# Dependency Updates Deployment Status

**Date:** December 2024  
**MongoDB Atlas:** All versions verified compatible

---

## ✅ Frontend Deployment (COMPLETE)

**Status:** ✅ **DEPLOYED**

**Location:** Firebase Hosting - `wisptools-production`

**Actions Completed:**
- ✅ Package.json updated with new dependency versions
- ✅ npm install completed
- ✅ Production build successful (1m 60s)
- ✅ Deployed to Firebase Hosting
- ✅ 1,204 files uploaded

**Deployed URL:** https://wisptools-production.web.app

**Packages Updated:**
- `@arcgis/core`: 4.34.8
- `@sveltejs/kit`: 2.49.1
- `mongodb`: 6.21.0 (MongoDB Atlas compatible)
- `svelte`: 5.45.5
- `svelte-check`: 4.3.4
- `@types/node`: 20.19.25
- `express`: 4.22.1

---

## ⏳ Backend Deployment (PENDING)

**Status:** ⏳ **READY FOR DEPLOYMENT**

**Location:** GCE Server - `hss.wisptools.io` (136.112.111.167)

### Deployment Steps Required:

**Option 1: Automated (Recommended)**

From your local machine:
```powershell
# Use PowerShell deployment script
.\scripts\deployment\Deploy-GCE-Backend.ps1
```

**Option 2: Manual Deployment**

1. **SSH to GCE Server:**
   ```bash
   gcloud compute ssh acs-hss-server --zone=us-central1-a --tunnel-through-iap
   ```

2. **On the GCE Server:**
   ```bash
   # Navigate to repo
   cd /opt/lte-pci-mapper
   # OR if different location:
   cd /root/lte-pci-mapper
   
   # Pull latest changes
   git pull origin main
   
   # Install updated dependencies
   cd backend-services
   npm install --production
   
   # Restart PM2 services
   pm2 restart all
   # OR restart specific services:
   pm2 restart main-api
   pm2 restart epc-api
   
   # Verify services are running
   pm2 status
   pm2 logs main-api --lines 20
   ```

**Option 3: Use Deployment Script on Server**

```bash
# On GCE server
cd /opt/lte-pci-mapper  # or /root/lte-pci-mapper
sudo bash scripts/deployment/update-backend-from-git.sh
```

**Packages to be Updated on Server:**
- `firebase-admin`: 13.6.0
- `mongoose`: 7.8.8 (MongoDB Atlas compatible)
- `nodemon`: 3.1.11
- `net-snmp`: 3.26.0 (newly added)

---

## ⏳ Firebase Functions Deployment (PENDING)

**Status:** ⏳ **READY FOR DEPLOYMENT**

### Deployment Steps:

```bash
# From project root
cd functions

# Install updated dependencies
npm install

# Build TypeScript
npm run build

# Deploy to Firebase
cd ..
firebase deploy --only functions --project wisptools-production
```

**Packages to be Updated:**
- `firebase-admin`: 13.6.0
- `mongodb`: 6.21.0 (MongoDB Atlas compatible)

---

## ⏳ Remote EPC Agents (AUTO-UPDATE)

**Status:** ⏳ **AUTO-UPDATES ON NEXT CHECK-IN**

**How It Works:**

1. **Agent Scripts Location on GCE Server:**
   - `/var/www/html/downloads/scripts/epc-checkin-agent.sh`
   - `/var/www/html/downloads/scripts/epc-snmp-discovery.js`
   - `/var/www/html/downloads/scripts/epc-snmp-discovery.sh`

2. **Auto-Update Process:**
   - Agents check in with backend every 60 seconds
   - Backend checks script versions/hashes
   - If updates available, backend queues update command
   - Agent downloads updated scripts on next check-in
   - Scripts are automatically replaced

3. **Manual Update (If Needed):**

   **For specific EPC device:**
   ```bash
   # On GCE server
   cd /opt/lte-pci-mapper/backend-services/scripts
   node create-new-epc-update-command.js <DEVICE_CODE>
   ```

   **Or via frontend:**
   - Go to Deploy module
   - Select EPC device
   - Click "Send Update Command"

**Important Notes:**
- ✅ Agent scripts don't use npm packages (bash/Node.js scripts only)
- ✅ Scripts are served from `/var/www/html/downloads/scripts/` on GCE server
- ✅ After backend deployment, ensure scripts are copied to download directory
- ✅ Agents will automatically get updates on next check-in

---

## 📋 Complete Deployment Checklist

### ✅ Completed
- [x] Update package.json files
- [x] Install packages locally
- [x] Build frontend successfully
- [x] Deploy frontend to Firebase Hosting
- [x] Commit and push all changes to GitHub

### ⏳ Pending
- [ ] Deploy backend to GCE server
  - [ ] SSH to server
  - [ ] Pull latest code
  - [ ] Install updated npm packages
  - [ ] Restart PM2 services
  - [ ] Verify services running
- [ ] Deploy Firebase Functions
  - [ ] Install updated dependencies
  - [ ] Build TypeScript
  - [ ] Deploy to Firebase
- [ ] Verify agent scripts on GCE server
  - [ ] Ensure scripts in `/var/www/html/downloads/scripts/`
  - [ ] Verify scripts are latest versions
  - [ ] Agents will auto-update on next check-in

---

## 🚀 Quick Deployment Commands

### Frontend (Already Done ✅)
```bash
cd Module_Manager
npm install
npm run build
cd ..
firebase deploy --only hosting --project wisptools-production
```

### Backend (Ready to Deploy)
```bash
# SSH to server first
gcloud compute ssh acs-hss-server --zone=us-central1-a --tunnel-through-iap

# Then on server:
cd /opt/lte-pci-mapper
git pull origin main
cd backend-services
npm install --production
pm2 restart all
pm2 status
```

### Firebase Functions (Ready to Deploy)
```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions --project wisptools-production
```

### Agent Scripts (Auto-Updates)
- No action needed - agents will auto-update on next check-in
- Scripts are served from GCE server at `/var/www/html/downloads/scripts/`

---

## ⚠️ Important Notes

### MongoDB Atlas Compatibility

All MongoDB driver versions are compatible with MongoDB Atlas:
- ✅ `mongodb` v6.21.0 - Used in Module Manager, Functions, GenieACS
- ✅ `mongoose` v7.8.8 - Used in Backend Services
- ✅ Connection strings use `mongodb+srv://` format
- ✅ All Atlas features supported

### GenieACS Fork

**CRITICAL UPDATE:**
- MongoDB driver: v4.16.0 → v6.21.0 (major breaking change)
- Node.js requirement: >=12.13.0 → >=20.0.0

**Status:** ⚠️ Requires testing before production use

**Location:** `genieacs-fork/package.json` (not deployed to production server)

**Action Required:**
- Test MongoDB driver migration thoroughly
- Verify all GenieACS functionality works with v6.21.0
- Update code if breaking changes are encountered

---

## 📊 Deployment Summary

| Component | Status | Location | Next Action |
|-----------|--------|----------|-------------|
| Frontend | ✅ Deployed | Firebase Hosting | Verify deployment |
| Backend | ⏳ Pending | GCE Server | Deploy via SSH |
| Functions | ⏳ Pending | Firebase Functions | Deploy via Firebase CLI |
| Agents | ⏳ Auto-Update | Remote EPCs | Wait for check-in |

---

## ✅ Verification Steps

After all deployments:

1. **Frontend:**
   - ✅ Visit: https://wisptools-production.web.app
   - Verify pages load correctly
   - Check browser console for errors

2. **Backend:**
   - Visit: https://hss.wisptools.io/api/health
   - Verify API responds
   - Check PM2 status on server

3. **Functions:**
   - Check Firebase Console
   - Verify functions deployed
   - Check function logs

4. **Agents:**
   - Wait for next agent check-in (within 60 seconds)
   - Check agent logs on remote EPCs
   - Verify scripts updated

---

**Next Steps:** Deploy backend and Firebase Functions to complete the deployment.

