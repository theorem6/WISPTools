const mongoose = require('mongoose');
const { UserTenant } = require('../../models/user');

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  displayName: { type: String },
  photoURL: { type: String },
  role: {
    type: String,
    enum: ['platform_admin', 'owner', 'admin', 'engineer', 'installer', 'helpdesk', 'sales', 'viewer'],
    default: 'viewer'
  },
  tenantId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = {
  User,
  UserTenant
};
