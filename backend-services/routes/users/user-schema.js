const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  displayName: { type: String },
  photoURL: { type: String },
  role: { type: String, enum: ['platform_admin', 'owner', 'admin', 'engineer', 'installer', 'helpdesk', 'viewer'], default: 'viewer' },
  tenantId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const userTenantSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  tenantId: { type: String, required: true },
  role: { type: String, enum: ['platform_admin', 'owner', 'admin', 'engineer', 'installer', 'helpdesk', 'viewer'], default: 'viewer' },
  moduleAccess: { type: Object, default: {} },
  workOrderPermissions: { type: Object, default: {} },
  status: { type: String, enum: ['active', 'suspended', 'pending'], default: 'pending' },
  invitedBy: { type: String },
  invitedAt: { type: Date, default: Date.now },
  acceptedAt: { type: Date },
  addedAt: { type: Date, default: Date.now },
  lastAccessAt: { type: Date },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String }
});

module.exports = {
  User: mongoose.model('User', userSchema),
  UserTenant: mongoose.model('UserTenant', userTenantSchema)
};
