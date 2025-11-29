/**
 * Monitoring API Routes
 * Provides endpoints for network monitoring, device status, and SNMP data
 */

const express = require('express');
const router = express.Router();
const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment, HardwareDeployment } = require('../models/network');
const { RemoteEPC, EPCServiceStatus } = require('../models/distributed-epc-schema');

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

  // Add device-specific fields - NO FAKE DATA, use real metrics from device or null
  if (type === 'epc') {
    const config = device.config || (device.notes ? JSON.parse(device.notes) : {});
    return {
      ...baseDevice,
      epcId: device._id.toString(),
      ipAddress: config.management_ip || device.ip_address || null,
      metrics: device.metrics || {
        cpuUsage: null,
        memoryUsage: null,
        activeUsers: null,
        uptime: null
      }
    };
  }

  if (type === 'mikrotik') {
    const config = device.notes ? JSON.parse(device.notes) : {};
    return {
      ...baseDevice,
      deviceType: deviceType || device.type,
      ipAddress: config.management_ip || null,
      manufacturer: device.manufacturer || 'Mikrotik',
      model: device.model || 'Unknown',
      serialNumber: device.serialNumber,
      metrics: device.metrics || {
        cpuUsage: null,
        memoryUsage: null,
        throughput: null,
        temperature: null
      }
    };
  }

  if (type === 'snmp') {
    const config = device.notes ? JSON.parse(device.notes) : {};
    return {
      ...baseDevice,
      deviceType: deviceType || device.type,
      ipAddress: config.management_ip || null,
      manufacturer: device.manufacturer || 'Generic',
      model: device.model || 'Unknown',
      snmpVersion: config.snmp_version || 'v2c',
      community: config.snmp_community || 'public',
      metrics: device.metrics || {
        cpuUsage: null,
        memoryUsage: null,
        portUtilization: null,
        temperature: null
      }
    };
  }

  return baseDevice;
};

// Helper function to format uptime
function formatUptime(seconds) {
  if (!seconds || seconds < 0) return null;
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// ========== EPC ENDPOINTS ==========

// GET /api/monitoring/epc/list - List all EPC devices for monitoring
router.get('/epc/list', async (req, res) => {
  try {
    console.log(`🔍 [Monitoring] Fetching EPC devices for tenant: ${req.tenantId}`);
    
    const epcs = [];
    const seenIds = new Set();
    
    // PRIMARY SOURCE: Get EPCs from RemoteEPC collection (devices linked via device code)
    const remoteEPCs = await RemoteEPC.find({ tenant_id: req.tenantId }).lean();
    console.log(`📡 [Monitoring] Found ${remoteEPCs.length} RemoteEPCs`);
    
    // Get latest service status for all EPCs to populate metrics - use efficient aggregation
    const epcIds = remoteEPCs.map(epc => epc.epc_id);
    const latestStatuses = await EPCServiceStatus.aggregate([
      { $match: { epc_id: { $in: epcIds }, tenant_id: req.tenantId } },
      { $sort: { timestamp: -1 } },
      { $group: {
          _id: '$epc_id',
          latest: { $first: '$$ROOT' }
        }
      }
    ]).allowDiskUse(true);
    
    // Create a map of epc_id -> latest status
    const statusMap = new Map();
    latestStatuses.forEach(item => {
      statusMap.set(item._id, item.latest);
    });
    
    remoteEPCs.forEach(epc => {
      const lastSeen = epc.last_seen || epc.last_heartbeat || epc.updated_at;
      const isOnline = lastSeen && (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000;
      
      // Get latest service status for this EPC
      const latestStatus = statusMap.get(epc.epc_id);
      
      // Format metrics from latest service status
      const metrics = latestStatus?.system ? {
        cpuUsage: latestStatus.system.cpu_percent ?? null,
        memoryUsage: latestStatus.system.memory_percent ?? null,
        uptime: latestStatus.system.uptime_seconds 
          ? formatUptime(latestStatus.system.uptime_seconds)
          : (epc.metrics?.system_uptime_seconds 
              ? formatUptime(epc.metrics.system_uptime_seconds)
              : null),
        activeUsers: null
      } : (epc.metrics?.system_uptime_seconds ? {
        cpuUsage: null,
        memoryUsage: null,
        uptime: formatUptime(epc.metrics.system_uptime_seconds),
        activeUsers: null
      } : {
        cpuUsage: null,
        memoryUsage: null,
        activeUsers: null,
        uptime: null
      });
      
      epcs.push({
        id: epc._id?.toString() || epc.epc_id,
        epcId: epc.epc_id,
        name: epc.site_name,
        type: 'epc',
        status: epc.status === 'online' || isOnline ? 'online' : 
                epc.status === 'registered' ? 'pending' : 'offline',
        device_code: epc.device_code,
        hardware_id: epc.hardware_id,
        ipAddress: epc.ip_address || null,
        deployment_type: epc.deployment_type,
        location: {
          coordinates: {
            latitude: epc.location?.coordinates?.latitude || epc.location?.latitude || 0,
            longitude: epc.location?.coordinates?.longitude || epc.location?.longitude || 0
          },
          address: epc.location?.address || 'Unknown Location'
        },
        metrics: metrics,
        last_seen: lastSeen,
        createdAt: epc.created_at,
        updatedAt: epc.updated_at
      });
      seenIds.add(epc.epc_id);
    });
    
    // SECONDARY: Get EPC hardware deployments (legacy)
    const epcDeployments = await HardwareDeployment.find({
      tenantId: req.tenantId,
      hardware_type: 'epc',
      status: 'deployed'
    }).populate('siteId', 'name location').lean();
    
    epcDeployments.forEach(deployment => {
      if (!seenIds.has(deployment._id.toString())) {
        epcs.push(formatDeviceForMonitoring({
          _id: deployment._id,
          name: deployment.name,
          status: deployment.status,
          location: deployment.siteId?.location || {},
          config: deployment.config || {},
          createdAt: deployment.createdAt,
          updatedAt: deployment.updatedAt
        }, 'epc'));
      }
    });
    
    console.log(`📊 [Monitoring] Total ${epcs.length} EPC devices for tenant ${req.tenantId}`);
    
    res.json({ epcs, total: epcs.length });
  } catch (error) {
    console.error('[Monitoring] Error fetching EPC devices:', error);
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
// GET /api/monitoring/snmp/discovered - Get discovered SNMP devices (proxies to SNMP route)
router.get('/snmp/discovered', async (req, res) => {
  try {
    const { NetworkEquipment } = require('../models/network');
    
    if (!req.tenantId) {
      return res.status(400).json({ error: 'X-Tenant-ID header is required' });
    }

    // Get all network equipment that was discovered via SNMP
    const devices = await NetworkEquipment.find({
      tenantId: req.tenantId,
      'notes.discovery_source': 'epc_snmp_agent'
    }).lean();

    // Parse notes and format for frontend
    const formattedDevices = devices.map(device => {
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

      // Check if device is deployed (has a siteId)
      const isDeployed = !!device.siteId;
      
      // Get enable_graphs from notes
      const enableGraphs = notes.enable_graphs !== false; // Default to true

      return {
        id: device._id.toString(),
        name: device.name || notes.sysName || device.manufacturer || 'Unknown Device',
        ipAddress: notes.management_ip || device.manufacturer || 'Unknown',
        deviceType: notes.device_type || device.type || 'other',
        manufacturer: device.manufacturer || notes.mikrotik?.identity || 'Unknown',
        model: device.model || notes.mikrotik?.board_name || 'Unknown',
        serialNumber: device.serialNumber || notes.mikrotik?.serial_number || null,
        status: device.status || 'active',
        discoveredAt: notes.discovered_at || notes.last_discovered || device.createdAt,
        snmp: {
          community: notes.snmp_community || 'public',
          version: notes.snmp_version || 'v2c'
        },
        isDeployed,
        enableGraphs,
        // Include OID walk data if available
        oidWalk: notes.oid_walk || null,
        interfaces: notes.oid_walk?.interfaces || null,
        arpTable: notes.oid_walk?.arp_table || null,
        routes: notes.oid_walk?.routes || null
      };
    });

    res.json({ devices: formattedDevices });
  } catch (error) {
    console.error('❌ [Monitoring API] Error fetching discovered devices:', error);
    res.status(500).json({
      error: 'Failed to fetch discovered devices',
      message: error.message,
      devices: []
    });
  }
});

router.get('/snmp/metrics/latest', async (req, res) => {
  try {
    console.log(`🔍 Fetching latest SNMP metrics for tenant: ${req.tenantId}`);
    
    // Get device list from database
    const allEquipment = await NetworkEquipment.find({
      tenantId: req.tenantId,
      status: 'active'
    }).lean();
    
    const allCPE = await UnifiedCPE.find({
      tenantId: req.tenantId,
      status: 'active'
    }).lean();
    
    // Return real metrics (null if not available) - NO FAKE DATA
    const metrics = [];
    
    // Get metrics for equipment
    allEquipment.forEach(device => {
      const config = device.notes ? JSON.parse(device.notes) : {};
      if (config.snmp_enabled || config.snmp_community || config.management_ip) {
        metrics.push({
          deviceId: device._id.toString(),
          deviceName: device.name,
          timestamp: device.updatedAt || new Date().toISOString(),
          metrics: device.metrics || {
            'cpu-usage': null,
            'memory-usage': null,
            'interface-1-in-octets': null,
            'interface-1-out-octets': null,
            'uptime': null,
            'temperature': null
          }
        });
      }
    });
    
    // Get metrics for CPE
    allCPE.forEach(device => {
      metrics.push({
        deviceId: device._id.toString(),
        deviceName: device.name,
        timestamp: device.updatedAt || new Date().toISOString(),
        metrics: device.metrics || {
          'signal-strength': null,
          'throughput-down': null,
          'throughput-up': null,
          'uptime': null
        }
      });
    });
    
    console.log(`📊 Found ${metrics.length} SNMP metrics for tenant ${req.tenantId}`);
    
    res.json(metrics);
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
    
    // Get real alerts from database (if EPCAlert model exists)
    let activeAlerts = [];
    try {
      const { EPCAlert } = require('../models/distributed-epc-schema');
      const recentAlerts = await EPCAlert.find({
        tenant_id: req.tenantId,
        status: { $in: ['active', 'unacknowledged'] }
      }).sort({ created_at: -1 }).limit(10).lean();
      
      activeAlerts = recentAlerts.map(alert => ({
        id: alert._id.toString(),
        severity: alert.severity || 'info',
        message: alert.message || alert.description || 'Alert',
        timestamp: alert.created_at?.toISOString() || new Date().toISOString(),
        deviceId: alert.epc_id || null,
        deviceName: alert.epc_id || 'Unknown Device'
      }));
    } catch (err) {
      console.log('EPCAlert model not available or no alerts:', err.message);
    }
    
    const dashboardData = {
      summary: {
        total_devices: epcCount + mikrotikCount + cpeCount,
        sites: siteCount,
        critical_alerts: activeAlerts.filter(a => a.severity === 'critical').length,
        total_alerts: activeAlerts.length,
        services_down: 0
      },
      metrics: {
        uptime: null,
        latency: null,
        throughput: null
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