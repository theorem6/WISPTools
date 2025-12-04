const express = require('express');
const router = express.Router();
const { UnifiedSite, UnifiedCPE, NetworkEquipment } = require('../../models/network');
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

// GET /api/snmp/metrics/latest - Get latest metrics for all devices
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
// NOTE: SNMP polling is DISABLED on cloud backend - should only run on remote EPC agents
router.post('/poll/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    console.log(`🔄 [SNMP API] Manual poll requested for device ${deviceId}`);
    
    // SNMP polling is disabled on cloud backend - return error explaining why
    res.status(503).json({
      error: 'SNMP polling disabled on cloud backend',
      message: 'SNMP polling is disabled on the cloud backend. Devices on private networks cannot be reached from the cloud. SNMP polling should be performed by remote EPC agents on local networks.',
      deviceId,
      suggestion: 'Use remote EPC agents to perform SNMP discovery and polling, or check existing metrics that have been reported by agents.'
    });
  } catch (error) {
    console.error('❌ [SNMP API] Error in poll endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to process poll request', 
      message: error.message 
    });
  }
});

module.exports = router;
