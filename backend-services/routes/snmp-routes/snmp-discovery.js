const express = require('express');
const router = express.Router();
const { UnifiedSite, UnifiedCPE, NetworkEquipment, HardwareDeployment } = require('../../models/network');
const { SNMPMetrics } = require('../../models/snmp-metrics-schema');
const { formatSNMPDevice, isFakeDevice } = require('./snmp-helpers');

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

// GET /api/snmp/discovered - Get discovered SNMP devices from EPC agents
router.get('/discovered', async (req, res) => {
  try {
    console.log(`🔍 [SNMP API] Fetching discovered SNMP devices for tenant: ${req.tenantId}`);
    
    // Get devices that were discovered by EPC agents
    // Notes can be stored as JSON string or object, and we need to search for discovery metadata
    // Explicitly include siteId and inventoryId - with lean(), all fields should be included by default
    // But we'll be explicit to ensure siteId is returned
    const allEquipment = await NetworkEquipment.find({
      tenantId: req.tenantId,
      status: 'active'
    }).lean();
    
    // Filter devices that have discovery metadata in notes
    const discoveredEquipment = allEquipment.filter(equipment => {
      if (!equipment.notes) return false;
      
      // Try to parse as JSON first
      let notes = null;
      try {
        notes = typeof equipment.notes === 'string' ? JSON.parse(equipment.notes) : equipment.notes;
      } catch (e) {
        // If not JSON, check as plain string
        const notesStr = String(equipment.notes).toLowerCase();
        return notesStr.includes('discovered_by_epc') || 
               notesStr.includes('discovery_source') || 
               notesStr.includes('discovered_at') ||
               notesStr.includes('epc_snmp_agent');
      }
      
      // Check if it's an object with discovery metadata
      if (notes && typeof notes === 'object') {
        return notes.discovered_by_epc || 
               notes.discovery_source === 'epc_snmp_agent' ||
               notes.discovered_at ||
               notes.last_discovered;
      }
      
      return false;
    });
    
    console.log(`📡 Found ${discoveredEquipment.length} discovered SNMP equipment items`);
    
    // Get deployments to check deployment status
    let deployments = [];
    try {
      if (HardwareDeployment) {
        deployments = await HardwareDeployment.find({
          tenantId: req.tenantId,
          status: 'deployed'
        }).lean();
      }
    } catch (deploymentError) {
      console.warn('[SNMP API] HardwareDeployment query failed, skipping deployment check:', deploymentError.message);
    }
    
    const devices = [];
    
    discoveredEquipment.forEach(equipment => {
      // Parse notes to get discovery info
      let notes = {};
      if (equipment.notes) {
        try {
          notes = typeof equipment.notes === 'string' ? JSON.parse(equipment.notes) : equipment.notes;
        } catch (e) {
          notes = {};
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
      
      // Check if device is deployed (has siteId or matches a deployment)
      const isDeployed = !!siteIdString || deployments.some(d => {
        const deviceIP = notes.management_ip || equipment.serialNumber;
        return (d.config?.management_ip === deviceIP || d.name === equipment.name);
      });
      
      // Get enable_graphs flag from notes (default true for deployed devices)
      const enableGraphs = isDeployed && (notes.enable_graphs !== false);
      
      const device = {
        id: equipment._id.toString(),
        name: equipment.name || notes.sysName || notes.management_ip || 'Unknown Device',
        type: 'snmp',
        deviceType: equipment.type || notes.device_type || 'other',
        status: equipment.status === 'active' ? 'online' : 'offline',
        manufacturer: notes.manufacturer_detected_via_oui || 
                      notes.oui_detection?.manufacturer || 
                      equipment.manufacturer || 
                      'Generic',
        model: equipment.model || notes.sysDescr || 'Unknown',
        serialNumber: equipment.serialNumber || notes.management_ip || equipment._id.toString(),
        siteId: siteIdString,
        isDeployed: !!isDeployed,
        enableGraphs: enableGraphs,
        location: {
          coordinates: {
            latitude: equipment.location?.latitude || equipment.location?.coordinates?.latitude || 0,
            longitude: equipment.location?.longitude || equipment.location?.coordinates?.longitude || 0
          },
          address: equipment.location?.address || 'Unknown Location'
        },
        ipAddress: notes.management_ip || equipment.serialNumber || 'Unknown',
        snmp: {
          enabled: true,
          version: notes.snmp_version || 'v2c',
          community: notes.snmp_community || 'public',
          port: notes.snmp_port || 161
        },
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
    
    // Count deployed devices for debugging
    const deployedCount = devices.filter(d => d.isDeployed).length;
    const withSiteIdCount = devices.filter(d => d.siteId).length;
    console.log(`📊 Returning ${devices.length} discovered SNMP devices for tenant ${req.tenantId} (${deployedCount} deployed, ${withSiteIdCount} with siteId)`);
    
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
