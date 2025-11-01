/**
 * User Management Schema (MongoDB)
 * Stores user-tenant relationships and roles
 */

const mongoose = require('mongoose');

// User-Tenant Association Schema
const UserTenantSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  tenantId: { type: String, required: true, index: true },
  
  // Role in this tenant
  role: { 
    type: String, 
    required: true,
    enum: ['platform_admin', 'owner', 'admin', 'engineer', 'installer', 'helpdesk', 'sales', 'viewer']
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'suspended', 'pending_invitation'],
    default: 'active'
  },
  
  // Custom permissions (overrides defaults)
  moduleAccess: {
    type: Map,
    of: Boolean
  },
  
  // Invitation tracking
  invitedBy: String,
  invitedAt: Date,
  acceptedAt: Date,
  
  // Metadata
  addedAt: { type: Date, default: Date.now },
  lastAccessAt: Date,
  updatedAt: { type: Date, default: Date.now },
  updatedBy: String,
  suspendedAt: Date,
  suspendedBy: String,
  activatedAt: Date,
  activatedBy: String
});

// Compound index for efficient lookups
UserTenantSchema.index({ userId: 1, tenantId: 1 }, { unique: true });
UserTenantSchema.index({ tenantId: 1, role: 1 });
UserTenantSchema.index({ tenantId: 1, status: 1 });

// Pre-save middleware
UserTenantSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const UserTenant = mongoose.model('UserTenant', UserTenantSchema);

module.exports = { UserTenant, UserTenantSchema };

