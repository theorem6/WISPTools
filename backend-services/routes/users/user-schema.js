const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  displayName: { type: String },
  photoURL: { type: String },
  role: { type: String, enum: ['admin', 'user', 'tenant_admin'], default: 'user' },
  tenantId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const userTenantSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  tenantId: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user', 'tenant_admin'], default: 'user' },
  modules: { type: [String], default: [] },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  invitedBy: { type: String },
  invitedAt: { type: Date, default: Date.now },
  joinedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = {
  User: mongoose.model('User', userSchema),
  UserTenant: mongoose.model('UserTenant', userTenantSchema)
};
