# 🗺️ Interactive Coverage Map - Deployment Guide

## ✅ What Was Built

### **Interactive Features:**
- ✅ **Add Equipment Dropdown** - Quick access to add sites, sectors, or CPE
- ✅ **Right-Click Context Menu** - Add site/CPE at any map location
- ✅ **Address Search** - Geocode addresses to GPS coordinates
- ✅ **GPS Input** - Direct latitude/longitude entry
- ✅ **Site-Based Sectors** - Link sectors to tower sites
- ✅ **Read-Only Indicators** - ACS/CBRS synced data marked with 🔒

### **Modals Created:**
1. **Add Site Modal**
   - Address search with ArcGIS geocoding
   - Tower professional info (FCC ID, contacts, gate codes)
   - GPS coordinates or address input
   - Site type selection

2. **Add Sector Modal**
   - Site selection dropdown
   - RF configuration (azimuth, beamwidth, tilt)
   - Technology presets (LTE=65°, CBRS=90°, FWA=30°)
   - Band/frequency selection
   - Equipment tracking (antenna/radio models, serial numbers)

3. **Add CPE Modal**
   - Customer location (address search or GPS)
   - Subscriber information
   - 30-degree beamwidth (FWA standard)
   - Pointing direction (azimuth)
   - Equipment details

---

## 🚀 Deployment (2 Steps)

### **Step 1: Deploy Backend** (SSH to 136.112.111.167)

```bash
ssh root@136.112.111.167
```

Then run:
```bash
cd /root/lte-pci-mapper && git pull && systemctl stop hss-api && sleep 2 && bash backend-deploy-coverage-map.sh
```

**What this does:**
- Pulls latest unified network schema
- Deploys `/api/network/*` endpoints
- Restarts backend service

### **Step 2: Frontend Auto-Deploys**
✅ Already pushed to Git - Firebase App Hosting is building now (~10-15 min)

---

## 🎯 How to Use

### **Add Equipment 3 Ways:**

#### **Method 1: Using Dropdown Menu**
1. Click "➕ Add Equipment" button
2. Select: "📡 Add Tower Site", "📶 Add Sector", or "📱 Add CPE"
3. Fill out the modal form
4. Click "Create"

#### **Method 2: Right-Click on Map**
1. Right-click anywhere on the map
2. Context menu appears with GPS coordinates
3. Select "Add Tower Site Here" or "Add CPE Here"
4. Modal opens with coordinates pre-filled
5. Complete the form and save

#### **Method 3: Address Search**
1. Open any Add modal
2. Type customer address: "123 Main St, New York, NY"
3. Click "Search"
4. GPS coordinates auto-fill
5. Complete form and save

### **Add Sectors to Existing Sites:**
1. Add a tower site first
2. Click "Add Equipment" → "Add Sector"
3. Select the site from dropdown
4. Configure RF parameters (azimuth, beamwidth, band)
5. Save

### **Technology Presets:**
- **LTE**: 65° beamwidth, Band 71 (600MHz)
- **CBRS**: 90° beamwidth, 3550 MHz
- **FWA**: 30° beamwidth, 5GHz
- **5G**: 65° beamwidth, n71
- **WiFi**: 360° (omnidirectional), 2.4GHz

---

## 🔒 Read-Only Items

### **Synced from Other Modules:**

Equipment with these extensions is **read-only** in Coverage Map:

- **modules.cbrs** = Managed by CBRS module (sectors with SAS grants)
- **modules.acs** = Managed by ACS module (CPE from GenieACS)
- **modules.pci** = Managed by PCI module (sectors with PCI values)
- **modules.hss** = Managed by HSS module (CPE with IMSI links)

**What this means:**
- ✅ Appears on Coverage Map automatically
- ✅ Can view details in popup
- 🔒 Cannot edit from Coverage Map
- 🔒 Must edit in source module (CBRS/ACS/PCI/HSS)

### **Editable Items:**

Equipment created in Coverage Map (no module extensions):
- ✅ Can edit all fields
- ✅ Can delete
- ✅ Can move location
- ✅ Fully managed by Coverage Map

---

## 🗺️ Unified Data Model

```
UnifiedSite (Tower Locations)
  ↓
UnifiedSector (Radio Sectors)
  ├── Coverage Map: Creates base (location, RF)
  ├── CBRS Module: Adds modules.cbrs (SAS grants)
  ├── PCI Module: Adds modules.pci (PCI values)
  └── All modules share the same sector!

UnifiedCPE (Customer Equipment)
  ├── Coverage Map: Creates base (equipment, subscriber)
  ├── ACS Module: Adds modules.acs (TR-069 data)
  ├── HSS Module: Adds modules.hss (IMSI link)
  └── All modules share the same CPE!
```

**Single source of truth = No duplicate data!**

---

## 📊 Example Workflow

### **Scenario: New CBRS Deployment**

1. **Add Tower Site** (Coverage Map)
   - Right-click on map at site location
   - Enter tower info, FCC ID, gate code
   - Save

2. **Add Sectors** (Coverage Map)
   - Click "Add Equipment" → "Add Sector"
   - Select the tower site
   - Configure 3 sectors (0°, 120°, 240°)
   - Set beamwidth to 90° (CBRS standard)
   - Set frequency to 3550 MHz
   - Save each sector

3. **Register with SAS** (CBRS Module)
   - Go to CBRS module
   - See the 3 sectors appear
   - Register each with Google SAS
   - CBRS module adds `modules.cbrs` extension
   - Grants appear on Coverage Map!

4. **Add CPE** (Coverage Map)
   - Customer calls to order service
   - Right-click on customer address
   - "Add CPE Here"
   - Point azimuth toward tower
   - Set beamwidth to 30°
   - Enter subscriber info
   - Save

5. **Configure TR-069** (ACS Module)
   - Go to ACS module
   - See CPE appear
   - Configure TR-069 parameters
   - ACS module adds `modules.acs` extension
   - Parameters appear on Coverage Map!

**Result:** Complete view from tower → sector → CPE with all module data unified!

---

## 🧪 Test After Deployment

1. **Login** to application
2. **Go to Coverage Map** from dashboard
3. **Right-click** on map - context menu should appear
4. **Add a tower site** using address search
5. **Add a sector** to that site
6. **Verify** it appears on map with directional cone
7. **Check** that clicking shows popup with details
8. **Test** band filtering - hide/show specific bands

---

## 🔧 Backend Deployment Commands

**If backend deployment failed with port error:**

```bash
ssh root@136.112.111.167
```

Then:
```bash
# Kill any zombie processes
kill -9 $(lsof -t -i:3000)

# Pull latest
cd /root/lte-pci-mapper && git pull

# Deploy
bash backend-deploy-coverage-map.sh

# Verify
curl -H "X-Tenant-ID: test" http://localhost:3000/api/network/sites
```

---

## ✅ Complete Feature List

- [x] Add sites via dropdown button
- [x] Add sites via right-click on map  
- [x] Add sites via address search
- [x] Add sites via GPS coordinates
- [x] Add sectors linked to sites
- [x] Add CPE with pointing direction (30° beamwidth)
- [x] Technology presets (auto-fill beamwidth/frequency)
- [x] Geocoding integration (ArcGIS)
- [x] Context menu with coordinates
- [x] Read-only indicators for synced data
- [x] Same visual style as CBRS (cones, markers)
- [x] Site/sector relationships
- [x] Professional tower info fields
- [x] Equipment serial number tracking

---

**Your interactive Coverage Map is ready! Frontend auto-deploys from Git.** 🎉

