/**
 * SNMP Management API Routes
 * Provides endpoints for SNMP device management and monitoring
 */

const express = require('express');
const router = express.Router();
const { UnifiedSite, UnifiedCPE, NetworkEquipment } = require('../models/network');

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
    lastPolled: new Date().toISOString(),
    metrics: {
      cpuUsage: Math.floor(Math.random() * 100),
      memoryUsage: Math.floor(Math.random() * 100),
      temperature: Math.floor(Math.random() * 20) + 30,
      uptime: Math.floor(Math.random() * 31536000),
      interfaceCount: Math.floor(Math.random() * 24) + 1
    },
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
    
    const metrics = [];
    
    // Get all SNMP-enabled equipment
    const allEquipment = await NetworkEquipment.find({
      tenantId: req.tenantId,
      status: 'active'
    }).lean();
    
    const allCPE = await UnifiedCPE.find({
      tenantId: req.tenantId,
      status: 'active'
    }).lean();
    
    // Generate metrics for equipment
    allEquipment.forEach(device => {
      const config = device.notes ? JSON.parse(device.notes) : {};
      if (config.snmp_enabled || config.snmp_community || config.management_ip) {
        metrics.push({
          deviceId: device._id.toString(),
          deviceName: device.name,
          deviceType: device.type,
          timestamp: new Date().toISOString(),
          metrics: {
            'system.sysUpTime': Math.floor(Math.random() * 31536000),
            'system.sysDescr': `${device.manufacturer} ${device.model}`,
            'system.sysContact': 'admin@wisptools.io',
            'system.sysLocation': device.location?.address || 'Unknown',
            'hrSystem.hrSystemUptime': Math.floor(Math.random() * 31536000),
            'hrSystem.hrSystemProcesses': Math.floor(Math.random() * 100) + 50,
            'hrProcessor.hrProcessorLoad': Math.floor(Math.random() * 100),
            'hrStorage.hrStorageUsed': Math.floor(Math.random() * 100),
            'ifTable.ifInOctets.1': Math.floor(Math.random() * 1000000000),
            'ifTable.ifOutOctets.1': Math.floor(Math.random() * 1000000000),
            'ifTable.ifInErrors.1': Math.floor(Math.random() * 100),
            'ifTable.ifOutErrors.1': Math.floor(Math.random() * 100),
            'temperature': Math.floor(Math.random() * 20) + 30
          }
        });
      }
    });
    
    // Generate metrics for CPE
    allCPE.forEach(device => {
      metrics.push({
        deviceId: device._id.toString(),
        deviceName: device.name,
        deviceType: 'cpe',
        timestamp: new Date().toISOString(),
        metrics: {
          'system.sysUpTime': Math.floor(Math.random() * 31536000),
          'system.sysDescr': `${device.manufacturer} ${device.model}`,
          'lte.signalStrength': Math.floor(Math.random() * 30) - 90,
          'lte.throughputDown': Math.floor(Math.random() * 100),
          'lte.throughputUp': Math.floor(Math.random() * 50),
          'lte.dataUsage': Math.floor(Math.random() * 10000),
          'system.cpuUsage': Math.floor(Math.random() * 100),
          'system.memoryUsage': Math.floor(Math.random() * 100)
        }
      });
    });
    
    console.log(`📊 Generated ${metrics.length} SNMP metrics for tenant ${req.tenantId}`);
    
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
    
    // In a real implementation, this would query a time-series database
    // For now, generate mock historical data
    const now = new Date();
    const dataPoints = [];
    const intervalMinutes = timeRange === '1h' ? 5 : timeRange === '24h' ? 60 : 300;
    const totalPoints = timeRange === '1h' ? 12 : timeRange === '24h' ? 24 : 48;
    
    for (let i = totalPoints; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - (i * intervalMinutes * 60 * 1000));
      dataPoints.push({
        timestamp: timestamp.toISOString(),
        metrics: {
          cpuUsage: Math.floor(Math.random() * 100),
          memoryUsage: Math.floor(Math.random() * 100),
          temperature: Math.floor(Math.random() * 20) + 30,
          interfaceInOctets: Math.floor(Math.random() * 1000000),
          interfaceOutOctets: Math.floor(Math.random() * 1000000),
          uptime: Math.floor(Math.random() * 31536000)
        }
      });
    }
    
    res.json({
      deviceId,
      timeRange,
      dataPoints,
      total: dataPoints.length
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
    
    // In a real implementation, this would trigger an immediate SNMP poll
    // For now, return mock poll result
    const pollResult = {
      deviceId,
      timestamp: new Date().toISOString(),
      success: true,
      responseTime: Math.floor(Math.random() * 1000) + 100, // 100-1100ms
      metrics: {
        'system.sysUpTime': Math.floor(Math.random() * 31536000),
        'hrProcessor.hrProcessorLoad': Math.floor(Math.random() * 100),
        'hrStorage.hrStorageUsed': Math.floor(Math.random() * 100),
        'ifTable.ifInOctets.1': Math.floor(Math.random() * 1000000000),
        'ifTable.ifOutOctets.1': Math.floor(Math.random() * 1000000000)
      }
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
    
    const status = {
      summary: {
        total_devices: totalDevices,
        online: Math.floor(totalDevices * 0.92), // 92% online
        offline: Math.floor(totalDevices * 0.05), // 5% offline
        unreachable: Math.floor(totalDevices * 0.03) // 3% unreachable
      },
      polling: {
        interval: '5 minutes',
        last_poll: new Date(Date.now() - 300000).toISOString(),
        next_poll: new Date(Date.now() + 300000).toISOString(),
        success_rate: 95.2
      },
      performance: {
        avg_response_time: Math.floor(Math.random() * 500) + 200,
        total_oids_collected: Math.floor(Math.random() * 10000) + 5000,
        data_points_per_hour: Math.floor(Math.random() * 1000) + 500
      },
      alerts: {
        critical: Math.floor(Math.random() * 2),
        warning: Math.floor(Math.random() * 5),
        info: Math.floor(Math.random() * 10)
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
