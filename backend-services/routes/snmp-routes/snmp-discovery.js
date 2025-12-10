const express = require('express');
const router = express.Router();
const { UnifiedSite, UnifiedCPE, NetworkEquipment, HardwareDeployment } = require('../../models/network');
const { SNMPMetrics } = require('../../models/snmp-metrics-schema');
const { formatSNMPDevice, isFakeDevice } = require('./snmp-helpers');
const { InventoryItem } = require('../../models/inventory');

// Middleware to extract tenant ID
const requireTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-ID header is required' });
  }
  req.tenantId = tenantId;
  next();
};

router.use(requireTenant);

// GET /api/snmp/discovery - Start SNMP discovery on a subnet
router.get('/discovery', async (req, res) => {
  try {
    const { subnet = '192.168.1.0/24' } = req.query;
    console.log(`🔍 [SNMP API] Starting SNMP discovery on subnet: ${subnet}`);
    
    // In a real implementation, this would scan the network for SNMP devices
    // For now, return existing devices as "discovered"
    const existingDevices = await NetworkEquipment.find({
      tenantId: req.tenantId,
      status: 'active'
    }).lean();
    
    const discoveredDevices = existingDevices.map(device => ({
      id: device._id.toString(),
      name: device.name,
      ipAddress: '192.168.1.' + Math.floor(Math.random() * 254 + 1),
      snmpVersion: 'v2c',
      community: 'public',
      sysDescr: `${device.manufacturer} ${device.model}`,
      sysObjectID: '1.3.6.1.4.1.14988', // Mikrotik OID
      discovered: true,
      lastSeen: new Date().toISOString()
    }));
    
    res.json({
      subnet,
      discovered: discoveredDevices,
      total: discoveredDevices.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [SNMP API] Error during discovery:', error);
    res.status(500).json({ 
      error: 'Failed to discover devices', 
      message: error.message 
    });
  }
});

// GET /api/snmp/discovered - Get discovered SNMP devices from EPC agents AND all deployed devices
router.get('/discovered', async (req, res) => {
  try {
    console.log(`🔍 [SNMP API] Fetching discovered SNMP devices for tenant: ${req.tenantId}`);
    
    // Get ALL network equipment - include active, deployed, and any with discovery metadata
    // We want to show ALL devices that could be monitored, not just active ones
    const allEquipment = await NetworkEquipment.find({
      tenantId: req.tenantId,
      // Include multiple statuses - active, deployed, and any device with discovery metadata
      $or: [
        { status: 'active' },
        { status: 'deployed' },
        { status: { $exists: false } }, // Devices without status field
        // Also include devices with discovery metadata regardless of status
        { 'notes': { $regex: /discovered_by_epc|discovery_source|discovered_at|epc_snmp_agent/i } }
      ]
    }).lean();
    
    console.log(`🔍 [SNMP API] Query returned ${allEquipment.length} total NetworkEquipment records for tenant ${req.tenantId}`);
    
    // Separate into discovered devices and deployed devices
    const discoveredEquipment = [];
    const deployedEquipment = [];
    
    allEquipment.forEach(equipment => {
      // Check if device is deployed (has siteId - means it's from deploy module or has been deployed)
      const hasSiteId = !!equipment.siteId;
      
      // Check if device has discovery metadata or SNMP-related fields
      let hasDiscoveryMetadata = false;
      let hasSNMPMetadata = false;
      
      if (equipment.notes) {
        try {
          const notes = typeof equipment.notes === 'string' ? JSON.parse(equipment.notes) : equipment.notes;
          if (notes && typeof notes === 'object') {
            hasDiscoveryMetadata = !!(notes.discovered_by_epc || 
                                     notes.discovery_source === 'epc_snmp_agent' ||
                                     notes.discovered_at ||
                                     notes.last_discovered);
            // Also check for SNMP metadata (management_ip, snmp_community, etc.)
            hasSNMPMetadata = !!(notes.management_ip || 
                                notes.snmp_community || 
                                notes.snmp_version ||
                                notes.sysDescr ||
                                notes.sysName);
          } else {
            const notesStr = String(equipment.notes).toLowerCase();
            hasDiscoveryMetadata = notesStr.includes('discovered_by_epc') || 
                                   notesStr.includes('discovery_source') || 
                                   notesStr.includes('discovered_at') ||
                                   notesStr.includes('epc_snmp_agent');
            hasSNMPMetadata = notesStr.includes('management_ip') || 
                             notesStr.includes('snmp_community') ||
                             notesStr.includes('sysdescr') ||
                             notesStr.includes('sysname');
          }
        } catch (e) {
          const notesStr = String(equipment.notes).toLowerCase();
          hasDiscoveryMetadata = notesStr.includes('discovered_by_epc') || 
                                 notesStr.includes('discovery_source') || 
                                 notesStr.includes('discovered_at') ||
                                 notesStr.includes('epc_snmp_agent');
          hasSNMPMetadata = notesStr.includes('management_ip') || 
                           notesStr.includes('snmp_community') ||
                           notesStr.includes('sysdescr') ||
                           notesStr.includes('sysname');
        }
      }
      
      // Include if:
      // 1. Has discovery metadata (discovered by EPC agent), OR
      // 2. Has SNMP metadata (looks like an SNMP device), OR
      // 3. Has siteId (deployed device), OR
      // 4. Has an IP address in serialNumber (often used for discovered devices)
      const hasIPInSerial = equipment.serialNumber && /^\d+\.\d+\.\d+\.\d+$/.test(String(equipment.serialNumber));
      
      if (hasDiscoveryMetadata || hasSNMPMetadata || hasSiteId || hasIPInSerial) {
        if (hasDiscoveryMetadata || hasSNMPMetadata || hasIPInSerial) {
          discoveredEquipment.push(equipment);
        } else if (hasSiteId) {
          deployedEquipment.push(equipment);
        }
      }
    });
    
    console.log(`📡 Found ${discoveredEquipment.length} discovered SNMP equipment items`);
    console.log(`📦 Found ${deployedEquipment.length} deployed equipment items from deploy module`);
    
    // Also get deployed InventoryItem records that should appear as devices
    let deployedInventoryItems = [];
    try {
      if (InventoryItem) {
        deployedInventoryItems = await InventoryItem.find({
          tenantId: req.tenantId,
          status: 'deployed',
          // Only include items with IP addresses or site associations
          $or: [
            { ipAddress: { $exists: true, $ne: null, $ne: '' } },
            { 'technicalSpecs.ipAddress': { $exists: true, $ne: null, $ne: '' } },
            { 'currentLocation.siteId': { $exists: true, $ne: null } },
            { 'modules.coverageMap.siteId': { $exists: true, $ne: null } }
          ]
        }).lean();
        
        console.log(`📦 Found ${deployedInventoryItems.length} deployed inventory items that should appear as devices`);
      }
    } catch (inventoryError) {
      console.warn('[SNMP API] InventoryItem query failed, skipping inventory check:', inventoryError.message);
    }
    
    // Also get HardwareDeployment records that should appear as devices
    let hardwareDeployments = [];
    try {
      if (HardwareDeployment) {
        hardwareDeployments = await HardwareDeployment.find({
          tenantId: req.tenantId,
          status: 'deployed'
        }).lean();
        
        console.log(`🔧 Found ${hardwareDeployments.length} hardware deployments that should appear as devices`);
      }
    } catch (deploymentError) {
      console.warn('[SNMP API] HardwareDeployment query failed, skipping deployment check:', deploymentError.message);
    }
    
    // Combine discovered and deployed equipment (deployed will have initial "unknown" status)
    const allDevicesToProcess = [...discoveredEquipment, ...deployedEquipment];
    
    // Collect all siteIds from NetworkEquipment, InventoryItem, and HardwareDeployment
    const allSiteIds = new Set();
    
    // From NetworkEquipment
    allDevicesToProcess.forEach(eq => {
      const siteId = eq.siteId;
      if (siteId) {
        const siteIdStr = typeof siteId === 'object' ? (siteId._id || siteId).toString() : String(siteId);
        allSiteIds.add(siteIdStr);
      }
    });
    
    // From InventoryItem
    deployedInventoryItems.forEach(item => {
      const siteId = item.currentLocation?.siteId || item.modules?.coverageMap?.siteId;
      if (siteId) {
        allSiteIds.add(String(siteId));
      }
    });
    
    // From HardwareDeployment
    hardwareDeployments.forEach(deployment => {
      const siteId = deployment.siteId;
      if (siteId) {
        const siteIdStr = typeof siteId === 'object' ? (siteId._id || siteId).toString() : String(siteId);
        allSiteIds.add(siteIdStr);
      }
    });
    
    // Get all sites to look up locations for devices with siteId
    const sitesMap = new Map();
    if (allSiteIds.size > 0) {
      const sites = await UnifiedSite.find({
        _id: { $in: Array.from(allSiteIds) },
        tenantId: req.tenantId
      }).select('_id name location').lean();
      
      sites.forEach(site => {
        sitesMap.set(String(site._id), site);
      });
    }
    
    const devices = [];
    
    // Process all devices (both discovered and deployed)
    allDevicesToProcess.forEach(equipment => {
      // Parse notes to get discovery info
      let notes = {};
      if (equipment.notes) {
        try {
          notes = typeof equipment.notes === 'string' ? JSON.parse(equipment.notes) : equipment.notes;
        } catch (e) {
          notes = {};
        }
      }
      
      // Check if this device has discovery metadata (determined in the loop above)
      let hasDiscoveryMetadata = false;
      if (equipment.notes) {
        try {
          const parsedNotes = typeof equipment.notes === 'string' ? JSON.parse(equipment.notes) : equipment.notes;
          if (parsedNotes && typeof parsedNotes === 'object') {
            hasDiscoveryMetadata = !!(parsedNotes.discovered_by_epc || 
                                     parsedNotes.discovery_source === 'epc_snmp_agent' ||
                                     parsedNotes.discovered_at ||
                                     parsedNotes.last_discovered);
          } else {
            const notesStr = String(equipment.notes).toLowerCase();
            hasDiscoveryMetadata = notesStr.includes('discovered_by_epc') || 
                                   notesStr.includes('discovery_source') || 
                                   notesStr.includes('discovered_at') ||
                                   notesStr.includes('epc_snmp_agent');
          }
        } catch (e) {
          const notesStr = String(equipment.notes).toLowerCase();
          hasDiscoveryMetadata = notesStr.includes('discovered_by_epc') || 
                                 notesStr.includes('discovery_source') || 
                                 notesStr.includes('discovered_at') ||
                                 notesStr.includes('epc_snmp_agent');
        }
      }
      
      // Filter out fake devices
      if (isFakeDevice(equipment.name)) {
        console.log(`  ⚠️ Filtering out fake device: ${equipment.name}`);
        return;
      }
      
      // Convert siteId to string if it exists (ObjectId -> string)
      // Handle both ObjectId objects and string representations
      let siteIdString = null;
      if (equipment.siteId) {
        if (equipment.siteId.toString && typeof equipment.siteId.toString === 'function') {
          siteIdString = equipment.siteId.toString();
        } else if (typeof equipment.siteId === 'string') {
          siteIdString = equipment.siteId;
        } else if (equipment.siteId._id) {
          // Might be populated object
          siteIdString = equipment.siteId._id.toString();
        } else {
          siteIdString = String(equipment.siteId);
        }
      }
      
      // Debug logging for devices with inventoryId (should have siteId)
      if (equipment.inventoryId || notes.inventory_id) {
        console.log(`🔍 [SNMP API] Device ${equipment.name || equipment._id}`, {
          deviceId: equipment._id?.toString(),
          siteId_raw: equipment.siteId,
          siteId_string: siteIdString,
          inventoryId: equipment.inventoryId || notes.inventory_id,
          siteId_type: typeof equipment.siteId,
          siteId_isObject: equipment.siteId?.constructor?.name,
          has_siteId_field: 'siteId' in equipment,
          equipment_keys: Object.keys(equipment).slice(0, 10) // First 10 keys
        });
      }
      
      // Check if device is deployed (has siteId or matches a hardware deployment)
      const isDeployed = !!siteIdString || hardwareDeployments.some(d => {
        const deviceIP = notes.management_ip || equipment.serialNumber;
        return (d.config?.management_ip === deviceIP || d.name === equipment.name);
      });
      
      // Get enable_graphs flag from notes (default true for deployed devices)
      const enableGraphs = isDeployed && (notes.enable_graphs !== false);
      
      // Determine initial status:
      // - If device has monitoring data (ping/SNMP), use that status
      // - If device is deployed but has no monitoring data yet, use "unknown" (grey)
      // - Otherwise use device status
      let deviceStatus = 'unknown'; // Default to unknown (grey) for new deployed devices
      
      // Check if device has monitoring data (ping results or SNMP metrics)
      const hasMonitoringData = notes.last_ping_result || 
                                notes.last_snmp_poll || 
                                notes.monitoring_status ||
                                equipment.metrics;
      
      if (hasMonitoringData) {
        // Use monitoring status if available
        deviceStatus = notes.monitoring_status || 
                      (notes.last_ping_result === 'success' ? 'online' : 
                       notes.last_ping_result === 'failed' ? 'offline' : 
                       equipment.status === 'active' ? 'online' : 'offline');
      } else if (isDeployed) {
        // Deployed but no monitoring data yet - show as unknown (grey)
        deviceStatus = 'unknown';
      } else {
        // Not deployed or discovered - use device status
        deviceStatus = equipment.status === 'active' ? 'online' : 'offline';
      }
      
      const device = {
        id: equipment._id.toString(),
        name: equipment.name || notes.sysName || notes.management_ip || 'Unknown Device',
        type: 'snmp',
        deviceType: equipment.type || notes.device_type || 'other',
        status: deviceStatus,
        manufacturer: notes.manufacturer_detected_via_oui || 
                      notes.oui_detection?.manufacturer || 
                      equipment.manufacturer || 
                      'Generic',
        model: equipment.model || notes.sysDescr || 'Unknown',
        serialNumber: equipment.serialNumber || notes.management_ip || equipment._id.toString(),
        siteId: siteIdString,
        isDeployed: !!isDeployed,
        enableGraphs: enableGraphs,
        location: (() => {
          // First try device's own location
          let lat = equipment.location?.latitude || equipment.location?.coordinates?.latitude;
          let lon = equipment.location?.longitude || equipment.location?.coordinates?.longitude;
          let address = equipment.location?.address;
          
          // If device has siteId but no valid coordinates, get location from site
          if (siteIdString && (!lat || lat === 0) && sitesMap.has(siteIdString)) {
            const site = sitesMap.get(siteIdString);
            if (site && site.location) {
              lat = site.location.latitude || site.location.coordinates?.latitude || 0;
              lon = site.location.longitude || site.location.coordinates?.longitude || 0;
              address = site.location.address || site.name || 'Unknown Location';
            }
          }
          
          return {
            coordinates: {
              latitude: lat || 0,
              longitude: lon || 0
            },
            address: address || 'Unknown Location'
          };
        })(),
        ipAddress: notes.management_ip || notes.ip_address || notes.ipAddress || equipment.serialNumber || 'Unknown',
        snmp: {
          enabled: !!(notes.snmp_community || notes.snmp_version || notes.snmp_enabled),
          version: notes.snmp_version || 'v2c',
          community: notes.snmp_community || 'public',
          port: notes.snmp_port || 161
        },
        // Flag to indicate if device has monitoring configured
        hasMonitoringConfigured: !!(notes.snmp_community || notes.management_ip || equipment.metrics),
        // Flag to indicate if this is a deployed device (from deploy module)
        isDeployedDevice: isDeployed && !hasDiscoveryMetadata,
        discoveredBy: notes.discovered_by_epc || 'Unknown EPC',
        discoveredAt: notes.discovered_at || equipment.createdAt || new Date().toISOString(),
        lastSeen: notes.last_discovered || equipment.updatedAt || new Date().toISOString(),
        sysDescr: notes.sysDescr || notes.sysName || null,
        sysObjectID: notes.sysObjectID || null,
        // Include OID walk data for graphing
        oidWalk: notes.oid_walk || null,
        interfaces: notes.oid_walk?.interfaces || null,
        arpTable: notes.oid_walk?.arp_table || null,
        routes: notes.oid_walk?.routes || null,
        createdAt: equipment.createdAt,
        updatedAt: equipment.updatedAt
      };
      
      devices.push(device);
    });
    
    // Count devices by status for debugging
    const deployedCount = devices.filter(d => d.isDeployed).length;
    const withSiteIdCount = devices.filter(d => d.siteId).length;
    const unknownStatusCount = devices.filter(d => d.status === 'unknown').length;
    const onlineStatusCount = devices.filter(d => d.status === 'online').length;
    const offlineStatusCount = devices.filter(d => d.status === 'offline').length;
    console.log(`📊 Returning ${devices.length} devices for tenant ${req.tenantId}:`);
    console.log(`   - ${deployedCount} deployed (${withSiteIdCount} with siteId)`);
    console.log(`   - Status: ${unknownStatusCount} unknown (grey), ${onlineStatusCount} online, ${offlineStatusCount} offline`);
    
    res.json({
      devices,
      total: devices.length,
      tenant: req.tenantId
    });
  } catch (error) {
    console.error('❌ [SNMP API] Error fetching discovered devices:', error);
    res.status(500).json({
      error: 'Failed to fetch discovered devices',
      message: error.message,
      devices: []
    });
  }
});

module.exports = router;
