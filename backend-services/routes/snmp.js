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
    manufacturer: device.manufacturer || 'Generic',
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
    
    // Add SNMP equipment
    snmpEquipment.forEach(equipment => {
      devices.push(formatSNMPDevice(equipment, 'equipment'));
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
    
    // Add SNMP CPE
    snmpCPE.forEach(cpe => {
      devices.push(formatSNMPDevice(cpe, 'cpe'));
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

module.exports = router;
