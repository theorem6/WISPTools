// Monitoring and Alerting Service
// Collects metrics, evaluates alert rules, sends notifications

const { Metric, AlertRule, Alert, ServiceHealth, AuditLog } = require('./monitoring-schema');
const { v4: uuidv4 } = require('uuid');

class MonitoringService {
  constructor() {
    this.alertCheckInterval = null;
  }

  // ============================================
  // METRIC COLLECTION
  // ============================================

  async recordMetric(tenantId, source, metricName, value, labels = {}, unit = null) {
    try {
      const metric = new Metric({
        metric_id: uuidv4(),
        tenant_id: tenantId,
        source,
        metric_name: metricName,
        metric_type: this.inferMetricType(metricName),
        value,
        labels,
        unit,
        timestamp: new Date(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });

      await metric.save();
      return metric;
    } catch (error) {
      console.error('Error recording metric:', error);
      throw error;
    }
  }

  inferMetricType(metricName) {
    if (metricName.includes('_total') || metricName.includes('_count')) return 'counter';
    if (metricName.includes('_rate') || metricName.includes('_percent')) return 'gauge';
    if (metricName.includes('_time') || metricName.includes('_duration')) return 'histogram';
    return 'gauge';
  }

  // ============================================
  // HSS METRICS COLLECTION
  // ============================================

  async collectHSSMetrics(tenantId) {
    try {
      // Query MongoDB for HSS stats
      const db = require('./monitoring-schema').Metric.db;
      
      // Active subscribers
      const activeSubscribers = await db.collection('subscribers').countDocuments({
        tenant_id: tenantId,
        enabled: true
      });
      await this.recordMetric(tenantId, 'hss', 'active_subscribers', activeSubscribers);

      // Total subscribers
      const totalSubscribers = await db.collection('subscribers').countDocuments({
        tenant_id: tenantId
      });
      await this.recordMetric(tenantId, 'hss', 'total_subscribers', totalSubscribers);

      // Recent authentications (last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentAuths = await db.collection('subscriber_sessions').countDocuments({
        tenant_id: tenantId,
        created_at: { $gte: fiveMinutesAgo }
      });
      await this.recordMetric(tenantId, 'hss', 'recent_authentications', recentAuths);

      // Authentication failures
      const authFailures = await db.collection('auth_failures').countDocuments({
        tenant_id: tenantId,
        timestamp: { $gte: fiveMinutesAgo }
      });
      
      const failureRate = totalSubscribers > 0 ? (authFailures / recentAuths) * 100 : 0;
      await this.recordMetric(tenantId, 'hss', 'auth_failure_rate', failureRate, {}, '%');

      // MME connections (from Open5GS Prometheus endpoint)
      const mmeConnections = await this.getPrometheusMetric('open5gs_hss_diameter_peers');
      await this.recordMetric(tenantId, 'hss', 'mme_connections', mmeConnections || 0);

      return {
        active_subscribers: activeSubscribers,
        total_subscribers: totalSubscribers,
        recent_authentications: recentAuths,
        auth_failure_rate: failureRate,
        mme_connections: mmeConnections
      };
    } catch (error) {
      console.error('Error collecting HSS metrics:', error);
      throw error;
    }
  }

  // ============================================
  // GENIEACS METRICS COLLECTION
  // ============================================

  async collectGenieACSMetrics(tenantId) {
    try {
      const db = require('./monitoring-schema').Metric.db;
      
      // Total devices
      const totalDevices = await db.collection('devices').countDocuments({
        tenant_id: tenantId
      });
      await this.recordMetric(tenantId, 'genieacs', 'total_devices', totalDevices);

      // Online devices
      const onlineDevices = await db.collection('devices').countDocuments({
        tenant_id: tenantId,
        '_lastInform': { $gte: new Date(Date.now() - 15 * 60 * 1000) } // Last 15 minutes
      });
      await this.recordMetric(tenantId, 'genieacs', 'online_devices', onlineDevices);

      // Offline devices
      const offlineDevices = totalDevices - onlineDevices;
      await this.recordMetric(tenantId, 'genieacs', 'offline_devices', offlineDevices);

      // Devices with faults
      const faultyDevices = await db.collection('faults').countDocuments({
        tenant_id: tenantId,
        resolved: false
      });
      await this.recordMetric(tenantId, 'genieacs', 'faulty_devices', faultyDevices);

      const faultRate = totalDevices > 0 ? (faultyDevices / totalDevices) * 100 : 0;
      await this.recordMetric(tenantId, 'genieacs', 'fault_rate', faultRate, {}, '%');

      return {
        total_devices: totalDevices,
        online_devices: onlineDevices,
        offline_devices: offlineDevices,
        faulty_devices: faultyDevices,
        fault_rate: faultRate
      };
    } catch (error) {
      console.error('Error collecting GenieACS metrics:', error);
      throw error;
    }
  }

  // ============================================
  // CBRS METRICS COLLECTION
  // ============================================

  async collectCBRSMetrics(tenantId) {
    try {
      const db = require('./monitoring-schema').Metric.db;
      
      // Total CBSDs
      const totalCBSDs = await db.collection('cbsds').countDocuments({
        tenant_id: tenantId
      });
      await this.recordMetric(tenantId, 'cbrs', 'total_cbsds', totalCBSDs);

      // Active grants
      const activeGrants = await db.collection('grants').countDocuments({
        tenant_id: tenantId,
        state: 'GRANTED'
      });
      await this.recordMetric(tenantId, 'cbrs', 'active_grants', activeGrants);

      // Heartbeat success rate
      const recentHeartbeats = await db.collection('heartbeat_logs').find({
        tenant_id: tenantId,
        timestamp: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
      }).toArray();

      const failedHeartbeats = recentHeartbeats.filter(h => !h.success).length;
      const heartbeatFailureRate = recentHeartbeats.length > 0 
        ? (failedHeartbeats / recentHeartbeats.length) * 100 
        : 0;
      
      await this.recordMetric(tenantId, 'cbrs', 'heartbeat_failure_rate', heartbeatFailureRate, {}, '%');

      // Available spectrum
      const availableSpectrum = await this.calculateAvailableSpectrum(tenantId);
      await this.recordMetric(tenantId, 'cbrs', 'available_spectrum_mhz', availableSpectrum, {}, 'MHz');

      return {
        total_cbsds: totalCBSDs,
        active_grants: activeGrants,
        heartbeat_failure_rate: heartbeatFailureRate,
        available_spectrum_mhz: availableSpectrum
      };
    } catch (error) {
      console.error('Error collecting CBRS metrics:', error);
      throw error;
    }
  }

  // ============================================
  // SERVICE HEALTH CHECKS
  // ============================================

  async checkServiceHealth(tenantId, serviceName) {
    try {
      let status, responseTime, errorMessage;

      switch (serviceName) {
        case 'hss-daemon':
          ({ status, responseTime, errorMessage } = await this.checkHSSDaemon());
          break;
        case 'hss-api':
          ({ status, responseTime, errorMessage } = await this.checkHSSAPI());
          break;
        case 'genieacs-cwmp':
          ({ status, responseTime, errorMessage } = await this.checkGenieACS('cwmp', 7547));
          break;
        case 'genieacs-nbi':
          ({ status, responseTime, errorMessage } = await this.checkGenieACS('nbi', 7557));
          break;
        case 'mongodb':
          ({ status, responseTime, errorMessage } = await this.checkMongoDB());
          break;
        case 'frontend':
          ({ status, responseTime, errorMessage } = await this.checkFrontend());
          break;
        default:
          status = 'unknown';
      }

      const health = new ServiceHealth({
        health_id: uuidv4(),
        tenant_id: tenantId,
        service_name: serviceName,
        status,
        response_time_ms: responseTime,
        error_message: errorMessage,
        checked_at: new Date(),
        last_healthy: status === 'healthy' ? new Date() : undefined
      });

      await health.save();

      // Record as metric
      await this.recordMetric(tenantId, 'system', `${serviceName}_health`, 
        status === 'healthy' ? 1 : 0, { service: serviceName });

      return health;
    } catch (error) {
      console.error(`Error checking ${serviceName} health:`, error);
      throw error;
    }
  }

  async checkHSSDaemon() {
    try {
      // Check if Open5GS HSS is responding on port 3868
      const net = require('net');
      const start = Date.now();

      return await new Promise((resolve) => {
        const socket = net.createConnection(3868, '136.112.111.167', () => {
          socket.destroy();
          resolve({ 
            status: 'healthy', 
            responseTime: Date.now() - start,
            errorMessage: null
          });
        });

        socket.on('error', (err) => {
          resolve({ 
            status: 'down', 
            responseTime: Date.now() - start,
            errorMessage: err.message
          });
        });

        socket.setTimeout(5000, () => {
          socket.destroy();
          resolve({ 
            status: 'down', 
            responseTime: 5000,
            errorMessage: 'Connection timeout'
          });
        });
      });
    } catch (error) {
      return { status: 'down', responseTime: 0, errorMessage: error.message };
    }
  }

  async checkHSSAPI() {
    try {
      const fetch = require('node-fetch');
      const start = Date.now();

      const response = await fetch('http://136.112.111.167:3000/health', {
        timeout: 5000
      });

      if (response.ok) {
        return { 
          status: 'healthy', 
          responseTime: Date.now() - start,
          errorMessage: null
        };
      } else {
        return { 
          status: 'degraded', 
          responseTime: Date.now() - start,
          errorMessage: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      return { status: 'down', responseTime: 0, errorMessage: error.message };
    }
  }

  async checkGenieACS(service, port) {
    try {
      const fetch = require('node-fetch');
      const start = Date.now();

      const urls = {
        cwmp: `http://136.112.111.167:${port}`,
        nbi: `http://136.112.111.167:${port}/devices?limit=1`
      };

      const response = await fetch(urls[service] || urls.nbi, {
        timeout: 5000
      });

      if (response.ok || response.status === 200) {
        return { 
          status: 'healthy', 
          responseTime: Date.now() - start,
          errorMessage: null
        };
      } else {
        return { 
          status: 'degraded', 
          responseTime: Date.now() - start,
          errorMessage: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      return { status: 'down', responseTime: 0, errorMessage: error.message };
    }
  }

  async checkMongoDB() {
    try {
      const mongoose = require('mongoose');
      const start = Date.now();

      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db.admin().ping();
        return { 
          status: 'healthy', 
          responseTime: Date.now() - start,
          errorMessage: null
        };
      } else {
        return { 
          status: 'down', 
          responseTime: 0,
          errorMessage: 'Not connected'
        };
      }
    } catch (error) {
      return { status: 'down', responseTime: 0, errorMessage: error.message };
    }
  }

  async checkFrontend() {
    try {
      const fetch = require('node-fetch');
      const start = Date.now();

      const response = await fetch(
        'https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app',
        { timeout: 10000 }
      );

      if (response.ok) {
        return { 
          status: 'healthy', 
          responseTime: Date.now() - start,
          errorMessage: null
        };
      } else {
        return { 
          status: 'degraded', 
          responseTime: Date.now() - start,
          errorMessage: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      return { status: 'down', responseTime: 0, errorMessage: error.message };
    }
  }

  // ============================================
  // ALERT EVALUATION
  // ============================================

  async evaluateAlertRules(tenantId) {
    try {
      const rules = await AlertRule.find({ tenant_id: tenantId, enabled: true });
      
      for (const rule of rules) {
        await this.evaluateRule(rule);
      }
    } catch (error) {
      console.error('Error evaluating alert rules:', error);
    }
  }

  async evaluateRule(rule) {
    try {
      // Get recent metrics for this rule
      const timeWindow = new Date(Date.now() - rule.duration_seconds * 1000);
      
      const metrics = await Metric.find({
        tenant_id: rule.tenant_id,
        source: rule.source,
        metric_name: rule.metric_name,
        timestamp: { $gte: timeWindow }
      }).sort({ timestamp: -1 }).limit(10);

      if (metrics.length === 0) return;

      // Get latest value
      const currentValue = metrics[0].value;

      // Evaluate condition
      const conditionMet = this.evaluateCondition(
        currentValue,
        rule.operator,
        rule.threshold
      );

      if (conditionMet) {
        await this.triggerAlert(rule, currentValue);
      } else {
        await this.resolveAlert(rule);
      }
    } catch (error) {
      console.error('Error evaluating rule:', rule.rule_id, error);
    }
  }

  evaluateCondition(value, operator, threshold) {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      case 'ne': return value !== threshold;
      default: return false;
    }
  }

  async triggerAlert(rule, currentValue) {
    try {
      // Check if alert already exists and is firing
      const existingAlert = await Alert.findOne({
        tenant_id: rule.tenant_id,
        rule_id: rule.rule_id,
        status: { $in: ['firing', 'acknowledged'] }
      });

      if (existingAlert) {
        // Update last triggered time
        existingAlert.last_triggered = new Date();
        existingAlert.current_value = currentValue;
        await existingAlert.save();
        return existingAlert;
      }

      // Check cooldown period
      const cooldownEnd = new Date(Date.now() - rule.cooldown_minutes * 60 * 1000);
      const recentAlert = await Alert.findOne({
        tenant_id: rule.tenant_id,
        rule_id: rule.rule_id,
        first_triggered: { $gte: cooldownEnd }
      });

      if (recentAlert) {
        console.log(`Alert ${rule.name} in cooldown period`);
        return null;
      }

      // Create new alert
      const alert = new Alert({
        alert_id: uuidv4(),
        tenant_id: rule.tenant_id,
        rule_id: rule.rule_id,
        rule_name: rule.name,
        source: rule.source,
        severity: rule.severity,
        message: this.formatAlertMessage(rule, currentValue),
        metric_name: rule.metric_name,
        current_value: currentValue,
        threshold: rule.threshold,
        operator: rule.operator,
        status: 'firing',
        first_triggered: new Date(),
        last_triggered: new Date()
      });

      await alert.save();

      // Send notifications
      await this.sendNotifications(alert, rule);

      return alert;
    } catch (error) {
      console.error('Error triggering alert:', error);
      throw error;
    }
  }

  formatAlertMessage(rule, currentValue) {
    const operators = {
      'gt': 'greater than',
      'gte': 'greater than or equal to',
      'lt': 'less than',
      'lte': 'less than or equal to',
      'eq': 'equal to',
      'ne': 'not equal to'
    };

    return `${rule.name}: ${rule.metric_name} is ${currentValue} (${operators[rule.operator]} threshold of ${rule.threshold})`;
  }

  async resolveAlert(rule) {
    try {
      const alert = await Alert.findOne({
        tenant_id: rule.tenant_id,
        rule_id: rule.rule_id,
        status: 'firing'
      });

      if (alert) {
        alert.status = 'resolved';
        alert.resolved_at = new Date();
        alert.resolved_by = 'system';
        await alert.save();

        // Send resolution notification
        await this.sendResolutionNotification(alert, rule);
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================

  async sendNotifications(alert, rule) {
    const notifications = [];

    // Email notifications
    if (rule.notifications?.email?.length > 0) {
      for (const email of rule.notifications.email) {
        try {
          await this.sendEmail(email, alert, rule);
          notifications.push({
            channel: 'email',
            sent_at: new Date(),
            success: true
          });
        } catch (error) {
          notifications.push({
            channel: 'email',
            sent_at: new Date(),
            success: false,
            error: error.message
          });
        }
      }
    }

    // Webhook notifications
    if (rule.notifications?.webhook) {
      try {
        await this.sendWebhook(rule.notifications.webhook, alert, rule);
        notifications.push({
          channel: 'webhook',
          sent_at: new Date(),
          success: true
        });
      } catch (error) {
        notifications.push({
          channel: 'webhook',
          sent_at: new Date(),
          success: false,
          error: error.message
        });
      }
    }

    // Update alert with notification status
    alert.notifications_sent = notifications;
    await alert.save();
  }

  async sendEmail(to, alert, rule) {
    const emailService = require('./email-service');
    const result = await emailService.sendAlertEmail(to, alert, rule, alert.tenant_id);
    
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  async sendWebhook(url, alert, rule) {
    try {
      const fetch = require('node-fetch');
      
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_id: alert.alert_id,
          rule_name: rule.name,
          severity: alert.severity,
          message: alert.message,
          current_value: alert.current_value,
          threshold: alert.threshold,
          timestamp: alert.first_triggered
        })
      });
    } catch (error) {
      console.error('Error sending webhook:', error);
      throw error;
    }
  }

  async sendResolutionNotification(alert, rule) {
    try {
      // Send email notifications
      if (rule.notifications?.email?.length > 0) {
        const emailService = require('./email-service');
        for (const email of rule.notifications.email) {
          await emailService.sendResolutionEmail(
            email, 
            alert, 
            rule, 
            alert.tenant_id, 
            alert.resolved_by || 'system'
          );
        }
      }

      console.log(`✅ Resolution notifications sent for: ${alert.rule_name}`);
    } catch (error) {
      console.error('Error sending resolution notification:', error);
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  async getPrometheusMetric(metricName) {
    try {
      const fetch = require('node-fetch');
      const response = await fetch('http://136.112.111.167:9090/metrics', {
        timeout: 5000
      });

      if (!response.ok) return null;

      const text = await response.text();
      const lines = text.split('\n');
      
      for (const line of lines) {
        if (line.startsWith(metricName)) {
          const match = line.match(/\s+([\d.]+)$/);
          return match ? parseFloat(match[1]) : null;
        }
      }

      return null;
    } catch (error) {
      console.error('Error fetching Prometheus metric:', error);
      return null;
    }
  }

  async calculateAvailableSpectrum(tenantId) {
    // Placeholder - calculate from CBRS grants
    return 150; // MHz
  }

  // ============================================
  // AUDIT LOGGING
  // ============================================

  async logAction(tenantId, userId, action, resourceType, resourceId, changes, status = 'success', errorMessage = null, module = null, req = null) {
    try {
      const auditLog = new AuditLog({
        log_id: uuidv4(),
        tenant_id: tenantId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        user_id: userId,
        user_email: req?.user?.email,
        user_role: req?.user?.role,
        changes,
        status,
        error_message: errorMessage,
        ip_address: req?.ip || req?.headers?.['x-forwarded-for'],
        user_agent: req?.headers?.['user-agent'],
        module,
        timestamp: new Date(),
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
      });

      await auditLog.save();
      return auditLog;
    } catch (error) {
      console.error('Error logging action:', error);
    }
  }

  // ============================================
  // MONITORING LOOP
  // ============================================

  startMonitoring() {
    console.log('🔍 Starting monitoring service...');

    // Collect metrics every 60 seconds
    setInterval(async () => {
      try {
        // Get all active tenants
        const tenants = await this.getActiveTenants();

        for (const tenant of tenants) {
          await this.collectHSSMetrics(tenant.tenant_id);
          await this.collectGenieACSMetrics(tenant.tenant_id);
          await this.collectCBRSMetrics(tenant.tenant_id);
          
          // Health checks
          await this.checkServiceHealth(tenant.tenant_id, 'hss-daemon');
          await this.checkServiceHealth(tenant.tenant_id, 'hss-api');
          await this.checkServiceHealth(tenant.tenant_id, 'genieacs-nbi');
          await this.checkServiceHealth(tenant.tenant_id, 'mongodb');
          
          // Evaluate alert rules
          await this.evaluateAlertRules(tenant.tenant_id);
        }
      } catch (error) {
        console.error('Error in monitoring loop:', error);
      }
    }, 60000); // Every 60 seconds

    console.log('✅ Monitoring service started');
  }

  async getActiveTenants() {
    // Get unique tenant IDs from various collections
    const db = require('./monitoring-schema').Metric.db;
    
    const tenants = await db.collection('subscribers').distinct('tenant_id');
    return tenants.map(id => ({ tenant_id: id }));
  }
}

module.exports = new MonitoringService();

