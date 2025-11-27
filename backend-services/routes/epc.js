/**
 * EPC Management API Routes
 * Provides endpoints for EPC device management and monitoring
 */

const express = require('express');
const router = express.Router();
const { UnifiedSite, NetworkEquipment, HardwareDeployment } = require('../models/network');
const { RemoteEPC } = require('../models/distributed-epc-schema');
const { InventoryItem } = require('../models/inventory');

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

// Helper function to format EPC device for API response
const formatEPCDevice = (device, source = 'equipment') => {
  const config = source === 'equipment' && device.notes ? 
    (typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes) : 
    (device.config || {});

  // Calculate uptime based on last_seen
  const lastSeen = device.last_seen || device.last_heartbeat || device.updatedAt;
  const isOnline = lastSeen && (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000; // 5 min threshold
  
  return {
    id: device._id?.toString() || device.epc_id,
    epcId: device.epc_id || device._id?.toString(),
    name: device.name || device.site_name,
    status: device.status === 'online' || (device.status === 'active' && isOnline) || device.status === 'deployed' ? 'online' : 
            device.status === 'registered' ? 'pending' : 'offline',
    type: 'epc',
    device_code: device.device_code,
    hardware_id: device.hardware_id,
    location: {
      coordinates: {
        latitude: device.location?.latitude || device.location?.coordinates?.latitude || (device.siteId?.location?.latitude) || 0,
        longitude: device.location?.longitude || device.location?.coordinates?.longitude || (device.siteId?.location?.longitude) || 0
      },
      address: device.location?.address || (device.siteId?.location?.address) || 'Unknown Location'
    },
    ipAddress: device.ip_address || config.management_ip || null,
    manufacturer: device.manufacturer || 'WISPTools',
    model: device.model || 'EPC Server',
    serialNumber: device.serialNumber || device.epc_id || device._id?.toString(),
    deployment_type: device.deployment_type,
    services: device.deployment_type === 'snmp' ? ['SNMP'] : 
              device.deployment_type === 'both' ? ['MME', 'SGW', 'PGW', 'HSS', 'SNMP'] : 
              config.services || ['MME', 'SGW', 'PGW', 'HSS'],
    monitoring: config.monitoring || {
      cpu_threshold: 80,
      memory_threshold: 85,
      disk_threshold: 90
    },
    // Real metrics - will be populated by device heartbeat
    metrics: device.metrics || {
      cpuUsage: null,
      memoryUsage: null,
      diskUsage: null,
      activeUsers: null,
      uptime: null,
      throughput: null
    },
    last_seen: lastSeen,
    last_heartbeat: device.last_heartbeat,
    createdAt: device.createdAt || device.created_at,
    updatedAt: device.updatedAt || device.updated_at,
    deployedAt: device.deployedAt || device.createdAt || device.created_at
  };
};

// GET /api/epc/list - List all EPC devices for tenant
router.get('/list', async (req, res) => {
  try {
    console.log(`🔍 [EPC API] Fetching EPC devices for tenant: ${req.tenantId}`);
    
    const epcs = [];
    const seenIds = new Set();
    
    // PRIMARY SOURCE: Get EPCs from RemoteEPC collection (devices linked via device code)
    const remoteEPCs = await RemoteEPC.find({
      tenant_id: req.tenantId
    }).lean();
    
    console.log(`📡 Found ${remoteEPCs.length} RemoteEPCs`);
    
    remoteEPCs.forEach(epc => {
      const formatted = formatEPCDevice(epc, 'remote');
      epcs.push(formatted);
      seenIds.add(epc.epc_id);
    });
    
    // SECONDARY: Get EPC hardware deployments
    const epcDeployments = await HardwareDeployment.find({
      tenantId: req.tenantId,
      hardware_type: 'epc',
      status: 'deployed'
    }).populate('siteId', 'name location').lean();
    
    console.log(`📦 Found ${epcDeployments.length} EPC deployments`);
    
    // Add EPC deployments (skip if already in RemoteEPCs)
    epcDeployments.forEach(deployment => {
      if (!seenIds.has(deployment._id.toString())) {
        epcs.push(formatEPCDevice({
          _id: deployment._id,
          name: deployment.name,
          status: deployment.status,
          location: deployment.siteId?.location || {},
          config: deployment.config || {},
          createdAt: deployment.createdAt,
          updatedAt: deployment.updatedAt,
          deployedAt: deployment.deployedAt
        }, 'deployment'));
        seenIds.add(deployment._id.toString());
      }
    });
    
    // TERTIARY: Get network equipment that could be EPC servers (legacy)
    const epcEquipment = await NetworkEquipment.find({
      tenantId: req.tenantId,
      $or: [
        { name: /epc/i },
        { name: /core.*server/i },
        { name: /mme/i },
        { name: /sgw/i },
        { name: /pgw/i },
        { name: /hss/i },
        { type: 'other', name: /server/i }
      ],
      status: 'active'
    }).lean();
    
    console.log(`🖥️ Found ${epcEquipment.length} EPC equipment items`);
    
    // Add EPC equipment
    epcEquipment.forEach(equipment => {
      epcs.push(formatEPCDevice(equipment, 'equipment'));
    });
    
    console.log(`📊 Total EPC devices for tenant ${req.tenantId}: ${epcs.length}`);
    
    res.json({ 
      epcs,
      total: epcs.length,
      tenant: req.tenantId
    });
  } catch (error) {
    console.error('❌ [EPC API] Error fetching EPC devices:', error);
    res.status(500).json({ 
      error: 'Failed to fetch EPC devices', 
      message: error.message,
      epcs: []
    });
  }
});

// GET /api/epc/:id - Get specific EPC device details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 [EPC API] Fetching EPC device ${id} for tenant: ${req.tenantId}`);
    
    // Try to find as hardware deployment first
    let epcDevice = await HardwareDeployment.findOne({
      _id: id,
      tenantId: req.tenantId,
      hardware_type: 'epc'
    }).populate('siteId', 'name location').lean();
    
    if (epcDevice) {
      const formattedDevice = formatEPCDevice({
        _id: epcDevice._id,
        name: epcDevice.name,
        status: epcDevice.status,
        location: epcDevice.siteId?.location || {},
        config: epcDevice.config || {},
        createdAt: epcDevice.createdAt,
        updatedAt: epcDevice.updatedAt,
        deployedAt: epcDevice.deployedAt
      }, 'deployment');
      
      return res.json(formattedDevice);
    }
    
    // Try to find as network equipment
    epcDevice = await NetworkEquipment.findOne({
      _id: id,
      tenantId: req.tenantId,
      status: 'active'
    }).lean();
    
    if (epcDevice) {
      const formattedDevice = formatEPCDevice(epcDevice, 'equipment');
      return res.json(formattedDevice);
    }
    
    res.status(404).json({ error: 'EPC device not found' });
  } catch (error) {
    console.error('❌ [EPC API] Error fetching EPC device:', error);
    res.status(500).json({ 
      error: 'Failed to fetch EPC device', 
      message: error.message 
    });
  }
});

// GET /api/epc/metrics/:id - Get metrics for specific EPC device
router.get('/metrics/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📊 [EPC API] Fetching metrics for EPC device ${id}`);
    
    // In a real implementation, this would query a time-series database
    // For now, generate realistic mock metrics
    const metrics = {
      deviceId: id,
      timestamp: new Date().toISOString(),
      system: {
        cpuUsage: Math.floor(Math.random() * 100),
        memoryUsage: Math.floor(Math.random() * 100),
        diskUsage: Math.floor(Math.random() * 100),
        networkIn: Math.floor(Math.random() * 1000000),
        networkOut: Math.floor(Math.random() * 1000000),
        uptime: Math.floor(Math.random() * 31536000) // Up to 1 year in seconds
      },
      lte: {
        activeUsers: Math.floor(Math.random() * 500),
        attachedDevices: Math.floor(Math.random() * 1000),
        throughputDown: Math.floor(Math.random() * 1000),
        throughputUp: Math.floor(Math.random() * 500),
        bearerSetupSuccess: Math.random() * 100,
        handoverSuccess: Math.random() * 100
      },
      services: {
        mme: {
          status: 'running',
          connections: Math.floor(Math.random() * 100),
          responseTime: Math.floor(Math.random() * 50) + 10
        },
        sgw: {
          status: 'running',
          tunnels: Math.floor(Math.random() * 200),
          throughput: Math.floor(Math.random() * 800)
        },
        pgw: {
          status: 'running',
          sessions: Math.floor(Math.random() * 300),
          dataUsage: Math.floor(Math.random() * 10000)
        },
        hss: {
          status: 'running',
          subscribers: Math.floor(Math.random() * 1000),
          authRequests: Math.floor(Math.random() * 50)
        }
      }
    };
    
    res.json(metrics);
  } catch (error) {
    console.error('❌ [EPC API] Error fetching EPC metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch EPC metrics', 
      message: error.message 
    });
  }
});

// GET /api/epc/status - Get overall EPC system status
router.get('/status', async (req, res) => {
  try {
    console.log(`🔍 [EPC API] Fetching EPC system status for tenant: ${req.tenantId}`);
    
    // Get count of EPC devices by status
    const deployedCount = await HardwareDeployment.countDocuments({
      tenantId: req.tenantId,
      hardware_type: 'epc',
      status: 'deployed'
    });
    
    const equipmentCount = await NetworkEquipment.countDocuments({
      tenantId: req.tenantId,
      $or: [
        { name: /epc/i },
        { name: /core.*server/i }
      ],
      status: 'active'
    });
    
    const totalEPCs = deployedCount + equipmentCount;
    
    const status = {
      summary: {
        total_epcs: totalEPCs,
        online: Math.floor(totalEPCs * 0.9), // 90% online
        offline: Math.floor(totalEPCs * 0.1), // 10% offline
        maintenance: 0
      },
      services: {
        mme: { status: 'healthy', instances: totalEPCs },
        sgw: { status: 'healthy', instances: totalEPCs },
        pgw: { status: 'healthy', instances: totalEPCs },
        hss: { status: 'healthy', instances: Math.max(1, Math.floor(totalEPCs / 2)) }
      },
      performance: {
        avg_cpu: Math.floor(Math.random() * 50) + 25,
        avg_memory: Math.floor(Math.random() * 50) + 30,
        total_users: Math.floor(Math.random() * 1000) + 500,
        total_throughput: Math.floor(Math.random() * 5000) + 2000
      },
      alerts: {
        critical: 0,
        warning: Math.floor(Math.random() * 3),
        info: Math.floor(Math.random() * 5)
      }
    };
    
    res.json(status);
  } catch (error) {
    console.error('❌ [EPC API] Error fetching EPC status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch EPC status', 
      message: error.message 
    });
  }
});

module.exports = router;