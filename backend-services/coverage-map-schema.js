// Coverage Map MongoDB Schemas
const mongoose = require('mongoose');

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

// Tower Site Schema
const TowerSiteSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  location: { type: LocationSchema, required: true },
  type: { 
    type: String, 
    enum: ['tower', 'rooftop', 'monopole', 'warehouse', 'other'],
    default: 'tower'
  },
  height: Number, // feet
  
  // Professional Info
  fccId: String,
  towerOwner: String,
  towerContact: ContactInfoSchema,
  siteContact: ContactInfoSchema,
  gateCode: String,
  accessInstructions: String,
  safetyNotes: String,
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add compound index for tenant + location queries
TowerSiteSchema.index({ tenantId: 1, 'location.latitude': 1, 'location.longitude': 1 });

// Sector Schema
const SectorSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'TowerSite' },
  name: { type: String, required: true },
  location: { type: LocationSchema, required: true },
  
  // RF Configuration
  azimuth: { type: Number, required: true, min: 0, max: 360 },
  beamwidth: { type: Number, required: true, min: 0, max: 360 },
  tilt: Number, // mechanical tilt
  
  // Technology
  technology: { 
    type: String, 
    enum: ['LTE', 'CBRS', 'FWA', '5G', 'WiFi'],
    required: true
  },
  band: String, // "Band 71 (600MHz)", "CBRS (3.5GHz)"
  frequency: Number, // MHz
  bandwidth: Number, // MHz
  
  // Equipment
  antennaModel: String,
  antennaManufacturer: String,
  antennaSerialNumber: String,
  radioModel: String,
  radioManufacturer: String,
  radioSerialNumber: String,
  
  // Status
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'maintenance', 'planned'],
    default: 'active'
  },
  installDate: Date,
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add compound indexes
SectorSchema.index({ tenantId: 1, siteId: 1 });
SectorSchema.index({ tenantId: 1, band: 1 });
SectorSchema.index({ tenantId: 1, technology: 1 });

// CPE Device Schema
const CPEDeviceSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'TowerSite' },
  name: { type: String, required: true },
  location: { type: LocationSchema, required: true },
  
  // Installation
  azimuth: { type: Number, required: true, min: 0, max: 360 },
  beamwidth: { type: Number, default: 30 }, // Typically 30° for FWA CPE
  heightAGL: Number, // feet above ground
  
  // Equipment Info
  manufacturer: { type: String, required: true },
  model: { type: String, required: true },
  serialNumber: { type: String, required: true },
  macAddress: String,
  
  // Subscriber Info
  subscriberName: String,
  subscriberContact: ContactInfoSchema,
  accountNumber: String,
  
  // Service Info
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
  
  // Status
  status: { 
    type: String, 
    enum: ['online', 'offline', 'maintenance', 'inventory'],
    default: 'offline'
  },
  installDate: Date,
  lastOnline: Date,
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add compound indexes
CPEDeviceSchema.index({ tenantId: 1, serialNumber: 1 }, { unique: true });
CPEDeviceSchema.index({ tenantId: 1, status: 1 });
CPEDeviceSchema.index({ tenantId: 1, subscriberName: 1 });

// Network Equipment Schema
const NetworkEquipmentSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'TowerSite' },
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

// Add compound indexes
NetworkEquipmentSchema.index({ tenantId: 1, serialNumber: 1 }, { unique: true });
NetworkEquipmentSchema.index({ tenantId: 1, locationType: 1 });
NetworkEquipmentSchema.index({ tenantId: 1, status: 1 });

// Create Models
const TowerSite = mongoose.model('TowerSite', TowerSiteSchema);
const Sector = mongoose.model('Sector', SectorSchema);
const CPEDevice = mongoose.model('CPEDevice', CPEDeviceSchema);
const NetworkEquipment = mongoose.model('NetworkEquipment', NetworkEquipmentSchema);

module.exports = {
  TowerSite,
  Sector,
  CPEDevice,
  NetworkEquipment
};

