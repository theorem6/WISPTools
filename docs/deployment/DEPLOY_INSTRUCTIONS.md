# Deployment Instructions for Fake Data Fixes

## Quick Deployment

### Option 1: Use PowerShell Script (Windows)
```powershell
.\deploy-all-fixes.ps1
```

### Option 2: Manual Deployment

## Backend Deployment to GCE

1. **SSH to GCE server:**
   ```bash
   gcloud compute ssh acs-hss-server --zone=us-central1-a --tunnel-through-iap
   ```

2. **On the GCE server, run:**
   ```bash
   cd /opt/lte-pci-mapper
   git fetch origin
   git reset --hard origin/main
   
   cd backend-services
   npm install --production
   
   # Restart PM2 services
   pm2 restart main-api
   pm2 restart epc-api  
   pm2 restart hss-api
   pm2 save
   
   # Run cleanup script to remove fake data
   cd /opt/lte-pci-mapper/backend-services/scripts
   node cleanup-fake-data.js
   
   # Verify services are running
   pm2 status
   ```

## Frontend Deployment to Firebase

1. **Build the frontend:**
   ```powershell
   cd Module_Manager
   npm run build
   ```

2. **Deploy to Firebase:**
   ```powershell
   cd ..
   firebase deploy --only hosting --project wisptools-production
   ```

## Verification

After deployment:

1. **Check backend API:**
   - Visit: https://hss.wisptools.io/api/health
   - Should return a health status

2. **Check frontend:**
   - Visit: https://wisptools-production.web.app
   - Go to Monitoring > Graphs tab
   - Should show empty device list or only real devices
   - No fake devices (Core Router, Core Switch, Customer A/B CPE, etc.)

3. **Check hardware inventory:**
   - Go to Hardware module
   - Should show only real EPC devices, no fake equipment

## What Was Fixed

1. ✅ Removed all fake data generation from backend API routes
2. ✅ Added filtering to exclude fake devices from SNMP API
3. ✅ Enhanced cleanup script to remove fake devices and metrics
4. ✅ Fixed graphs to show real data or empty state

## If You Still See Fake Data

Run the cleanup script again on the GCE server:
```bash
cd /opt/lte-pci-mapper/backend-services/scripts
node cleanup-fake-data.js
```

Then restart the backend:
```bash
pm2 restart main-api
pm2 restart epc-api
pm2 restart hss-api
```

