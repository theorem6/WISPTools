# 🏗️ Unified Network Architecture

## Overview

The **Unified Network** approach creates a single source of truth for all network equipment (sites, sectors, CPE) with module-specific extensions.

---

## 🎯 Core Concept

### **Before (Fragmented):**
```
CBRS Module     → cbrs_devices (Firestore)
ACS Module      → cpe_devices (GenieACS/MongoDB)
PCI Module      → networks/cells (Firestore)
Coverage Map    → Separate collections
```
**Problem:** Duplicate data, inconsistent locations, hard to get complete view

### **After (Unified):**
```
Unified Network → MongoDB Atlas
├── UnifiedSites      (Base: location, contacts, tower info)
├── UnifiedSectors    (Base: RF config + module extensions)
└── UnifiedCPE        (Base: equipment + module extensions)

Each module extends with .modules.{moduleName} field:
├── modules.pci       (PCI-specific: pci, cellId, rsPower)
├── modules.cbrs      (CBRS-specific: grants, SAS info)
├── modules.acs       (ACS-specific: TR-069 parameters)
└── modules.hss       (HSS-specific: IMSI links)
```
**Benefit:** Single location = Single truth, all modules share base data

---

## 📊 Unified Schema Structure

### **UnifiedSite** (Towers, Buildings, Warehouses)
```javascript
{
  _id: ObjectId("..."),
  tenantId: "tenant_123",
  
  // Coverage Map fields (base)
  name: "Main Tower Site",
  location: { latitude, longitude, address },
  type: "tower",  // tower, rooftop, monopole, warehouse
  height: 150,  // feet
  fccId: "FCC-12345",
  towerContact: { name, phone, email },
  gateCode: "1234#",
  accessInstructions: "Call before arrival",
  
  // Module extensions
  modules: {
    pci: {
      eNodeB: 12345,
      networkId: "network_abc"
    }
  }
}
```

### **UnifiedSector** (Radio Sectors - LTE/CBRS/5G/WiFi)
```javascript
{
  _id: ObjectId("..."),
  tenantId: "tenant_123",
  siteId: ObjectId("..."),  // Reference to UnifiedSite
  
  // Coverage Map fields (base)
  name: "Alpha Sector",
  location: { latitude, longitude },
  azimuth: 0,
  beamwidth: 65,
  technology: "LTE",
  band: "Band 71 (600MHz)",
  frequency: 617,
  antennaModel: "Commscope SBNHH-1D65C",
  radioModel: "Nokia AEQE",
  status: "active",
  
  // Module extensions
  modules: {
    // PCI Module uses this sector
    pci: {
      pci: 150,  // Physical Cell ID
      cellId: 0,
      rsPower: 43
    },
    
    // CBRS Module uses this sector
    cbrs: {
      cbsdSerialNumber: "SAS-123456",
      fccId: "FCC-789",
      cbsdId: "google-cbsd-123",
      cbsdCategory: "B",
      sasProviderId: "google",
      state: "GRANTED",
      userId: "user@example.com",
      activeGrants: [{
        grantId: "grant-123",
        maxEirp: 30,
        channelType: "GAA"
      }],
      lastHeartbeat: ISODate("...")
    },
    
    // HSS Module can track which EPC this connects to
    hss: {
      connectedEPC: "remote-epc-1",
      attachedSubscribers: 50
    }
  }
}
```

### **UnifiedCPE** (Customer Equipment)
```javascript
{
  _id: ObjectId("..."),
  tenantId: "tenant_123",
  siteId: ObjectId("..."),  // Which tower it connects to
  
  // Coverage Map fields (base)
  name: "Smith Residence FWA",
  location: { latitude, longitude, address: "123 Main St" },
  azimuth: 180,
  beamwidth: 30,
  manufacturer: "Telrad",
  model: "CPE7000",
  serialNumber: "CPE-123456",
  subscriberName: "John Smith",
  subscriberContact: { name, phone, email },
  technology: "FWA",
  status: "online",
  
  // Module extensions
  modules: {
    // ACS/TR-069 Module data
    acs: {
      deviceId: "202BC3-ONTUSER-CPE123456",
      productClass: "CPE7000",
      softwareVersion: "2.1.5",
      lastInform: ISODate("..."),
      parameters: {
        "Device.WiFi.Radio.1.Channel": 6,
        "Device.DeviceInfo.UpTime": 86400,
        // ... full TR-069 parameter tree
      },
      faults: [
        { code: "9001", message: "Connection timeout", timestamp: ISODate("...") }
      ]
    },
    
    // HSS Module data
    hss: {
      imsi: "310410123456789",
      groupId: "residential",
      bandwidthPlanId: "plan-100mbps",
      apnProfile: "internet"
    },
    
    // Monitoring Module data
    monitoring: {
      signalStrength: -65,  // dBm
      sinr: 18,  // dB
      rsrp: -75,
      rsrq: -10,
      throughputDown: 85.5,  // Mbps
      throughputUp: 22.3,
      connectedSectorId: ObjectId("...")  // Which sector it's connected to
    }
  }
}
```

---

## 🔄 How Modules Use Unified Data

### **Coverage Map Module**
- **Reads**: All sites, sectors, CPE (base fields only)
- **Writes**: Base fields (location, contacts, RF config)
- **Displays**: Everything on map with filters
- **Purpose**: Central management and visualization

### **CBRS Module**
- **Reads**: Sectors where `modules.cbrs` exists
- **Writes**: Updates `modules.cbrs` with SAS data
- **Creates**: New sectors with CBRS extension
- **Syncs**: Grant status, heartbeats, SAS state

### **ACS Module**
- **Reads**: CPE where `modules.acs` exists
- **Writes**: Updates `modules.acs` with TR-069 data
- **Creates**: New CPE when GenieACS discovers devices
- **Syncs**: Parameters, faults, last inform time

### **PCI Module**
- **Reads**: Sectors where `modules.pci` exists
- **Writes**: Updates `modules.pci.pci` with optimized values
- **Analyzes**: Conflicts using azimuth, beamwidth from base
- **Uses**: Location from UnifiedSite for distance calculations

### **HSS Module**
- **Reads**: CPE with `modules.hss.imsi` to show subscribers
- **Writes**: Links subscribers to CPE/sectors
- **Tracks**: Which sectors have attached subscribers

---

## 📈 Benefits

### **Single Source of Truth:**
- ✅ One CPE record with all module data
- ✅ No duplicate location data
- ✅ Consistent naming across modules
- ✅ Central inventory management

### **Module Integration:**
- ✅ CBRS can see which tower/sector has CPE
- ✅ ACS can track which sectors CPE connect to
- ✅ Monitoring can show end-to-end path
- ✅ HSS can map subscribers to physical locations

### **Complete View:**
- ✅ Coverage Map shows everything
- ✅ Filter by module (show only CBRS, only ACS, etc.)
- ✅ Export unified reports
- ✅ Track equipment lifecycle

---

## 🗂️ MongoDB Collections

```
MongoDB Atlas Database: hss

Collections:
├── unifiedsites          (Towers, buildings, warehouses)
├── unifiedsectors        (All radio sectors)
├── unifiedcpes           (All customer equipment)
├── networkequipments     (Inventory - routers, switches, etc.)
│
├── subscribers           (HSS module - links to UnifiedCPE via modules.hss.imsi)
├── groups                (HSS module)
├── bandwidth_plans       (HSS module)
└── remote_epcs           (Distributed EPC module)
```

**Note:** Legacy collections (cbrs_devices in Firestore, old cpe_devices) will be migrated to Unified collections.

---

## 🔌 API Endpoints

### **Base URL:** `/api/network`

```
Sites:
GET    /api/network/sites           - All sites
POST   /api/network/sites           - Create site
GET    /api/network/sites/:id       - Get site
PUT    /api/network/sites/:id       - Update site
DELETE /api/network/sites/:id       - Delete site

Sectors:
GET    /api/network/sectors                - All sectors
GET    /api/network/sectors?band=LTE       - Filter by band
GET    /api/network/sectors?technology=CBRS - Filter by tech
GET    /api/network/sites/:siteId/sectors  - Sectors at site
POST   /api/network/sectors                - Create sector
PUT    /api/network/sectors/:id            - Update sector (any module can extend)
DELETE /api/network/sectors/:id            - Delete sector

CPE:
GET    /api/network/cpe                  - All CPE
GET    /api/network/cpe?status=online    - Filter by status
GET    /api/network/cpe?siteId=...       - CPE connected to site
POST   /api/network/cpe                  - Create CPE
PUT    /api/network/cpe/:id              - Update CPE (any module can extend)
DELETE /api/network/cpe/:id              - Delete CPE

Equipment:
GET    /api/network/equipment            - All equipment
POST   /api/network/equipment            - Create equipment
PUT    /api/network/equipment/:id        - Update
DELETE /api/network/equipment/:id        - Delete

Geocoding:
POST   /api/network/geocode              - Address → coordinates
POST   /api/network/reverse-geocode      - Coordinates → address
```

---

## 🔄 Migration Strategy

### **Phase 1: Deploy Unified API** (This commit)
- Add UnifiedSite, UnifiedSector, UnifiedCPE schemas
- Deploy backend API
- Coverage Map uses unified collections

### **Phase 2: Migrate CBRS Module** (Next)
- Update CBRS to read/write UnifiedSector
- Add `modules.cbrs` extension when creating sectors
- Migrate existing cbrs_devices to UnifiedSector

### **Phase 3: Migrate ACS Module** (After)
- Update ACS to read/write UnifiedCPE
- Add `modules.acs` extension when syncing GenieACS
- Migrate existing cpe_devices to UnifiedCPE

### **Phase 4: Migrate PCI Module** (After)
- Update PCI to read/write UnifiedSector
- Add `modules.pci` extension for PCI values
- Use unified locations for conflict analysis

---

## 💡 Example: CBRS Creating a Sector

```javascript
// CBRS Module registers a new CBSD
// Creates a UnifiedSector with CBRS extension

const newSector = {
  // Base fields (Coverage Map can use)
  name: "CBRS Sector Alpha",
  siteId: existingSiteId,
  location: { latitude: 40.7128, longitude: -74.0060 },
  azimuth: 0,
  beamwidth: 90,
  technology: "CBRS",
  band: "CBRS (3.5GHz)",
  frequency: 3550,
  status: "active",
  
  // CBRS-specific extension
  modules: {
    cbrs: {
      cbsdSerialNumber: "SAS-123456",
      fccId: "FCC-789",
      cbsdCategory: "B",
      sasProviderId: "google",
      state: "REGISTERED",
      userId: "user@example.com"
    }
  }
};

await fetch('/api/network/sectors', {
  method: 'POST',
  headers: {
    'X-Tenant-ID': tenantId,
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(newSector)
});

// Now this sector appears in:
// ✅ CBRS Module (filters by modules.cbrs existence)
// ✅ Coverage Map (shows all sectors)
// ✅ PCI Module (can add modules.pci for optimization)
```

---

## ✅ Deployment

### **SSH to Backend:**
```bash
ssh root@136.112.111.167
```

### **Pull and Deploy:**
```bash
cd /root/lte-pci-mapper && git pull && bash backend-deploy-coverage-map.sh
```

---

## 📝 Next Steps

1. **Deploy unified backend** (this commit)
2. **Test Coverage Map** with unified API
3. **Migrate CBRS** to use UnifiedSector
4. **Migrate ACS** to use UnifiedCPE
5. **Update PCI** to use UnifiedSector
6. **Decommission** old fragmented collections

---

**This creates a proper normalized database where all modules share base equipment data!** 🎯

