# 🗺️ Coverage Map Module

## Overview

The **Coverage Map** is a comprehensive network asset management and visualization system that consolidates all network equipment (towers, sectors, CPE devices, and inventory) into a single interactive ArcGIS-powered map interface.

This module serves as the **central hub** for viewing and managing your entire network infrastructure across all modules (CBRS, ACS, PCI Resolution, etc.).

---

## ✨ Key Features

### 1. **Unified Asset Visualization**
- 📡 **Tower Sites**: Cell towers, rooftops, monopoles, warehouses
- 📶 **Sectors**: LTE/CBRS/FWA/5G sectors with directional cones
- 📱 **CPE Devices**: Customer premises equipment with 30° beamwidth visualization
- 🔧 **Equipment**: Network equipment inventory (routers, switches, antennas, etc.)

### 2. **Professional Tower Site Management**
- **FCC Registration ID** tracking
- **Tower Owner** contact information
- **Site Contact** details (on-site manager, phone, email)
- **Gate Codes** and access instructions
- **Safety Notes** and onsite procedures
- **Tower Height** and type classification

### 3. **Sector RF Configuration**
- **Azimuth**: Directional pointing (0-360°)
- **Beamwidth**: Antenna coverage angle (typically 65-90° for sectors, 30° for CPE)
- **Mechanical Tilt**: Downtilt angle
- **Band/Frequency**: LTE Band 71, CBRS 3.5GHz, 5GHz WiFi, etc.
- **Technology Type**: LTE, CBRS, FWA, 5G, WiFi
- **Equipment Tracking**: Antenna and radio models with serial numbers

### 4. **CPE Device Management**
- **Subscriber Information**: Name, contact, account number
- **Equipment Details**: Manufacturer, model, serial number, MAC address
- **Directional Antenna**: 30-degree beamwidth pointing visualization
- **Service Type**: Residential, business, or temporary
- **Status Tracking**: Online, offline, maintenance, inventory
- **Location**: GPS coordinates or geocoded address

### 5. **Equipment Inventory System**
- **Location Tracking**: Tower, warehouse, vehicle, customer-site
- **Serial Number** and part number tracking
- **Manufacturer** and model information
- **Status Management**: Deployed, inventory, RMA, retired, lost
- **Quantity Tracking**: For warehouse stock items
- **Purchase Date** and warranty expiration
- **Installation Details**: Installer, install date, notes

### 6. **Advanced Filtering**
- **Asset Type Filters**: Show/hide towers, sectors, CPE, equipment
- **Band Filtering**: Display only specific LTE bands or frequencies
- **Technology Filtering**: Filter by LTE, CBRS, FWA, 5G, WiFi
- **Status Filtering**: Active, inactive, maintenance
- **Location Type**: Tower-mounted, warehouse, field inventory

### 7. **Geocoding & Location**
- **Address Search**: Convert addresses to GPS coordinates
- **Reverse Geocoding**: Get address from map coordinates
- **Right-Click Add**: Add equipment by clicking map location
- **GPS Coordinate Input**: Direct latitude/longitude entry

### 8. **Basemap Options**
- 🛣️ **Streets View**: Detailed street maps
- 🛰️ **Satellite View**: High-resolution imagery
- 🗺️ **Topographic View**: Terrain and elevation data

### 9. **Equipment Reports**
- **CSV Export**: Complete equipment inventory spreadsheet
- **PDF Reports**: Professional formatted reports with statistics
- **Asset Summaries**: Tower, sector, CPE, and equipment counts
- **Contact Lists**: All site contacts and tower information

---

## 🎯 Use Cases

### Network Planning
- Visualize entire network infrastructure on one map
- Identify coverage gaps and overlapping sectors
- Plan new tower sites and sector deployments
- Analyze sector azimuths and interference patterns

### Field Operations
- Gate codes and access instructions for tower climbers
- Contact information for site managers and tower owners
- Equipment serial numbers for RMA and warranty tracking
- Warehouse inventory management

### Compliance & Documentation
- FCC registration tracking for all tower sites
- Professional documentation for regulatory audits
- Complete equipment inventory with serial numbers
- Maintenance and installation history

### Subscriber Management
- CPE device locations and pointing directions
- Subscriber contact information
- Service type and technology classification
- Online/offline status monitoring

---

## 📊 Data Models

### Tower Site
```typescript
{
  id: string
  name: string
  location: { latitude, longitude, address }
  type: 'tower' | 'rooftop' | 'monopole' | 'warehouse'
  height: number  // feet
  
  // Professional Info
  fccId: string
  towerOwner: string
  towerContact: { name, phone, email, role }
  siteContact: { name, phone, email, role }
  gateCode: string
  accessInstructions: string
  safetyNotes: string
}
```

### Sector
```typescript
{
  id: string
  siteId: string
  name: string
  location: { latitude, longitude, address }
  
  // RF Configuration
  azimuth: number  // 0-360 degrees
  beamwidth: number  // typically 65-90°
  tilt: number  // mechanical tilt
  
  // Technology
  technology: 'LTE' | 'CBRS' | 'FWA' | '5G' | 'WiFi'
  band: string  // "Band 71 (600MHz)", "CBRS (3.5GHz)"
  frequency: number  // MHz
  bandwidth: number  // MHz
  
  // Equipment
  antennaModel: string
  antennaManufacturer: string
  antennaSerialNumber: string
  radioModel: string
  radioSerialNumber: string
  
  status: 'active' | 'inactive' | 'maintenance' | 'planned'
}
```

### CPE Device
```typescript
{
  id: string
  name: string
  location: { latitude, longitude, address }
  
  azimuth: number  // pointing direction
  beamwidth: number  // 30° for FWA CPE
  heightAGL: number  // feet above ground
  
  // Equipment
  manufacturer: string
  model: string
  serialNumber: string
  macAddress: string
  
  // Subscriber
  subscriberName: string
  subscriberContact: { name, phone, email }
  accountNumber: string
  
  serviceType: 'residential' | 'business' | 'temporary'
  technology: 'LTE' | 'CBRS' | 'FWA'
  status: 'online' | 'offline' | 'maintenance' | 'inventory'
}
```

### Network Equipment
```typescript
{
  id: string
  name: string
  location: { latitude, longitude, address }
  locationType: 'tower' | 'warehouse' | 'vehicle' | 'customer-site'
  
  type: 'router' | 'switch' | 'antenna' | 'radio' | 'cpe' | 'battery'
  manufacturer: string
  model: string
  serialNumber: string
  partNumber: string
  
  status: 'deployed' | 'inventory' | 'rma' | 'retired'
  quantity: number  // for inventory items
  purchaseDate: Date
  warrantyExpires: Date
}
```

---

## 🚀 Getting Started

### Initial Setup

1. **Add Tower Sites**
   - Click "Add Tower" or right-click on map
   - Enter tower details, FCC ID, contacts
   - Set gate codes and access procedures

2. **Add Sectors**
   - Associate with tower site
   - Configure azimuth and beamwidth
   - Set band/frequency and technology type
   - Record antenna and radio serial numbers

3. **Import from Other Modules**
   - Import CBRS devices as sectors
   - Import ACS CPE devices
   - Automatically geocode existing equipment

4. **Add Equipment Inventory**
   - Record warehouse stock with serial numbers
   - Track deployed equipment on towers
   - Manage RMA and warranty information

---

## 🔧 Integration with Other Modules

### CBRS Management
- Import CBRS devices as sectors
- Sync CBSD locations and parameters
- Track SAS grant status

### ACS CPE Management
- Import TR-069 CPE devices
- Sync device status (online/offline)
- Display GenieACS location data

### PCI Resolution
- Import cell site data for PCI planning
- Visualize sector azimuths and beamwidths
- Export for conflict analysis

---

## 📈 Reporting

### CSV Export
- Complete equipment inventory
- Tower sites with contact information
- Sector configurations with RF parameters
- CPE devices with subscriber details
- Equipment with serial numbers

### PDF Reports
- Professional formatted documents
- Summary statistics
- Asset tables organized by type
- Ready for printing or sharing

---

## 🎨 Color Coding

### Tower Types
- 🔵 **Tower**: Blue
- 🟣 **Rooftop**: Purple
- 🔷 **Monopole**: Cyan
- 🟠 **Warehouse**: Orange

### Technologies
- 🔴 **LTE**: Red
- 🔵 **CBRS**: Blue
- 🟢 **FWA**: Green
- 🟣 **5G**: Purple
- 🟠 **WiFi**: Orange

### Status
- 🟢 **Active/Online**: Green
- 🔴 **Inactive/Offline**: Red
- 🟠 **Maintenance**: Orange

---

## 💡 Best Practices

### Tower Site Documentation
1. Always record FCC ID for licensed sites
2. Update gate codes immediately when changed
3. Include emergency contact information
4. Document site-specific safety procedures

### Equipment Tracking
1. Record serial numbers for all equipment
2. Track warranty expiration dates
3. Update status when equipment moves locations
4. Use consistent naming conventions

### Sector Configuration
1. Verify azimuth with compass or GPS
2. Document mechanical and electrical tilt
3. Record exact frequency and bandwidth
4. Update status during maintenance windows

### CPE Management
1. Always geocode customer locations
2. Record accurate pointing direction
3. Link to subscriber account systems
4. Track online/offline status

---

## 🔒 Security & Multi-Tenancy

- All data is isolated per tenant
- Admin users can view all tenants
- Firestore security rules enforce access control
- Equipment serial numbers protected per organization

---

## 🛠️ Technical Stack

- **Mapping**: ArcGIS Maps SDK for JavaScript
- **Database**: Firebase Firestore (multi-tenant)
- **Geocoding**: ArcGIS World Geocoding Service
- **Framework**: SvelteKit with TypeScript
- **Styling**: CSS Variables with dark mode support

---

## 📞 Support

For questions or issues with the Coverage Map module, refer to:
- ArcGIS API Documentation: https://developers.arcgis.com/
- Module documentation: `docs/guides/`
- Support: Contact system administrator

---

*Last Updated: October 18, 2025*

