// Unified Network Equipment Schema
// Single source of truth for all sites, sectors, and CPE
// Other modules extend this base schema with their specific data

const mongoose = require('mongoose');

// ============================================================================
// SHARED SCHEMAS (used across all modules)
// ============================================================================

// Location Schema (embedded)
const LocationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  address: String,
  city: String,
  state: String,
  zipCode: String
}, { _id: false });

// Contact Info Schema (embedded)
const ContactInfoSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  role: String
}, { _id: false });

// ============================================================================
// UNIFIED SITE SCHEMA (Base for all tower locations)
// ============================================================================

const UnifiedSiteSchema = new mongoose.Schema({
  // Core Fields (Coverage Map)
  tenantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  location: { type: LocationSchema, required: true },
  type: { 
    type: String, 
    enum: ['tower', 'rooftop', 'monopole', 'warehouse', 'noc', 'other'],
    default: 'tower'
  },
  height: Number, // feet
  
  // Professional Info (Coverage Map)
  fccId: String,
  towerOwner: String,
  towerContact: ContactInfoSchema,
  siteContact: ContactInfoSchema,
  gateCode: String,
  accessInstructions: String,
  safetyNotes: String,
  
  // Module Extensions
  modules: {
    // PCI Module data
    pci: {
      eNodeB: Number,
      networkId: String
    },
    
    // Future: Add other module-specific data as needed
    // monitoring: { ... },
    // capacity: { ... }
  },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: String,
  updatedBy: String
});

UnifiedSiteSchema.index({ tenantId: 1, name: 1 });
UnifiedSiteSchema.index({ tenantId: 1, 'location.latitude': 1, 'location.longitude': 1 });

// ============================================================================
// UNIFIED SECTOR SCHEMA (Base for all radio sectors)
// ============================================================================

const UnifiedSectorSchema = new mongoose.Schema({
  // Core Fields (Coverage Map)
  tenantId: { type: String, required: true, index: true },
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'UnifiedSite' },
  name: { type: String, required: true },
  location: { type: LocationSchema, required: true },
  
  // RF Configuration (Coverage Map)
  azimuth: { type: Number, required: true, min: 0, max: 360 },
  beamwidth: { type: Number, required: true, min: 0, max: 360 },
  tilt: Number, // mechanical tilt
  
  // Technology (Coverage Map)
  technology: { 
    type: String, 
    enum: ['LTE', 'CBRS', 'FWA', '5G', 'WiFi'],
    required: true
  },
  band: String, // "Band 71 (600MHz)", "CBRS (3.5GHz)"
  frequency: Number, // MHz
  bandwidth: Number, // MHz
  
  // Equipment (Coverage Map)
  antennaModel: String,
  antennaManufacturer: String,
  antennaSerialNumber: String,
  radioModel: String,
  radioManufacturer: String,
  radioSerialNumber: String,
  
  // Status (Coverage Map)
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'maintenance', 'planned'],
    default: 'active'
  },
  installDate: Date,
  
  // Module Extensions
  modules: {
    // PCI Module data
    pci: {
      pci: Number, // Physical Cell ID (0-503)
      cellId: Number,
      rsPower: Number
    },
    
    // CBRS Module data
    cbrs: {
      cbsdSerialNumber: String,
      fccId: String,
      cbsdId: String, // Assigned by SAS
      cbsdCategory: { type: String, enum: ['A', 'B'] },
      sasProviderId: { type: String, enum: ['google', 'federated-wireless'] },
      state: String, // CBRS state (REGISTERED, GRANTED, etc.)
      userId: String, // Google SAS User ID
      callSign: String,
      activeGrants: [{
        grantId: String,
        grantExpireTime: Date,
        channelType: String,
        maxEirp: Number,
        operationFrequencyRange: {
          lowFrequency: Number,
          highFrequency: Number
        }
      }],
      lastHeartbeat: Date
    },
    
    // HSS Module data (for sectors connected to EPC)
    hss: {
      connectedEPC: String,
      attachedSubscribers: Number
    }
  },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: String,
  updatedBy: String
});

UnifiedSectorSchema.index({ tenantId: 1, siteId: 1 });
UnifiedSectorSchema.index({ tenantId: 1, band: 1 });
UnifiedSectorSchema.index({ tenantId: 1, technology: 1 });
UnifiedSectorSchema.index({ tenantId: 1, 'modules.pci.pci': 1 });
UnifiedSectorSchema.index({ tenantId: 1, 'modules.cbrs.cbsdId': 1 });

// ============================================================================
// UNIFIED CPE SCHEMA (Base for all customer equipment)
// ============================================================================

const UnifiedCPESchema = new mongoose.Schema({
  // Core Fields (Coverage Map)
  tenantId: { type: String, required: true, index: true },
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'UnifiedSite' }, // Optional - which tower it connects to
  name: { type: String, required: true },
  location: { type: LocationSchema, required: true },
  
  // Installation (Coverage Map)
  azimuth: { type: Number, required: true, min: 0, max: 360 },
  beamwidth: { type: Number, default: 30 }, // Typically 30° for FWA CPE
  heightAGL: Number, // feet above ground
  
  // Equipment Info (Coverage Map)
  manufacturer: { type: String, required: true },
  model: { type: String, required: true },
  serialNumber: { type: String, required: true },
  macAddress: String,
  
  // Subscriber Info (Coverage Map)
  subscriberName: String,
  subscriberContact: ContactInfoSchema,
  accountNumber: String,
  
  // Service Info (Coverage Map)
  serviceType: { 
    type: String, 
    enum: ['residential', 'business', 'temporary'],
    default: 'residential'
  },
  technology: { 
    type: String, 
    enum: ['LTE', 'CBRS', 'FWA', '5G', 'WiFi'],
    required: true
  },
  band: String,
  
  // Status (Coverage Map)
  status: { 
    type: String, 
    enum: ['online', 'offline', 'maintenance', 'inventory'],
    default: 'offline'
  },
  installDate: Date,
  lastOnline: Date,
  
  // Module Extensions
  modules: {
    // ACS/TR-069 Module data
    acs: {
      deviceId: String, // GenieACS device ID
      productClass: String,
      oui: String,
      hardwareVersion: String,
      softwareVersion: String,
      connectionRequestURL: String,
      lastInform: Date,
      parameters: mongoose.Schema.Types.Mixed, // Full TR-069 parameter tree
      tags: [String],
      faults: [{
        code: String,
        message: String,
        timestamp: Date
      }]
    },
    
    // HSS Module data (for LTE/CBRS CPE)
    hss: {
      imsi: String, // Linked IMSI
      groupId: String,
      bandwidthPlanId: String,
      apnProfile: String
    },
    
    // Performance/Monitoring data
    monitoring: {
      signalStrength: Number,
      sinr: Number,
      rsrp: Number,
      rsrq: Number,
      throughputDown: Number,
      throughputUp: Number,
      connectedSectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'UnifiedSector' }
    }
  },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: String,
  updatedBy: String
});

UnifiedCPESchema.index({ tenantId: 1, serialNumber: 1 }, { unique: true });
UnifiedCPESchema.index({ tenantId: 1, status: 1 });
UnifiedCPESchema.index({ tenantId: 1, subscriberName: 1 });
UnifiedCPESchema.index({ tenantId: 1, 'modules.acs.deviceId': 1 });
UnifiedCPESchema.index({ tenantId: 1, 'modules.hss.imsi': 1 });

// ============================================================================
// NETWORK EQUIPMENT SCHEMA (Inventory management)
// ============================================================================

const NetworkEquipmentSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'UnifiedSite' },
  name: { type: String, required: true },
  
  // Location
  location: { type: LocationSchema, required: true },
  locationType: { 
    type: String, 
    enum: ['tower', 'rooftop', 'warehouse', 'vehicle', 'customer-site', 'other'],
    required: true
  },
  
  // Equipment Details
  type: { 
    type: String, 
    enum: ['router', 'switch', 'antenna', 'radio', 'cpe', 'power', 'battery', 'cable', 'other'],
    required: true
  },
  manufacturer: { type: String, required: true },
  model: { type: String, required: true },
  serialNumber: { type: String, required: true },
  partNumber: String,
  
  // Inventory
  status: { 
    type: String, 
    enum: ['deployed', 'inventory', 'rma', 'retired', 'lost'],
    default: 'inventory'
  },
  quantity: { type: Number, default: 1 },
  purchaseDate: Date,
  warrantyExpires: Date,
  
  // Deployment Info
  installedBy: String,
  installDate: Date,
  notes: String,
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

NetworkEquipmentSchema.index({ tenantId: 1, serialNumber: 1 }, { unique: true });
NetworkEquipmentSchema.index({ tenantId: 1, locationType: 1 });
NetworkEquipmentSchema.index({ tenantId: 1, status: 1 });

// ============================================================================
// CREATE MODELS
// ============================================================================

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

