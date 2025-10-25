// Monitoring and Alerting API Endpoints
// Add these to your Express app in deploy-hss-api.sh

const express = require('express');
const router = express.Router();
const { Metric, AlertRule, Alert, ServiceHealth, AuditLog } = require('./monitoring-schema');
const monitoringService = require('./monitoring-service');
const { v4: uuidv4 } = require('uuid');

// ============================================
// METRICS ENDPOINTS
// ============================================

// Get metrics for a specific source and time range
router.get('/metrics', async (req, res) => {
  try {
    const { source, metric_name, time_range = '1h' } = req.query;
    const tenantId = req.headers['x-tenant-id'];

    const timeRanges = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const since = new Date(Date.now() - (timeRanges[time_range] || timeRanges['1h']));

    const query = {
      tenant_id: tenantId,
      timestamp: { $gte: since }
    };

    if (source) query.source = source;
    if (metric_name) query.metric_name = metric_name;

    const metrics = await Metric.find(query)
      .sort({ timestamp: -1 })
      .limit(1000);

    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get aggregated metrics (for charts)
router.get('/metrics/aggregated', async (req, res) => {
  try {
    const { source, metric_name, time_range = '24h', interval = '5m' } = req.query;
    const tenantId = req.headers['x-tenant-id'];

    const timeRanges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };

    const intervals = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000
    };

    const since = new Date(Date.now() - (timeRanges[time_range] || timeRanges['24h']));
    const bucketSize = intervals[interval] || intervals['5m'];

    const results = await Metric.aggregate([
      {
        $match: {
          tenant_id: tenantId,
          source: source,
          metric_name: metric_name,
          timestamp: { $gte: since }
        }
      },
      {
        $group: {
          _id: {
            $toDate: {
              $subtract: [
                { $toLong: '$timestamp' },
                { $mod: [{ $toLong: '$timestamp' }, bucketSize] }
              ]
            }
          },
          avg: { $avg: '$value' },
          min: { $min: '$value' },
          max: { $max: '$value' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ALERT RULE ENDPOINTS
// ============================================

// Get all alert rules
router.get('/alert-rules', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const rules = await AlertRule.find({ tenant_id: tenantId });
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create alert rule
router.post('/alert-rules', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    
    const rule = new AlertRule({
      rule_id: uuidv4(),
      tenant_id: tenantId,
      ...req.body
    });

    await rule.save();
    
    // Log action
    await monitoringService.logAction(
      tenantId,
      req.user?.uid || 'system',
      'create',
      'alert_rule',
      rule.rule_id,
      { after: rule },
      'success',
      null,
      'monitoring',
      req
    );

    res.status(201).json(rule);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update alert rule
router.put('/alert-rules/:rule_id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    
    const before = await AlertRule.findOne({ 
      rule_id: req.params.rule_id,
      tenant_id: tenantId
    });

    if (!before) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    const rule = await AlertRule.findOneAndUpdate(
      { rule_id: req.params.rule_id, tenant_id: tenantId },
      { ...req.body, updated_at: new Date() },
      { new: true, runValidators: true }
    );

    // Log action
    await monitoringService.logAction(
      tenantId,
      req.user?.uid || 'system',
      'update',
      'alert_rule',
      rule.rule_id,
      { before, after: rule },
      'success',
      null,
      'monitoring',
      req
    );

    res.json(rule);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete alert rule
router.delete('/alert-rules/:rule_id', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    
    const rule = await AlertRule.findOneAndDelete({
      rule_id: req.params.rule_id,
      tenant_id: tenantId
    });

    if (!rule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    // Log action
    await monitoringService.logAction(
      tenantId,
      req.user?.uid || 'system',
      'delete',
      'alert_rule',
      rule.rule_id,
      { before: rule },
      'success',
      null,
      'monitoring',
      req
    );

    res.json({ message: 'Alert rule deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ALERTS ENDPOINTS
// ============================================

// Get active alerts
router.get('/alerts', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { status = 'firing', severity, source } = req.query;

    const query = { tenant_id: tenantId };
    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (source) query.source = source;

    const alerts = await Alert.find(query)
      .sort({ first_triggered: -1 })
      .limit(100);

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Acknowledge alert
router.post('/alerts/:alert_id/acknowledge', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.user?.uid || 'unknown';

    const alert = await Alert.findOneAndUpdate(
      { alert_id: req.params.alert_id, tenant_id: tenantId },
      {
        status: 'acknowledged',
        acknowledged_at: new Date(),
        acknowledged_by: userId,
        notes: req.body.notes
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resolve alert manually
router.post('/alerts/:alert_id/resolve', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.user?.uid || 'unknown';

    const alert = await Alert.findOneAndUpdate(
      { alert_id: req.params.alert_id, tenant_id: tenantId },
      {
        status: 'resolved',
        resolved_at: new Date(),
        resolved_by: userId,
        notes: req.body.notes
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SERVICE HEALTH ENDPOINTS
// ============================================

// Get service health status
router.get('/health/services', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];

    // Get latest health check for each service
    const services = ['hss-daemon', 'hss-api', 'genieacs-cwmp', 'genieacs-nbi', 'mongodb', 'frontend'];
    const healthStatuses = [];

    for (const service of services) {
      const health = await ServiceHealth.findOne({
        tenant_id: tenantId,
        service_name: service
      }).sort({ checked_at: -1 });

      healthStatuses.push(health || {
        service_name: service,
        status: 'unknown',
        checked_at: null
      });
    }

    res.json(healthStatuses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force health check
router.post('/health/check', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { service } = req.body;

    const health = await monitoringService.checkServiceHealth(tenantId, service);
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AUDIT LOG ENDPOINTS
// ============================================

// Get audit logs
router.get('/audit-logs', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { module, user_id, action, resource_type, limit = 100 } = req.query;

    const query = { tenant_id: tenantId };
    if (module) query.module = module;
    if (user_id) query.user_id = user_id;
    if (action) query.action = action;
    if (resource_type) query.resource_type = resource_type;

    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DASHBOARD ENDPOINTS
// ============================================

// Get monitoring dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];

    // Collect current metrics
    const hssMetrics = await monitoringService.collectHSSMetrics(tenantId);
    const genieMetrics = await monitoringService.collectGenieACSMetrics(tenantId);
    const cbrsMetrics = await monitoringService.collectCBRSMetrics(tenantId);

    // Get service health
    const services = await ServiceHealth.find({ tenant_id: tenantId })
      .sort({ checked_at: -1 })
      .limit(10);

    // Get active alerts
    const activeAlerts = await Alert.find({
      tenant_id: tenantId,
      status: { $in: ['firing', 'acknowledged'] }
    }).sort({ severity: 1, first_triggered: -1 });

    // Get recent audit activity
    const recentActivity = await AuditLog.find({ tenant_id: tenantId })
      .sort({ timestamp: -1 })
      .limit(10);

    res.json({
      metrics: {
        hss: hssMetrics,
        genieacs: genieMetrics,
        cbrs: cbrsMetrics
      },
      service_health: services,
      active_alerts: activeAlerts,
      recent_activity: recentActivity,
      summary: {
        total_alerts: activeAlerts.length,
        critical_alerts: activeAlerts.filter(a => a.severity === 'critical').length,
        services_down: services.filter(s => s.status === 'down').length,
        timestamp: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize default alert rules for a tenant
router.post('/initialize-alerts', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { DEFAULT_ALERT_RULES } = require('./monitoring-schema');

    const created = [];

    for (const ruleTemplate of DEFAULT_ALERT_RULES) {
      const rule = new AlertRule({
        rule_id: uuidv4(),
        tenant_id: tenantId,
        ...ruleTemplate,
        created_by: req.user?.uid || 'system'
      });

      await rule.save();
      created.push(rule);
    }

    res.status(201).json({
      message: `Created ${created.length} default alert rules`,
      rules: created
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// EMAIL CONFIGURATION & TESTING
// ============================================

// Test email configuration
router.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email address required' });
    }

    const emailService = require('./email-service');
    const result = await emailService.sendTestEmail(email);

    if (result.success) {
      res.json({ 
        success: true, 
        message: `Test email sent to ${email}` 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get email configuration status
router.get('/email-config', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const emailService = require('../email-service');
    const TenantEmailConfig = require('../models/tenant-email');
    
    // Get tenant config
    const tenantConfig = await TenantEmailConfig.findOne({ tenant_id: tenantId });
    const effectiveConfig = await emailService.getTenantEmailConfig(tenantId);
    
    res.json({
      platform_enabled: emailService.enabled,
      tenant_config: tenantConfig,
      effective_sender: {
        email: effectiveConfig.from_email,
        name: effectiveConfig.from_name
      },
      provider: effectiveConfig.api_key ? 'SendGrid' : 'Not configured'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update tenant email configuration
router.put('/email-config', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const TenantEmailConfig = require('../models/tenant-email');
    const { v4: uuidv4 } = require('uuid');
    
    let config = await TenantEmailConfig.findOne({ tenant_id: tenantId });
    
    if (!config) {
      // Create new config
      config = new TenantEmailConfig({
        config_id: uuidv4(),
        tenant_id: tenantId,
        ...req.body,
        updated_at: new Date()
      });
    } else {
      // Update existing
      Object.assign(config, req.body);
      config.updated_at = new Date();
    }
    
    await config.save();
    
    // Log action
    await monitoringService.logAction(
      tenantId,
      req.user?.uid || 'system',
      config.isNew ? 'create' : 'update',
      'email_config',
      config.config_id,
      { after: config },
      'success',
      null,
      'monitoring',
      req
    );
    
    res.json(config);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get tenant information for email config
router.get('/tenant-info', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    
    const tenant = await db.collection('tenants').findOne({ tenant_id: tenantId });
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    res.json({
      tenant_id: tenant.tenant_id,
      display_name: tenant.displayName,
      owner_email: tenant.owner_email,
      owner_name: tenant.ownerName
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

