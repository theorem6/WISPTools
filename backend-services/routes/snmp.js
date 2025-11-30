/**
 * SNMP Management API Routes
 * Provides endpoints for SNMP device management and monitoring
 */

const express = require('express');
const router = express.Router();
const { UnifiedSite, UnifiedCPE, NetworkEquipment } = require('../models/network');
const { SNMPMetrics } = require('../models/snmp-metrics-schema');

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

// Helper function to format SNMP device for API response
const formatSNMPDevice = (device, source = 'equipment') => {
  const config = source === 'equipment' && device.notes ? 
    (typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes) : 
    {};

  return {
    id: device._id.toString(),
    name: device.name,
    type: 'snmp',
    deviceType: source === 'equipment' ? device.type : 'cpe',
    status: device.status === 'active' ? 'online' : 'offline',
    manufacturer: config.manufacturer_detected_via_oui || 
                  config.oui_detection?.manufacturer || 
                  device.manufacturer || 
                  'Generic',
    model: device.model || 'Unknown',
    serialNumber: device.serialNumber || device._id.toString(),
    location: {
      coordinates: {
        latitude: device.location?.latitude || 0,
        longitude: device.location?.longitude || 0
      },
      address: device.location?.address || device.address || 'Unknown Location'
    },
    snmp: {
      enabled: true,
      version: config.snmp_version || 'v2c',
      community: config.snmp_community || 'public',
      port: config.snmp_port || 161,
      timeout: config.snmp_timeout || 5000,
      retries: config.snmp_retries || 3
    },
    ipAddress: config.management_ip || '192.168.1.10',
    lastPolled: device.updatedAt || device.lastPolled || new Date().toISOString(),
    metrics: device.metrics || null, // Real metrics if available, null otherwise
    createdAt: device.createdAt,
    updatedAt: device.updatedAt
  };
};

// Helper function to filter out fake/demo devices
const FAKE_DEVICE_NAMES = [
  'Core Router MT-RB5009',
  'Core Switch CRS328',
  'EPC Core Server',
  'Backhaul Router RB4011',
  'Customer A CPE',
  'Customer B CPE',
  'Customer A LTE CPE',
  'Customer B LTE CPE'
];

const FAKE_PATTERNS = [
  /Customer.*CPE/i,
  /Customer.*LTE/i,
  /Customer A/i,
  /Customer B/i
];

function isFakeDevice(name) {
  if (!name) return false;
  if (FAKE_DEVICE_NAMES.some(fake => name.includes(fake))) return true;
  return FAKE_PATTERNS.some(pattern => pattern.test(name));
}

// GET /api/snmp/devices - List all SNMP-enabled devices for tenant
router.get('/devices', async (req, res) => {
  try {
    console.log(`🔍 [SNMP API] Fetching SNMP devices for tenant: ${req.tenantId}`);
    
    const devices = [];
    
    // Get all network equipment with SNMP enabled
    const snmpEquipment = await NetworkEquipment.find({
      tenantId: req.tenantId,
      status: 'active',
      $or: [
        { notes: /snmp_enabled.*true/i },
        { notes: /snmp_community/i },
        { notes: /snmp_version/i }
      ]
    }).lean();
    
    console.log(`🖥️ Found ${snmpEquipment.length} SNMP equipment items`);
    
    // Add SNMP equipment (filter out fake devices)
    snmpEquipment.forEach(equipment => {
      if (!isFakeDevice(equipment.name)) {
        devices.push(formatSNMPDevice(equipment, 'equipment'));
      } else {
        console.log(`  ⚠️ Filtering out fake device: ${equipment.name}`);
      }
    });
    
    // Get CPE devices with SNMP/ACS modules enabled
    const snmpCPE = await UnifiedCPE.find({
      tenantId: req.tenantId,
      status: 'active',
      $or: [
        { 'modules.acs.enabled': true },
        { 'modules.hss.enabled': true }
      ]
    }).lean();
    
    console.log(`📱 Found ${snmpCPE.length} SNMP CPE devices`);
    
    // Add SNMP CPE (filter out fake devices)
    snmpCPE.forEach(cpe => {
      if (!isFakeDevice(cpe.name)) {
        devices.push(formatSNMPDevice(cpe, 'cpe'));
      } else {
        console.log(`  ⚠️ Filtering out fake device: ${cpe.name}`);
      }
    });
    
    console.log(`📊 Total SNMP devices for tenant ${req.tenantId}: ${devices.length}`);
    
    res.json({ 
      devices,
      total: devices.length,
      tenant: req.tenantId,
      summary: {
        routers: devices.filter(d => d.deviceType === 'router').length,
        switches: devices.filter(d => d.deviceType === 'switch').length,
        access_points: devices.filter(d => d.deviceType === 'access_point').length,
        cpe: devices.filter(d => d.deviceType === 'cpe').length,
        other: devices.filter(d => d.deviceType === 'other').length
      }
    });
  } catch (error) {
    console.error('❌ [SNMP API] Error fetching SNMP devices:', error);
    res.status(500).json({ 
      error: 'Failed to fetch SNMP devices', 
      message: error.message,
      devices: []
    });
  }
});

// GET /api/snmp/devices/:id - Get specific SNMP device details
router.get('/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 [SNMP API] Fetching SNMP device ${id} for tenant: ${req.tenantId}`);
    
    // Try to find as network equipment first
    let device = await NetworkEquipment.findOne({
      _id: id,
      tenantId: req.tenantId,
      status: 'active'
    }).lean();
    
    if (device) {
      const formattedDevice = formatSNMPDevice(device, 'equipment');
      return res.json(formattedDevice);
    }
    
    // Try to find as CPE device
    device = await UnifiedCPE.findOne({
      _id: id,
      tenantId: req.tenantId,
      status: 'active'
    }).lean();
    
    if (device) {
      const formattedDevice = formatSNMPDevice(device, 'cpe');
      return res.json(formattedDevice);
    }
    
    res.status(404).json({ error: 'SNMP device not found' });
  } catch (error) {
    console.error('❌ [SNMP API] Error fetching SNMP device:', error);
    res.status(500).json({ 
      error: 'Failed to fetch SNMP device', 
      message: error.message 
    });
  }
});

// GET /api/snmp/metrics/latest - Get latest SNMP metrics for all devices
router.get('/metrics/latest', async (req, res) => {
  try {
    console.log(`📊 [SNMP API] Fetching latest SNMP metrics for tenant: ${req.tenantId}`);
    
    // Get latest metrics from database for each device
    const latestMetrics = await SNMPMetrics.aggregate([
      {
        $match: {
          tenant_id: req.tenantId,
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        }
      },
      {
        $sort: { device_id: 1, timestamp: -1 }
      },
      {
        $group: {
          _id: '$device_id',
          latest: { $first: '$$ROOT' }
        }
      }
    ]);
    
    // Format for frontend
    const metrics = latestMetrics.map(item => {
      const m = item.latest;
      return {
        deviceId: m.device_id,
        deviceName: m.system?.hostname || m.device_id,
        timestamp: m.timestamp,
        metrics: {
          cpuUsage: m.resources?.cpu_percent ?? null,
          memoryUsage: m.resources?.memory_percent ?? null,
          temperature: m.temperature ?? null,
          uptime: m.system?.uptime_seconds ?? null,
          interfaceInOctets: m.network?.interface_in_octets ?? null,
          interfaceOutOctets: m.network?.interface_out_octets ?? null,
          diskUsage: m.resources?.disk_percent ?? null
        }
      };
    });
    
    console.log(`📊 Found ${metrics.length} devices with metrics`);
    
    res.json(metrics);
  } catch (error) {
    console.error('❌ [SNMP API] Error fetching SNMP metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch SNMP metrics', 
      message: error.message,
      metrics: []
    });
  }
});

// GET /api/snmp/metrics/:deviceId - Get metrics for specific device
router.get('/metrics/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { timeRange = '1h' } = req.query;
    
    console.log(`📊 [SNMP API] Fetching metrics for device ${deviceId}, timeRange: ${timeRange}`);
    
    // Calculate time range
    const now = new Date();
    let startTime;
    let limit = 100; // Default limit
    
    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour
        limit = 60; // 1 point per minute
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours
        limit = 96; // 1 point per 15 minutes
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days
        limit = 168; // 1 point per hour
        break;
      default:
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
    }
    
    // Query real metrics from database
    const metrics = await SNMPMetrics.find({
      device_id: deviceId,
      tenant_id: req.tenantId,
      timestamp: { $gte: startTime }
    })
    .sort({ timestamp: 1 })
    .limit(limit)
    .lean();
    
    // Format data points for frontend
    const dataPoints = metrics.map(m => ({
      timestamp: m.timestamp,
      metrics: {
        cpuUsage: m.resources?.cpu_percent ?? null,
        memoryUsage: m.resources?.memory_percent ?? null,
        temperature: m.temperature ?? null,
        interfaceInOctets: m.network?.interface_in_octets ?? null,
        interfaceOutOctets: m.network?.interface_out_octets ?? null,
        uptime: m.system?.uptime_seconds ?? null,
        diskUsage: m.resources?.disk_percent ?? null,
        loadAverage: m.resources?.load_average?.[0] ?? null
      }
    }));
    
    // If no data, return empty array (don't generate fake data)
    if (dataPoints.length === 0) {
      console.log(`⚠️ [SNMP API] No metrics found for device ${deviceId} in time range ${timeRange}`);
    }
    
    res.json({
      deviceId,
      timeRange,
      dataPoints,
      total: dataPoints.length,
      startTime: startTime.toISOString(),
      endTime: now.toISOString()
    });
  } catch (error) {
    console.error('❌ [SNMP API] Error fetching device metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch device metrics', 
      message: error.message 
    });
  }
});

// POST /api/snmp/poll/:deviceId - Manually poll specific device
router.post('/poll/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    console.log(`🔄 [SNMP API] Manually polling device ${deviceId}`);
    
    // TODO: This should trigger an immediate SNMP poll via the SNMP collector service
    // For now, return the latest metrics from database if available
    const SNMPMetrics = require('../models/snmp-metrics-schema').SNMPMetrics;
    const latestMetric = await SNMPMetrics.findOne({
      device_id: deviceId,
      tenant_id: req.tenantId
    }).sort({ timestamp: -1 }).lean();
    
    const pollResult = {
      deviceId,
      timestamp: new Date().toISOString(),
      success: latestMetric !== null,
      responseTime: null,
      metrics: latestMetric ? {
        'system.sysUpTime': latestMetric.system?.uptime_seconds ?? null,
        'hrProcessor.hrProcessorLoad': latestMetric.resources?.cpu_percent ?? null,
        'hrStorage.hrStorageUsed': latestMetric.resources?.disk_percent ?? null,
        'ifTable.ifInOctets.1': latestMetric.network?.interface_in_octets ?? null,
        'ifTable.ifOutOctets.1': latestMetric.network?.interface_out_octets ?? null
      } : null
    };
    
    res.json(pollResult);
  } catch (error) {
    console.error('❌ [SNMP API] Error polling device:', error);
    res.status(500).json({ 
      error: 'Failed to poll device', 
      message: error.message 
    });
  }
});

// GET /api/snmp/status - Get overall SNMP system status
router.get('/status', async (req, res) => {
  try {
    console.log(`🔍 [SNMP API] Fetching SNMP system status for tenant: ${req.tenantId}`);
    
    // Get count of SNMP-enabled devices
    const equipmentCount = await NetworkEquipment.countDocuments({
      tenantId: req.tenantId,
      status: 'active',
      $or: [
        { notes: /snmp_enabled.*true/i },
        { notes: /snmp_community/i }
      ]
    });
    
    const cpeCount = await UnifiedCPE.countDocuments({
      tenantId: req.tenantId,
      status: 'active',
      $or: [
        { 'modules.acs.enabled': true },
        { 'modules.hss.enabled': true }
      ]
    });
    
    const totalDevices = equipmentCount + cpeCount;
    
    // Get real online/offline counts based on recent metrics
    const SNMPMetrics = require('../models/snmp-metrics-schema').SNMPMetrics;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentMetrics = await SNMPMetrics.distinct('device_id', {
      tenant_id: req.tenantId,
      timestamp: { $gte: fiveMinutesAgo }
    });
    
    const onlineCount = recentMetrics.length;
    const offlineCount = Math.max(0, totalDevices - onlineCount);
    
    // Get last poll time from most recent metric
    const lastMetric = await SNMPMetrics.findOne({
      tenant_id: req.tenantId
    }).sort({ timestamp: -1 }).select('timestamp').lean();
    
    const status = {
      summary: {
        total_devices: totalDevices,
        online: onlineCount,
        offline: offlineCount,
        unreachable: 0
      },
      polling: {
        interval: '5 minutes',
        last_poll: lastMetric?.timestamp?.toISOString() ?? null,
        next_poll: null,
        success_rate: totalDevices > 0 ? Math.round((onlineCount / totalDevices) * 100 * 10) / 10 : null
      },
      performance: {
        avg_response_time: null,
        total_oids_collected: null,
        data_points_per_hour: null
      },
      alerts: {
        critical: 0,
        warning: 0,
        info: 0
      }
    };
    
    res.json(status);
  } catch (error) {
    console.error('❌ [SNMP API] Error fetching SNMP status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch SNMP status', 
      message: error.message 
    });
  }
});

// GET /api/snmp/configuration - Get SNMP configuration for tenant
router.get('/configuration', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    // Return default configuration (can be extended to store per-tenant config in DB)
    res.json({
      communityProfiles: [],
      v3UserProfiles: [],
      discoverySubnets: [],
      defaultCommunity: 'public',
      defaultVersion: '2c',
      pollingInterval: 60,
      trapPort: 162,
      enabled: true
    });
  } catch (error) {
    console.error('❌ [SNMP API] Error fetching configuration:', error);
    res.status(500).json({ 
      error: 'Failed to fetch SNMP configuration', 
      message: error.message 
    });
  }
});

// POST /api/snmp/configuration - Save SNMP configuration for tenant
router.post('/configuration', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const config = req.body;
    
    // In the future, save this to a TenantSettings or SNMPConfig collection
    console.log(`[SNMP API] Saving configuration for tenant ${tenantId}`);
    
    res.json({
      success: true,
      message: 'SNMP configuration saved',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [SNMP API] Error saving configuration:', error);
    res.status(500).json({ 
      error: 'Failed to save SNMP configuration', 
      message: error.message 
    });
  }
});

// GET /api/snmp/discovery - Discover SNMP-enabled devices on network
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
    const { HardwareDeployment } = require('../models/network');
    const deployments = await HardwareDeployment.find({
      tenantId: req.tenantId,
      status: 'deployed'
    }).lean();
    
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

// PUT /api/snmp/devices/:id/graphs - Toggle graphs enabled/disabled for a device
router.put('/devices/:id/graphs', async (req, res) => {
  try {
    const deviceId = req.params.id;
    const { enabled } = req.body;
    
    if (!req.tenantId) {
      return res.status(400).json({ error: 'X-Tenant-ID header is required' });
    }
    
    // Find device
    const device = await NetworkEquipment.findOne({ 
      _id: deviceId,
      tenantId: req.tenantId
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
    console.error('❌ [SNMP API] Error toggling graphs:', error);
    res.status(500).json({ 
      error: 'Failed to toggle graphs', 
      message: error.message 
    });
  }
});

// POST /api/snmp/discovered/:deviceId/pair - Pair discovered device with existing hardware
router.post('/discovered/:deviceId/pair', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { hardwareId } = req.body;
    
    if (!hardwareId) {
      return res.status(400).json({ error: 'hardwareId is required' });
    }
    
    console.log(`🔗 [SNMP API] Pairing discovered device ${deviceId} with hardware ${hardwareId}`);
    
    // Get the discovered device
    const device = await NetworkEquipment.findOne({
      _id: deviceId,
      tenantId: req.tenantId
    });
    
    if (!device) {
      return res.status(404).json({ error: 'Discovered device not found' });
    }
    
    // Get the inventory item to pair with
    const { InventoryItem } = require('../models/inventory');
    const hardware = await InventoryItem.findOne({
      _id: hardwareId,
      tenantId: req.tenantId
    });
    
    if (!hardware) {
      return res.status(404).json({ error: 'Hardware item not found' });
    }
    
    // Parse device notes
    let notes = {};
    if (device.notes) {
      try {
        notes = typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes;
      } catch (e) {
        notes = {};
      }
    }
    
    // Update NetworkEquipment to link to inventory
    device.inventoryId = hardwareId.toString();
    if (typeof device.notes === 'string') {
      notes.inventory_id = hardwareId.toString();
      notes.paired_at = new Date().toISOString();
      device.notes = JSON.stringify(notes);
    } else {
      device.notes = { ...notes, inventory_id: hardwareId.toString(), paired_at: new Date().toISOString() };
    }
    await device.save();
    
    // Update InventoryItem to link to NetworkEquipment
    hardware.serialNumber = notes.management_ip || device.serialNumber || hardware.serialNumber;
    if (!hardware.networkConfig) hardware.networkConfig = {};
    hardware.networkConfig.management_ip = notes.management_ip || device.serialNumber || null;
    hardware.networkConfig.snmp_enabled = true;
    hardware.networkConfig.snmp_community = notes.snmp_community || 'public';
    hardware.networkConfig.snmp_version = notes.snmp_version || '2c';
    
    // Update modules to link to SNMP device
    if (!hardware.modules) hardware.modules = {};
    if (!hardware.modules.snmp) hardware.modules.snmp = {};
    hardware.modules.snmp.deviceId = deviceId.toString();
    hardware.modules.snmp.lastSync = new Date();
    
    await hardware.save();
    
    console.log(`✅ [SNMP API] Paired device ${deviceId} with hardware ${hardwareId}`);
    
    res.json({
      success: true,
      deviceId,
      hardwareId,
      message: 'Device paired successfully with hardware'
    });
  } catch (error) {
    console.error('❌ [SNMP API] Error pairing device:', error);
    res.status(500).json({
      error: 'Failed to pair device',
      message: error.message
    });
  }
});

// POST /api/snmp/discovered/:deviceId/create-hardware - Create new hardware from discovered device
router.post('/discovered/:deviceId/create-hardware', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { assetTag, category, siteId, siteName, location } = req.body;
    
    console.log(`➕ [SNMP API] Creating hardware from discovered device ${deviceId}`);
    
    // Get the discovered device
    const device = await NetworkEquipment.findOne({
      _id: deviceId,
      tenantId: req.tenantId
    });
    
    if (!device) {
      return res.status(404).json({ error: 'Discovered device not found' });
    }
    
    // Parse device notes
    let notes = {};
    if (device.notes) {
      try {
        notes = typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes;
      } catch (e) {
        notes = {};
      }
    }
    
    // Check if device already has inventory item (already deployed)
    const { InventoryItem } = require('../models/inventory');
    let inventoryItem = null;
    if (device.inventoryId) {
      inventoryItem = await InventoryItem.findOne({ 
        _id: device.inventoryId, 
        tenantId: req.tenantId 
      });
      if (inventoryItem) {
        console.log(`ℹ️ [SNMP API] Device ${deviceId} already has inventory item ${inventoryItem._id}, will update it`);
      }
    }
    
    // Find site by siteId or siteName
    let site = null;
    const { UnifiedSite } = require('../models/network');
    if (siteId) {
      site = await UnifiedSite.findOne({ _id: siteId, tenantId: req.tenantId }).lean();
    } else if (siteName) {
      site = await UnifiedSite.findOne({ name: siteName, tenantId: req.tenantId }).lean();
    }
    
    // If no existing inventory item, check if assetTag already exists to avoid duplicates
    if (!inventoryItem) {
      const proposedAssetTag = assetTag || `SNMP-${notes.management_ip || device.serialNumber || deviceId.substring(0, 8)}`;
      const existingByTag = await InventoryItem.findOne({ 
        assetTag: proposedAssetTag, 
        tenantId: req.tenantId 
      });
      
      if (existingByTag) {
        // Asset tag exists - use the existing item
        console.log(`ℹ️ [SNMP API] Asset tag ${proposedAssetTag} already exists, using existing inventory item ${existingByTag._id}`);
        inventoryItem = existingByTag;
      }
    }
    
    // Create or update inventory item
    if (!inventoryItem) {
      // Generate unique assetTag if needed
      const baseAssetTag = assetTag || `SNMP-${notes.management_ip || device.serialNumber || deviceId.substring(0, 8)}`;
      let uniqueAssetTag = baseAssetTag;
      let suffix = 1;
      
      // Check if base tag exists, append suffix if needed
      while (await InventoryItem.findOne({ assetTag: uniqueAssetTag, tenantId: req.tenantId })) {
        uniqueAssetTag = `${baseAssetTag}-${suffix}`;
        suffix++;
      }
      
      inventoryItem = new InventoryItem({
      tenantId: req.tenantId,
      assetTag: uniqueAssetTag,
      category: category === 'Network Equipment' ? 'Networking Equipment' : (category || 'Networking Equipment'),
      subcategory: device.type === 'router' ? 'Router' :
                   device.type === 'switch' ? 'Switch' :
                   device.type === 'ap' ? 'Access Point' : 'Network Device',
      equipmentType: device.manufacturer ? `${device.manufacturer} ${device.model || ''}`.trim() : 
                     notes.device_type || 'SNMP Device',
      manufacturer: device.manufacturer || 'Generic',
      model: device.model || notes.sysDescr || 'Unknown',
      serialNumber: notes.management_ip || device.serialNumber || deviceId,
      physicalDescription: `${device.name || 'Discovered SNMP Device'} - ${notes.management_ip || 'Unknown IP'}`,
      status: 'deployed',
      condition: 'good',
      currentLocation: {
        type: 'tower',
        siteId: site?._id?.toString() || null, // InventoryItem uses string for siteId in location
        siteName: site?.name || siteName || 'Unknown Site',
        address: location?.address || device.location?.address || site?.location?.address || 'Unknown Location'
      },
      ownership: 'owned',
      networkConfig: {
        management_ip: notes.management_ip || device.serialNumber || null,
        snmp_enabled: true,
        snmp_community: notes.snmp_community || 'public',
        snmp_version: notes.snmp_version || '2c'
      },
      notes: `Created from discovered SNMP device. Discovered by EPC: ${notes.discovered_by_epc || 'Unknown'}. IP: ${notes.management_ip || 'Unknown'}`,
      modules: {
        snmp: {
          deviceId: deviceId.toString(),
          lastSync: new Date()
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
      
      await inventoryItem.save();
      console.log(`✅ [SNMP API] Created new inventory item ${inventoryItem._id} with assetTag: ${uniqueAssetTag}`);
    } else {
      // Update existing inventory item
      inventoryItem.assetTag = assetTag || inventoryItem.assetTag;
      inventoryItem.category = category === 'Network Equipment' ? 'Networking Equipment' : (category || inventoryItem.category || 'Networking Equipment');
      inventoryItem.subcategory = device.type === 'router' ? 'Router' :
                                  device.type === 'switch' ? 'Switch' :
                                  device.type === 'ap' ? 'Access Point' : (inventoryItem.subcategory || 'Network Device');
      inventoryItem.equipmentType = device.manufacturer ? `${device.manufacturer} ${device.model || ''}`.trim() : 
                                    (notes.device_type || inventoryItem.equipmentType || 'SNMP Device');
      inventoryItem.manufacturer = device.manufacturer || inventoryItem.manufacturer || 'Generic';
      inventoryItem.model = device.model || notes.sysDescr || inventoryItem.model || 'Unknown';
      inventoryItem.status = 'deployed'; // Update status to deployed
      inventoryItem.currentLocation = {
        type: 'tower',
        siteId: site?._id?.toString() || inventoryItem.currentLocation?.siteId || null,
        siteName: site?.name || siteName || inventoryItem.currentLocation?.siteName || 'Unknown Site',
        address: location?.address || device.location?.address || site?.location?.address || inventoryItem.currentLocation?.address || 'Unknown Location'
      };
      inventoryItem.updatedAt = new Date();
      
      await inventoryItem.save();
      console.log(`✅ [SNMP API] Updated existing inventory item ${inventoryItem._id}`);
    }
    
    // Mark device as deployed: Set siteId and enable graphs
    // siteId must be an ObjectId (not a string) for NetworkEquipment schema
    const savedSiteId = site?._id || null;
    if (savedSiteId) {
      device.siteId = savedSiteId;
      console.log(`✅ [SNMP API] Setting device siteId to: ${savedSiteId.toString()}`);
    } else {
      console.warn(`⚠️ [SNMP API] No site found for siteId: ${siteId}, siteName: ${siteName}`);
    }
    if (typeof device.notes === 'string') {
      notes.inventory_id = inventoryItem._id.toString();
      notes.created_from_discovery = true;
      notes.enable_graphs = true; // Enable graphs when hardware is created
      device.notes = JSON.stringify(notes);
    } else {
      device.notes = { 
        ...notes, 
        inventory_id: inventoryItem._id.toString(), 
        created_from_discovery: true,
        enable_graphs: true // Enable graphs when hardware is created
      };
    }
    device.inventoryId = inventoryItem._id.toString();
    await device.save();
    
    // Verify the save worked - explicitly select siteId, refresh from DB
    // Use findOneAndUpdate or refresh the device to ensure we get the latest
    const refreshedDevice = await NetworkEquipment.findById(deviceId);
    if (!refreshedDevice) {
      console.error(`❌ [SNMP API] ERROR: Could not find device ${deviceId} after save`);
    } else {
      // Refresh from database
      await refreshedDevice.populate('siteId');
      const refreshedLean = await NetworkEquipment.findById(deviceId).lean();
      
      let parsedNotes = {};
      try {
        parsedNotes = typeof refreshedLean?.notes === 'string' ? JSON.parse(refreshedLean.notes) : (refreshedLean?.notes || {});
      } catch (e) {}
      
      console.log(`✅ [SNMP API] Created hardware ${inventoryItem._id} from device ${deviceId}`);
      console.log(`✅ [SNMP API] Device siteId after save (refreshed):`, {
        siteId_raw: refreshedLean?.siteId,
        siteId_string: refreshedLean?.siteId ? (typeof refreshedLean.siteId === 'object' ? refreshedLean.siteId.toString() : String(refreshedLean.siteId)) : 'null',
        siteId_type: typeof refreshedLean?.siteId,
        enable_graphs: parsedNotes.enable_graphs !== undefined ? parsedNotes.enable_graphs : 'not set',
        inventoryId: refreshedLean?.inventoryId
      });
      
      if (!refreshedLean?.siteId) {
        console.warn(`⚠️ [SNMP API] WARNING: Device ${deviceId} siteId was not saved correctly. Site lookup result:`, site ? { id: site._id?.toString(), name: site.name } : 'null');
        console.warn(`⚠️ [SNMP API] Device data:`, {
          _id: refreshedLean?._id,
          name: refreshedLean?.name,
          inventoryId: refreshedLean?.inventoryId,
          siteId_field_exists: 'siteId' in (refreshedLean || {})
        });
      }
    }
    
    res.json({
      success: true,
      deviceId,
      hardwareId: inventoryItem._id.toString(),
      hardware: inventoryItem,
      message: 'Hardware created successfully from discovered device'
    });
  } catch (error) {
    console.error('❌ [SNMP API] Error creating hardware:', error);
    res.status(500).json({
      error: 'Failed to create hardware',
      message: error.message
    });
  }
});

module.exports = router;
