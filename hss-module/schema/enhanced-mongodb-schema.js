/**
 * Enhanced HSS MongoDB Schema with Groups, Bandwidth Plans, and IMEI Tracking
 * 
 * Cloud-only HSS with:
 * - User groups with bandwidth plans
 * - IMEI tracking when UE comes online
 * - QCI settings per user/group
 * - Easy import/export functionality
 */

// Collection: bandwidth_plans
const bandwidthPlanSchema = {
  _id: ObjectId(),
  plan_name: String,                   // "Gold", "Silver", "Bronze", "Unlimited"
  plan_id: String,                     // "plan_gold" (unique identifier)
  tenantId: String,                    // Multi-tenant support
  
  // Bandwidth Settings
  bandwidth: {
    download_mbps: Number,             // Max download speed in Mbps
    upload_mbps: Number,               // Max upload speed in Mbps
    burst_download_mbps: Number,       // Optional burst speed
    burst_upload_mbps: Number,
  },
  
  // QoS Settings
  qos: {
    qci: Number,                       // QoS Class Identifier (1-9)
    arp: {                             // Allocation and Retention Priority
      priority_level: Number,          // 1 (highest) - 15 (lowest)
      pre_emption_capability: Boolean, // Can pre-empt other bearers
      pre_emption_vulnerability: Boolean // Can be pre-empted
    },
    gbr: Boolean,                      // Guaranteed Bit Rate bearer
    mbr_dl: Number,                    // Maximum Bit Rate Downlink (bps)
    mbr_ul: Number,                    // Maximum Bit Rate Uplink (bps)
    gbr_dl: Number,                    // Guaranteed Bit Rate Downlink (bps)
    gbr_ul: Number                     // Guaranteed Bit Rate Uplink (bps)
  },
  
  // Data Limits
  data_limits: {
    monthly_quota_gb: Number,          // Monthly data allowance in GB (0 = unlimited)
    daily_quota_gb: Number,            // Daily limit (optional)
    throttle_after_quota: Boolean,     // Throttle or block after quota
    throttled_speed_mbps: Number       // Speed after quota exceeded
  },
  
  // Additional Features
  features: {
    priority_traffic: Boolean,         // Priority in congestion
    video_optimization: Boolean,       // Video streaming optimization
    gaming_optimization: Boolean,      // Low latency for gaming
    static_ip: Boolean                 // Static IP assignment
  },
  
  // Pricing (optional, for billing integration)
  pricing: {
    monthly_price: Number,
    currency: String,                  // "USD", "EUR", etc.
  },
  
  // Metadata
  metadata: {
    created_at: Date,
    updated_at: Date,
    created_by: String,
    description: String,
    is_active: Boolean
  },
  
  // Indexes
  indexes: {
    plan_id: { unique: true },
    tenantId: 1,
    'metadata.is_active': 1
  }
};

// Collection: subscriber_groups
const subscriberGroupSchema = {
  _id: ObjectId(),
  group_name: String,                  // "VIP Users", "Business", "Residential"
  group_id: String,                    // "group_vip" (unique identifier)
  tenantId: String,
  
  // Default Bandwidth Plan for Group
  default_plan_id: String,             // Reference to bandwidth_plans.plan_id
  
  // Group Settings (inherited by all members)
  group_settings: {
    apn: String,                       // Default APN for group
    allowed_apns: [String],            // List of allowed APNs
    roaming_allowed: Boolean,
    international_roaming: Boolean,
    volte_enabled: Boolean,
    vowifi_enabled: Boolean,
  },
  
  // Group QoS Override (optional, overrides plan QoS)
  qos_override: {
    qci: Number,
    arp: {
      priority_level: Number,
      pre_emption_capability: Boolean,
      pre_emption_vulnerability: Boolean
    }
  },
  
  // Access Control
  access_control: {
    allowed_mme_realms: [String],      // Which MMEs can serve this group
    allowed_tracking_areas: [String],  // TACs allowed for this group
    home_network_only: Boolean         // Restrict to home network
  },
  
  // Member Statistics
  statistics: {
    total_members: Number,
    active_members: Number,
    total_data_usage_gb: Number,
    last_updated: Date
  },
  
  // Metadata
  metadata: {
    created_at: Date,
    updated_at: Date,
    created_by: String,
    description: String,
    color: String,                     // For UI display
    icon: String,
    is_active: Boolean
  },
  
  // Indexes
  indexes: {
    group_id: { unique: true },
    tenantId: 1,
    'metadata.is_active': 1
  }
};

// Collection: subscribers (Enhanced with groups and IMEI)
const subscriberSchema = {
  _id: ObjectId(),
  
  // Identity
  imsi: String,                        // 15-digit IMSI (Primary Key)
  tenantId: String,
  
  // Authentication (Encrypted)
  ki: String,                          // 128-bit or 256-bit key (encrypted)
  opc: String,                         // Operator code (encrypted)
  op: String,                          // Alternative: OP value (encrypted)
  sqn: Number,                         // Sequence number for AKA
  
  // User Information
  user_info: {
    full_name: String,                 // NEW: Full user name
    username: String,                  // Optional login username
    email: String,
    phone: String,
    msisdn: String,                    // Primary phone number
    customer_id: String,               // External customer ID
    account_type: String               // "individual", "business", "enterprise"
  },
  
  // Device Information (Tracked when UE comes online)
  device_info: {
    imei: String,                      // NEW: Captured from MME
    imei_sv: String,                   // IMEI Software Version
    device_type: String,               // "smartphone", "router", "modem", "iot"
    manufacturer: String,
    model: String,
    first_seen: Date,                  // When IMEI first detected
    last_seen: Date,                   // Last time device was online
    history: [{                        // Track IMEI changes
      imei: String,
      first_seen: Date,
      last_seen: Date
    }]
  },
  
  // Group Membership
  group_membership: {
    group_id: String,                  // Reference to subscriber_groups
    group_name: String,                // Cached for quick access
    joined_at: Date,
    assigned_by: String
  },
  
  // Bandwidth Plan (Individual Override)
  bandwidth_plan: {
    plan_id: String,                   // If null, use group's default plan
    plan_name: String,                 // Cached
    override_group_plan: Boolean,      // Individual plan overrides group
    custom_settings: {                 // Custom per-user settings
      download_mbps: Number,           // Override plan settings
      upload_mbps: Number,
      monthly_quota_gb: Number
    }
  },
  
  // Status
  status: String,                      // "active", "inactive", "suspended", "pending"
  
  // Network Profile
  profile: {
    apn: String,                       // Default APN
    apn_config: [{
      apn: String,
      qci: Number,
      static_ip: String,
      pdp_type: String                 // "IPv4", "IPv6", "IPv4v6"
    }],
    subscription_type: String,         // "prepaid", "postpaid"
    roaming_allowed: Boolean,
    ue_ambr_dl: Number,                // UE Aggregate Maximum Bit Rate Downlink
    ue_ambr_ul: Number                 // UE Aggregate Maximum Bit Rate Uplink
  },
  
  // Usage Tracking
  usage: {
    current_period_start: Date,
    current_period_end: Date,
    data_used_bytes: Number,
    data_remaining_bytes: Number,
    session_count: Number,
    last_session: Date
  },
  
  // ACS Integration
  acs: {
    cpe_serial_number: String,
    acs_device_id: String,
    last_acs_inform: Date,
    device_status: String
  },
  
  // MME Tracking
  mme_tracking: {
    last_mme_realm: String,            // Which MME served last
    last_mme_host: String,
    last_tracking_area: String,        // TAC
    last_ecgi: String,                 // E-UTRAN Cell Global Identifier
    last_location_update: Date,
    current_serving_mme: String
  },
  
  // Metadata
  metadata: {
    created_at: Date,
    updated_at: Date,
    created_by: String,
    last_modified_by: String,
    notes: String,
    tags: [String],
    activation_date: Date,
    expiration_date: Date
  },
  
  // Indexes
  indexes: {
    imsi: { unique: true },
    tenantId: 1,
    status: 1,
    'device_info.imei': 1,
    'group_membership.group_id': 1,
    'mme_tracking.last_mme_realm': 1,
    'user_info.full_name': 1,
    'user_info.email': 1
  }
};

// Collection: inactive_subscribers (Enhanced)
const inactiveSubscriberSchema = {
  // Same structure as subscribers, plus:
  deactivation: {
    deactivated_at: Date,
    deactivated_by: String,
    reason: String,
    can_reactivate: Boolean,
    scheduled_reactivation: Date,      // Optional auto-reactivation
    original_data: Object
  }
};

// Collection: subscriber_sessions (Enhanced with IMEI)
const sessionSchema = {
  _id: ObjectId(),
  session_id: String,                  // Unique session identifier
  tenantId: String,
  imsi: String,
  imei: String,                        // NEW: Device IMEI for this session
  msisdn: String,
  
  // Network Information
  network: {
    ip_address: String,
    ipv6_address: String,
    apn: String,
    qci: Number,
    cell_id: String,
    enodeb_id: String,
    tracking_area: String,
    serving_mme: String,
    serving_sgw: String,
    serving_pgw: String
  },
  
  // Session Timing
  started_at: Date,
  ended_at: Date,
  last_activity: Date,
  duration_seconds: Number,
  
  // Usage Statistics
  usage: {
    bytes_uploaded: Number,
    bytes_downloaded: Number,
    total_bytes: Number,
    peak_upload_rate: Number,
    peak_download_rate: Number
  },
  
  // QoS Applied
  qos_applied: {
    qci: Number,
    arp_priority: Number,
    bandwidth_dl_mbps: Number,
    bandwidth_ul_mbps: Number,
    plan_id: String,
    group_id: String
  },
  
  // Session Status
  status: String,                      // "active", "disconnected", "expired"
  disconnect_reason: String,
  
  // Indexes
  indexes: {
    imsi: 1,
    imei: 1,
    session_id: { unique: true },
    started_at: -1,
    status: 1,
    tenantId: 1
  }
};

// Collection: mme_connections (Track connected MMEs)
const mmeConnectionSchema = {
  _id: ObjectId(),
  mme_realm: String,                   // "mme.example.com"
  mme_host: String,                    // "mme1.example.com"
  mme_identity: String,                // Diameter identity
  
  // Connection Info
  connection: {
    ip_address: String,
    diameter_port: Number,
    status: String,                    // "connected", "disconnected"
    last_connected: Date,
    last_disconnected: Date,
    connection_uptime: Number          // Seconds
  },
  
  // MME Capabilities
  capabilities: {
    supported_tracking_areas: [String],
    max_subscribers: Number,
    current_subscribers: Number,
    vendor: String,
    version: String
  },
  
  // Statistics
  statistics: {
    total_auth_requests: Number,
    total_location_updates: Number,
    successful_requests: Number,
    failed_requests: Number,
    average_response_time_ms: Number
  },
  
  // Access Control
  access_control: {
    allowed: Boolean,
    whitelist_tenants: [String],       // Which tenants can use this MME
    max_concurrent_sessions: Number
  },
  
  // Metadata
  metadata: {
    created_at: Date,
    updated_at: Date,
    last_seen: Date,
    notes: String
  },
  
  // Indexes
  indexes: {
    mme_realm: 1,
    mme_host: 1,
    'connection.status': 1
  }
};

// Collection: bulk_import_jobs
const bulkImportJobSchema = {
  _id: ObjectId(),
  job_id: String,
  tenantId: String,
  
  // Import Details
  import_info: {
    filename: String,
    format: String,                    // "csv", "json", "excel"
    total_records: Number,
    processed: Number,
    successful: Number,
    failed: Number,
    status: String                     // "pending", "processing", "completed", "failed"
  },
  
  // Default Settings for Import
  defaults: {
    group_id: String,                  // Assign all to this group
    plan_id: String,                   // Assign all to this plan
    status: String,                    // Default status for imported users
    apn: String
  },
  
  // Results
  results: {
    successful_imsis: [String],
    failed_records: [{
      row: Number,
      imsi: String,
      error: String
    }]
  },
  
  // Metadata
  metadata: {
    created_at: Date,
    completed_at: Date,
    created_by: String,
    file_size_bytes: Number
  },
  
  // Indexes
  indexes: {
    job_id: { unique: true },
    tenantId: 1,
    'import_info.status': 1,
    'metadata.created_at': -1
  }
};

module.exports = {
  bandwidthPlanSchema,
  subscriberGroupSchema,
  subscriberSchema,
  inactiveSubscriberSchema,
  sessionSchema,
  mmeConnectionSchema,
  bulkImportJobSchema
};

