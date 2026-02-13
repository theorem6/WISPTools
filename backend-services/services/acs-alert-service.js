// ACS Alert Evaluation Service
// Checks ACS devices for alert conditions and triggers alerts

const { AlertRule, Alert } = require('../routes/monitoring-schema');
const { v4: uuidv4 } = require('uuid');

class ACSAlertService {
  constructor() {
    this.checkInterval = null;
  }

  // Start periodic alert checking
  start(intervalMs = 60000) { // Default: 1 minute
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.evaluateAllAlerts().catch(err => {
        console.error('[ACS Alert Service] Error evaluating alerts:', err);
      });
    }, intervalMs);

    console.log('[ACS Alert Service] Started with interval:', intervalMs, 'ms');
  }

  // Stop alert checking
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('[ACS Alert Service] Stopped');
  }

  // Evaluate all alert rules for all tenants
  async evaluateAllAlerts() {
    try {
      const rules = await AlertRule.find({
        source: 'acs',
        enabled: true
      }).lean();

      if (rules.length === 0) {
        return;
      }

      // Group rules by tenant
      const rulesByTenant = {};
      rules.forEach(rule => {
        const tenantId = rule.tenant_id || rule.tenantId;
        if (!rulesByTenant[tenantId]) {
          rulesByTenant[tenantId] = [];
        }
        rulesByTenant[tenantId].push(rule);
      });

      // Evaluate rules for each tenant
      for (const [tenantId, tenantRules] of Object.entries(rulesByTenant)) {
        await this.evaluateTenantAlerts(tenantId, tenantRules);
      }
    } catch (error) {
      console.error('[ACS Alert Service] Error evaluating all alerts:', error);
    }
  }

  // Evaluate alert rules for a specific tenant
  async evaluateTenantAlerts(tenantId, rules) {
    try {
      // Get all ACS devices for this tenant
      const devices = await this.getACSTenantDevices(tenantId);
      
      for (const rule of rules) {
        await this.evaluateRule(tenantId, rule, devices);
      }
    } catch (error) {
      console.error(`[ACS Alert Service] Error evaluating alerts for tenant ${tenantId}:`, error);
    }
  }

  // Get ACS devices for a tenant
  async getACSTenantDevices(tenantId) {
    try {
      const { MongoClient } = require('mongodb');
      const mongoUrl = process.env.MONGODB_URI || process.env.GENIEACS_MONGODB_URI || '';
      const client = new MongoClient(mongoUrl);
      await client.connect();
      const db = client.db('genieacs');
      
      const devices = await db.collection('devices')
        .find({
          $or: [
            { _tenantId: tenantId },
            { tenantId: tenantId }
          ]
        })
        .toArray();
      
      await client.close();
      return devices;
    } catch (error) {
      console.error('[ACS Alert Service] Error getting devices:', error);
      return [];
    }
  }

  // Evaluate a single alert rule
  async evaluateRule(tenantId, rule, devices) {
    try {
      if (rule.metric_name === 'device_offline') {
        await this.checkOfflineDevices(tenantId, rule, devices);
      } else if (rule.metric_name.startsWith('parameter_')) {
        await this.checkParameterThreshold(tenantId, rule, devices);
      }
    } catch (error) {
      console.error(`[ACS Alert Service] Error evaluating rule ${rule.name}:`, error);
    }
  }

  // Check for offline devices
  async checkOfflineDevices(tenantId, rule, devices) {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    
    for (const device of devices) {
      const lastContact = device._lastInform ? new Date(device._lastInform).getTime() : 0;
      const isOffline = lastContact < fiveMinutesAgo;
      
      if (isOffline) {
        // Check if alert already exists
        const existingAlert = await Alert.findOne({
          tenant_id: tenantId,
          tenantId: tenantId,
          rule_id: rule.rule_id,
          device_id: device._id,
          status: { $in: ['firing', 'acknowledged'] }
        });

        if (!existingAlert) {
          // Check cooldown
          const cooldownEnd = new Date(Date.now() - rule.cooldown_minutes * 60 * 1000);
          const recentAlert = await Alert.findOne({
            tenant_id: tenantId,
            tenantId: tenantId,
            rule_id: rule.rule_id,
            device_id: device._id,
            first_triggered: { $gte: cooldownEnd }
          });

          if (!recentAlert) {
            // Create alert
            const alert = new Alert({
              alert_id: uuidv4(),
              tenant_id: tenantId,
              tenantId: tenantId,
              rule_id: rule.rule_id,
              rule_name: rule.name,
              source: 'acs',
              severity: rule.severity || 'warning',
              message: `Device ${device._id} (${device.manufacturer || 'Unknown'} ${device.model || ''}) is offline`,
              metric_name: rule.metric_name,
              current_value: 0,
              threshold: rule.threshold,
              operator: rule.operator,
              status: 'firing',
              device_id: device._id,
              device_name: `${device.manufacturer || 'Unknown'} ${device.model || ''}`,
              first_triggered: new Date(),
              last_triggered: new Date()
            });

            await alert.save();
            
            // Send notifications
            await this.sendNotifications(alert, rule, tenantId);
            
            console.log(`[ACS Alert Service] Alert triggered: ${rule.name} for device ${device._id}`);
          }
        }
      }
    }
  }

  // Check parameter thresholds
  async checkParameterThreshold(tenantId, rule, devices) {
    // Extract parameter name from metric_name (e.g., "parameter_RSSI" -> "RSSI")
    const paramName = rule.metric_name.replace('parameter_', '');
    
    for (const device of devices) {
      // Find parameter value
      let paramValue = null;
      
      // Common parameter paths
      const paramPaths = [
        `Device.Cellular.Interface.1.${paramName}`,
        `InternetGatewayDevice.DeviceInfo.${paramName}`,
        `Device.DeviceInfo.${paramName}`
      ];
      
      for (const path of paramPaths) {
        if (device.parameters?.[path]?._value !== undefined) {
          paramValue = parseFloat(device.parameters[path]._value);
          break;
        }
      }
      
      if (paramValue === null) continue;
      
      // Evaluate condition
      const shouldAlert = this.evaluateCondition(paramValue, rule.operator, rule.threshold);
      
      if (shouldAlert) {
        // Check if alert already exists
        const existingAlert = await Alert.findOne({
          tenant_id: tenantId,
          tenantId: tenantId,
          rule_id: rule.rule_id,
          device_id: device._id,
          status: { $in: ['firing', 'acknowledged'] }
        });

        if (!existingAlert) {
          // Check cooldown
          const cooldownEnd = new Date(Date.now() - rule.cooldown_minutes * 60 * 1000);
          const recentAlert = await Alert.findOne({
            tenant_id: tenantId,
            tenantId: tenantId,
            rule_id: rule.rule_id,
            device_id: device._id,
            first_triggered: { $gte: cooldownEnd }
          });

          if (!recentAlert) {
            // Create alert
            const alert = new Alert({
              alert_id: uuidv4(),
              tenant_id: tenantId,
              tenantId: tenantId,
              rule_id: rule.rule_id,
              rule_name: rule.name,
              source: 'acs',
              severity: rule.severity || 'warning',
              message: `Device ${device._id}: ${paramName} is ${rule.operator} ${rule.threshold} (current: ${paramValue})`,
              metric_name: rule.metric_name,
              current_value: paramValue,
              threshold: rule.threshold,
              operator: rule.operator,
              status: 'firing',
              device_id: device._id,
              device_name: `${device.manufacturer || 'Unknown'} ${device.model || ''}`,
              first_triggered: new Date(),
              last_triggered: new Date()
            });

            await alert.save();
            
            // Send notifications
            await this.sendNotifications(alert, rule, tenantId);
            
            console.log(`[ACS Alert Service] Alert triggered: ${rule.name} for device ${device._id}`);
          }
        } else {
          // Update existing alert
          existingAlert.current_value = paramValue;
          existingAlert.last_triggered = new Date();
          await existingAlert.save();
        }
      }
    }
  }

  // Evaluate condition
  evaluateCondition(value, operator, threshold) {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      default: return false;
    }
  }

  // Send notifications
  async sendNotifications(alert, rule, tenantId) {
    try {
      // Get tenant email settings
      const { Tenant } = require('../models/tenant');
      const tenant = await Tenant.findById(tenantId).lean();
      
      if (!tenant?.settings?.emailNotifications?.enabled) {
        return;
      }

      const emailService = require('../email-service');
      const recipients = tenant.settings.emailNotifications?.recipients || [];
      
      if (recipients.length === 0) {
        // Try to get tenant owner email
        const ownerEmail = tenant.contactEmail;
        if (ownerEmail) {
          recipients.push(ownerEmail);
        }
      }
      
      if (recipients.length === 0) {
        return;
      }

      // Send email notification to each recipient
      for (const recipient of recipients) {
        try {
          await emailService.sendAlertEmail(recipient, alert, rule, tenantId);
        } catch (error) {
          console.error(`[ACS Alert Service] Error sending email to ${recipient}:`, error);
        }
      }
    } catch (error) {
      console.error('[ACS Alert Service] Error sending notifications:', error);
    }
  }
}

// Export singleton instance
const acsAlertService = new ACSAlertService();

module.exports = acsAlertService;
