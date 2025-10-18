# 🗺️ Deploy Coverage Map Backend

## Architecture

```
Frontend (Firebase App Hosting)
         ↓
Cloud Function (hssProxy)
         ↓
GCE Backend (136.112.111.167:3000)  ← Add Coverage Map routes here
         ↓
MongoDB Atlas
```

---

## 🚀 Deployment Commands

### **SSH to Backend Server:**

```bash
ssh root@136.112.111.167
```

### **Run These Commands:**

```bash
# 1. Pull latest code from GitHub
cd /root
git clone https://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@github.com/theorem6/lte-pci-mapper.git 2>/dev/null || (cd lte-pci-mapper && git pull)

# 2. Run the deployment script
cd /root/lte-pci-mapper
bash backend-deploy-coverage-map.sh
```

---

## ✅ What Gets Deployed

### **Files Added to /opt/hss-api/:**
- `coverage-map-schema.js` - MongoDB/Mongoose models
- `coverage-map-api.js` - Express API routes

### **Routes Added to server.js:**
```javascript
const coverageMapAPI = require('./coverage-map-api');
app.use('/api/coverage-map', coverageMapAPI);
```

### **API Endpoints Available:**
```
http://136.112.111.167:3000/api/coverage-map/tower-sites
http://136.112.111.167:3000/api/coverage-map/sectors
http://136.112.111.167:3000/api/coverage-map/cpe-devices
http://136.112.111.167:3000/api/coverage-map/equipment
http://136.112.111.167:3000/api/coverage-map/geocode
```

### **Frontend Calls:**
```
Frontend → hssProxy Cloud Function → GCE Backend → MongoDB Atlas
```

---

## 📊 MongoDB Collections Created

```
Database: hss (your existing MongoDB Atlas database)

Collections:
├── towersites         ← New
├── sectors            ← New
├── cpedevices         ← New
├── networkequipments  ← New
├── subscribers        ← Existing (HSS)
├── groups             ← Existing (HSS)
└── devices            ← Existing (GenieACS)
```

**All collections use `tenantId` for isolation.**

---

## 🧪 Test After Deployment

```bash
# Test from the VM
curl -H "X-Tenant-ID: test" http://localhost:3000/api/coverage-map/tower-sites

# Should return: []
```

---

## ✅ Done!

- Backend: Add API routes + MongoDB schema
- Frontend: Auto-deploys from Git (already pushed)
- Database: Uses existing MongoDB Atlas
- No new services or installations needed

Simple 2-command deployment! 🎯

