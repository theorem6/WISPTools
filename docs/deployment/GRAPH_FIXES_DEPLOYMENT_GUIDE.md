# Graph System Fixes - Deployment Guide

## Status: Changes Committed and Pushed to GitHub ✅

All graph system fixes have been committed and pushed to the repository:
- **Commit**: `b45343ea` - "Fix graph system: backend response format, missing throughput data, frontend overlay display"
- **Branch**: `main`
- **Files Changed**: 8 files (400 insertions, 113 deletions)

---

## Deployment Steps

### ✅ Step 1: Git Push (COMPLETE)
Changes have been committed and pushed to GitHub.

---

### ⏳ Step 2: Backend Deployment (PENDING - Requires gcloud auth)

**Location**: GCE Server (`acs-hss-server` in `us-central1-a`)

**Files to Deploy**:
- `backend-services/routes/monitoring-graphs.js` - Fixed response format and added throughput data

#### Option A: Using PowerShell Script (Recommended)

First, authenticate with gcloud:
```powershell
gcloud auth login
gcloud config set account YOUR_ACCOUNT@email.com
```

Then run:
```powershell
gcloud compute ssh acs-hss-server --zone=us-central1-a --command="cd /opt/lte-pci-mapper 2>/dev/null || cd /root/lte-pci-mapper; git pull origin main; cd backend-services; npm install --production; pm2 restart all; pm2 save; pm2 status" --tunnel-through-iap
```

#### Option B: Manual SSH Deployment

1. **SSH to the server:**
   ```bash
   gcloud compute ssh acs-hss-server --zone=us-central1-a --tunnel-through-iap
   ```

2. **On the server, run:**
   ```bash
   # Navigate to repo directory
   cd /opt/lte-pci-mapper 2>/dev/null || cd /root/lte-pci-mapper
   
   # Pull latest changes from GitHub
   git pull origin main
   
   # Install/update dependencies
   cd backend-services
   npm install --production
   
   # Restart all services
   pm2 restart all
   pm2 save
   
   # Verify services are running
   pm2 status
   ```

3. **Verify deployment:**
   ```bash
   # Check API health
   curl http://localhost:3001/api/monitoring/graphs/devices
   
   # Check logs for errors
   pm2 logs main-api --lines 50
   ```

---

### ⏳ Step 3: Frontend Build (IN PROGRESS)

**Location**: `Module_Manager/` directory

**Files Changed**:
- `Module_Manager/src/routes/modules/monitoring/+page.svelte` - Fixed graphs overlay CSS
- `Module_Manager/src/lib/components/EPCMonitoringPanel.svelte` - Already using ECharts

**Build Command:**
```powershell
cd Module_Manager
npm run build
```

The build is currently running in the background.

---

### ⏳ Step 4: Frontend Deployment (PENDING - After Build Completes)

**Location**: Firebase Hosting (`wisptools-production`)

Once the build completes, deploy to Firebase:

#### Option A: Using Firebase Helper Script
```powershell
.\firebase-deploy.ps1
```

#### Option B: Direct Firebase Command
```powershell
firebase deploy --only hosting
```

Or deploy everything (hosting + functions):
```powershell
firebase deploy
```

---

## What Was Fixed

### Backend Fixes (`backend-services/routes/monitoring-graphs.js`)

1. **Ping Stats Response**:
   - Fixed: `avg_response_time` → `avg_response_time_ms` (matches frontend expectation)
   - Added: `current_status` field for status badge display

2. **Status Dataset Format**:
   - Fixed: Simplified borderColor/backgroundColor (removed array format incompatible with ECharts)

3. **SNMP Throughput Data**:
   - Added: Network throughput datasets (interface_in_octets and interface_out_octets)
   - Previously only CPU, Memory, and Uptime were returned

### Frontend Fixes (`Module_Manager/src/routes/modules/monitoring/+page.svelte`)

1. **Graphs Overlay CSS**:
   - Fixed: Changed `overflow: hidden` → `overflow-y: auto` for scrolling
   - Fixed: Changed `top: 80px` → `top: 0` for full-screen display
   - Added: Proper background gradient

---

## Verification After Deployment

### Backend Verification

1. **Test Graph Endpoints:**
   ```bash
   # List devices
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        -H "X-Tenant-ID: YOUR_TENANT_ID" \
        https://hss.wisptools.io/api/monitoring/graphs/devices
   
   # Get ping metrics
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        -H "X-Tenant-ID: YOUR_TENANT_ID" \
        https://hss.wisptools.io/api/monitoring/graphs/ping/DEVICE_ID?hours=24
   
   # Get SNMP metrics (should now include throughput)
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        -H "X-Tenant-ID: YOUR_TENANT_ID" \
        https://hss.wisptools.io/api/monitoring/graphs/snmp/DEVICE_ID?hours=24
   ```

2. **Check Response Structure:**
   - Ping stats should have `avg_response_time_ms` (not `avg_response_time`)
   - Ping stats should have `current_status` field
   - SNMP response should include throughput datasets if data exists

### Frontend Verification

1. **Navigate to Monitoring > Graphs**
   - URL: https://wisptools-production.web.app/modules/monitoring
   - Click "Graphs" tab

2. **Verify:**
   - ✅ Graphs overlay displays full screen
   - ✅ Device list loads correctly
   - ✅ Ping charts display (Uptime and Response Time)
   - ✅ SNMP charts display (CPU, Memory, Throughput if data available)
   - ✅ Stats display correctly (uptime %, response time, status)

---

## Troubleshooting

### Backend Issues

**If services don't restart:**
```bash
pm2 logs all --err
pm2 restart all --update-env
```

**If git pull fails:**
```bash
# Check git remote
cd /opt/lte-pci-mapper
git remote -v

# If needed, reset to GitHub state
git fetch origin main
git reset --hard origin/main
```

### Frontend Issues

**If build fails:**
```powershell
cd Module_Manager
npm install  # Ensure dependencies are up to date
npm run build
```

**If deployment fails:**
```powershell
firebase login  # Re-authenticate if needed
firebase use wisptools-production  # Verify project
firebase deploy --only hosting
```

---

## Summary

- ✅ **Git Commit & Push**: Complete
- ⏳ **Backend Deployment**: Pending (requires gcloud auth)
- ⏳ **Frontend Build**: In Progress
- ⏳ **Frontend Deployment**: Pending (after build completes)

Once both deployments are complete, all graph system fixes will be live in production!

