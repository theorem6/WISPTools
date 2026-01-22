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
// Helper function to batch get device statuses from recent ping metrics
// This is much faster than calling getDeviceStatusFromPingMetrics individually for each device
async function getDeviceStatusesFromPingMetrics(deviceIds, tenantId) {
  try {
    const { PingMetrics } = require('../models/ping-metrics-schema');
    const mongoose = require('mongoose');
    
    if (!deviceIds || deviceIds.length === 0) {
      return new Map();
    }
    
    const statusMap = new Map();
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    // Convert deviceIds to a flat array including both string and ObjectId formats
    const deviceIdArray = [];
    deviceIds.forEach(id => {
      deviceIdArray.push(id);
      if (mongoose.Types.ObjectId.isValid(id)) {
        deviceIdArray.push(new mongoose.Types.ObjectId(id));
      }
    });
    
    // Single query to get all recent successful pings (last 15 minutes)
    // Use $in for better performance than $or
    const recentMetrics = await PingMetrics.find({
      device_id: { $in: deviceIdArray },
      tenant_id: tenantId,
      timestamp: { $gte: fifteenMinutesAgo },
      $or: [
        { success: true },
        { response_time_ms: { $ne: null } }
      ]
    })
    .sort({ timestamp: -1 })
    .lean();
    
    // Mark devices with recent successful pings as online
    recentMetrics.forEach(metric => {
      const deviceId = String(metric.device_id);
      if (!statusMap.has(deviceId)) {
        statusMap.set(deviceId, 'online');
      }
    });
    
    // For devices not yet marked, check 30-minute window
    const unmarkedIds = deviceIds.filter(id => !statusMap.has(String(id)));
    if (unmarkedIds.length > 0) {
      const unmarkedIdArray = [];
      unmarkedIds.forEach(id => {
        unmarkedIdArray.push(id);
        if (mongoose.Types.ObjectId.isValid(id)) {
          unmarkedIdArray.push(new mongoose.Types.ObjectId(id));
        }
      });
      
      const thirtyMinMetrics = await PingMetrics.find({
        device_id: { $in: unmarkedIdArray },
        tenant_id: tenantId,
        timestamp: { $gte: thirtyMinutesAgo },
        $or: [
          { success: true },
          { response_time_ms: { $ne: null } }
        ]
      })
      .sort({ timestamp: -1 })
      .lean();
      
      thirtyMinMetrics.forEach(metric => {
        const deviceId = String(metric.device_id);
        if (!statusMap.has(deviceId)) {
          statusMap.set(deviceId, 'online');
        }
      });
    }
    
    // For remaining devices, check if they have any metrics at all (mark as offline)
    const stillUnmarkedIds = deviceIds.filter(id => !statusMap.has(String(id)));
    if (stillUnmarkedIds.length > 0) {
      const stillUnmarkedIdArray = [];
      stillUnmarkedIds.forEach(id => {
        stillUnmarkedIdArray.push(id);
        if (mongoose.Types.ObjectId.isValid(id)) {
          stillUnmarkedIdArray.push(new mongoose.Types.ObjectId(id));
        }
      });
      
      const anyMetrics = await PingMetrics.find({
        device_id: { $in: stillUnmarkedIdArray },
        tenant_id: tenantId
      })
      .select('device_id')
      .lean();
      
      anyMetrics.forEach(metric => {
        const deviceId = String(metric.device_id);
        if (!statusMap.has(deviceId)) {
          statusMap.set(deviceId, 'offline');
        }
      });
    }
    
    return statusMap;
  } catch (error) {
    console.error(`[getDeviceStatusesFromPingMetrics] Error batch checking ping metrics:`, error);
    return new Map();
  }
}

// Legacy single-device function for backward compatibility (but prefer batch version)
async function getDeviceStatusFromPingMetrics(deviceId, tenantId) {
  const statusMap = await getDeviceStatusesFromPingMetrics([deviceId], tenantId);
  return statusMap.get(String(deviceId)) || null;
}

const formatDeviceForMonitoring = async (device, type, deviceType = null, tenantId = null, preFetchedPingStatus = null) => {
  // Determine device status based on monitoring data
  let deviceStatus = 'unknown'; // Default to unknown (grey) for devices without monitoring data
  
  let notes = {};
  if (device.notes) {
    try {
      notes = typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes;
    } catch (e) {
      notes = {};
    }
  }
  
  // First, try to get status from recent ping metrics (if tenantId is provided)
  // Use pre-fetched status if available (from batch query), otherwise fetch individually
  if (tenantId && device._id) {
    const pingStatus = preFetchedPingStatus || (await getDeviceStatusFromPingMetrics(device._id.toString(), tenantId));
    if (pingStatus) {
      deviceStatus = pingStatus;
    }
  }
  
  // If no ping status found, check device notes for monitoring data
  if (deviceStatus === 'unknown') {
    const hasMonitoringData = notes.last_ping_result || 
                              notes.last_snmp_poll || 
                              notes.monitoring_status ||
                              device.metrics;
    
    if (hasMonitoringData) {
      // Use monitoring status if available
      deviceStatus = notes.monitoring_status || 
                    (notes.last_ping_result === 'success' ? 'online' : 
                     notes.last_ping_result === 'failed' ? 'offline' : 
                     device.status === 'active' ? 'online' : 'offline');
    } else if (device.siteId) {
      // Deployed device but no monitoring data yet - show as unknown (grey)
      deviceStatus = 'unknown';
    } else {
      // Use device status for non-deployed devices
      deviceStatus = device.status === 'active' ? 'online' : 'offline';
    }
  }
  
  // Extract siteId from device (handle ObjectId objects)
  const deviceSiteId = device.siteId?._id || device.siteId?.id || device.siteId || null;
  const normalizedSiteId = deviceSiteId ? (typeof deviceSiteId === 'object' ? deviceSiteId.toString() : String(deviceSiteId)) : null;
  
  const baseDevice = {
    id: device._id.toString(),
    name: device.name,
    type: type,
    status: deviceStatus,
    siteId: normalizedSiteId, // CRITICAL: Include siteId so devices can be matched to sites
    site_id: normalizedSiteId, // Also include snake_case for compatibility
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
    let notes = {};
    if (device.notes) {
      try {
        notes = typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes;
      } catch (e) {
        notes = {};
      }
    }
    return {
      ...baseDevice,
      deviceType: deviceType || device.type,
      ipAddress: notes.management_ip || null,
      manufacturer: notes.manufacturer_detected_via_oui || 
                    notes.oui_detection?.manufacturer || 
                    device.manufacturer || 
                    'Generic',
      model: device.model || 'Unknown',
      snmpVersion: notes.snmp_version || 'v2c',
      community: notes.snmp_community || 'public',
      metrics: device.metrics || {
        cpuUsage: null,
        memoryUsage: null,
        portUtilization: null,
        temperature: null
      }
    };
  }
  
  // Handle network equipment from deploy module (default type)
  if (type === 'network_equipment' || !type) {
    let equipmentNotes = {};
    if (device.notes) {
      try {
        equipmentNotes = typeof device.notes === 'string' ? JSON.parse(device.notes) : device.notes;
      } catch (e) {
        equipmentNotes = {};
      }
    }
    
    return {
      ...baseDevice,
      deviceType: deviceType || device.type || 'other',
      ipAddress: equipmentNotes.management_ip || equipmentNotes.ip_address || equipmentNotes.ipAddress || null,
      manufacturer: device.manufacturer || equipmentNotes.manufacturer_detected_via_oui || 'Generic',
      model: device.model || 'Unknown',
      serialNumber: device.serialNumber,
      metrics: device.metrics || {}
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
  const startTime = Date.now();
  try {
    const { createDebugLogger } = require('../utils/debug');
    const debug = createDebugLogger(req);
    debug.log(`🔍 [Monitoring] Fetching EPC devices for tenant: ${req.tenantId}`);
    
    const epcs = [];
    const seenIds = new Set();
    
    // PRIMARY SOURCE: Get EPCs from RemoteEPC collection (devices linked via device code)
    // TENANT-SPECIFIC ONLY: Only return EPCs that belong to this tenant
    const queryStart = Date.now();
    const tenantEPCs = await RemoteEPC.find({
      tenant_id: req.tenantId
    }).lean();
    console.log(`⏱️ [Monitoring] RemoteEPC query took ${Date.now() - queryStart}ms, found ${tenantEPCs.length} EPCs`);
    
    // Get all sites to populate EPC locations from site_id
    const siteIds = tenantEPCs.map(epc => epc.site_id).filter(Boolean);
    const mongoose = require('mongoose');
    
    // Convert site_ids to ObjectIds if they're strings
    const siteObjectIds = siteIds.map(siteId => {
      if (typeof siteId === 'string' && mongoose.Types.ObjectId.isValid(siteId)) {
        return new mongoose.Types.ObjectId(siteId);
      }
      return siteId;
    }).filter(Boolean);
    
    const sites = siteObjectIds.length > 0 ? await UnifiedSite.find({
      tenantId: req.tenantId,
      _id: { $in: siteObjectIds }
    })
    .select('_id name location')
    .lean() : [];
    
    const siteMap = new Map();
    sites.forEach(site => {
      siteMap.set(String(site._id), site);
    });
    
    // Get latest service status for all EPCs to populate metrics - use efficient aggregation
    const epcIds = tenantEPCs.map(epc => epc.epc_id);
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
    
    tenantEPCs.forEach(epc => {
      const lastSeen = epc.last_seen || epc.last_heartbeat || epc.updated_at;
      // Check if last check-in was within 5 minutes - prioritize timestamp over status field
      // If last_seen is missing or more than 5 minutes ago, EPC is offline
      const isOnline = lastSeen && (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000;
      
      // Calculate time since last check-in (for offline display)
      const timeSinceCheckin = lastSeen 
        ? Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000) // seconds
        : null;
      
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
      
      // Get location from site if EPC doesn't have coordinates
      let location = {
        coordinates: {
          latitude: epc.location?.coordinates?.latitude || epc.location?.latitude || 0,
          longitude: epc.location?.coordinates?.longitude || epc.location?.longitude || 0
        },
        address: epc.location?.address || 'Unknown Location'
      };
      
      // If EPC has site_id but no valid coordinates, get location from site
      if (epc.site_id && (!location.coordinates.latitude || location.coordinates.latitude === 0)) {
        // Try multiple formats for site_id matching
        const siteIdStr = typeof epc.site_id === 'object' ? epc.site_id.toString() : String(epc.site_id);
        let site = siteMap.get(siteIdStr);
        
        // If not found, try ObjectId format
        if (!site && mongoose.Types.ObjectId.isValid(siteIdStr)) {
          const siteObjId = new mongoose.Types.ObjectId(siteIdStr);
          site = siteMap.get(siteObjId.toString());
        }
        
        if (site && site.location) {
          location = {
            coordinates: {
              latitude: site.location.latitude || site.location.coordinates?.latitude || 0,
              longitude: site.location.longitude || site.location.coordinates?.longitude || 0
            },
            address: site.location.address || site.name || epc.site_name || 'Unknown Location'
          };
          debug.log(`[Monitoring] EPC ${epc.epc_id} (${epc.site_name}) got location from site ${siteIdStr}: ${location.coordinates.latitude}, ${location.coordinates.longitude}`);
        } else if (epc.site_id) {
          debug.log(`[Monitoring] EPC ${epc.epc_id} (${epc.site_name}) has site_id ${siteIdStr} but site not found in ${siteMap.size} loaded sites`);
        }
      }
      
      // Determine status: prioritize timestamp check over status field
      // BUT: If we have recent service status data (within 10 minutes), consider EPC online
      // This handles cases where check-in is delayed but service status is still being reported
      const hasRecentServiceStatus = latestStatus && latestStatus.timestamp && 
        (Date.now() - new Date(latestStatus.timestamp).getTime()) < 10 * 60 * 1000;
      
      let status;
      if (!lastSeen && !hasRecentServiceStatus) {
        status = 'offline'; // Never checked in and no recent service status
      } else if (isOnline || hasRecentServiceStatus) {
        status = 'online'; // Checked in within last 5 minutes OR has recent service status
      } else if (epc.status === 'registered') {
        status = 'pending'; // Registered but not yet checked in
      } else {
        status = 'offline'; // Last check-in was more than 5 minutes ago and no recent service status
      }
      
      epcs.push({
        id: epc._id?.toString() || epc.epc_id,
        epcId: epc.epc_id,
        name: epc.site_name,
        type: 'epc',
        status: status,
        device_code: epc.device_code,
        hardware_id: epc.hardware_id,
        ipAddress: epc.ip_address || null,
        deployment_type: epc.deployment_type,
        siteId: epc.site_id ? (typeof epc.site_id === 'object' ? epc.site_id.toString() : epc.site_id) : null,
        location: location,
        metrics: metrics,
        last_seen: lastSeen,
        last_heartbeat: epc.last_heartbeat,
        timeSinceCheckin: timeSinceCheckin, // Time in seconds since last check-in
        createdAt: epc.created_at,
        updatedAt: epc.updated_at
      });
      seenIds.add(epc.epc_id);
    });
    
    // SECONDARY: Get EPC hardware deployments (legacy - include all statuses, not just 'deployed')
    const epcDeployments = await HardwareDeployment.find({
      tenantId: req.tenantId,
      hardware_type: 'epc'
      // Don't filter by status - include all EPC hardware deployments
    }).populate('siteId', 'name location').lean();
    
    // Batch format deployments for better performance
    const deploymentDevices = epcDeployments
      .filter(deployment => !seenIds.has(deployment._id.toString()))
      .map(deployment => ({
        _id: deployment._id,
        name: deployment.name,
        status: deployment.status,
        location: deployment.siteId?.location || {},
        config: deployment.config || {},
        createdAt: deployment.createdAt,
        updatedAt: deployment.updatedAt
      }));
    
    if (deploymentDevices.length > 0) {
      // Batch get ping statuses for all deployment devices
      const deploymentDeviceIds = deploymentDevices.map(d => d._id.toString());
      const pingStart = Date.now();
      const deploymentStatusMap = await getDeviceStatusesFromPingMetrics(deploymentDeviceIds, req.tenantId);
      console.log(`⏱️ [Monitoring] EPC deployment ping status batch query took ${Date.now() - pingStart}ms for ${deploymentDeviceIds.length} devices`);
      
      // Format all devices in parallel
      const formattedDeployments = await Promise.all(
        deploymentDevices.map(async (device) => {
          // Use pre-fetched status if available
          const preStatus = deploymentStatusMap.get(device._id.toString());
          return formatDeviceForMonitoring(device, 'epc', null, req.tenantId, preStatus);
        })
      );
      
      epcs.push(...formattedDeployments);
    }
    
    debug.log(`📊 [Monitoring] Total ${epcs.length} EPC devices for tenant ${req.tenantId}`);
    console.log(`⏱️ [Monitoring] Total EPC endpoint time: ${Date.now() - startTime}ms`);
    
    res.json({ epcs, total: epcs.length });
  } catch (error) {
    console.error('[Monitoring] Error fetching EPC devices:', error);
    console.log(`⏱️ [Monitoring] EPC endpoint failed after ${Date.now() - startTime}ms`);
    res.status(500).json({ error: 'Failed to fetch EPC devices', message: error.message });
  }
});

// ========== MIKROTIK ENDPOINTS ==========

// GET /api/mikrotik/devices - List all Mikrotik devices
router.get('/mikrotik/devices', async (req, res) => {
  const startTime = Date.now();
  try {
    const { createDebugLogger } = require('../utils/debug');
    const debug = createDebugLogger(req);
    debug.log(`🔍 Fetching Mikrotik devices for tenant: ${req.tenantId}`);
    
    // Get Mikrotik network equipment (include both active and planned/deployed devices)
    const queryStart = Date.now();
    const mikrotikEquipment = await NetworkEquipment.find({
      tenantId: req.tenantId,
      manufacturer: /mikrotik/i,
      $or: [
        { status: 'active' },
        { status: 'planned', siteId: { $exists: true, $ne: null } } // Include planned devices that are deployed (have siteId)
      ]
    }).lean();
    
    // Get Mikrotik CPE devices (include both active and planned/deployed devices)
    const mikrotikCPE = await UnifiedCPE.find({
      tenantId: req.tenantId,
      manufacturer: /mikrotik/i,
      $or: [
        { status: 'active' },
        { status: 'planned', siteId: { $exists: true, $ne: null } } // Include planned devices that are deployed (have siteId)
      ]
    }).lean();
    
    // Get all sites for location lookup
    const siteMap = new Map();
    const allDevices = [...mikrotikEquipment, ...mikrotikCPE];
    if (allDevices.length > 0) {
      const siteIds = allDevices
        .map(d => d.siteId)
        .filter(id => id)
        .map(id => typeof id === 'object' ? id._id || id : id);
      
      if (siteIds.length > 0) {
        const sites = await UnifiedSite.find({
          _id: { $in: siteIds },
          tenantId: req.tenantId
        }).select('_id name location').lean();
        
        sites.forEach(site => {
          siteMap.set(site._id.toString(), site);
        });
      }
    }
    
    // Batch get ping statuses for all Mikrotik devices
    const allMikrotikDeviceIds = [...mikrotikEquipment, ...mikrotikCPE]
      .map(d => d._id?.toString())
      .filter(Boolean);
    const pingStart = Date.now();
    const mikrotikStatusMap = await getDeviceStatusesFromPingMetrics(allMikrotikDeviceIds, req.tenantId);
    console.log(`⏱️ [Monitoring] Mikrotik ping status batch query took ${Date.now() - pingStart}ms for ${allMikrotikDeviceIds.length} devices`);
    
    const devices = [];
    
    // Add Mikrotik equipment with location from site if needed (parallelized)
    const equipmentDevices = await Promise.all(
      mikrotikEquipment.map(async (equipment) => {
        const preStatus = mikrotikStatusMap.get(equipment._id.toString());
        const device = await formatDeviceForMonitoring(equipment, 'mikrotik', equipment.type, req.tenantId, preStatus);
        
        // If device has siteId but no valid coordinates, get location from site
        if (equipment.siteId && (!device.location?.coordinates?.latitude || device.location.coordinates.latitude === 0)) {
          const siteIdStr = typeof equipment.siteId === 'object' ? equipment.siteId._id?.toString() || equipment.siteId.toString() : equipment.siteId.toString();
          const site = siteMap.get(siteIdStr) || (typeof equipment.siteId === 'object' ? equipment.siteId : null);
          
          if (site && site.location) {
            device.location = {
              coordinates: {
                latitude: site.location.latitude || 0,
                longitude: site.location.longitude || 0
              },
              address: site.location.address || device.location?.address || 'Unknown Location'
            };
          }
        }
        
        return device;
      })
    );
    devices.push(...equipmentDevices);
    
    // Add Mikrotik CPE with location from site if needed (parallelized)
    const cpeDevices = await Promise.all(
      mikrotikCPE.map(async (cpe) => {
        const preStatus = mikrotikStatusMap.get(cpe._id.toString());
        const device = await formatDeviceForMonitoring(cpe, 'mikrotik', 'cpe', req.tenantId, preStatus);
        
        // If device has siteId but no valid coordinates, get location from site
        if (cpe.siteId && (!device.location?.coordinates?.latitude || device.location.coordinates.latitude === 0)) {
          const siteIdStr = typeof cpe.siteId === 'object' ? cpe.siteId._id?.toString() || cpe.siteId.toString() : cpe.siteId.toString();
          const site = siteMap.get(siteIdStr) || (typeof cpe.siteId === 'object' ? cpe.siteId : null);
          
          if (site && site.location) {
            device.location = {
              coordinates: {
                latitude: site.location.latitude || 0,
                longitude: site.location.longitude || 0
              },
              address: site.location.address || device.location?.address || 'Unknown Location'
            };
          }
        }
        
        return device;
      })
    );
    devices.push(...cpeDevices);
    
    console.log(`📊 Found ${devices.length} Mikrotik devices for tenant ${req.tenantId}`);
    console.log(`⏱️ [Monitoring] Mikrotik endpoint took ${Date.now() - startTime}ms (query: ${Date.now() - queryStart}ms)`);
    
    res.json({ devices });
  } catch (error) {
    console.error('Error fetching Mikrotik devices:', error);
    console.log(`⏱️ [Monitoring] Mikrotik endpoint failed after ${Date.now() - startTime}ms`);
    res.status(500).json({ error: 'Failed to fetch Mikrotik devices', message: error.message });
  }
});

// ========== SNMP ENDPOINTS ==========

// GET /api/snmp/devices - List all SNMP-enabled devices
router.get('/snmp/devices', async (req, res) => {
  const startTime = Date.now();
  try {
    const { createDebugLogger } = require('../utils/debug');
    const debug = createDebugLogger(req);
    debug.log(`🔍 Fetching SNMP devices for tenant: ${req.tenantId}`);
    
    // Get all network equipment with SNMP enabled (include both active and planned/deployed devices)
    const queryStart = Date.now();
    const snmpEquipment = await NetworkEquipment.find({
      tenantId: req.tenantId,
      $and: [
        {
          $or: [
            { status: 'active' },
            { status: 'planned', siteId: { $exists: true, $ne: null } } // Include planned devices that are deployed (have siteId)
          ]
        },
        {
          $or: [
            { notes: /snmp_enabled.*true/i },
            { notes: /snmp_community/i },
            { notes: /snmp_version/i }
          ]
        }
      ]
    }).lean();
    
    // Get CPE devices with SNMP modules enabled
    // Include both active and planned/deployed CPE devices
    const snmpCPE = await UnifiedCPE.find({
      tenantId: req.tenantId,
      $or: [
        { status: 'active' },
        { status: 'planned', siteId: { $exists: true, $ne: null } } // Include planned devices that are deployed (have siteId)
      ],
      'modules.acs.enabled': true
    }).lean();
    
    // Get all sites for location lookup
    const siteMap = new Map();
    const allDevices = [...snmpEquipment, ...snmpCPE];
    if (allDevices.length > 0) {
      const siteIds = allDevices
        .map(d => d.siteId)
        .filter(id => id)
        .map(id => typeof id === 'object' ? id._id || id : id);
      
      if (siteIds.length > 0) {
        const sites = await UnifiedSite.find({
          _id: { $in: siteIds },
          tenantId: req.tenantId
        }).select('_id name location').lean();
        
        sites.forEach(site => {
          siteMap.set(site._id.toString(), site);
        });
      }
    }
    
    // Batch get ping statuses for all SNMP devices
    const allSNMPDeviceIds = [...snmpEquipment, ...snmpCPE]
      .map(d => d._id?.toString())
      .filter(Boolean);
    const pingStart = Date.now();
    const snmpStatusMap = await getDeviceStatusesFromPingMetrics(allSNMPDeviceIds, req.tenantId);
    console.log(`⏱️ [Monitoring] SNMP ping status batch query took ${Date.now() - pingStart}ms for ${allSNMPDeviceIds.length} devices`);
    
    const devices = [];
    
    // Add SNMP equipment with location from site if needed (parallelized)
    const equipmentDevices = await Promise.all(
      snmpEquipment.map(async (equipment) => {
        const preStatus = snmpStatusMap.get(equipment._id.toString());
        const device = await formatDeviceForMonitoring(equipment, 'snmp', equipment.type, req.tenantId, preStatus);
        
        // If device has siteId but no valid coordinates, get location from site
        if (equipment.siteId && (!device.location?.coordinates?.latitude || device.location.coordinates.latitude === 0)) {
          const siteIdStr = typeof equipment.siteId === 'object' ? equipment.siteId._id?.toString() || equipment.siteId.toString() : equipment.siteId.toString();
          const site = siteMap.get(siteIdStr) || (typeof equipment.siteId === 'object' ? equipment.siteId : null);
          
          if (site && site.location) {
            device.location = {
              coordinates: {
                latitude: site.location.latitude || 0,
                longitude: site.location.longitude || 0
              },
              address: site.location.address || device.location?.address || 'Unknown Location'
            };
          }
        }
        
        return device;
      })
    );
    devices.push(...equipmentDevices);
    
    // Add SNMP CPE with location from site if needed (parallelized)
    const cpeDevices = await Promise.all(
      snmpCPE.map(async (cpe) => {
        const preStatus = snmpStatusMap.get(cpe._id.toString());
        const device = await formatDeviceForMonitoring(cpe, 'snmp', 'cpe', req.tenantId, preStatus);
        
        // If device has siteId but no valid coordinates, get location from site
        if (cpe.siteId && (!device.location?.coordinates?.latitude || device.location.coordinates.latitude === 0)) {
          const siteIdStr = typeof cpe.siteId === 'object' ? cpe.siteId._id?.toString() || cpe.siteId.toString() : cpe.siteId.toString();
          const site = siteMap.get(siteIdStr) || (typeof cpe.siteId === 'object' ? cpe.siteId : null);
          
          if (site && site.location) {
            device.location = {
              coordinates: {
                latitude: site.location.latitude || 0,
                longitude: site.location.longitude || 0
              },
              address: site.location.address || device.location?.address || 'Unknown Location'
            };
          }
        }
        
        return device;
      })
    );
    devices.push(...cpeDevices);
    
    console.log(`📊 Found ${devices.length} SNMP devices for tenant ${req.tenantId}`);
    console.log(`⏱️ [Monitoring] SNMP devices endpoint took ${Date.now() - startTime}ms (query: ${Date.now() - queryStart}ms)`);
    
    res.json({ devices });
  } catch (error) {
    console.error('Error fetching SNMP devices:', error);
    console.log(`⏱️ [Monitoring] SNMP devices endpoint failed after ${Date.now() - startTime}ms`);
    res.status(500).json({ error: 'Failed to fetch SNMP devices', message: error.message });
  }
});

// GET /api/snmp/metrics/latest - Get latest SNMP metrics for all devices
// GET /api/monitoring/snmp/discovered - Get discovered SNMP devices (proxies to SNMP route)
router.get('/snmp/discovered', async (req, res) => {
  const startTime = Date.now();
  try {
    const { NetworkEquipment } = require('../models/network');
    
    if (!req.tenantId) {
      return res.status(400).json({ error: 'X-Tenant-ID header is required' });
    }

    // Get all network equipment that was discovered via SNMP (include both active and planned/deployed devices)
    // Notes are stored as JSON strings, so we search for the discovery_source string
    const queryStart = Date.now();
    const devices = await NetworkEquipment.find({
      tenantId: req.tenantId,
      $and: [
        {
          $or: [
            { 'notes.discovery_source': 'epc_snmp_agent' }, // If notes is an object (future-proofing)
            { notes: { $regex: 'epc_snmp_agent', $options: 'i' } } // If notes is a JSON string (current format)
          ]
        },
        {
          $or: [
            { status: 'active' },
            { status: 'planned', siteId: { $exists: true, $ne: null } } // Include planned devices that are deployed (have siteId)
          ]
        }
      ]
    }).lean();

    // Get all sites for location lookup (in case populate didn't work)
    const siteMap = new Map();
    if (devices.length > 0) {
      const siteIds = devices
        .map(d => d.siteId)
        .filter(id => id)
        .map(id => typeof id === 'object' ? id._id || id : id);
      
      if (siteIds.length > 0) {
        const sites = await UnifiedSite.find({
          _id: { $in: siteIds },
          tenantId: req.tenantId
        }).select('_id name location').lean();
        
        sites.forEach(site => {
          siteMap.set(site._id.toString(), site);
        });
      }
    }

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

      // Extract IP address from various possible fields
      // serialNumber often contains the IP address as fallback
      let ipAddress = notes.management_ip;
      if (!ipAddress && device.serialNumber) {
        // Check if serialNumber looks like an IP address
        if (typeof device.serialNumber === 'string' && /^\d+\.\d+\.\d+\.\d+$/.test(device.serialNumber)) {
          ipAddress = device.serialNumber;
        }
      }
      if (!ipAddress) {
        ipAddress = 'Unknown';
      }
      
      // Include location data from device record, or populate from site if device has siteId
      let location = device.location || {};
      let locationCoordinates = location.coordinates || {
        latitude: location.latitude || 0,
        longitude: location.longitude || 0
      };
      
      // If device has siteId but no valid coordinates, get location from site
      if (device.siteId && (locationCoordinates.latitude === 0 || locationCoordinates.longitude === 0)) {
        const siteIdStr = typeof device.siteId === 'object' ? device.siteId._id?.toString() || device.siteId.toString() : device.siteId.toString();
        const site = siteMap.get(siteIdStr) || (typeof device.siteId === 'object' ? device.siteId : null);
        
        if (site && site.location) {
          location = site.location;
          locationCoordinates = {
            latitude: site.location.latitude || 0,
            longitude: site.location.longitude || 0
          };
        }
      }

      return {
        id: device._id.toString(),
        name: device.name || notes.sysName || notes.sysDescr || ipAddress || 'Unknown Device',
        ipAddress: ipAddress,
        ip_address: ipAddress, // Also include snake_case for compatibility
        deviceType: notes.device_type || device.type || 'other',
        type: notes.device_type || device.type || 'snmp', // Add type field for compatibility
        manufacturer: notes.manufacturer_detected_via_oui || 
                      notes.oui_detection?.manufacturer || 
                      device.manufacturer || 
                      notes.mikrotik?.identity || 
                      'Unknown',
        model: device.model || notes.mikrotik?.board_name || notes.sysDescr || 'Unknown',
        serialNumber: device.serialNumber || notes.mikrotik?.serial_number || ipAddress,
        status: device.status || 'active',
        discoveredAt: notes.discovered_at || notes.last_discovered || device.createdAt,
        snmp: {
          community: notes.snmp_community || 'public',
          version: notes.snmp_version || 'v2c'
        },
        isDeployed,
        siteId: device.siteId ? (typeof device.siteId === 'object' ? device.siteId.toString() : device.siteId) : null,
        enableGraphs,
        // Include location data for map display
        location: {
          coordinates: {
            latitude: locationCoordinates.latitude || 0,
            longitude: locationCoordinates.longitude || 0
          },
          address: location.address || 'Discovered Device'
        },
        // Include OID walk data if available
        oidWalk: notes.oid_walk || null,
        interfaces: notes.oid_walk?.interfaces || null,
        arpTable: notes.oid_walk?.arp_table || null,
        routes: notes.oid_walk?.routes || null,
        // Include raw notes fields for debugging
        sysName: notes.sysName || null,
        sysDescr: notes.sysDescr || null,
        management_ip: notes.management_ip || null
      };
    });

    console.log(`⏱️ [Monitoring] Discovered devices endpoint took ${Date.now() - startTime}ms (query: ${Date.now() - queryStart}ms)`);
    res.json({ devices: formattedDevices });
  } catch (error) {
    console.error('❌ [Monitoring API] Error fetching discovered devices:', error);
    console.log(`⏱️ [Monitoring] Discovered devices endpoint failed after ${Date.now() - startTime}ms`);
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
    // Include both active and planned/deployed devices
    const allEquipment = await NetworkEquipment.find({
      tenantId: req.tenantId,
      $or: [
        { status: 'active' },
        { status: 'planned', siteId: { $exists: true, $ne: null } } // Include planned devices that are deployed (have siteId)
      ]
    }).lean();
    
    const allCPE = await UnifiedCPE.find({
      tenantId: req.tenantId,
      $or: [
        { status: 'active' },
        { status: 'planned', siteId: { $exists: true, $ne: null } } // Include planned devices that are deployed (have siteId)
      ]
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
    const { createDebugLogger } = require('../utils/debug');
    const debug = createDebugLogger(req);
    debug.log(`🔍 Fetching monitoring dashboard for tenant: ${req.tenantId}`);
    
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
    const { createDebugLogger } = require('../utils/debug');
    const debug = createDebugLogger(req);
    debug.log(`🔍 Fetching network topology for tenant: ${req.tenantId}`);
    
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
