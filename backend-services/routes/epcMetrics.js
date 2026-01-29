/**
 * EPC Metrics Collection API
 * Handles metrics and health data from deployed EPCs
 */

const express = require('express');
const router = express.Router();
const { RemoteEPC, EPCMetrics, EPCAlert } = require('../models/distributed-epc-schema');

const METRIC_LOOKBACK_MINUTES = 5;

const getAuthToken = (req, bodyAuthCode) => {
  if (bodyAuthCode) return bodyAuthCode;
  const headerAuth = req.headers.authorization || '';
  if (headerAuth.startsWith('Bearer ')) {
    return headerAuth.slice(7);
  }
  return req.headers['x-api-key'] || null;
};

const normalizeAlertType = (alertType, severity) => {
  if (!alertType) return 'component_down';
  if (alertType === 'health') return severity === 'critical' ? 'component_down' : 'high_cpu';
  if (['offline', 'high_cpu', 'high_memory', 'high_disk', 'component_down', 'no_heartbeat', 'pool_exhausted', 'enb_disconnected'].includes(alertType)) {
    return alertType;
  }
  return 'component_down';
};

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toDate = (value) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

async function authenticateEPC(req, epcId, tenantId, authToken) {
  if (!epcId || !tenantId || !authToken) {
    return null;
  }
  return RemoteEPC.findOne({
    epc_id: epcId,
    tenant_id: tenantId,
    $or: [
      { auth_code: authToken },
      { api_key: authToken }
    ]
  }).lean();
}

/**
 * Receive metrics from EPC SNMP agent
 * POST /api/epc/metrics
 */
router.post('/metrics', async (req, res) => {
  try {
    const { epcId, tenantId, authCode, metrics, timestamp } = req.body;
    
    // Validate required fields
    if (!epcId || !tenantId || !authCode || !metrics) {
      return res.status(400).json({ 
        error: 'Missing required fields: epcId, tenantId, authCode, metrics' 
      });
    }
    
    const authToken = getAuthToken(req, authCode);
    const epc = await authenticateEPC(req, epcId, tenantId, authToken);
    if (!epc) {
      return res.status(401).json({ error: 'Invalid EPC credentials' });
    }
    
    const metricTimestamp = toDate(metrics?.timestamp || timestamp);
    const processedMetrics = {
      epcId,
      tenantId,
      timestamp: metricTimestamp,
      receivedAt: new Date().toISOString(),
      
      // System metrics
      system: {
        uptime: metrics.system?.uptime || 0,
        epcUptime: metrics.system?.epcUptime || 0,
        hostname: metrics.system?.hostname || 'unknown',
        platform: metrics.system?.platform || 'unknown'
      },
      
      // Resource metrics
      resources: {
        cpuUsage: parseFloat(metrics.resources?.cpuUsage) || 0,
        memoryUsage: parseFloat(metrics.resources?.memoryUsage) || 0,
        diskUsage: parseFloat(metrics.resources?.diskUsage) || 0,
        freeMemory: parseInt(metrics.resources?.freeMemory) || 0,
        totalMemory: parseInt(metrics.resources?.totalMemory) || 0,
        loadAverage: metrics.resources?.loadAverage || [0, 0, 0]
      },
      
      // Network metrics
      network: {
        throughput: parseInt(metrics.network?.throughput) || 0,
        connections: parseInt(metrics.network?.connections) || 0,
        interfaces: metrics.network?.interfaces || {}
      },
      
      // EPC-specific metrics
      epc: {
        activeUsers: parseInt(metrics.epc?.activeUsers) || 0,
        activeSessions: parseInt(metrics.epc?.activeSessions) || 0,
        dataUsage: metrics.epc?.dataUsage || { totalBytes: 0, uploadBytes: 0, downloadBytes: 0 },
        serviceStatus: metrics.epc?.serviceStatus || { status: 'unknown', running: false }
      },
      
      // Custom metrics
      custom: metrics.custom || {}
    };
    
    const metricsRecord = new EPCMetrics({
      epc_id: epcId,
      tenant_id: tenantId,
      timestamp: metricTimestamp,
      subscribers: {
        total_connected: toNumber(metrics?.epc?.activeUsers),
        active_sessions: toNumber(metrics?.epc?.activeSessions)
      },
      system: {
        cpu_percent: toNumber(metrics?.resources?.cpuUsage),
        memory_percent: toNumber(metrics?.resources?.memoryUsage),
        disk_percent: toNumber(metrics?.resources?.diskUsage),
        load_average: Array.isArray(metrics?.resources?.loadAverage)
          ? metrics.resources.loadAverage.map((value) => toNumber(value))
          : []
      }
    });
    await metricsRecord.save();

    await RemoteEPC.updateOne(
      { epc_id: epcId, tenant_id: tenantId },
      {
        $set: {
          status: 'online',
          last_seen: new Date(),
          last_heartbeat: new Date(),
          uptime_seconds: toNumber(metrics?.system?.uptime)
        }
      }
    );

    console.log(`[EPC Metrics] Received metrics from EPC ${epcId} (Tenant: ${tenantId})`);

    // Check for alerts/thresholds
    const alerts = await checkMetricThresholds(processedMetrics);
    if (alerts.length > 0) {
      console.log(`[EPC Metrics] Generated ${alerts.length} alerts for EPC ${epcId}`);
      const alertDocs = alerts.map((alert) => ({
        tenant_id: tenantId,
        epc_id: epcId,
        severity: alert.severity,
        alert_type: normalizeAlertType(alert.type, alert.severity),
        message: alert.message,
        details: {
          value: alert.value,
          threshold: alert.threshold,
          raw_type: alert.type
        }
      }));
      await EPCAlert.insertMany(alertDocs);
      // Integrate with incident creation for critical/high alerts
      try {
        const incidentService = require('../services/incident-creation-service');
        const epc = await RemoteEPC.findOne({ epc_id: epcId, tenant_id: tenantId }).lean();
        for (const alert of alerts) {
          if (['critical', 'high'].includes(alert.severity)) {
            const rule = { rule_id: 'epc-metrics', name: alert.type || 'EPC Alert', tenant_id: tenantId };
            await incidentService.createFromMonitoringAlert(
              {
                tenant_id: tenantId,
                message: alert.message,
                metric_name: alert.type,
                current_value: alert.value,
                threshold: alert.threshold,
                severity: alert.severity,
                first_triggered: new Date()
              },
              rule,
              { _id: epcId, id: epcId, siteId: epc?.site_id, site_id: epc?.site_id, status: 'alert', type: 'epc' }
            );
          }
        }
      } catch (incErr) {
        console.warn('[EPC Metrics] Incident creation failed (non-blocking):', incErr.message);
      }
    }
    
    res.json({
      success: true,
      message: 'Metrics received successfully',
      epcId,
      timestamp: processedMetrics.receivedAt,
      alertsGenerated: alerts.length
    });
    
  } catch (error) {
    console.error('[EPC Metrics] Failed to process metrics:', error);
    res.status(500).json({ 
      error: 'Failed to process metrics',
      details: error.message 
    });
  }
});

/**
 * Receive health alerts from EPC
 * POST /api/epc/alerts
 */
router.post('/alerts', async (req, res) => {
  try {
    const { epcId, tenantId, authCode, alertType, severity, health, timestamp } = req.body;
    
    // Validate required fields
    if (!epcId || !tenantId || !authCode || !alertType || !severity) {
      return res.status(400).json({ 
        error: 'Missing required fields: epcId, tenantId, authCode, alertType, severity' 
      });
    }
    
    const authToken = getAuthToken(req, authCode);
    const epc = await authenticateEPC(req, epcId, tenantId, authToken);
    if (!epc) {
      return res.status(401).json({ error: 'Invalid EPC credentials' });
    }
    
    const alert = {
      epcId,
      tenantId,
      alertType,
      severity, // 'healthy', 'warning', 'critical', 'error'
      health,
      timestamp: timestamp || new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      status: 'active'
    };
    
    const alertRecord = new EPCAlert({
      tenant_id: tenantId,
      epc_id: epcId,
      severity: severity === 'critical' ? 'critical' : severity === 'warning' ? 'warning' : severity === 'error' ? 'error' : 'info',
      alert_type: normalizeAlertType(alertType, severity),
      message: health?.overallStatus ? `EPC health ${health.overallStatus}` : alertType,
      details: health || {}
    });
    await alertRecord.save();

    console.log(`[EPC Alerts] Received ${severity} alert from EPC ${epcId}: ${alertType}`);
    
    res.json({
      success: true,
      message: 'Alert received successfully',
      epcId,
      alertId: alertRecord._id,
      timestamp: alert.receivedAt
    });
    
  } catch (error) {
    console.error('[EPC Alerts] Failed to process alert:', error);
    res.status(500).json({ 
      error: 'Failed to process alert',
      details: error.message 
    });
  }
});

/**
 * Get EPC status and latest metrics
 * GET /api/epc/:epcId/status
 */
router.get('/:epcId/status', async (req, res) => {
  try {
    const { epcId } = req.params;
    const tenantId = req.headers['x-tenant-id'];
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }
    
    const latestMetrics = await EPCMetrics.findOne({
      epc_id: epcId,
      tenant_id: tenantId
    }).sort({ timestamp: -1 }).lean();

    const lastSeen = latestMetrics?.timestamp || null;
    const isOnline = lastSeen
      ? Date.now() - new Date(lastSeen).getTime() <= METRIC_LOOKBACK_MINUTES * 60 * 1000
      : false;

    const activeAlerts = await EPCAlert.find({
      epc_id: epcId,
      tenant_id: tenantId,
      resolved: false
    }).sort({ timestamp: -1 }).limit(5).lean();

    const status = {
      epcId,
      tenantId,
      status: isOnline ? 'online' : 'offline',
      lastSeen,
      metrics: latestMetrics
        ? {
            cpuUsage: latestMetrics.system?.cpu_percent ?? null,
            memoryUsage: latestMetrics.system?.memory_percent ?? null,
            diskUsage: latestMetrics.system?.disk_percent ?? null,
            activeUsers: latestMetrics.subscribers?.total_connected ?? null,
            activeSessions: latestMetrics.subscribers?.active_sessions ?? null
          }
        : null,
      activeAlerts
    };
    
    res.json(status);
    
  } catch (error) {
    console.error('[EPC Status] Failed to get EPC status:', error);
    res.status(500).json({ 
      error: 'Failed to get EPC status',
      details: error.message 
    });
  }
});

/**
 * Get EPC metrics history
 * GET /api/epc/:epcId/metrics/history
 */
router.get('/:epcId/metrics/history', async (req, res) => {
  try {
    const { epcId } = req.params;
    const { startTime, endTime, metric, interval = '1h' } = req.query;
    const tenantId = req.headers['x-tenant-id'];
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }
    
    const startDate = startTime ? new Date(startTime) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDate = endTime ? new Date(endTime) : new Date();
    const docs = await EPCMetrics.find({
      epc_id: epcId,
      tenant_id: tenantId,
      timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: 1 }).lean();

    const timestamps = docs.map((doc) => doc.timestamp);
    const series = {};
    const metricKey = metric || 'all';

    if (metricKey === 'cpu') {
      series.cpu = docs.map((doc) => doc.system?.cpu_percent ?? null);
    } else if (metricKey === 'memory') {
      series.memory = docs.map((doc) => doc.system?.memory_percent ?? null);
    } else if (metricKey === 'disk') {
      series.disk = docs.map((doc) => doc.system?.disk_percent ?? null);
    } else if (metricKey === 'activeSessions') {
      series.activeSessions = docs.map((doc) => doc.subscribers?.active_sessions ?? null);
    } else if (metricKey === 'activeUsers') {
      series.activeUsers = docs.map((doc) => doc.subscribers?.total_connected ?? null);
    } else {
      series.cpu = docs.map((doc) => doc.system?.cpu_percent ?? null);
      series.memory = docs.map((doc) => doc.system?.memory_percent ?? null);
      series.disk = docs.map((doc) => doc.system?.disk_percent ?? null);
      series.activeSessions = docs.map((doc) => doc.subscribers?.active_sessions ?? null);
      series.activeUsers = docs.map((doc) => doc.subscribers?.total_connected ?? null);
    }

    const history = {
      epcId,
      metric: metricKey,
      interval,
      timeRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      data: {
        timestamps,
        values: series
      }
    };
    
    res.json(history);
    
  } catch (error) {
    console.error('[EPC Metrics History] Failed to get metrics history:', error);
    res.status(500).json({ 
      error: 'Failed to get metrics history',
      details: error.message 
    });
  }
});


/**
 * Check metric thresholds and generate alerts
 */
async function checkMetricThresholds(metrics) {
  const alerts = [];
  
  // CPU usage alert
  if (metrics.resources.cpuUsage > 90) {
    alerts.push({
      type: 'cpu_critical',
      severity: 'critical',
      message: `CPU usage is ${metrics.resources.cpuUsage.toFixed(1)}% (threshold: 90%)`,
      value: metrics.resources.cpuUsage,
      threshold: 90
    });
  } else if (metrics.resources.cpuUsage > 70) {
    alerts.push({
      type: 'cpu_warning',
      severity: 'warning',
      message: `CPU usage is ${metrics.resources.cpuUsage.toFixed(1)}% (threshold: 70%)`,
      value: metrics.resources.cpuUsage,
      threshold: 70
    });
  }
  
  // Memory usage alert
  if (metrics.resources.memoryUsage > 95) {
    alerts.push({
      type: 'memory_critical',
      severity: 'critical',
      message: `Memory usage is ${metrics.resources.memoryUsage.toFixed(1)}% (threshold: 95%)`,
      value: metrics.resources.memoryUsage,
      threshold: 95
    });
  } else if (metrics.resources.memoryUsage > 80) {
    alerts.push({
      type: 'memory_warning',
      severity: 'warning',
      message: `Memory usage is ${metrics.resources.memoryUsage.toFixed(1)}% (threshold: 80%)`,
      value: metrics.resources.memoryUsage,
      threshold: 80
    });
  }
  
  // Disk usage alert
  if (metrics.resources.diskUsage > 95) {
    alerts.push({
      type: 'disk_critical',
      severity: 'critical',
      message: `Disk usage is ${metrics.resources.diskUsage.toFixed(1)}% (threshold: 95%)`,
      value: metrics.resources.diskUsage,
      threshold: 95
    });
  } else if (metrics.resources.diskUsage > 85) {
    alerts.push({
      type: 'disk_warning',
      severity: 'warning',
      message: `Disk usage is ${metrics.resources.diskUsage.toFixed(1)}% (threshold: 85%)`,
      value: metrics.resources.diskUsage,
      threshold: 85
    });
  }
  
  // EPC service status alert
  if (!metrics.epc.serviceStatus.running) {
    alerts.push({
      type: 'service_critical',
      severity: 'critical',
      message: `EPC service is not running (status: ${metrics.epc.serviceStatus.status})`,
      value: metrics.epc.serviceStatus.status,
      threshold: 'active'
    });
  }
  
  return alerts;
}

module.exports = router;
