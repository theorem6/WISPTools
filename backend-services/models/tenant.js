/**
 * Tenant Schema for MongoDB
 * 
 * Unified tenant management using MongoDB instead of Firestore
 * This ensures consistency with user-tenant associations
 */

const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  // Basic tenant information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  subdomain: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[a-z0-9-]+$/
  },
  contactEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  
  // Technical configuration
  cwmpUrl: {
    type: String,
    required: true
  },
  
  // Status and metadata
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active'
  },
  
  // Settings and limits
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      allowSelfRegistration: false,
      requireEmailVerification: true,
      maxUsers: 50,
      maxDevices: 1000,
      features: {
        acs: true,
        hss: true,
        pci: true,
        helpDesk: true,
        userManagement: true,
        customerManagement: true
      }
    }
  },
  
  limits: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      maxUsers: 50,
      maxDevices: 1000,
      maxNetworks: 10,
      maxTowerSites: 100
    }
  },
  
  // Audit fields
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  collection: 'tenants'
});

// Indexes for performance
tenantSchema.index({ subdomain: 1 }, { unique: true });
tenantSchema.index({ status: 1 });
tenantSchema.index({ createdBy: 1 });
tenantSchema.index({ createdAt: -1 });

// Update updatedAt on save
tenantSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Soft delete method
tenantSchema.methods.softDelete = function(deletedBy) {
  this.status = 'deleted';
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

// Restore method
tenantSchema.methods.restore = function() {
  this.status = 'active';
  this.deletedAt = null;
  this.deletedBy = null;
  return this.save();
};

const Tenant = mongoose.model('Tenant', tenantSchema);

module.exports = { Tenant };
