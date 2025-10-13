/**
 * HSS and User Management Module - MongoDB Schema
 * 
 * This module provides subscriber authentication data storage
 * integrated with the ACS/TR-069 server using IMSI as the correlation key.
 */

// Collection: active_subscribers
const activeSubscriberSchema = {
  // Primary Identity
  _id: ObjectId(),
  tenantId: String,                    // Multi-tenant support
  imsi: String,                        // REQUIRED: Primary key (15 digits)
  
  // Authentication Credentials (ENCRYPTED)
  ki: String,                          // 128-bit or 256-bit key (hex string)
  opc: String,                         // Operator code (128-bit hex string)
  
  // Optional: Alternative auth methods
  op: String,                          // OP value (some HSS use OP instead of OPc)
  sqn: Number,                         // Sequence number for AKA
  
  // Subscriber Profile
  msisdn: String,                      // Phone number
  imei: String,                        // Device IMEI (if known)
  status: String,                      // "active", "suspended", "pending"
  
  // Network Profile
  profile: {
    apn: String,                       // Access Point Name
    apn_config: [{
      apn: String,
      qos_profile: String,             // "gold", "silver", "bronze"
      static_ip: String,               // Optional static IP
    }],
    subscription_type: String,         // "prepaid", "postpaid"
    data_plan: {
      max_bandwidth_dl: Number,        // Downlink bandwidth (bps)
      max_bandwidth_ul: Number,        // Uplink bandwidth (bps)
      monthly_quota: Number,           // Data quota in bytes
      used_this_month: Number,         // Current usage
    }
  },
  
  // ACS Integration (CRITICAL for your use case)
  acs: {
    cpe_serial_number: String,         // Link to GenieACS device
    acs_device_id: String,             // GenieACS device _id
    last_acs_inform: Date,             // Last time device contacted ACS
    device_status: String,             // "online", "offline", "maintenance"
  },
  
  // Metadata
  metadata: {
    created_at: Date,
    updated_at: Date,
    created_by: String,                // User who created this subscriber
    last_modified_by: String,
    notes: String,
    tags: [String],                    // ["vip", "test", "business"]
  },
  
  // Indexes
  indexes: {
    imsi: { unique: true },
    tenantId: 1,
    "acs.cpe_serial_number": 1,
    status: 1
  }
};

// Collection: inactive_subscribers
const inactiveSubscriberSchema = {
  // Same structure as active_subscribers, plus:
  deactivation: {
    deactivated_at: Date,
    deactivated_by: String,
    reason: String,                    // "non-payment", "user-request", "fraud"
    can_reactivate: Boolean,
    original_data: Object              // Backup of original subscriber data
  }
};

// Collection: subscriber_sessions (for tracking)
const sessionSchema = {
  _id: ObjectId(),
  tenantId: String,
  imsi: String,
  session_id: String,                  // EPC session identifier
  
  // Network Information
  network: {
    ip_address: String,                // Assigned IP
    apn: String,
    cell_id: String,                   // LTE Cell ID
    enodeb_id: String,                 // eNodeB identifier
    tracking_area: String,
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
  },
  
  // Session Status
  status: String,                      // "active", "disconnected", "expired"
  
  // Indexes
  indexes: {
    imsi: 1,
    session_id: { unique: true },
    started_at: -1,
    tenantId: 1
  }
};

// Collection: authentication_vectors (for HSS)
const authVectorSchema = {
  _id: ObjectId(),
  imsi: String,
  
  // Authentication Vectors (generated from Ki and OPc)
  vectors: [{
    rand: String,                      // Random challenge (128-bit hex)
    autn: String,                      // Authentication token
    xres: String,                      // Expected response
    kasme: String,                     // Key for MME
    generated_at: Date,
    used: Boolean,
  }],
  
  // Indexes
  indexes: {
    imsi: 1
  }
};

// Collection: subscriber_audit_log
const auditLogSchema = {
  _id: ObjectId(),
  tenantId: String,
  imsi: String,
  
  // Action Information
  action: String,                      // "created", "activated", "deactivated", "modified"
  performed_by: String,                // User ID or email
  performed_at: Date,
  
  // Change Details
  changes: {
    field: String,
    old_value: String,
    new_value: String,
  },
  
  // Context
  ip_address: String,
  user_agent: String,
  
  // Indexes
  indexes: {
    imsi: 1,
    performed_at: -1,
    tenantId: 1
  }
};

module.exports = {
  activeSubscriberSchema,
  inactiveSubscriberSchema,
  sessionSchema,
  authVectorSchema,
  auditLogSchema
};

