/**
 * Mikrotik Device Management API Routes
 * Provides endpoints for Mikrotik device management and monitoring
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

// Helper function to format Mikrotik device for API response
const formatMikrotikDevice = (device, source = 'equipment') => {
  const config = source === 'equipment' && device.notes ? 
    (typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes) : 
    {};

  const baseDevice = {
    id: device._id.toString(),
    name: device.name,
    type: 'mikrotik',
    status: device.status === 'active' ? 'online' : 'offline',
    manufacturer: device.manufacturer || 'Mikrotik',
    model: device.model || 'Unknown',
    serialNumber: device.serialNumber || device._id.toString(),
    location: {
      coordinates: {
        latitude: device.location?.latitude || 0,
        longitude: device.location?.longitude || 0
      },
      address: device.location?.address || device.address || 'Unknown Location'
    },
    createdAt: device.createdAt,
    updatedAt: device.updatedAt
  };

  // Add device-specific fields based on source
  if (source === 'equipment') {
    return {
      ...baseDevice,
      deviceType: device.type,
      ipAddress: config.management_ip || '192.168.1.1',
      routerOS: {
        version: '7.11.2',
        architecture: 'arm64',
        uptime: Math.floor(Math.random() * 31536000)
      },
      api: {
        enabled: config.mikrotik_api?.enabled || true,
        port: config.mikrotik_api?.port || 8728,
        username: config.mikrotik_api?.username || 'admin'
      },
      snmp: {
        enabled: !!config.snmp_community,
        version: config.snmp_version || 'v2c',
        community: config.snmp_community || 'public'
      },
      metrics: {
        cpuUsage: Math.floor(Math.random() * 100),
        memoryUsage: Math.floor(Math.random() * 100),
        temperature: Math.floor(Math.random() * 20) + 30,
        uptime: Math.floor(Math.random() * 31536000),
        throughput: Math.floor(Math.random() * 1000)
      }
    };
  } else if (source === 'cpe') {
    return {
      ...baseDevice,
      deviceType: 'cpe',
      ipAddress: config.management_ip || '192.168.100.1',
      macAddress: device.macAddress,
      firmwareVersion: device.firmwareVersion || '7.11.2',
      subscriber: {
        name: device.subscriberName,
        email: device.subscriberEmail,
        phone: device.subscriberPhone
      },
      lte: {
        technology: device.technology,
        signalStrength: Math.floor(Math.random() * 30) - 90, // -90 to -60 dBm
        throughputDown: Math.floor(Math.random() * 100),
        throughputUp: Math.floor(Math.random() * 50)
      },
      modules: device.modules || {},
      metrics: {
        signalStrength: Math.floor(Math.random() * 30) - 90,
        throughput: Math.floor(Math.random() * 100),
        uptime: Math.floor(Math.random() * 31536000),
        dataUsage: Math.floor(Math.random() * 10000)
      }
    };
  }

  return baseDevice;
};

// GET /api/mikrotik/devices - List all Mikrotik devices for tenant
router.get('/devices', async (req, res) => {
  try {
    console.log(`🔍 [Mikrotik API] Fetching Mikrotik devices for tenant: ${req.tenantId}`);
    
    const devices = [];
    
    // Get Mikrotik network equipment
    const mikrotikEquipment = await NetworkEquipment.find({
      tenantId: req.tenantId,
      manufacturer: /mikrotik/i,
      status: 'active'
    }).lean();
    
    console.log(`🖥️ Found ${mikrotikEquipment.length} Mikrotik equipment items`);
    
    // Add Mikrotik equipment
    mikrotikEquipment.forEach(equipment => {
      devices.push(formatMikrotikDevice(equipment, 'equipment'));
    });
    
    // Get Mikrotik CPE devices
    const mikrotikCPE = await UnifiedCPE.find({
      tenantId: req.tenantId,
      manufacturer: /mikrotik/i,
      status: 'active'
    }).lean();
    
    console.log(`📱 Found ${mikrotikCPE.length} Mikrotik CPE devices`);
    
    // Add Mikrotik CPE
    mikrotikCPE.forEach(cpe => {
      devices.push(formatMikrotikDevice(cpe, 'cpe'));
    });
    
    console.log(`📊 Total Mikrotik devices for tenant ${req.tenantId}: ${devices.length}`);
    
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
    console.error('❌ [Mikrotik API] Error fetching Mikrotik devices:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Mikrotik devices', 
      message: error.message,
      devices: []
    });
  }
});

// GET /api/mikrotik/devices/:id - Get specific Mikrotik device details
router.get('/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 [Mikrotik API] Fetching Mikrotik device ${id} for tenant: ${req.tenantId}`);
    
    // Try to find as network equipment first
    let device = await NetworkEquipment.findOne({
      _id: id,
      tenantId: req.tenantId,
      manufacturer: /mikrotik/i,
      status: 'active'
    }).lean();
    
    if (device) {
      const formattedDevice = formatMikrotikDevice(device, 'equipment');
      return res.json(formattedDevice);
    }
    
    // Try to find as CPE device
    device = await UnifiedCPE.findOne({
      _id: id,
      tenantId: req.tenantId,
      manufacturer: /mikrotik/i,
      status: 'active'
    }).lean();
    
    if (device) {
      const formattedDevice = formatMikrotikDevice(device, 'cpe');
      return res.json(formattedDevice);
    }
    
    res.status(404).json({ error: 'Mikrotik device not found' });
  } catch (error) {
    console.error('❌ [Mikrotik API] Error fetching Mikrotik device:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Mikrotik device', 
      message: error.message 
    });
  }
});

// GET /api/mikrotik/devices/:id/metrics - Get metrics for specific Mikrotik device
router.get('/devices/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📊 [Mikrotik API] Fetching metrics for Mikrotik device ${id}`);
    
    // In a real implementation, this would query the device via RouterOS API or SNMP
    // For now, generate realistic mock metrics
    const metrics = {
      deviceId: id,
      timestamp: new Date().toISOString(),
      system: {
        cpuUsage: Math.floor(Math.random() * 100),
        memoryUsage: Math.floor(Math.random() * 100),
        temperature: Math.floor(Math.random() * 20) + 30,
        voltage: (Math.random() * 2 + 11).toFixed(1), // 11-13V
        uptime: Math.floor(Math.random() * 31536000)
      },
      network: {
        interfaces: [
          {
            name: 'ether1',
            status: 'running',
            rxBytes: Math.floor(Math.random() * 1000000000),
            txBytes: Math.floor(Math.random() * 1000000000),
            rxPackets: Math.floor(Math.random() * 1000000),
            txPackets: Math.floor(Math.random() * 1000000),
            speed: '1Gbps'
          },
          {
            name: 'wlan1',
            status: 'running',
            rxBytes: Math.floor(Math.random() * 100000000),
            txBytes: Math.floor(Math.random() * 100000000),
            connectedClients: Math.floor(Math.random() * 50),
            signalStrength: Math.floor(Math.random() * 30) - 90
          }
        ]
      },
      routerOS: {
        version: '7.11.2',
        architecture: 'arm64',
        boardName: 'RB5009UG+S+IN',
        licenseLevel: 6
      }
    };
    
    res.json(metrics);
  } catch (error) {
    console.error('❌ [Mikrotik API] Error fetching Mikrotik metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Mikrotik metrics', 
      message: error.message 
    });
  }
});

// GET /api/mikrotik/status - Get overall Mikrotik system status
router.get('/status', async (req, res) => {
  try {
    console.log(`🔍 [Mikrotik API] Fetching Mikrotik system status for tenant: ${req.tenantId}`);
    
    // Get count of Mikrotik devices by type
    const equipmentCount = await NetworkEquipment.countDocuments({
      tenantId: req.tenantId,
      manufacturer: /mikrotik/i,
      status: 'active'
    });
    
    const cpeCount = await UnifiedCPE.countDocuments({
      tenantId: req.tenantId,
      manufacturer: /mikrotik/i,
      status: 'active'
    });
    
    const totalDevices = equipmentCount + cpeCount;
    
    const status = {
      summary: {
        total_devices: totalDevices,
        online: Math.floor(totalDevices * 0.95), // 95% online
        offline: Math.floor(totalDevices * 0.05), // 5% offline
        maintenance: 0
      },
      device_types: {
        routers: Math.floor(equipmentCount * 0.3),
        switches: Math.floor(equipmentCount * 0.2),
        access_points: Math.floor(equipmentCount * 0.3),
        cpe: cpeCount,
        other: Math.floor(equipmentCount * 0.2)
      },
      performance: {
        avg_cpu: Math.floor(Math.random() * 40) + 20,
        avg_memory: Math.floor(Math.random() * 50) + 25,
        avg_temperature: Math.floor(Math.random() * 15) + 35,
        total_throughput: Math.floor(Math.random() * 2000) + 1000
      },
      services: {
        api: { status: 'healthy', port: 8728 },
        snmp: { status: 'healthy', version: 'v2c' },
        ssh: { status: 'healthy', port: 22 },
        winbox: { status: 'healthy', port: 8291 }
      },
      alerts: {
        critical: 0,
        warning: Math.floor(Math.random() * 2),
        info: Math.floor(Math.random() * 3)
      }
    };
    
    res.json(status);
  } catch (error) {
    console.error('❌ [Mikrotik API] Error fetching Mikrotik status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Mikrotik status', 
      message: error.message 
    });
  }
});

// POST /api/mikrotik/devices/:id/command - Execute RouterOS API command
router.post('/devices/:id/command', async (req, res) => {
  try {
    const { id } = req.params;
    const { command, parameters } = req.body;
    
    console.log(`🔧 [Mikrotik API] Executing command on device ${id}: ${command}`);
    
    // In a real implementation, this would connect to the device via RouterOS API
    // For now, return mock response
    const mockResponse = {
      deviceId: id,
      command: command,
      parameters: parameters || {},
      result: {
        success: true,
        output: `Mock response for command: ${command}`,
        timestamp: new Date().toISOString()
      }
    };
    
    res.json(mockResponse);
  } catch (error) {
    console.error('❌ [Mikrotik API] Error executing command:', error);
    res.status(500).json({ 
      error: 'Failed to execute command', 
      message: error.message 
    });
  }
});

// GET /api/mikrotik/discovery - Discover Mikrotik devices on network
router.get('/discovery', async (req, res) => {
  try {
    console.log(`🔍 [Mikrotik API] Starting device discovery for tenant: ${req.tenantId}`);
    
    // In a real implementation, this would scan the network for Mikrotik devices
    // For now, return existing devices as "discovered"
    const existingDevices = await NetworkEquipment.find({
      tenantId: req.tenantId,
      manufacturer: /mikrotik/i,
      status: 'active'
    }).lean();
    
    const discoveredDevices = existingDevices.map(device => ({
      id: device._id.toString(),
      name: device.name,
      ipAddress: '192.168.1.' + Math.floor(Math.random() * 254 + 1),
      macAddress: '4C:5E:0C:' + Array.from({length: 3}, () => 
        Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(':').toUpperCase(),
      model: device.model,
      routerOSVersion: '7.11.2',
      discovered: true,
      lastSeen: new Date().toISOString()
    }));
    
    res.json({
      discovered: discoveredDevices,
      total: discoveredDevices.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [Mikrotik API] Error during discovery:', error);
    res.status(500).json({ 
      error: 'Failed to discover devices', 
      message: error.message 
    });
  }
});

module.exports = router;
