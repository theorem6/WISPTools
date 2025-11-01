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
    enum: ['tower', 'noc', 'warehouse', 'building', 'pole', 'internet-access', 'internet', 'other'],
    default: 'tower'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'planned'],
    default: 'active'
  },
  
  // Location
  location: LocationSchema,
  
  // Contact Information - Multiple contact types for different site types
  contact: {
    name: String,
    email: String,
    phone: String
  },
  // Tower-specific contact (for tower owner/manager)
  towerContact: {
    name: String,
    email: String,
    phone: String,
    company: String
  },
  // Building-specific contact (for building owner/manager)
  buildingContact: {
    name: String,
    email: String,
    phone: String,
    company: String,
    buildingManager: String
  },
  // On-site contact (site manager/maintenance)
  siteContact: {
    name: String,
    email: String,
    phone: String,
    role: String  // e.g., "Site Manager", "Maintenance", "Technician"
  },
  // Access Information
  accessInstructions: String,  // Instructions for accessing the site
  gateCode: String,  // Gate/entry code
  safetyNotes: String,  // Safety warnings/requirements
  accessHours: String,  // When site is accessible
  
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
    enum: ['router', 'switch', 'power-supply', 'ups', 'generator', 'cable', 'connector', 'mounting-hardware', 'backhaul', 'antenna', 'radio', 'other'],
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
  
  // Additional configuration/notes (stores JSON for complex equipment like backhaul)
  notes: String,  // JSON string for complex configurations (backhaul licensing, fiber details, etc.)
  
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

// Hardware Deployment Schema - tracks hardware deployed at sites
const HardwareDeploymentSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  hardware_type: {
    type: String,
    enum: ['tower', 'sector', 'backhaul', 'router', 'epc', 'switch', 'power', 'other'],
    required: true
  },
  status: {
    type: String,
    enum: ['deployed', 'planned', 'maintenance', 'removed'],
    default: 'deployed'
  },
  
  // Site Association
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UnifiedSite',
    required: true,
    index: true
  },
  
  // Inventory Link (optional - for purchased hardware)
  inventory_item_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem'
  },
  
  // Hardware Configuration (type-specific)
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // EPC-specific fields (when hardware_type is 'epc')
  epc_config: {
    mcc: String,
    mnc: String,
    tac: String,
    hss_config: {
      host: String,
      port: Number,
      auth_code: String,
      api_key: String,
      secret_key: String
    }
  },
  
  // Ownership
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  
  // Metadata
  deployedAt: {
    type: Date,
    default: Date.now
  },
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
HardwareDeploymentSchema.index({ tenantId: 1, siteId: 1 });
HardwareDeploymentSchema.index({ tenantId: 1, hardware_type: 1 });
HardwareDeploymentSchema.index({ tenantId: 1, status: 1 });

HardwareDeploymentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Create models
const UnifiedSite = mongoose.model('UnifiedSite', UnifiedSiteSchema);
const UnifiedSector = mongoose.model('UnifiedSector', UnifiedSectorSchema);
const UnifiedCPE = mongoose.model('UnifiedCPE', UnifiedCPESchema);
const NetworkEquipment = mongoose.model('NetworkEquipment', NetworkEquipmentSchema);
const HardwareDeployment = mongoose.model('HardwareDeployment', HardwareDeploymentSchema);

module.exports = {
  UnifiedSite,
  UnifiedSector,
  UnifiedCPE,
  NetworkEquipment,
  HardwareDeployment
};
