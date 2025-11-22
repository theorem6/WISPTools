/**
 * Monitoring API Routes
 * Provides endpoints for network monitoring, device status, and SNMP data
 */

const express = require('express');
const router = express.Router();
const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment, HardwareDeployment } = require('../models/network');

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

// Helper function to convert network devices to monitoring format
const formatDeviceForMonitoring = (device, type, deviceType = null) => {
  const baseDevice = {
    id: device._id.toString(),
    name: device.name,
    type: type,
    status: device.status === 'active' ? 'online' : 'offline',
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

  // Add device-specific fields
  if (type === 'epc') {
    return {
      ...baseDevice,
      epcId: device._id.toString(),
      ipAddress: device.config?.management_ip || '10.0.1.10',
      metrics: {
        cpuUsage: Math.floor(Math.random() * 100),
        memoryUsage: Math.floor(Math.random() * 100),
        activeUsers: Math.floor(Math.random() * 200),
        uptime: 99.9
      }
    };
  }

  if (type === 'mikrotik') {
    const config = device.notes ? JSON.parse(device.notes) : {};
    return {
      ...baseDevice,
      deviceType: deviceType || device.type,
      ipAddress: config.management_ip || '192.168.1.1',
      manufacturer: device.manufacturer || 'Mikrotik',
      model: device.model || 'Unknown',
      serialNumber: device.serialNumber,
      metrics: {
        cpuUsage: Math.floor(Math.random() * 100),
        memoryUsage: Math.floor(Math.random() * 100),
        throughput: Math.floor(Math.random() * 1000),
        temperature: Math.floor(Math.random() * 20) + 30
      }
    };
  }

  if (type === 'snmp') {
    const config = device.notes ? JSON.parse(device.notes) : {};
    return {
      ...baseDevice,
      deviceType: deviceType || device.type,
      ipAddress: config.management_ip || '192.168.1.10',
      manufacturer: device.manufacturer || 'Generic',
      model: device.model || 'Unknown',
      snmpVersion: config.snmp_version || 'v2c',
      community: config.snmp_community || 'public',
      metrics: {
        cpuUsage: Math.floor(Math.random() * 100),
        memoryUsage: Math.floor(Math.random() * 100),
        portUtilization: Math.floor(Math.random() * 100),
        temperature: Math.floor(Math.random() * 20) + 30
      }
    };
  }

  return baseDevice;
};

// ========== EPC ENDPOINTS ==========

// GET /api/epc/list - List all EPC devices
router.get('/epc/list', async (req, res) => {
  try {
    console.log(`🔍 Fetching EPC devices for tenant: ${req.tenantId}`);
    
    // Get EPC hardware deployments
    const epcDeployments = await HardwareDeployment.find({
      tenantId: req.tenantId,
      hardware_type: 'epc',
      status: 'deployed'
    }).populate('siteId', 'name location').lean();
    
    // Also get network equipment marked as EPC-related
    const epcEquipment = await NetworkEquipment.find({
      tenantId: req.tenantId,
      $or: [
        { name: /epc/i },
        { name: /core/i },
        { type: 'other', name: /server/i }
      ],
      status: 'active'
    }).lean();
    
    const epcs = [];
    
    // Add EPC deployments
    epcDeployments.forEach(deployment => {
      epcs.push(formatDeviceForMonitoring({
        _id: deployment._id,
        name: deployment.name,
        status: deployment.status,
        location: deployment.siteId?.location || {},
        config: deployment.config || {},
        createdAt: deployment.createdAt,
        updatedAt: deployment.updatedAt
      }, 'epc'));
    });
    
    // Add EPC equipment
    epcEquipment.forEach(equipment => {
      epcs.push(formatDeviceForMonitoring(equipment, 'epc'));
    });
    
    console.log(`📊 Found ${epcs.length} EPC devices for tenant ${req.tenantId}`);
    
    res.json({ epcs });
  } catch (error) {
    console.error('Error fetching EPC devices:', error);
    res.status(500).json({ error: 'Failed to fetch EPC devices', message: error.message });
  }
});

// ========== MIKROTIK ENDPOINTS ==========

// GET /api/mikrotik/devices - List all Mikrotik devices
router.get('/mikrotik/devices', async (req, res) => {
  try {
    console.log(`🔍 Fetching Mikrotik devices for tenant: ${req.tenantId}`);
    
    // Get Mikrotik network equipment
    const mikrotikEquipment = await NetworkEquipment.find({
      tenantId: req.tenantId,
      manufacturer: /mikrotik/i,
      status: 'active'
    }).lean();
    
    // Get Mikrotik CPE devices
    const mikrotikCPE = await UnifiedCPE.find({
      tenantId: req.tenantId,
      manufacturer: /mikrotik/i,
      status: 'active'
    }).lean();
    
    const devices = [];
    
    // Add Mikrotik equipment
    mikrotikEquipment.forEach(equipment => {
      devices.push(formatDeviceForMonitoring(equipment, 'mikrotik', equipment.type));
    });
    
    // Add Mikrotik CPE
    mikrotikCPE.forEach(cpe => {
      devices.push(formatDeviceForMonitoring(cpe, 'mikrotik', 'cpe'));
    });
    
    console.log(`📊 Found ${devices.length} Mikrotik devices for tenant ${req.tenantId}`);
    
    res.json({ devices });
  } catch (error) {
    console.error('Error fetching Mikrotik devices:', error);
    res.status(500).json({ error: 'Failed to fetch Mikrotik devices', message: error.message });
  }
});

// ========== SNMP ENDPOINTS ==========

// GET /api/snmp/devices - List all SNMP-enabled devices
router.get('/snmp/devices', async (req, res) => {
  try {
    console.log(`🔍 Fetching SNMP devices for tenant: ${req.tenantId}`);
    
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
    
    // Get CPE devices with SNMP modules enabled
    const snmpCPE = await UnifiedCPE.find({
      tenantId: req.tenantId,
      status: 'active',
      'modules.acs.enabled': true
    }).lean();
    
    const devices = [];
    
    // Add SNMP equipment
    snmpEquipment.forEach(equipment => {
      devices.push(formatDeviceForMonitoring(equipment, 'snmp', equipment.type));
    });
    
    // Add SNMP CPE
    snmpCPE.forEach(cpe => {
      devices.push(formatDeviceForMonitoring(cpe, 'snmp', 'cpe'));
    });
    
    console.log(`📊 Found ${devices.length} SNMP devices for tenant ${req.tenantId}`);
    
    res.json({ devices });
  } catch (error) {
    console.error('Error fetching SNMP devices:', error);
    res.status(500).json({ error: 'Failed to fetch SNMP devices', message: error.message });
  }
});

// GET /api/snmp/metrics/latest - Get latest SNMP metrics for all devices
router.get('/snmp/metrics/latest', async (req, res) => {
  try {
    console.log(`🔍 Fetching latest SNMP metrics for tenant: ${req.tenantId}`);
    
    // Get all SNMP-enabled devices
    const snmpDevicesResponse = await router.handle({
      method: 'GET',
      url: '/snmp/devices',
      headers: { 'x-tenant-id': req.tenantId },
      tenantId: req.tenantId
    });
    
    // For now, generate mock metrics data based on real devices
    // In a real implementation, this would query a time-series database
    const mockMetrics = [];
    
    // Get device list from database
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
        mockMetrics.push({
          deviceId: device._id.toString(),
          deviceName: device.name,
          timestamp: new Date().toISOString(),
          metrics: {
            'cpu-usage': Math.floor(Math.random() * 100),
            'memory-usage': Math.floor(Math.random() * 100),
            'interface-1-in-octets': Math.floor(Math.random() * 10000000),
            'interface-1-out-octets': Math.floor(Math.random() * 10000000),
            'uptime': Math.floor(Math.random() * 31536000), // Up to 1 year in seconds
            'temperature': Math.floor(Math.random() * 20) + 30
          }
        });
      }
    });
    
    // Generate metrics for CPE
    allCPE.forEach(device => {
      mockMetrics.push({
        deviceId: device._id.toString(),
        deviceName: device.name,
        timestamp: new Date().toISOString(),
        metrics: {
          'signal-strength': Math.floor(Math.random() * 30) - 90, // -90 to -60 dBm
          'throughput-down': Math.floor(Math.random() * 100),
          'throughput-up': Math.floor(Math.random() * 50),
          'uptime': Math.floor(Math.random() * 31536000)
        }
      });
    });
    
    console.log(`📊 Generated ${mockMetrics.length} SNMP metrics for tenant ${req.tenantId}`);
    
    res.json(mockMetrics);
  } catch (error) {
    console.error('Error fetching SNMP metrics:', error);
    res.status(500).json({ error: 'Failed to fetch SNMP metrics', message: error.message });
  }
});

// ========== MONITORING DASHBOARD ==========

// GET /api/monitoring/dashboard - Get monitoring dashboard data
router.get('/monitoring/dashboard', async (req, res) => {
  try {
    console.log(`🔍 Fetching monitoring dashboard for tenant: ${req.tenantId}`);
    
    // Get counts of different device types
    const epcCount = await NetworkEquipment.countDocuments({
      tenantId: req.tenantId,
      $or: [{ name: /epc/i }, { name: /core/i }],
      status: 'active'
    });
    
    const mikrotikCount = await NetworkEquipment.countDocuments({
      tenantId: req.tenantId,
      manufacturer: /mikrotik/i,
      status: 'active'
    });
    
    const cpeCount = await UnifiedCPE.countDocuments({
      tenantId: req.tenantId,
      status: 'active'
    });
    
    const siteCount = await UnifiedSite.countDocuments({
      tenantId: req.tenantId,
      status: 'active'
    });
    
    // Generate mock alerts based on real devices
    const activeAlerts = [
      {
        id: 'alert-cpu-high',
        severity: 'warning',
        message: 'High CPU usage detected on Core Router',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        deviceId: 'core-router',
        deviceName: 'Core Router MT-RB5009'
      },
      {
        id: 'alert-new-device',
        severity: 'info',
        message: 'New CPE device connected',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        deviceId: 'new-cpe',
        deviceName: 'Customer B LTE CPE'
      }
    ];
    
    const dashboardData = {
      summary: {
        total_devices: epcCount + mikrotikCount + cpeCount,
        sites: siteCount,
        critical_alerts: activeAlerts.filter(a => a.severity === 'critical').length,
        total_alerts: activeAlerts.length,
        services_down: 0
      },
      metrics: {
        uptime: 99.8,
        latency: Math.floor(Math.random() * 50) + 20,
        throughput: Math.floor(Math.random() * 1000) + 500
      },
      service_health: [
        { name: 'SNMP Collector', status: 'healthy' },
        { name: 'Mikrotik Integration', status: 'healthy' },
        { name: 'EPC Management', status: 'healthy' },
        { name: 'Network Equipment', status: 'healthy' }
      ],
      active_alerts: activeAlerts,
      device_counts: {
        epc: epcCount,
        mikrotik: mikrotikCount,
        cpe: cpeCount,
        sites: siteCount
      }
    };
    
    console.log(`📊 Dashboard data for tenant ${req.tenantId}:`, dashboardData.summary);
    
    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching monitoring dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch monitoring dashboard', message: error.message });
  }
});

// ========== NETWORK TOPOLOGY ==========

// GET /api/monitoring/topology - Get network topology data
router.get('/monitoring/topology', async (req, res) => {
  try {
    console.log(`🔍 Fetching network topology for tenant: ${req.tenantId}`);
    
    // Get all sites, equipment, and relationships
    const sites = await UnifiedSite.find({
      tenantId: req.tenantId,
      status: 'active'
    }).lean();
    
    const equipment = await NetworkEquipment.find({
      tenantId: req.tenantId,
      status: 'active'
    }).lean();
    
    const cpe = await UnifiedCPE.find({
      tenantId: req.tenantId,
      status: 'active'
    }).lean();
    
    // Build topology nodes and edges
    const nodes = [];
    const edges = [];
    
    // Add sites as nodes
    sites.forEach(site => {
      nodes.push({
        id: site._id.toString(),
        label: site.name,
        type: 'site',
        group: 'sites',
        level: 0
      });
    });
    
    // Add equipment as nodes and connect to sites
    equipment.forEach(equip => {
      nodes.push({
        id: equip._id.toString(),
        label: equip.name,
        type: equip.type,
        group: 'equipment',
        level: 1
      });
      
      if (equip.siteId) {
        edges.push({
          from: equip.siteId.toString(),
          to: equip._id.toString(),
          label: 'deployed at'
        });
      }
    });
    
    // Add CPE as nodes and connect to sites
    cpe.forEach(device => {
      nodes.push({
        id: device._id.toString(),
        label: device.name,
        type: 'cpe',
        group: 'cpe',
        level: 2
      });
      
      if (device.siteId) {
        edges.push({
          from: device.siteId.toString(),
          to: device._id.toString(),
          label: 'serves'
        });
      }
    });
    
    // Create logical connections between equipment
    // Connect routers to switches, switches to access points, etc.
    const routers = equipment.filter(e => e.type === 'router');
    const switches = equipment.filter(e => e.type === 'switch');
    
    routers.forEach(router => {
      switches.forEach(sw => {
        if (router.siteId && sw.siteId && router.siteId.toString() === sw.siteId.toString()) {
          edges.push({
            from: router._id.toString(),
            to: sw._id.toString(),
            label: 'connects to'
          });
        }
      });
    });
    
    const topology = {
      nodes,
      edges,
      stats: {
        total_nodes: nodes.length,
        total_edges: edges.length,
        sites: sites.length,
        equipment: equipment.length,
        cpe: cpe.length
      }
    };
    
    console.log(`📊 Network topology for tenant ${req.tenantId}: ${nodes.length} nodes, ${edges.length} edges`);
    
    res.json(topology);
  } catch (error) {
    console.error('Error fetching network topology:', error);
    res.status(500).json({ error: 'Failed to fetch network topology', message: error.message });
  }
});

module.exports = router;