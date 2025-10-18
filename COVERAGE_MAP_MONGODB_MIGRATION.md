# 🗺️ Coverage Map: MongoDB Migration Guide

## ✅ Why MongoDB is Better for Your Project

You're **absolutely right** to use MongoDB instead of Firestore for Coverage Map data.

### **Your Current Architecture:**
```
MongoDB Atlas (Cloud):
├── HSS Management API
│   ├── Subscribers (IMSI, Ki, OPc)
│   ├── Groups
│   └── Bandwidth Plans
├── GenieACS (TR-069 ACS)
│   ├── CPE Devices
│   ├── Faults
│   └── Provisions
├── Distributed EPC API
│   ├── Remote EPCs
│   └── Metrics
└── [NEW] Coverage Map API ← Makes sense here!
    ├── Tower Sites
    ├── Sectors
    ├── CPE Devices
    └── Network Equipment
```

### **Benefits:**

1. **✅ Data Consistency**: All operational data in MongoDB
2. **✅ Backend Integration**: Easy to join Coverage Map with CBRS/ACS data
3. **✅ Complex Queries**: MongoDB aggregation for reports
4. **✅ Geospatial Queries**: Built-in GeoJSON support for location searches
5. **✅ Existing Infrastructure**: Backend server already connected to MongoDB Atlas
6. **✅ Team Knowledge**: You already use MongoDB everywhere

---

## 📦 What Was Created

### **Backend API (MongoDB)**
```
backend-services/
├── coverage-map-schema.js    # Mongoose schemas
└── coverage-map-api.js        # Express routes
```

**Features:**
- Multi-tenant with `X-Tenant-ID` header
- Full CRUD for towers, sectors, CPE, equipment
- Geocoding endpoints (ArcGIS integration)
- Query filtering by band, technology, status
- Population of site relationships

### **Frontend Service (MongoDB)**
```
Module_Manager/src/routes/modules/coverage-map/lib/
└── coverageMapService.mongodb.ts  # Backend API client
```

**Features:**
- Firebase Auth token for authentication
- Tenant ID from localStorage
- Clean async/await API
- Error handling
- MongoDB `_id` → `id` mapping

---

## 🚀 Deployment Steps

### **Step 1: Deploy Backend API**

Run the deployment script:

```bash
bash deploy-coverage-map-backend.sh
```

**What this does:**
1. ✅ Uploads `coverage-map-schema.js` and `coverage-map-api.js` to GCE VM
2. ✅ Updates `server.js` to register Coverage Map routes
3. ✅ Restarts `hss-api` service
4. ✅ Tests the new endpoints

**Manual alternative (if script fails):**

```bash
# SSH to backend server
ssh root@136.112.111.167

# Navigate to API directory
cd /opt/hss-api

# Upload files (from local machine)
# scp backend-services/coverage-map-*.js root@136.112.111.167:/opt/hss-api/

# Add to server.js (before the Express app starts)
nano server.js

# Add these lines after other require statements:
const coverageMapAPI = require('./coverage-map-api');

# Add this after other app.use statements:
app.use('/api/coverage-map', coverageMapAPI);

# Save and restart
systemctl restart hss-api

# Verify it's running
systemctl status hss-api
curl -H "X-Tenant-ID: test" http://localhost:3000/api/coverage-map/tower-sites
```

### **Step 2: Deploy Frontend**

Already done! Just commit and push:

```bash
git add Module_Manager/src/routes/modules/coverage-map/
git add backend-services/coverage-map-*.js
git commit -m "Coverage Map: Switch to MongoDB backend"
git push origin main
```

Firebase App Hosting will automatically rebuild with the MongoDB service.

---

## 🔄 Firestore vs MongoDB Comparison

| Aspect | Firestore (Old) | MongoDB (New) |
|--------|----------------|---------------|
| **Data Location** | Firebase | MongoDB Atlas |
| **Authentication** | Firebase SDK | Backend API + JWT |
| **Queries** | Limited | Full aggregation |
| **Relationships** | Manual joins | Mongoose populate |
| **Geospatial** | Basic | Advanced GeoJSON |
| **Integration** | Separate | Unified with backend |
| **Consistency** | Eventual | Configurable |
| **Cost** | Firebase pricing | MongoDB Atlas pricing |

---

## 📊 MongoDB Collections

### **Collection Structure:**

```javascript
// MongoDB Atlas Database: your-database-name

// Tower Sites
TowerSites
  ├── _id: ObjectId
  ├── tenantId: String (indexed)
  ├── name: String
  ├── location: { latitude, longitude, address }
  ├── type: enum['tower', 'rooftop', 'monopole', 'warehouse']
  ├── fccId: String
  ├── towerContact: { name, phone, email }
  ├── gateCode: String
  └── ... professional info

// Sectors
Sectors
  ├── _id: ObjectId
  ├── tenantId: String (indexed)
  ├── siteId: ObjectId (ref: TowerSites)
  ├── azimuth: Number (0-360)
  ├── beamwidth: Number
  ├── technology: enum['LTE', 'CBRS', 'FWA', '5G', 'WiFi']
  ├── band: String
  ├── frequency: Number
  └── ... RF config

// CPE Devices
CPEDevices
  ├── _id: ObjectId
  ├── tenantId: String (indexed)
  ├── siteId: ObjectId (optional)
  ├── serialNumber: String (unique per tenant)
  ├── azimuth: Number
  ├── beamwidth: Number (default 30)
  ├── subscriberName: String
  └── ... subscriber info

// Network Equipment
NetworkEquipment
  ├── _id: ObjectId
  ├── tenantId: String (indexed)
  ├── locationType: enum['tower', 'warehouse', 'vehicle', ...]
  ├── type: enum['router', 'switch', 'antenna', ...]
  ├── serialNumber: String (unique per tenant)
  ├── status: enum['deployed', 'inventory', 'rma', ...]
  └── ... inventory info
```

### **Indexes Created:**

```javascript
// Performance optimizations
TowerSites
  - tenantId (single)
  - tenantId + location (compound for geospatial)

Sectors
  - tenantId (single)
  - tenantId + siteId (compound)
  - tenantId + band (compound for filtering)
  - tenantId + technology (compound)

CPEDevices
  - tenantId + serialNumber (unique compound)
  - tenantId + status (compound)
  - tenantId + subscriberName (compound)

NetworkEquipment
  - tenantId + serialNumber (unique compound)
  - tenantId + locationType (compound)
  - tenantId + status (compound)
```

---

## 🔒 Security

### **Multi-Tenancy:**
- All queries automatically filtered by `tenantId`
- `X-Tenant-ID` header required on all requests
- Backend validates tenant membership via Firebase Auth

### **Authentication:**
- Firebase Auth JWT token required
- Backend verifies token with Firebase Admin SDK
- Only authenticated tenant members can access data

### **Data Isolation:**
- MongoDB queries always include `tenantId` filter
- Mongoose middleware ensures tenant isolation
- No cross-tenant data leakage

---

## 🧪 Testing

### **Test Backend API:**

```bash
# Get auth token (from browser console after login)
const token = await firebase.auth().currentUser.getIdToken();
console.log(token);

# Test tower sites endpoint
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -H "X-Tenant-ID: your-tenant-id" \
     http://136.112.111.167:3000/api/coverage-map/tower-sites

# Create a tower site
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -H "X-Tenant-ID: your-tenant-id" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Tower","location":{"latitude":40.7128,"longitude":-74.0060},"type":"tower"}' \
     http://136.112.111.167:3000/api/coverage-map/tower-sites
```

### **Test Frontend:**

1. Login to your application
2. Go to Dashboard → Coverage Map
3. Add a tower site
4. Check MongoDB Atlas to verify data saved
5. Try filtering by band
6. Export CSV/PDF reports

---

## 🔄 Data Migration

If you already have data in Firestore collections, you can migrate:

### **Option 1: Manual Export/Import**

```bash
# Export from Firestore
firebase firestore:export gs://your-bucket/firestore-export

# Convert to MongoDB format
# (Script would need to be written)

# Import to MongoDB
mongoimport --uri "mongodb+srv://..." --collection TowerSites --file tower-sites.json
```

### **Option 2: Fresh Start**
Since Coverage Map is new, just start fresh in MongoDB. No migration needed!

---

## 📈 Performance

### **MongoDB Advantages:**

1. **Geospatial Queries**:
   ```javascript
   // Find all sectors within 10km radius
   Sectors.find({
     location: {
       $near: {
         $geometry: { type: "Point", coordinates: [lng, lat] },
         $maxDistance: 10000
       }
     }
   });
   ```

2. **Aggregation Pipelines**:
   ```javascript
   // Count equipment by status
   NetworkEquipment.aggregate([
     { $match: { tenantId } },
     { $group: { _id: "$status", count: { $sum: 1 } } }
   ]);
   ```

3. **Efficient Joins**:
   ```javascript
   // Get sectors with site info
   Sectors.find({ tenantId })
     .populate('siteId', 'name type location');
   ```

---

## 🎯 API Endpoints Reference

### **Tower Sites:**
- `GET /api/coverage-map/tower-sites` - List all sites
- `GET /api/coverage-map/tower-sites/:id` - Get one site
- `POST /api/coverage-map/tower-sites` - Create site
- `PUT /api/coverage-map/tower-sites/:id` - Update site
- `DELETE /api/coverage-map/tower-sites/:id` - Delete site

### **Sectors:**
- `GET /api/coverage-map/sectors` - List all sectors
- `GET /api/coverage-map/sectors?band=LTE` - Filter by band
- `GET /api/coverage-map/tower-sites/:id/sectors` - Sectors by site
- `POST /api/coverage-map/sectors` - Create sector
- `PUT /api/coverage-map/sectors/:id` - Update sector
- `DELETE /api/coverage-map/sectors/:id` - Delete sector

### **CPE Devices:**
- `GET /api/coverage-map/cpe-devices` - List all CPE
- `GET /api/coverage-map/cpe-devices?status=online` - Filter by status
- `POST /api/coverage-map/cpe-devices` - Create CPE
- `PUT /api/coverage-map/cpe-devices/:id` - Update CPE
- `DELETE /api/coverage-map/cpe-devices/:id` - Delete CPE

### **Equipment:**
- `GET /api/coverage-map/equipment` - List all equipment
- `GET /api/coverage-map/equipment?locationType=warehouse` - Filter
- `POST /api/coverage-map/equipment` - Create equipment
- `PUT /api/coverage-map/equipment/:id` - Update equipment
- `DELETE /api/coverage-map/equipment/:id` - Delete equipment

### **Geocoding:**
- `POST /api/coverage-map/geocode` - Address → coordinates
- `POST /api/coverage-map/reverse-geocode` - Coordinates → address

---

## ✅ Deployment Checklist

- [ ] Backend files uploaded to GCE VM
- [ ] Coverage Map routes added to `server.js`
- [ ] `hss-api` service restarted
- [ ] API endpoints tested (returns 200 or 401)
- [ ] Frontend updated to use MongoDB service
- [ ] Code committed and pushed to GitHub
- [ ] Firebase App Hosting rebuilt automatically
- [ ] Tested Coverage Map in browser
- [ ] Verified data saves to MongoDB Atlas
- [ ] Removed Firestore rules (optional cleanup)

---

## 🆘 Troubleshooting

### **Backend not responding:**
```bash
ssh root@136.112.111.167
systemctl status hss-api
journalctl -u hss-api -n 50
```

### **Module not loading:**
Check browser console for errors. Verify `VITE_BACKEND_API_URL` is set.

### **"No tenant selected" error:**
Ensure you're logged in and have selected a tenant.

### **Authentication fails:**
Verify Firebase Auth is working and token is valid.

---

## 📞 Support

**Backend Server:** root@136.112.111.167  
**MongoDB Atlas:** Your Atlas cluster  
**API Port:** 3000  
**Frontend:** Firebase App Hosting (auto-deploy)

---

**Your decision to use MongoDB is correct! This keeps all your backend data consistent and integrated.** 🎯

*Last Updated: October 18, 2025*  
*Database: MongoDB Atlas (Recommended)*

