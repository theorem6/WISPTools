// Coverage Map Data Models

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface ContactInfo {
  name: string;
  phone: string;
  email?: string;
  role?: string; // Site manager, tower crew, etc.
}

export interface TowerSite {
  id: string;
  name: string;
  location: Location;
  type: 'tower' | 'rooftop' | 'monopole' | 'warehouse' | 'other';
  height?: number; // feet
  
  // Professional Info
  fccId?: string;
  towerOwner?: string;
  towerContact?: ContactInfo;
  siteContact?: ContactInfo;
  gateCode?: string;
  accessInstructions?: string;
  safetyNotes?: string;
  
  // Administrative
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Sector {
  id: string;
  siteId: string;
  name: string;
  location: Location;
  
  // RF Configuration
  azimuth: number; // degrees (0-360)
  beamwidth: number; // degrees (typically 65-90 for cell, 30 for CPE)
  tilt?: number; // mechanical tilt in degrees
  
  // Technology
  technology: 'LTE' | 'CBRS' | 'FWA' | '5G' | 'WiFi';
  band?: string; // "Band 71 (600MHz)", "CBRS (3.5GHz)", "5GHz", etc.
  frequency?: number; // MHz
  bandwidth?: number; // MHz
  
  // Equipment
  antennaModel?: string;
  antennaManufacturer?: string;
  antennaSerialNumber?: string;
  
  radioModel?: string;
  radioManufacturer?: string;
  radioSerialNumber?: string;
  
  // Status
  status: 'active' | 'inactive' | 'maintenance' | 'planned';
  installDate?: Date;
  
  // Administrative
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CPEDevice {
  id: string;
  siteId?: string; // Associated site if applicable
  name: string;
  location: Location;
  
  // Installation
  azimuth: number; // Pointing direction
  beamwidth: number; // Typically 30 degrees for FWA CPE
  heightAGL?: number; // feet above ground
  
  // Equipment Info
  manufacturer: string;
  model: string;
  serialNumber: string;
  macAddress?: string;
  
  // Subscriber Info
  subscriberName?: string;
  subscriberContact?: ContactInfo;
  accountNumber?: string;
  
  // Service Info
  serviceType: 'residential' | 'business' | 'temporary';
  technology: 'LTE' | 'CBRS' | 'FWA' | '5G' | 'WiFi';
  band?: string;
  
  // Status
  status: 'online' | 'offline' | 'maintenance' | 'inventory';
  installDate?: Date;
  lastOnline?: Date;
  
  // Administrative
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BackhaulLink {
  id: string;
  siteId: string; // Associated tower site
  name: string;
  
  // Backhaul Type
  backhaulType: 'fiber' | 'fixed-wireless-licensed' | 'fixed-wireless-unlicensed';
  
  // For Fixed Wireless
  azimuth?: number; // Pointing direction for wireless
  beamwidth?: number; // Antenna beamwidth
  frequency?: number; // MHz
  bandwidth?: number; // MHz
  licensing?: {
    licenseType?: string; // FCC license type
    licenseNumber?: string;
    expirationDate?: Date;
  };
  
  // For Fiber
  fiberDetails?: {
    provider?: string;
    circuitId?: string;
    handoffType?: string; // single-mode, multi-mode
    connectorType?: string; // LC, SC, etc.
  };
  
  // Common Fields
  capacity?: number; // Mbps
  upstreamSite?: string; // Where it connects to
  location?: Location; // For wireless: remote end location
  
  // Equipment
  equipmentModel?: string;
  equipmentSerialNumber?: string;
  
  // Status
  status: 'active' | 'inactive' | 'maintenance' | 'planned';
  installDate?: Date;
  
  // Administrative
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NetworkEquipment {
  id: string;
  siteId?: string; // Optional site association
  name: string;
  
  // Location
  location: Location;
  locationType: 'tower' | 'rooftop' | 'warehouse' | 'vehicle' | 'customer-site' | 'other';
  
  // Equipment Details
  type: 'router' | 'switch' | 'antenna' | 'radio' | 'cpe' | 'power' | 'battery' | 'cable' | 'backhaul' | 'other';
  manufacturer: string;
  model: string;
  serialNumber: string;
  partNumber?: string;
  
  // Inventory
  status: 'deployed' | 'inventory' | 'rma' | 'retired' | 'lost';
  quantity?: number; // For inventory items
  purchaseDate?: Date;
  warrantyExpires?: Date;
  
  // Deployment Info
  installedBy?: string;
  installDate?: Date;
  notes?: string;
  
  // Administrative
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BandFilter {
  enabled: boolean;
  band: string;
  frequency?: number;
  color?: string;
}

export type MapAssetType = 'tower' | 'sector' | 'cpe' | 'equipment';

export interface MapAsset {
  id: string;
  type: MapAssetType;
  data: TowerSite | Sector | CPEDevice | NetworkEquipment;
}

export interface CoverageMapFilters {
  showTowers: boolean;
  showSectors: boolean;
  showCPE: boolean;
  showEquipment: boolean;
  
  // Band filtering
  bandFilters: BandFilter[];
  
  // Status filtering
  statusFilter: string[]; // 'active', 'inactive', etc.
  
  // Technology filtering
  technologyFilter: string[]; // 'LTE', 'CBRS', 'FWA', etc.
  
  // Location filtering
  locationTypeFilter: string[]; // 'tower', 'warehouse', etc.
}

