/**
 * FCAPS Permission Model (MongoDB)
 * 
 * FCAPS - Fault, Configuration, Accounting, Performance, Security
 * Each category supports: read, write, delete operations
 * 
 * This model stores granular permissions for users/roles per module/system
 */

const mongoose = require('mongoose');

// FCAPS Categories
const FCAPS_CATEGORIES = ['fault', 'configuration', 'accounting', 'performance', 'security'];

// Operations supported by each FCAPS category
const FCAPS_OPERATIONS = ['read', 'write', 'delete'];

// Permission structure for a single module/system
const ModulePermissionSchema = new mongoose.Schema({
  // Module/System identifier (e.g., 'inventory', 'customers', 'plans', 'network', etc.)
  module: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  
  // FCAPS permissions - each category has read/write/delete
  fault: {
    read: { type: Boolean, default: false },
    write: { type: Boolean, default: false },
    delete: { type: Boolean, default: false }
  },
  configuration: {
    read: { type: Boolean, default: false },
    write: { type: Boolean, default: false },
    delete: { type: Boolean, default: false }
  },
  accounting: {
    read: { type: Boolean, default: false },
    write: { type: Boolean, default: false },
    delete: { type: Boolean, default: false }
  },
  performance: {
    read: { type: Boolean, default: false },
    write: { type: Boolean, default: false },
    delete: { type: Boolean, default: false }
  },
  security: {
    read: { type: Boolean, default: false },
    write: { type: Boolean, default: false },
    delete: { type: Boolean, default: false }
  }
}, { _id: false });

// User Permission Schema - stores permissions for a specific user in a tenant
const UserPermissionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  tenantId: { type: String, required: true, index: true },
  
  // Permissions for each module
  permissions: [ModulePermissionSchema],
  
  // Inherit permissions from role (if true, role permissions are used as base)
  inheritFromRole: { type: Boolean, default: true },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: String,
  updatedBy: String
});

// Role Permission Schema - stores default permissions for a role in a tenant
const RolePermissionSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
    enum: ['platform_admin', 'owner', 'admin', 'engineer', 'installer', 'helpdesk', 'sales', 'viewer'],
    index: true
  },
  tenantId: { type: String, required: true, index: true },
  
  // Permissions for each module
  permissions: [ModulePermissionSchema],
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: String,
  updatedBy: String
});

// Compound indexes
UserPermissionSchema.index({ userId: 1, tenantId: 1 }, { unique: true });
RolePermissionSchema.index({ role: 1, tenantId: 1 }, { unique: true });

// Pre-save middleware
UserPermissionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

RolePermissionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const UserPermission = mongoose.model('UserPermission', UserPermissionSchema);
const RolePermission = mongoose.model('RolePermission', RolePermissionSchema);

module.exports = {
  UserPermission,
  RolePermission,
  ModulePermissionSchema,
  FCAPS_CATEGORIES,
  FCAPS_OPERATIONS
};

