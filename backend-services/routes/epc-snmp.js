/**
 * EPC SNMP Discovery API Routes
 * Receives discovered devices from remote EPC agents
 * NOTE: These routes do NOT require X-Tenant-ID header - they use device_code to find tenant
 */

const express = require('express');
const router = express.Router();
const { RemoteEPC } = require('../models/distributed-epc-schema');
const { NetworkEquipment } = require('../models/network');

// Try to load OUI lookup utility for Mikrotik detection
let ouiLookup = null;
try {
  ouiLookup = require('../utils/oui-lookup');
} catch (e) {
  console.warn('[EPC SNMP] OUI lookup utility not available, OUI-based detection disabled');
}
const { SNMPMetrics } = require('../models/snmp-metrics-schema');

/**
 * POST /api/epc/snmp/discovered
 * Receive SNMP discovered devices from remote EPC
 * Called by epc-snmp-discovery.sh script
 * NOTE: No tenant ID header required - uses device_code to find tenant from EPC lookup
 * This endpoint bypasses the tenant requirement middleware since it gets tenant_id from EPC
 */
router.post('/discovered', async (req, res, next) => {
  // Bypass tenant requirement - we'll get it from EPC lookup
  // Set a dummy tenant to bypass middleware, will be replaced by actual lookup
  req.tenantId = 'pending'; 
  next();
}, async (req, res) => {
  try {
    const device_code = req.body.device_code || req.headers['x-device-code'];
    const { discovered_devices } = req.body;
    
    console.log(`[SNMP Discovery] Received request from device_code: ${device_code}`);
    
    if (!device_code) {
      return res.status(400).json({ error: 'device_code is required' });
    }
    
    if (!Array.isArray(discovered_devices)) {
      return res.status(400).json({ error: 'discovered_devices must be an array' });
    }
    
    console.log(`[SNMP Discovery] Receiving ${discovered_devices.length} devices from EPC ${device_code}`);
    
    // Find the EPC
    const epc = await RemoteEPC.findOne({ 
      device_code: device_code.toUpperCase() 
    }).lean();
    
    if (!epc) {
      return res.status(404).json({ 
        error: 'EPC not found', 
        message: `No EPC found with device code ${device_code}` 
      });
    }
    
    const processedDevices = [];
    
        // Process each discovered device
    for (const device of discovered_devices) {
      try {
        const { ip_address, sysDescr, sysObjectID, sysName, device_type, community, 
                oid_walk, interfaces, arp_table, routes, ip_addresses, neighbors,
                manufacturer_from_oui, oui_detection } = device;
        
        if (!ip_address) {
          console.warn('[SNMP Discovery] Skipping device without IP address');
          continue;
        }
        
        // Extract CDP/LLDP status flags - check multiple possible locations
        const cdp_lldp_status = device.cdp_lldp_status || neighbors?.cdp_lldp_status || null;
        const cdp_enabled = cdp_lldp_status?.cdp_enabled || neighbors?.cdp_enabled || device.cdp_enabled || false;
        const lldp_enabled = cdp_lldp_status?.lldp_enabled || neighbors?.lldp_enabled || device.lldp_enabled || false;
        const cdp_failed = cdp_lldp_status?.cdp_failed || neighbors?.cdp_failed || device.cdp_failed || false;
        const lldp_failed = cdp_lldp_status?.lldp_failed || neighbors?.lldp_failed || device.lldp_failed || false;
        const cdp_error = cdp_lldp_status?.cdp_error || neighbors?.cdp_error || device.cdp_error || null;
        const lldp_error = cdp_lldp_status?.lldp_error || neighbors?.lldp_error || device.lldp_error || null;
        
        // Get actual neighbors array (could be nested in result object)
        const neighborsArray = Array.isArray(neighbors) ? neighbors : (neighbors?.neighbors || []);
        
        // Check if device is Mikrotik from neighbors (CDP/LLDP discovery)
        const isMikrotikFromNeighbor = neighborsArray && neighborsArray.some(n => 
          n.device_type === 'mikrotik' ||
          (n.system_name && n.system_name.toLowerCase().includes('mikrotik')) ||
          (n.system_description && n.system_description.toLowerCase().includes('mikrotik')) ||
          (n.platform && n.platform.toLowerCase().includes('mikrotik')) ||
          (n.device_id && n.device_id.toLowerCase().includes('mikrotik'))
        );
        
        // Check for Mikrotik via OUI lookup from ARP table
        let isMikrotikFromOUI = false;
        if (ouiLookup && arp_table && Array.isArray(arp_table)) {
          const mikrotikFromARP = ouiLookup.detectMikrotikFromArpTable(arp_table);
          if (mikrotikFromARP && mikrotikFromARP.length > 0) {
            isMikrotikFromOUI = true;
            console.log(`[SNMP Discovery] Detected Mikrotik device ${ip_address} via OUI lookup from ARP table`);
          }
        }
        
        // Also check interfaces for Mikrotik MAC addresses
        if (!isMikrotikFromOUI && ouiLookup && interfaces && Array.isArray(interfaces)) {
          for (const iface of interfaces) {
            const mac = iface.mac_address || iface.phys_address;
            if (mac && ouiLookup.isMikrotikOUI(mac)) {
              isMikrotikFromOUI = true;
              console.log(`[SNMP Discovery] Detected Mikrotik device ${ip_address} via OUI lookup from interface MAC: ${mac}`);
              break;
            }
          }
        }
        
        // Detect manufacturer via OUI lookup from ARP table
        let manufacturerFromOUI = null;
        if (ouiLookup && arp_table && Array.isArray(arp_table)) {
          const manufacturersFromARP = ouiLookup.detectManufacturersFromArpTable(arp_table);
          if (manufacturersFromARP && manufacturersFromARP.length > 0) {
            // Use the most common manufacturer or the first one found
            manufacturerFromOUI = manufacturersFromARP[0].manufacturer;
            console.log(`[SNMP Discovery] Detected manufacturer ${manufacturerFromOUI} for device ${ip_address} via OUI lookup from ARP table`);
          }
        }
        
        // Also check interfaces for manufacturer detection
        if (!manufacturerFromOUI && ouiLookup && interfaces && Array.isArray(interfaces)) {
          const manufacturerInfo = ouiLookup.detectManufacturerFromInterfaces(interfaces);
          if (manufacturerInfo && manufacturerInfo.manufacturer) {
            manufacturerFromOUI = manufacturerInfo.manufacturer;
            console.log(`[SNMP Discovery] Detected manufacturer ${manufacturerFromOUI} for device ${ip_address} via OUI lookup from interface MAC`);
          }
        }
        
        // Override device_type if detected as Mikrotik from neighbors or OUI
        const detected_device_type = (isMikrotikFromNeighbor || isMikrotikFromOUI) ? 'mikrotik' : device_type;
        
        // Check if device already exists
        const existingDevice = await NetworkEquipment.findOne({
          tenantId: epc.tenant_id,
          $or: [
            { serialNumber: ip_address },
            { 'notes': { $regex: `"management_ip":\\s*"${ip_address}"` } }
          ]
        });
        
        // Parse device info from notes if existing
        let notes = {};
        if (existingDevice && typeof existingDevice.notes === 'string') {
          try {
            notes = JSON.parse(existingDevice.notes);
          } catch (e) {
            notes = {};
          }
        } else if (existingDevice && typeof existingDevice.notes === 'object') {
          notes = existingDevice.notes;
        }
        
        // Extract Mikrotik-specific info if present
        const mikrotik_info = device.mikrotik || {};
        const mikrotik_identity = mikrotik_info.identity || sysName || null;
        const mikrotik_version = mikrotik_info.routerOS_version || null;
        const mikrotik_serial = mikrotik_info.serial_number || null;
        const mikrotik_board = mikrotik_info.board_name || null;
        
        // Handle ping-only devices (no SNMP)
        const is_ping_only = device.discovered_via === 'ping_only' || device.snmp_enabled === false;
        
        // Determine device name and model based on Mikrotik info if available
        let device_name = sysName || detected_device_type || (is_ping_only ? `Device-${ip_address}` : `SNMP-${ip_address}`);
        let device_model = sysDescr || (is_ping_only ? 'Generic Network Device' : 'Unknown');
        let device_serial = ip_address;
        
        if (detected_device_type === 'mikrotik') {
          // Use Mikrotik identity as name if available
          device_name = mikrotik_identity || sysName || `Mikrotik-${ip_address}`;
          // Use board name as model if available, otherwise try to extract from sysDescr
          device_model = mikrotik_board || (sysDescr && sysDescr.length > 0 ? sysDescr.split(' ').slice(0, 2).join(' ') : 'Mikrotik RouterOS') || 'Mikrotik RouterOS';
          // Use serial number if available
          device_serial = mikrotik_serial || ip_address;
        } else if (is_ping_only) {
          // For ping-only devices, use IP-based naming
          device_name = `Device-${ip_address}`;
          device_model = 'Network Device (SNMP not available)';
        } else if (sysDescr && sysDescr.length > 0) {
          // Try to extract better model info from sysDescr for non-Mikrotik devices
          // Common format: "Manufacturer Model Version" - try to get first 2-3 words
          const descrParts = sysDescr.trim().split(/\s+/);
          if (descrParts.length >= 2) {
            // Use first 2-3 words as model if it looks reasonable
            device_model = descrParts.slice(0, Math.min(3, descrParts.length)).join(' ');
          }
        }
        
        // Determine manufacturer - use OUI lookup result if available, otherwise fall back to existing logic
        let device_manufacturer = 'Generic';
        // Priority: 1) manufacturer_from_oui from discovery script, 2) manufacturerFromOUI from backend OUI lookup, 3) device_type-based detection
        if (manufacturer_from_oui) {
          device_manufacturer = manufacturer_from_oui;
          console.log(`[SNMP Discovery] Using manufacturer ${device_manufacturer} from discovery script OUI lookup for ${ip_address}`);
        } else if (manufacturerFromOUI) {
          device_manufacturer = manufacturerFromOUI;
        } else if (detected_device_type === 'mikrotik') {
          device_manufacturer = 'Mikrotik';
        } else if (detected_device_type === 'cisco' || detected_device_type === 'cisco_router') {
          device_manufacturer = 'Cisco';
        } else if (detected_device_type === 'huawei') {
          device_manufacturer = 'Huawei';
        } else if (detected_device_type === 'ubiquiti') {
          device_manufacturer = 'Ubiquiti Networks';
        } else if (is_ping_only) {
          device_manufacturer = 'Unknown';
        }
        
        // Update or create device record
        const deviceData = {
          tenantId: epc.tenant_id,
          name: device_name,
          type: detected_device_type === 'mikrotik' ? 'router' : 
                detected_device_type === 'switch' ? 'switch' :
                detected_device_type === 'router' ? 'router' :
                detected_device_type === 'access_point' ? 'radio' :
                detected_device_type === 'cisco' ? 'switch' : 
                detected_device_type === 'huawei' ? 'router' : 
                (is_ping_only ? 'other' : 'other'),
          manufacturer: device_manufacturer,
          model: device_model,
          serialNumber: device_serial,
          status: 'active',
          location: {
            latitude: epc.location?.coordinates?.latitude || epc.location?.latitude || 0,
            longitude: epc.location?.coordinates?.longitude || epc.location?.longitude || 0,
            address: epc.location?.address || 'Unknown'
          },
          notes: JSON.stringify({
            ...notes,
            management_ip: ip_address,
            sysDescr: sysDescr,
            sysObjectID: sysObjectID,
            sysName: sysName,
            device_type: detected_device_type,
            snmp_community: community || 'public',
            snmp_version: 'v2c',
            snmp_enabled: !is_ping_only,
            discovered_by_epc: epc.epc_id,
            discovered_at: new Date().toISOString(),
            discovery_source: device.discovered_via || 'epc_snmp_agent',
            last_discovered: new Date().toISOString(),
            // Manufacturer detection via OUI (use discovery script result if available, otherwise backend result)
            manufacturer_detected_via_oui: manufacturer_from_oui || manufacturerFromOUI || null,
            oui_detection: oui_detection || (manufacturerFromOUI ? {
              manufacturer: manufacturerFromOUI,
              detected_at: new Date().toISOString(),
              source: 'arp_table_or_interfaces'
            } : null),
            // Include OID walk data
            ...(oid_walk ? {
              oid_walk: {
                interfaces: oid_walk.interfaces || interfaces || [],
                arp_table: oid_walk.arp_table || arp_table || [],
                routes: oid_walk.routes || routes || [],
                ip_addresses: oid_walk.ip_addresses || ip_addresses || []
              }
            } : {
              oid_walk: {
                interfaces: interfaces || [],
                arp_table: arp_table || [],
                routes: routes || [],
                ip_addresses: ip_addresses || []
              }
            }),
            // Include neighbors (CDP/LLDP)
            ...(neighborsArray && neighborsArray.length > 0 ? { neighbors: neighborsArray } : {}),
            // Include CDP/LLDP status flags
            cdp_lldp_status: {
              cdp_enabled,
              lldp_enabled,
              cdp_failed,
              lldp_failed,
              cdp_error,
              lldp_error,
              cdp_working: cdp_enabled && !cdp_failed,
              lldp_working: lldp_enabled && !lldp_failed
            },
            // Include Mikrotik-specific info
            ...(detected_device_type === 'mikrotik' && Object.keys(mikrotik_info).length > 0 ? {
              mikrotik: {
                identity: mikrotik_identity,
                routerOS_version: mikrotik_version,
                serial_number: mikrotik_serial,
                board_name: mikrotik_board,
                cpu_load_percent: mikrotik_info.cpu_load_percent,
                temperature_celsius: mikrotik_info.temperature_celsius,
                uptime_ticks: mikrotik_info.uptime_ticks
              },
              mikrotik_api: {
                enabled: true,
                port: 8728,
                username: 'admin'
              }
            } : {}),
            // Include device type-specific flags
            enable_graphs: true, // Default to enabled
            graphs_enabled: ['interfaces', 'arp', 'routes', 'cpu', 'memory', 'throughput']
          }),
          updatedAt: new Date()
        };
        
        if (existingDevice) {
          // Update existing device - ensure all profiling fields are updated
          await NetworkEquipment.updateOne(
            { _id: existingDevice._id },
            { 
              $set: deviceData
            }
          );
          console.log(`[SNMP Discovery] Updated device: ${ip_address} (Manufacturer: ${deviceData.manufacturer}, Model: ${deviceData.model}, Type: ${deviceData.type})`);
        } else {
          // Create new device
          deviceData.createdAt = new Date();
          const newDevice = new NetworkEquipment(deviceData);
          await newDevice.save();
          console.log(`[SNMP Discovery] Created device: ${ip_address} (Manufacturer: ${deviceData.manufacturer}, Model: ${deviceData.model}, Type: ${deviceData.type})`);
        }
        
        processedDevices.push({
          ip_address,
          status: existingDevice ? 'updated' : 'created'
        });
        
      } catch (deviceError) {
        console.error(`[SNMP Discovery] Error processing device:`, deviceError);
        // Continue with next device
      }
    }
    
    console.log(`[SNMP Discovery] Processed ${processedDevices.length} devices for EPC ${epc.epc_id} (tenant: ${epc.tenant_id})`);
    
    res.json({
      success: true,
      epc_id: epc.epc_id,
      tenant_id: epc.tenant_id,
      processed: processedDevices.length,
      devices: processedDevices,
      message: `Successfully processed ${processedDevices.length} discovered devices`
    });
    
  } catch (error) {
    console.error('[SNMP Discovery] Error:', error);
    res.status(500).json({ 
      error: 'Failed to process discovered devices', 
      message: error.message 
    });
  }
});

/**
 * PUT /api/epc/snmp/devices/:id/graphs
 * Toggle graphs enabled/disabled for a device
 */
router.put('/devices/:id/graphs', async (req, res) => {
  try {
    const deviceId = req.params.id;
    const { enabled } = req.body;
    
    // Find device
    const device = await NetworkEquipment.findOne({ 
      _id: deviceId,
      tenantId: req.tenantId || req.headers['x-tenant-id']
    });
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Parse notes
    let notes = {};
    if (typeof device.notes === 'string') {
      try {
        notes = JSON.parse(device.notes);
      } catch (e) {
        notes = {};
      }
    } else if (typeof device.notes === 'object') {
      notes = device.notes;
    }
    
    // Update enable_graphs flag
    notes.enable_graphs = enabled !== false;
    
    // Update device
    await NetworkEquipment.updateOne(
      { _id: deviceId },
      { 
        $set: { 
          notes: JSON.stringify(notes),
          updatedAt: new Date()
        }
      }
    );
    
    res.json({ 
      success: true, 
      device_id: deviceId,
      enable_graphs: notes.enable_graphs
    });
  } catch (error) {
    console.error('[SNMP] Error toggling graphs:', error);
    res.status(500).json({ 
      error: 'Failed to toggle graphs', 
      message: error.message 
    });
  }
});

module.exports = router;

