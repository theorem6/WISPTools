// Network Equipment Models
// Unified models for towers, sectors, and CPE devices

const mongoose = require('mongoose');

// Location Schema
const LocationSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  address: String,
  city: String,
  state: String,
  zipCode: String,
  country: {
    type: String,
    default: 'US'
  }
});

// Unified Site Schema
const UnifiedSiteSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['tower', 'building', 'pole', 'other'],
    default: 'tower'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'planned'],
    default: 'active'
  },
  
  // Location
  location: LocationSchema,
  
  // Physical Properties
  height: {
    type: Number,
    min: 0
  },
  structureType: {
    type: String,
    enum: ['self-supporting', 'guyed', 'monopole', 'building-mounted', 'other']
  },
  
  // Ownership
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  owner: String,
  fccId: String,
  gateCode: String,
  
  // Integration
  inventoryId: String, // Link to inventory system
  modules: {
    pci: {
      enabled: Boolean,
      lastSync: Date
    },
    cbrs: {
      enabled: Boolean,
      lastSync: Date
    }
  },
  
  // Metadata
  createdBy: String,
  createdById: String,
  updatedBy: String,
  updatedById: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Unified Sector Schema
const UnifiedSectorSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'planned'],
    default: 'active'
  },
  
  // Technical Properties
  technology: {
    type: String,
    enum: ['LTE', '5G', 'CBRS', 'WiFi', 'other'],
    required: true
  },
  band: String,
  frequency: Number,
  azimuth: {
    type: Number,
    required: true,
    min: 0,
    max: 360
  },
  beamwidth: {
    type: Number,
    min: 0,
    max: 360
  },
  power: Number,
  
  // Location
  location: LocationSchema,
  
  // Site Association
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UnifiedTower',
    required: true
  },
  
  // Ownership
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  
  // Integration
  inventoryId: String, // Link to inventory system
  modules: {
    pci: {
      enabled: Boolean,
      lastSync: Date
    },
    cbrs: {
      enabled: Boolean,
      lastSync: Date
    }
  },
  
  // Metadata
  createdBy: String,
  createdById: String,
  updatedBy: String,
  updatedById: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Unified CPE Schema
const UnifiedCPESchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'planned', 'offline'],
    default: 'active'
  },
  
  // Technical Properties
  technology: {
    type: String,
    enum: ['LTE', '5G', 'CBRS', 'WiFi', 'other'],
    required: true
  },
  manufacturer: String,
  model: String,
  serialNumber: {
    type: String,
    required: true,
    unique: true
  },
  macAddress: String,
  firmwareVersion: String,
  
  // Location
  location: LocationSchema,
  address: String, // Customer address
  
  // Site Association
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UnifiedTower'
  },
  
  // Customer Information
  subscriberName: String,
  subscriberEmail: String,
  subscriberPhone: String,
  
  // Ownership
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  
  // Integration
  inventoryId: String, // Link to inventory system
  modules: {
    acs: {
      enabled: Boolean,
      deviceId: String,
      lastSync: Date
    },
    hss: {
      enabled: Boolean,
      subscriberId: String,
      lastSync: Date
    }
  },
  
  // Metadata
  createdBy: String,
  createdById: String,
  updatedBy: String,
  updatedById: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Network Equipment Schema
const NetworkEquipmentSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['router', 'switch', 'power-supply', 'ups', 'generator', 'cable', 'connector', 'mounting-hardware', 'other'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'planned', 'retired'],
    default: 'active'
  },
  
  // Technical Properties
  manufacturer: String,
  model: String,
  serialNumber: String,
  partNumber: String,
  
  // Location
  location: LocationSchema,
  
  // Site Association
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UnifiedTower'
  },
  
  // Ownership
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  
  // Integration
  inventoryId: String, // Link to inventory system
  
  // Metadata
  createdBy: String,
  createdById: String,
  updatedBy: String,
  updatedById: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
UnifiedSiteSchema.index({ tenantId: 1, status: 1 });
UnifiedSiteSchema.index({ tenantId: 1, name: 1 });
UnifiedSectorSchema.index({ tenantId: 1, siteId: 1 });
UnifiedSectorSchema.index({ tenantId: 1, status: 1 });
UnifiedCPESchema.index({ tenantId: 1, status: 1 });
UnifiedCPESchema.index({ tenantId: 1, serialNumber: 1 });
NetworkEquipmentSchema.index({ tenantId: 1, type: 1 });
NetworkEquipmentSchema.index({ tenantId: 1, status: 1 });

// Pre-save middleware
UnifiedSiteSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

UnifiedSectorSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

UnifiedCPESchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

NetworkEquipmentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Create models
const UnifiedSite = mongoose.model('UnifiedSite', UnifiedSiteSchema);
const UnifiedSector = mongoose.model('UnifiedSector', UnifiedSectorSchema);
const UnifiedCPE = mongoose.model('UnifiedCPE', UnifiedCPESchema);
const NetworkEquipment = mongoose.model('NetworkEquipment', NetworkEquipmentSchema);

module.exports = {
  UnifiedSite,
  UnifiedSector,
  UnifiedCPE,
  NetworkEquipment
};
