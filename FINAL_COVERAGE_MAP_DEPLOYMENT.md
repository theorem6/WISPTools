# 🗺️ Coverage Map - Final Deployment Guide (MongoDB)

## ✅ **You Were Right - MongoDB is Better!**

Your backend data is already in **MongoDB Atlas**, so keeping Coverage Map data there makes perfect architectural sense.

---

## 📊 **Complete Architecture**

```
┌─────────────────────────────────────────────────────────┐
│              GitHub Repository (main)                     │
│          All code changes committed here                  │
└──────────────────┬────────────────────────────────────────┘
                   │ Git Push
                   ↓
┌─────────────────────────────────────────────────────────┐
│          Firebase App Hosting (Frontend)                  │
│  • Auto-builds on Git push                               │
│  • Deploys SvelteKit app                                 │
│  • Coverage Map UI                                       │
└──────────────────┬────────────────────────────────────────┘
                   │ API Calls (HTTP)
                   ↓
┌─────────────────────────────────────────────────────────┐
│      GCE VM Backend (136.112.111.167:3000)               │
│  • Express API Server                                    │
│  • Routes:                                               │
│    - /api/coverage-map/* (NEW)                          │
│    - /api/epc/*                                          │
│    - /api/monitoring/*                                   │
│    - /hss/* (HSS Management)                            │
└──────────────────┬────────────────────────────────────────┘
                   │ MongoDB Connection
                   ↓
┌─────────────────────────────────────────────────────────┐
│               MongoDB Atlas (Cloud Database)             │
│  Collections:                                            │
│  • TowerSites                                           │
│  • Sectors                                               │
│  • CPEDevices                                            │
│  • NetworkEquipment                                      │
│  • subscribers (HSS)                                     │
│  • cbsd_devices (CBRS)                                   │
│  • cpe_devices (GenieACS)                               │
│  • remote_epcs (Distributed EPC)                        │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 **Two-Step Deployment**

### **Step 1: Deploy Backend API** ⚠️ Manual (One-time)

Run this deployment script:

```bash
bash deploy-coverage-map-backend.sh
```

**What it does:**
1. Uploads MongoDB schema and API routes to GCE VM
2. Updates `server.js` to register Coverage Map endpoints
3. Restarts the `hss-api` service
4. Tests the new endpoints

**Expected output:**
```
═══════════════════════════════════════════════════════════
  🗺️  Deploying Coverage Map Backend API
═══════════════════════════════════════════════════════════

📦 Step 1: Preparing files...
   • coverage-map-schema.js
   • coverage-map-api.js

📤 Step 2: Uploading files to backend server...
   ✅ Files uploaded

🔧 Step 3: Updating backend server...
   📝 Adding Coverage Map routes to server.js...
   ✅ Routes added to server.js
   • Restarting HSS API service...
   ✅ Service running
   ✅ Backend responding

🧪 Step 4: Testing Coverage Map API...
   ✅ Coverage Map API responding (HTTP 200)

═══════════════════════════════════════════════════════════
  ✅ Coverage Map Backend Deployment Complete!
═══════════════════════════════════════════════════════════
```

### **Step 2: Deploy Frontend** ✅ Automatic

**Already done!** Your Git push triggers Firebase App Hosting to rebuild automatically.

```bash
# The code is already pushed:
git push origin main  # ✅ Done

# Firebase App Hosting:
# • Detects the push
# • Builds with MongoDB service
# • Deploys to production
# • Takes ~10-15 minutes
```

---

## 🎯 **What Was Created**

### **Backend Files** (MongoDB)
```
backend-services/
├── coverage-map-schema.js    # Mongoose schemas (400+ lines)
└── coverage-map-api.js        # Express routes (600+ lines)
```

**Features:**
- ✅ Multi-tenant with `X-Tenant-ID` header
- ✅ Full CRUD for towers, sectors, CPE, equipment
- ✅ Geocoding integration (ArcGIS)
- ✅ Query filtering (band, technology, status)
- ✅ Geospatial indexes for location queries
- ✅ Unique constraints on serial numbers per tenant

### **Frontend Files** (MongoDB Client)
```
Module_Manager/src/routes/modules/coverage-map/lib/
└── coverageMapService.mongodb.ts  # Backend API client (300+ lines)
```

**Features:**
- ✅ Firebase Auth token authentication
- ✅ Automatic tenant ID from localStorage
- ✅ Clean async/await API
- ✅ MongoDB `_id` → `id` mapping
- ✅ Error handling

### **Deployment Script**
```
deploy-coverage-map-backend.sh  # Bash deployment automation
```

**Features:**
- ✅ Uploads files to GCE VM via SCP
- ✅ Updates `server.js` automatically
- ✅ Restarts service
- ✅ Tests endpoints

---

## 📋 **MongoDB Collections**

### **Tower Sites**
```javascript
{
  _id: ObjectId("..."),
  tenantId: "tenant_123",
  name: "Main Tower Site",
  location: {
    latitude: 40.7128,
    longitude: -74.0060,
    address: "123 Tower Rd, New York, NY 10001"
  },
  type: "tower",  // tower, rooftop, monopole, warehouse
  height: 150,  // feet
  fccId: "FCC-12345",
  towerOwner: "Tower Company LLC",
  towerContact: {
    name: "John Smith",
    phone: "555-1234",
    email: "john@tower.com",
    role: "Site Manager"
  },
  gateCode: "1234#",
  accessInstructions: "Call 30 min before arrival",
  safetyNotes: "High voltage equipment on site",
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### **Sectors**
```javascript
{
  _id: ObjectId("..."),
  tenantId: "tenant_123",
  siteId: ObjectId("..."),  // Reference to TowerSite
  name: "Alpha Sector",
  location: { latitude: 40.7128, longitude: -74.0060 },
  azimuth: 0,  // 0-360 degrees
  beamwidth: 65,  // degrees
  tilt: 3,  // mechanical tilt
  technology: "LTE",  // LTE, CBRS, FWA, 5G, WiFi
  band: "Band 71 (600MHz)",
  frequency: 617,  // MHz
  bandwidth: 10,  // MHz
  antennaModel: "Commscope SBNHH-1D65C",
  antennaSerialNumber: "SN123456",
  radioModel: "Nokia AEQE",
  radioSerialNumber: "RN789012",
  status: "active",  // active, inactive, maintenance, planned
  installDate: ISODate("..."),
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### **CPE Devices**
```javascript
{
  _id: ObjectId("..."),
  tenantId: "tenant_123",
  siteId: ObjectId("..."),  // Optional reference
  name: "Customer Smith - FWA CPE",
  location: { latitude: 40.7200, longitude: -74.0100 },
  azimuth: 180,  // Pointing direction
  beamwidth: 30,  // Typical for FWA CPE
  heightAGL: 25,  // feet above ground
  manufacturer: "Telrad",
  model: "CPE7000",
  serialNumber: "CPE-123456",
  macAddress: "00:11:22:33:44:55",
  subscriberName: "John Smith",
  subscriberContact: {
    name: "John Smith",
    phone: "555-5678",
    email: "john.smith@example.com"
  },
  accountNumber: "ACCT-1001",
  serviceType: "residential",  // residential, business, temporary
  technology: "FWA",
  status: "online",  // online, offline, maintenance, inventory
  installDate: ISODate("..."),
  lastOnline: ISODate("..."),
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### **Network Equipment**
```javascript
{
  _id: ObjectId("..."),
  tenantId: "tenant_123",
  siteId: ObjectId("..."),  // Optional reference
  name: "Router - Core 1",
  location: { latitude: 40.7128, longitude: -74.0060 },
  locationType: "tower",  // tower, warehouse, vehicle, customer-site
  type: "router",  // router, switch, antenna, radio, cpe, power, battery
  manufacturer: "Cisco",
  model: "ASR-9000",
  serialNumber: "RTR-987654",
  partNumber: "ASR-9000-AC",
  status: "deployed",  // deployed, inventory, rma, retired, lost
  quantity: 1,
  purchaseDate: ISODate("..."),
  warrantyExpires: ISODate("..."),
  installedBy: "Tech Team",
  installDate: ISODate("..."),
  notes: "Core router for main site",
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

---

## 🔒 **Security & Multi-Tenancy**

### **Backend Validation:**
```javascript
// Every request requires:
Headers: {
  'Authorization': 'Bearer <Firebase-JWT-Token>',
  'X-Tenant-ID': 'tenant_123'
}

// Backend verifies:
1. JWT is valid (Firebase Admin SDK)
2. User is authenticated
3. User is member of tenant
4. All queries filtered by tenantId
```

### **Data Isolation:**
```javascript
// All MongoDB queries include tenant filter:
TowerSite.find({ tenantId: req.tenantId })
Sector.find({ tenantId: req.tenantId, band: 'LTE' })
CPEDevice.findOne({ _id, tenantId: req.tenantId })

// Prevents cross-tenant data access
// Even if someone guesses an ObjectId
```

---

## 📡 **API Endpoints**

Base URL: `http://136.112.111.167:3000/api/coverage-map`

### **Tower Sites:**
```
GET    /tower-sites           - List all tower sites
GET    /tower-sites/:id       - Get single tower site
POST   /tower-sites           - Create tower site
PUT    /tower-sites/:id       - Update tower site
DELETE /tower-sites/:id       - Delete tower site
```

### **Sectors:**
```
GET    /sectors                      - List all sectors
GET    /sectors?band=LTE             - Filter by band
GET    /sectors?technology=CBRS      - Filter by technology
GET    /tower-sites/:siteId/sectors  - Get sectors for site
POST   /sectors                      - Create sector
PUT    /sectors/:id                  - Update sector
DELETE /sectors/:id                  - Delete sector
```

### **CPE Devices:**
```
GET    /cpe-devices               - List all CPE devices
GET    /cpe-devices?status=online - Filter by status
POST   /cpe-devices               - Create CPE device
PUT    /cpe-devices/:id           - Update CPE device
DELETE /cpe-devices/:id           - Delete CPE device
```

### **Network Equipment:**
```
GET    /equipment                        - List all equipment
GET    /equipment?locationType=warehouse - Filter by location
GET    /equipment?status=inventory       - Filter by status
POST   /equipment                        - Create equipment
PUT    /equipment/:id                    - Update equipment
DELETE /equipment/:id                    - Delete equipment
```

### **Geocoding:**
```
POST   /geocode          - Convert address to coordinates
POST   /reverse-geocode  - Convert coordinates to address
```

---

## ✅ **Deployment Checklist**

### **Backend (Manual - One Time):**
- [ ] Run `bash deploy-coverage-map-backend.sh`
- [ ] Verify script completes successfully
- [ ] Check `systemctl status hss-api` shows "active (running)"
- [ ] Test endpoint: `curl -H "X-Tenant-ID: test" http://136.112.111.167:3000/api/coverage-map/tower-sites`

### **Frontend (Automatic):**
- [x] Code committed to Git
- [x] Code pushed to GitHub
- [ ] Wait for Firebase App Hosting build (~10-15 min)
- [ ] Verify in Firebase Console: Build succeeded
- [ ] Test Coverage Map module loads in browser

### **Verification:**
- [ ] Login to application
- [ ] Navigate to Dashboard → Coverage Map
- [ ] Try adding a tower site
- [ ] Verify data appears on map
- [ ] Check MongoDB Atlas to confirm data saved
- [ ] Test filtering by LTE band
- [ ] Export CSV report
- [ ] Export PDF report

---

## 🧪 **Testing Commands**

### **Test Backend (from local machine):**
```bash
# Health check
curl http://136.112.111.167:3000/health

# Coverage Map endpoint (requires auth)
curl -H "X-Tenant-ID: test" \
     http://136.112.111.167:3000/api/coverage-map/tower-sites
```

### **Test Backend (SSH to server):**
```bash
ssh root@136.112.111.167

# Check service status
systemctl status hss-api

# Check logs
journalctl -u hss-api -n 50 --no-pager

# Test locally
curl -H "X-Tenant-ID: test" \
     http://localhost:3000/api/coverage-map/tower-sites

# Should return: []  (empty array, means it's working)
```

### **Test Frontend:**
1. Open browser → Your production URL
2. Login with your account
3. Go to Dashboard → Click "🗺️ Coverage Map"
4. Open browser DevTools (F12) → Console
5. Should NOT see any errors
6. Try adding equipment → Should save successfully

---

## 🔄 **Why MongoDB Over Firestore**

| Reason | Impact |
|--------|--------|
| **Consistency** | All backend data in one database |
| **Integration** | Easy to join with CBRS/ACS/HSS data |
| **Geospatial** | Better location queries with GeoJSON |
| **Aggregation** | Complex reports and analytics |
| **Team Knowledge** | You already use MongoDB everywhere |
| **Backend Control** | Full control over queries and indexes |
| **Cost** | Included in existing MongoDB Atlas plan |

---

## 📞 **Support**

**Backend Server:**  
- Host: `root@136.112.111.167`  
- Port: `3000`  
- Service: `hss-api`  

**Database:**  
- MongoDB Atlas (your existing cluster)  
- Collections: TowerSites, Sectors, CPEDevices, NetworkEquipment  

**Frontend:**  
- Firebase App Hosting (auto-deploy)  
- Build triggered by Git push  

---

## 🎯 **Summary**

**Your setup:**
1. ✅ **Backend**: MongoDB Atlas (consistent with HSS/CBRS/ACS)
2. ✅ **API**: GCE VM Express server (one backend for all modules)
3. ✅ **Frontend**: Firebase App Hosting (auto-deploy from Git)

**What to do:**
1. Run: `bash deploy-coverage-map-backend.sh` (one-time backend deployment)
2. Wait: Firebase App Hosting rebuilds automatically (~10-15 min)
3. Test: Login and use Coverage Map module
4. Done! ✨

---

**MongoDB is the right choice! All your operational data stays together.** 🎯

*Last Updated: October 18, 2025*  
*Architecture: MongoDB Atlas + GCE Backend + Firebase Frontend*

