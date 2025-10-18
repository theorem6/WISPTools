// Tenant Email Configuration Schema
// Allows each tenant to configure their own alert email settings

const mongoose = require('mongoose');

const TenantEmailConfigSchema = new mongoose.Schema({
  config_id: { type: String, required: true, unique: true },
  tenant_id: { type: String, required: true, unique: true, index: true },
  
  // Sender configuration (optional - uses tenant email if not set)
  sender: {
    email: String,  // Custom sender email (e.g., alerts@company.com)
    name: String,   // Custom sender name (e.g., "Acme Corp Alerts")
    use_tenant_email: { type: Boolean, default: true }  // Use tenant owner email
  },
  
  // SendGrid configuration (optional - uses platform key if not set)
  sendgrid: {
    api_key: String,  // Tenant's own SendGrid API key (encrypted)
    use_platform_key: { type: Boolean, default: true }
  },
  
  // Default recipients for different severity levels
  default_recipients: {
    critical: [String],  // Emails for critical alerts
    error: [String],     // Emails for error alerts
    warning: [String],   // Emails for warning alerts
    info: [String]       // Emails for info alerts
  },
  
  // Email preferences
  preferences: {
    include_logo: { type: Boolean, default: true },
    include_action_button: { type: Boolean, default: true },
    timezone: { type: String, default: 'UTC' },
    daily_digest: { type: Boolean, default: false },
    digest_time: { type: String, default: '09:00' },  // HH:mm format
    digest_recipients: [String]
  },
  
  // Tenant branding
  branding: {
    company_name: String,
    logo_url: String,
    primary_color: { type: String, default: '#2563eb' },
    support_email: String,
    support_phone: String
  },
  
  // Status
  enabled: { type: Boolean, default: true },
  verified: { type: Boolean, default: false },  // Sender email verified
  
  // Metadata
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  last_test_sent: Date
});

module.exports = mongoose.model('TenantEmailConfig', TenantEmailConfigSchema);

