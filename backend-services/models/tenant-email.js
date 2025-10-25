const mongoose = require('mongoose');

const tenantEmailConfigSchema = new mongoose.Schema({
  tenant_id: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  from_email: { 
    type: String,
    required: false
  },
  from_name: { 
    type: String,
    required: false
  },
  api_key: { 
    type: String,
    required: false
  },
  enabled: { 
    type: Boolean, 
    default: false 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update timestamp on save
tenantEmailConfigSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const TenantEmailConfig = mongoose.model('TenantEmailConfig', tenantEmailConfigSchema);

module.exports = TenantEmailConfig;

