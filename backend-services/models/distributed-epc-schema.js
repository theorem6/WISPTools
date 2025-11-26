// MongoDB Schemas for Distributed EPC Management
// Integrates with existing HSS system for cloud-based authentication

const mongoose = require('mongoose');

/**
 * Remote EPC Site Schema
 * Each tenant can have multiple remote EPC sites
 */
const RemoteEPCSchema = new mongoose.Schema({
  // Identification
  epc_id: { type: String, required: true, unique: true, index: true },
  site_id: { type: String, index: true }, // Reference to Firestore site document
  site_name: { type: String, required: true },
  tenant_id: { type: String, required: true, index: true },
  
  // Deployment Type - what software to install
  deployment_type: { 
    type: String, 
    enum: ['epc', 'snmp', 'both'],
    default: 'both'
  },
  
  // Authentication
  auth_code: { type: String, required: true, unique: true, index: true }, // Unique code for API auth
  api_key: { type: String, required: true }, // Generated API key
  secret_key: { type: String, required: true }, // Secret for signing requests
  checkin_token: { type: String, unique: true, sparse: true, index: true }, // Token for hardware check-in
  hardware_id: { type: String, index: true }, // MAC address or unique hardware identifier
  device_code: { type: String, unique: true, sparse: true, index: true }, // Unique alphanumeric code displayed on device for registration
  origin_host_fqdn: { type: String }, // Unique FQDN for Diameter S6a identity
  
  // Location
  location: {
    address: String,
    city: String,
    state: String,
    country: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Network Configuration (legacy - use hss_config for new deployments)
  network_config: {
    mcc: String, // Mobile Country Code
    mnc: String, // Mobile Network Code
    tac: String, // Tracking Area Code
    plmn_id: String
  },
  
  // HSS/EPC Configuration
  hss_config: {
    mcc: { type: String, default: '001' },
    mnc: { type: String, default: '01' },
    tac: { type: String, default: '1' },
    apnName: { type: String, default: 'internet' },
    dnsPrimary: { type: String, default: '8.8.8.8' },
    dnsSecondary: { type: String, default: '8.8.4.4' },
    uePoolCidr: { type: String, default: '10.45.0.0/16' }
  },
  
  // SNMP Configuration
  snmp_config: {
    enabled: { type: Boolean, default: true },
    community: { type: String, default: 'public' },
    version: { type: String, enum: ['1', '2c', '3'], default: '2c' },
    port: { type: Number, default: 161 },
    pollingInterval: { type: Number, default: 60 }, // seconds
    targets: [String], // List of IPs/networks to scan
    trapReceiver: String, // Where to send SNMP traps
    autoDiscovery: { type: Boolean, default: true }
  },
  
  // APT Repository Configuration (for package updates)
  apt_config: {
    customRepoUrl: String,
    gpgKeyUrl: String,
    updateSchedule: { type: String, default: 'daily' }
  },
  
  // Connection Status
  status: { 
    type: String, 
    enum: ['registered', 'online', 'offline', 'error'],
    default: 'registered',
    index: true
  },
  last_heartbeat: { type: Date },
  last_seen: { type: Date },
  uptime_seconds: { type: Number, default: 0 },
  
  // Version Info
  version: {
    open5gs: String,
    metrics_agent: String,
    os: String
  },
  
  // Metrics Update Config
  metrics_config: {
    update_interval_seconds: { type: Number, default: 60 }, // Configurable 1-2 min
    enabled_metrics: [String],
    log_level: { type: String, enum: ['error', 'warn', 'info', 'debug'], default: 'info' }
  },
  
  // Contact
  contact: {
    name: String,
    email: String,
    phone: String
  },
  
  // Metadata
  notes: String,
  tags: [String],
  enabled: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes for performance
RemoteEPCSchema.index({ tenant_id: 1, status: 1 });
RemoteEPCSchema.index({ auth_code: 1 });
RemoteEPCSchema.index({ last_heartbeat: -1 });

/**
 * EPC Metrics Schema
 * Real-time metrics from remote EPC sites
 */
const EPCMetricsSchema = new mongoose.Schema({
  epc_id: { type: String, required: true, index: true },
  tenant_id: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  
  // Subscriber Metrics
  subscribers: {
    total_seen: { type: Number, default: 0 },
    total_connected: { type: Number, default: 0 },
    total_disconnected: { type: Number, default: 0 },
    active_sessions: { type: Number, default: 0 }
  },
  
  // Per-APN Metrics
  apn_stats: [{
    apn_name: String,
    attached_count: Number,
    data_usage_bytes: Number
  }],
  
  // Multi-APN IMSIs
  multi_apn_imsis: [{
    imsi: String,
    apn_list: [String],
    count: Number
  }],
  
  // Attach/Detach Events (last 60 min)
  attach_detach: {
    last_60min_attaches: { type: Number, default: 0 },
    last_60min_detaches: { type: Number, default: 0 },
    events: [{
      timestamp: Date,
      event_type: { type: String, enum: ['attach', 'detach'] },
      imsi: String
    }]
  },
  
  // OGSTUN Pool (IP Address Pool)
  ogstun_pool: {
    total_ips: { type: Number, default: 0 },
    allocated_ips: { type: Number, default: 0 },
    available_ips: { type: Number, default: 0 },
    utilization_percent: { type: Number, default: 0 }
  },
  
  // CellID Status
  cellid_status: {
    total_cells: { type: Number, default: 0 },
    active_cells: { type: Number, default: 0 },
    inactive_cells: { type: Number, default: 0 }
  },
  
  // eNB Base Stations (S1 Connections)
  enb_stats: [{
    s1_ip: String,
    cellid: String,
    status: { type: String, enum: ['connected', 'disconnected'] },
    duration_seconds: Number,
    last_seen: Date
  }],
  
  // System Resources
  system: {
    cpu_percent: Number,
    memory_percent: Number,
    disk_percent: Number,
    load_average: [Number]
  },
  
  // Open5GS Component Status
  components: {
    mme: { type: String, enum: ['running', 'stopped', 'error'] },
    sgwc: { type: String, enum: ['running', 'stopped', 'error'] },
    sgwu: { type: String, enum: ['running', 'stopped', 'error'] },
    upf: { type: String, enum: ['running', 'stopped', 'error'] },
    smf: { type: String, enum: ['running', 'stopped', 'error'] },
    pcrf: { type: String, enum: ['running', 'stopped', 'error'] }
  },
  
  // Log Freshness
  log_freshness: {
    latest_mme_log: Date,
    latest_smf_log: Date,
    latest_upf_log: Date,
    latest_sgwu_log: Date,
    latest_sgwc_log: Date
  }
}, {
  timeseries: {
    timeField: 'timestamp',
    metaField: 'epc_id',
    granularity: 'minutes'
  }
});

// TTL Index - Keep metrics for 90 days
EPCMetricsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // 90 days
EPCMetricsSchema.index({ epc_id: 1, timestamp: -1 });
EPCMetricsSchema.index({ tenant_id: 1, timestamp: -1 });

/**
 * Subscriber Session Schema
 * Track individual subscriber sessions across EPCs
 */
const SubscriberSessionSchema = new mongoose.Schema({
  imsi: { type: String, required: true, index: true },
  tenant_id: { type: String, required: true, index: true },
  epc_id: { type: String, required: true, index: true },
  
  // Session Info
  session_id: { type: String, unique: true },
  status: { type: String, enum: ['attached', 'detached'], index: true },
  
  // Network Details
  apn: String,
  cellid: String,
  enb_ip: String,
  allocated_ip: String,
  
  // Timestamps
  attached_at: { type: Date, index: true },
  detached_at: Date,
  last_activity: Date,
  
  // Data Usage
  data_usage: {
    uplink_bytes: { type: Number, default: 0 },
    downlink_bytes: { type: Number, default: 0 },
    total_bytes: { type: Number, default: 0 }
  },
  
  // QoS
  qos: {
    qci: Number,
    max_uplink_bps: Number,
    max_downlink_bps: Number
  }
}, {
  timestamps: true
});

SubscriberSessionSchema.index({ imsi: 1, attached_at: -1 });
SubscriberSessionSchema.index({ epc_id: 1, status: 1 });
SubscriberSessionSchema.index({ tenant_id: 1, status: 1 });
// TTL Index - Keep sessions for 90 days
SubscriberSessionSchema.index({ attached_at: 1 }, { expireAfterSeconds: 7776000 });

/**
 * Attach/Detach Event Schema
 * Detailed event log for attach/detach operations
 */
const AttachDetachEventSchema = new mongoose.Schema({
  tenant_id: { type: String, required: true, index: true },
  epc_id: { type: String, required: true, index: true },
  imsi: { type: String, required: true, index: true },
  
  event_type: { type: String, enum: ['attach', 'detach'], required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  
  // Context
  apn: String,
  cellid: String,
  enb_ip: String,
  allocated_ip: String,
  
  // Result
  result: { type: String, enum: ['success', 'failure'] },
  error_code: String,
  error_message: String,
  
  // Metadata
  session_duration_seconds: Number, // For detach events
  data_usage_bytes: Number // For detach events
}, {
  timestamps: { createdAt: 'timestamp', updatedAt: false }
});

// Indexes
AttachDetachEventSchema.index({ timestamp: -1 });
AttachDetachEventSchema.index({ epc_id: 1, timestamp: -1 });
AttachDetachEventSchema.index({ imsi: 1, timestamp: -1 });
AttachDetachEventSchema.index({ tenant_id: 1, event_type: 1, timestamp: -1 });
// TTL Index - Keep events for 90 days
AttachDetachEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

/**
 * EPC Alert Schema
 * Alerts and notifications for EPC issues
 */
const EPCAlertSchema = new mongoose.Schema({
  tenant_id: { type: String, required: true, index: true },
  epc_id: { type: String, required: true, index: true },
  
  severity: { 
    type: String, 
    enum: ['critical', 'error', 'warning', 'info'],
    required: true,
    index: true
  },
  
  alert_type: {
    type: String,
    enum: ['offline', 'high_cpu', 'high_memory', 'high_disk', 'component_down', 'no_heartbeat', 'pool_exhausted', 'enb_disconnected'],
    required: true
  },
  
  message: String,
  details: mongoose.Schema.Types.Mixed,
  
  timestamp: { type: Date, default: Date.now, index: true },
  resolved: { type: Boolean, default: false, index: true },
  resolved_at: Date,
  resolved_by: String,
  
  notified: { type: Boolean, default: false },
  notification_sent_at: Date
}, {
  timestamps: true
});

EPCAlertSchema.index({ tenant_id: 1, resolved: 1, timestamp: -1 });
EPCAlertSchema.index({ epc_id: 1, resolved: 1 });

// Models
const RemoteEPC = mongoose.model('RemoteEPC', RemoteEPCSchema);
const EPCMetrics = mongoose.model('EPCMetrics', EPCMetricsSchema);
const SubscriberSession = mongoose.model('SubscriberSession', SubscriberSessionSchema);
const AttachDetachEvent = mongoose.model('AttachDetachEvent', AttachDetachEventSchema);
const EPCAlert = mongoose.model('EPCAlert', EPCAlertSchema);

module.exports = {
  RemoteEPC,
  EPCMetrics,
  SubscriberSession,
  AttachDetachEvent,
  EPCAlert
};

