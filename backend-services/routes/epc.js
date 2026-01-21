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

  // Calculate uptime based on last_seen - prioritize timestamp over status field
  const lastSeen = device.last_seen || device.last_heartbeat || device.updatedAt;
  // Check if last check-in was within 5 minutes - if not, EPC is offline regardless of status field
  const isOnline = lastSeen && (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000; // 5 min threshold
  
  // Calculate time since last check-in (for offline display)
  const timeSinceCheckin = lastSeen 
    ? Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000) // seconds
    : null;
  
  // Determine status: prioritize timestamp check over status field
  let status;
  if (!lastSeen) {
    status = 'offline'; // Never checked in
  } else if (isOnline) {
    status = 'online'; // Checked in within last 5 minutes
  } else if (device.status === 'registered') {
    status = 'pending'; // Registered but not yet checked in
  } else {
    status = 'offline'; // Last check-in was more than 5 minutes ago
  }
  
  return {
    id: device._id?.toString() || device.epc_id,
    epcId: device.epc_id || device._id?.toString(),
    name: device.name || device.site_name,
    status: status,
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
    timeSinceCheckin: timeSinceCheckin, // Time in seconds since last check-in
    createdAt: device.createdAt || device.created_at,
    updatedAt: device.updatedAt || device.updated_at,
    deployedAt: device.deployedAt || device.createdAt || device.created_at
  };
};

// GET /api/epc/list - List all EPC devices for tenant
router.get('/list', async (req, res) => {
  try {
    const { createDebugLogger } = require('../utils/debug');
    const debug = createDebugLogger(req);
    debug.log(`🔍 [EPC API] Fetching EPC devices for tenant: ${req.tenantId}`);
    
    const epcs = [];
    const seenIds = new Set();
    
    // PRIMARY SOURCE: Get EPCs from RemoteEPC collection (devices linked via device code)
    const remoteEPCs = await RemoteEPC.find({
      tenant_id: req.tenantId
    }).lean();
    
    debug.log(`📡 Found ${remoteEPCs.length} RemoteEPCs`);
    
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
    
    // Try to get real metrics from RemoteEPC
    const remoteEPC = await RemoteEPC.findOne({
      $or: [
        { epc_id: id },
        { _id: id }
      ],
      tenant_id: req.tenantId
    }).lean();
    
    // Return real metrics from device check-in or null if not available
    const metrics = {
      deviceId: id,
      timestamp: new Date().toISOString(),
      system: {
        cpuUsage: remoteEPC?.metrics?.cpu_percent ?? null,
        memoryUsage: remoteEPC?.metrics?.memory_percent ?? null,
        diskUsage: remoteEPC?.metrics?.disk_percent ?? null,
        networkIn: remoteEPC?.metrics?.network_in_bytes ?? null,
        networkOut: remoteEPC?.metrics?.network_out_bytes ?? null,
        uptime: remoteEPC?.metrics?.uptime_seconds ?? null
      },
      lte: {
        activeUsers: null,
        attachedDevices: null,
        throughputDown: null,
        throughputUp: null,
        bearerSetupSuccess: null,
        handoverSuccess: null
      },
      services: {
        mme: {
          status: remoteEPC?.last_status?.services?.['open5gs-mmed']?.status ?? null,
          connections: null,
          responseTime: null
        },
        sgw: {
          status: remoteEPC?.last_status?.services?.['open5gs-sgwcd']?.status ?? null,
          tunnels: null,
          throughput: null
        },
        smf: {
          status: remoteEPC?.last_status?.services?.['open5gs-smfd']?.status ?? null,
          sessions: null,
          dataUsage: null
        },
        upf: {
          status: remoteEPC?.last_status?.services?.['open5gs-upfd']?.status ?? null,
          throughput: null
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
    
    // Get real counts from RemoteEPC collection
    const remoteEPCCount = await RemoteEPC.countDocuments({ tenant_id: req.tenantId });
    const onlineCount = await RemoteEPC.countDocuments({
      tenant_id: req.tenantId,
      status: 'online'
    });
    const offlineCount = remoteEPCCount - onlineCount;
    
    // Calculate real performance metrics from RemoteEPC data
    const onlineEPCs = await RemoteEPC.find({
      tenant_id: req.tenantId,
      status: 'online'
    }).select('metrics').lean();
    
    const cpuValues = onlineEPCs.map(epc => epc.metrics?.cpu_percent).filter(v => v !== null && v !== undefined);
    const memoryValues = onlineEPCs.map(epc => epc.metrics?.memory_percent).filter(v => v !== null && v !== undefined);
    
    const avg_cpu = cpuValues.length > 0 
      ? Math.round(cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length)
      : null;
    const avg_memory = memoryValues.length > 0
      ? Math.round(memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length)
      : null;
    
    const status = {
      summary: {
        total_epcs: remoteEPCCount,
        online: onlineCount,
        offline: offlineCount,
        maintenance: 0
      },
      services: {
        mme: { status: 'unknown', instances: remoteEPCCount },
        sgw: { status: 'unknown', instances: remoteEPCCount },
        smf: { status: 'unknown', instances: remoteEPCCount },
        upf: { status: 'unknown', instances: remoteEPCCount }
      },
      performance: {
        avg_cpu,
        avg_memory,
        total_users: null,
        total_throughput: null
      },
      alerts: {
        critical: 0,
        warning: 0,
        info: 0
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