/**
 * EPC SNMP Discovery API Routes
 * Receives discovered devices from remote EPC agents
 * NOTE: These routes do NOT require X-Tenant-ID header - they use device_code to find tenant
 */

const express = require('express');
const router = express.Router();
const { RemoteEPC } = require('../models/distributed-epc-schema');
const { NetworkEquipment } = require('../models/network');
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
        const { ip_address, sysDescr, sysObjectID, sysName, device_type, community } = device;
        
        if (!ip_address) {
          console.warn('[SNMP Discovery] Skipping device without IP address');
          continue;
        }
        
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
        
        // Update or create device record
        const deviceData = {
          tenantId: epc.tenant_id,
          name: sysName || device_type || `SNMP-${ip_address}`,
          type: device_type === 'mikrotik' ? 'router' : 
                device_type === 'cisco' ? 'switch' : 
                device_type === 'huawei' ? 'router' : 'other',
          manufacturer: device_type === 'mikrotik' ? 'Mikrotik' :
                       device_type === 'cisco' ? 'Cisco' :
                       device_type === 'huawei' ? 'Huawei' : 'Generic',
          model: sysDescr || 'Unknown',
          serialNumber: ip_address,
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
            device_type: device_type,
            snmp_community: community || 'public',
            snmp_version: 'v2c',
            snmp_enabled: true,
            discovered_by_epc: epc.epc_id,
            discovered_at: new Date().toISOString(),
            discovery_source: 'epc_snmp_agent',
            last_discovered: new Date().toISOString()
          }),
          updatedAt: new Date()
        };
        
        if (existingDevice) {
          // Update existing device
          await NetworkEquipment.updateOne(
            { _id: existingDevice._id },
            { $set: deviceData }
          );
          console.log(`[SNMP Discovery] Updated device: ${ip_address}`);
        } else {
          // Create new device
          deviceData.createdAt = new Date();
          const newDevice = new NetworkEquipment(deviceData);
          await newDevice.save();
          console.log(`[SNMP Discovery] Created device: ${ip_address}`);
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

module.exports = router;

