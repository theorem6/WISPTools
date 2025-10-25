const mongoose = require('mongoose');

const metricSchema = new mongoose.Schema({
  name: { type: String, required: true },
  value: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  tenantId: { type: String, required: true }
});

const alertRuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  condition: { type: String, required: true },
  threshold: { type: Number, required: true },
  tenantId: { type: String, required: true }
});

const alertSchema = new mongoose.Schema({
  ruleId: { type: String, required: true },
  message: { type: String, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status: { type: String, enum: ['active', 'resolved'], default: 'active' },
  tenantId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const serviceHealthSchema = new mongoose.Schema({
  serviceName: { type: String, required: true },
  status: { type: String, enum: ['healthy', 'degraded', 'down'], default: 'healthy' },
  lastCheck: { type: Date, default: Date.now },
  tenantId: { type: String, required: true }
});

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  userId: { type: String, required: true },
  details: { type: Object },
  tenantId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

module.exports = {
  Metric: mongoose.model('Metric', metricSchema),
  AlertRule: mongoose.model('AlertRule', alertRuleSchema),
  Alert: mongoose.model('Alert', alertSchema),
  ServiceHealth: mongoose.model('ServiceHealth', serviceHealthSchema),
  AuditLog: mongoose.model('AuditLog', auditLogSchema),
  DEFAULT_ALERT_RULES: []
};
