// MongoDB Schema for Monitoring and Alerting System
// Multi-tenant monitoring with per-tenant isolation

const mongoose = require('mongoose');

// ============================================
// MONITORING METRICS COLLECTION
// ============================================
const MetricSchema = new mongoose.Schema({
  metric_id: { type: String, required: true, unique: true },
  tenant_id: { type: String, required: true, index: true },
  
  // Metric source
  source: {
    type: String,
    required: true,
    enum: ['hss', 'genieacs', 'cbrs', 'pci', 'api', 'system']
  },
  
  // Metric details
  metric_name: { type: String, required: true },
  metric_type: {
    type: String,
    required: true,
    enum: ['counter', 'gauge', 'histogram', 'summary']
  },
  
  // Metric value
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  unit: String,
  
  // Labels for filtering
  labels: {
    type: Map,
    of: String
  },
  
  // Timestamps
  timestamp: { type: Date, default: Date.now, index: true },
  expires_at: { type: Date, index: true } // TTL for auto-deletion
});

// TTL index - automatically delete metrics older than 30 days
MetricSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Compound indexes for efficient queries
MetricSchema.index({ tenant_id: 1, source: 1, timestamp: -1 });
MetricSchema.index({ tenant_id: 1, metric_name: 1, timestamp: -1 });

// ============================================
// ALERT RULES COLLECTION
// ============================================
const AlertRuleSchema = new mongoose.Schema({
  rule_id: { type: String, required: true, unique: true },
  tenant_id: { type: String, required: true, index: true },
  
  // Rule configuration
  name: { type: String, required: true },
  description: String,
  enabled: { type: Boolean, default: true },
  
  // Source module
  source: {
    type: String,
    required: true,
    enum: ['hss', 'genieacs', 'cbrs', 'pci', 'api', 'system']
  },
  
  // Condition
  metric_name: { type: String, required: true },
  operator: {
    type: String,
    required: true,
    enum: ['gt', 'gte', 'lt', 'lte', 'eq', 'ne']
  },
  threshold: { type: Number, required: true },
  duration_seconds: { type: Number, default: 60 }, // Alert if condition persists
  
  // Severity
  severity: {
    type: String,
    required: true,
    enum: ['info', 'warning', 'error', 'critical']
  },
  
  // Notification settings
  notifications: {
    email: [String],
    webhook: String,
    slack: String
  },
  
  // Rate limiting
  cooldown_minutes: { type: Number, default: 15 }, // Min time between alerts
  
  // Metadata
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  created_by: String
});

AlertRuleSchema.index({ tenant_id: 1, enabled: 1 });
AlertRuleSchema.index({ source: 1, metric_name: 1 });

// ============================================
// ACTIVE ALERTS COLLECTION
// ============================================
const AlertSchema = new mongoose.Schema({
  alert_id: { type: String, required: true, unique: true },
  tenant_id: { type: String, required: true, index: true },
  rule_id: { type: String, required: true, index: true },
  
  // Alert details
  rule_name: { type: String, required: true },
  source: { type: String, required: true },
  severity: { type: String, required: true },
  message: { type: String, required: true },
  
  // Condition that triggered alert
  metric_name: String,
  current_value: Number,
  threshold: Number,
  operator: String,
  
  // Status
  status: {
    type: String,
    required: true,
    default: 'firing',
    enum: ['firing', 'acknowledged', 'resolved', 'muted']
  },
  
  // Timing
  first_triggered: { type: Date, default: Date.now, index: true },
  last_triggered: { type: Date, default: Date.now },
  acknowledged_at: Date,
  resolved_at: Date,
  
  // Actions
  acknowledged_by: String,
  resolved_by: String,
  notes: String,
  
  // Notification status
  notifications_sent: [{
    channel: String, // 'email', 'webhook', 'slack'
    sent_at: Date,
    success: Boolean,
    error: String
  }]
});

AlertSchema.index({ tenant_id: 1, status: 1, first_triggered: -1 });
AlertSchema.index({ status: 1, severity: 1 });

// ============================================
// SERVICE HEALTH COLLECTION
// ============================================
const ServiceHealthSchema = new mongoose.Schema({
  health_id: { type: String, required: true, unique: true },
  tenant_id: { type: String, required: true, index: true },
  
  // Service identification
  service_name: {
    type: String,
    required: true,
    enum: ['hss-daemon', 'hss-api', 'genieacs-cwmp', 'genieacs-nbi', 
           'genieacs-fs', 'genieacs-ui', 'mongodb', 'frontend']
  },
  
  // Health status
  status: {
    type: String,
    required: true,
    enum: ['healthy', 'degraded', 'down', 'unknown']
  },
  
  // Metrics
  uptime_seconds: Number,
  cpu_percent: Number,
  memory_mb: Number,
  response_time_ms: Number,
  error_rate: Number,
  
  // Additional info
  version: String,
  last_restart: Date,
  error_message: String,
  
  // Timestamps
  checked_at: { type: Date, default: Date.now, index: true },
  last_healthy: Date,
  last_unhealthy: Date
});

ServiceHealthSchema.index({ tenant_id: 1, service_name: 1, checked_at: -1 });
ServiceHealthSchema.index({ status: 1, checked_at: -1 });

// ============================================
// MONITORING DASHBOARD CONFIG
// ============================================
const DashboardConfigSchema = new mongoose.Schema({
  config_id: { type: String, required: true, unique: true },
  tenant_id: { type: String, required: true, index: true },
  
  // Dashboard settings
  name: { type: String, required: true },
  description: String,
  
  // Widgets configuration
  widgets: [{
    widget_id: String,
    type: String, // 'metric', 'alert', 'chart', 'status'
    title: String,
    source: String,
    metric_name: String,
    chart_type: String, // 'line', 'bar', 'pie', 'gauge'
    time_range: String, // '1h', '24h', '7d', '30d'
    position: {
      x: Number,
      y: Number,
      width: Number,
      height: Number
    }
  }],
  
  // Refresh settings
  refresh_interval_seconds: { type: Number, default: 30 },
  
  // Metadata
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  is_default: { type: Boolean, default: false }
});

DashboardConfigSchema.index({ tenant_id: 1, is_default: 1 });

// ============================================
// AUDIT LOG COLLECTION
// ============================================
const AuditLogSchema = new mongoose.Schema({
  log_id: { type: String, required: true, unique: true },
  tenant_id: { type: String, required: true, index: true },
  
  // Action details
  action: { type: String, required: true },
  resource_type: { type: String, required: true },
  resource_id: String,
  
  // Who performed the action
  user_id: { type: String, required: true },
  user_email: String,
  user_role: String,
  
  // What changed
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed
  },
  
  // Result
  status: {
    type: String,
    required: true,
    enum: ['success', 'failure', 'partial']
  },
  error_message: String,
  
  // Context
  ip_address: String,
  user_agent: String,
  module: String, // 'hss', 'genieacs', 'cbrs', 'pci', 'tenant'
  
  // Timestamp
  timestamp: { type: Date, default: Date.now, index: true },
  expires_at: { type: Date, index: true } // TTL - keep audit logs for 90 days
});

// TTL index - automatically delete audit logs older than 90 days
AuditLogSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Compound indexes
AuditLogSchema.index({ tenant_id: 1, timestamp: -1 });
AuditLogSchema.index({ tenant_id: 1, user_id: 1, timestamp: -1 });
AuditLogSchema.index({ tenant_id: 1, module: 1, timestamp: -1 });
AuditLogSchema.index({ resource_type: 1, resource_id: 1 });

// ============================================
// EXPORTS
// ============================================
module.exports = {
  Metric: mongoose.model('Metric', MetricSchema),
  AlertRule: mongoose.model('AlertRule', AlertRuleSchema),
  Alert: mongoose.model('Alert', AlertSchema),
  ServiceHealth: mongoose.model('ServiceHealth', ServiceHealthSchema),
  DashboardConfig: mongoose.model('DashboardConfig', DashboardConfigSchema),
  AuditLog: mongoose.model('AuditLog', AuditLogSchema)
};

// ============================================
// DEFAULT ALERT RULES (Per Tenant)
// ============================================
const DEFAULT_ALERT_RULES = [
  // HSS Alerts
  {
    name: 'HSS Service Down',
    source: 'hss',
    metric_name: 'service_health',
    operator: 'eq',
    threshold: 0,
    severity: 'critical',
    duration_seconds: 60
  },
  {
    name: 'High Authentication Failure Rate',
    source: 'hss',
    metric_name: 'auth_failure_rate',
    operator: 'gt',
    threshold: 10, // 10% failure rate
    severity: 'warning',
    duration_seconds: 300
  },
  {
    name: 'MME Disconnected',
    source: 'hss',
    metric_name: 'mme_connections',
    operator: 'eq',
    threshold: 0,
    severity: 'error',
    duration_seconds: 120
  },
  {
    name: 'Subscriber Limit Reached',
    source: 'hss',
    metric_name: 'active_subscribers',
    operator: 'gte',
    threshold: 900, // 90% of 1024 limit
    severity: 'warning',
    duration_seconds: 0
  },
  
  // GenieACS Alerts
  {
    name: 'GenieACS Service Down',
    source: 'genieacs',
    metric_name: 'service_health',
    operator: 'eq',
    threshold: 0,
    severity: 'critical',
    duration_seconds: 60
  },
  {
    name: 'High CPE Fault Rate',
    source: 'genieacs',
    metric_name: 'fault_rate',
    operator: 'gt',
    threshold: 5, // 5% of devices in fault
    severity: 'warning',
    duration_seconds: 600
  },
  {
    name: 'CPE Offline Spike',
    source: 'genieacs',
    metric_name: 'offline_device_count',
    operator: 'gt',
    threshold: 10,
    severity: 'warning',
    duration_seconds: 300
  },
  
  // CBRS Alerts
  {
    name: 'SAS Connection Lost',
    source: 'cbrs',
    metric_name: 'sas_connected',
    operator: 'eq',
    threshold: 0,
    severity: 'critical',
    duration_seconds: 300
  },
  {
    name: 'Grant Heartbeat Failures',
    source: 'cbrs',
    metric_name: 'heartbeat_failure_rate',
    operator: 'gt',
    threshold: 20, // 20% failure rate
    severity: 'error',
    duration_seconds: 600
  },
  {
    name: 'Low Available Spectrum',
    source: 'cbrs',
    metric_name: 'available_spectrum_mhz',
    operator: 'lt',
    threshold: 20, // Less than 20 MHz available
    severity: 'warning',
    duration_seconds: 0
  },
  
  // API Alerts
  {
    name: 'High API Error Rate',
    source: 'api',
    metric_name: 'error_rate',
    operator: 'gt',
    threshold: 5, // 5% error rate
    severity: 'warning',
    duration_seconds: 300
  },
  {
    name: 'Slow API Response',
    source: 'api',
    metric_name: 'avg_response_time_ms',
    operator: 'gt',
    threshold: 1000, // 1 second
    severity: 'warning',
    duration_seconds: 300
  },
  
  // System Alerts
  {
    name: 'High CPU Usage',
    source: 'system',
    metric_name: 'cpu_percent',
    operator: 'gt',
    threshold: 80,
    severity: 'warning',
    duration_seconds: 300
  },
  {
    name: 'High Memory Usage',
    source: 'system',
    metric_name: 'memory_percent',
    operator: 'gt',
    threshold: 85,
    severity: 'warning',
    duration_seconds: 300
  },
  {
    name: 'Low Disk Space',
    source: 'system',
    metric_name: 'disk_percent',
    operator: 'gt',
    threshold: 90,
    severity: 'critical',
    duration_seconds: 0
  },
  {
    name: 'MongoDB Connection Lost',
    source: 'system',
    metric_name: 'mongodb_connected',
    operator: 'eq',
    threshold: 0,
    severity: 'critical',
    duration_seconds: 60
  }
];

module.exports.DEFAULT_ALERT_RULES = DEFAULT_ALERT_RULES;

