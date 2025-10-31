# Deploy Backend Route to Fix ISO Generation

## Problem
Frontend is getting 404/500 errors when trying to generate EPC ISO because:
1. The `/api/deploy/generate-epc-iso` route was added to `gce-backend/routes/epc-deployment.js`
2. The route was mounted at `/api/deploy` in `gce-backend/server.js`
3. **BUT** - The updated files need to be deployed to the GCE server

## Solution: Deploy Updated Backend Files

### Option 1: SSH and Pull Latest Code

```bash
ssh root@136.112.111.167

# Navigate to repo
cd /root/lte-pci-mapper

# Pull latest changes
git pull origin main

# Copy updated route file to backend
cp gce-backend/routes/epc-deployment.js /opt/gce-backend/routes/

# Copy updated server.js if it changed
cp gce-backend/server.js /opt/gce-backend/

# Restart the backend service on port 3002
systemctl restart gce-backend  # or pm2 restart epc-api

# Check if it's running
curl http://localhost:3002/health
curl http://localhost:3002/api/deploy/generate-epc-iso -X POST -H "Content-Type: application/json" -d '{"siteName":"test"}'
```

### Option 2: Use Deployment Script

If there's a deployment script for gce-backend:
```bash
ssh root@136.112.111.167 "cd /root/lte-pci-mapper && bash scripts/deployment/deploy-gce-iso-builder.sh"
```

## Verify Deployment

1. **Check route is mounted:**
   ```bash
   curl http://localhost:3002/api/deploy/generate-epc-iso -X POST -H "Content-Type: application/json" -H "X-Tenant-ID: test" -d '{"siteName":"Test Site"}'
   ```

2. **Check from Cloud Function:**
   - Check Cloud Functions logs for isoProxy
   - Should see detailed error messages now

3. **Verify server is running:**
   ```bash
   systemctl status gce-backend
   # or
   pm2 status
   ```

## What Changed

1. **Added route handler** `POST /generate-epc-iso` to `gce-backend/routes/epc-deployment.js`
2. **Mounted router** at both `/api/epc` and `/api/deploy` in `gce-backend/server.js`
3. **Improved error logging** in `functions/src/index.ts` isoProxy

## After Deployment

Once deployed, the frontend should be able to:
- Call `/api/deploy/generate-epc-iso` via Firebase Hosting rewrite
- Or call `isoProxy/api/deploy/generate-epc-iso` directly
- Backend will generate ISO and return download URL

