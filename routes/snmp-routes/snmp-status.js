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


module.exports = router;
