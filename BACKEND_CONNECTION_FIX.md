# Backend Connection Refused Fix

## Problem
Firebase Functions getting `ECONNREFUSED 136.112.111.167:3001` because backend server crashed.

## Root Cause
Backend server crashed due to MODULE_NOT_FOUND error in `hss-epcs-legacy.js`:
- Wrong import path: `../models/distributed-epc-schema` 
- Should be: `../../models/distributed-epc-schema`

## Fix Applied
✅ Fixed both import paths in `hss-epcs-legacy.js`:
- Line 12: `require('../../models/distributed-epc-schema')`
- Line 679: `require('../../models/distributed-epc-schema')`

✅ Committed to git (commit: 17ffda5)

## Next Steps
Deploy the fix to the GCE server:
```bash
# The deployment script will pull latest code and restart
.\scripts\deployment\Deploy-GCE-Backend.ps1
```

Or manually:
```bash
# SSH to server
gcloud compute ssh acs-hss-server --zone=us-central1-a

# Pull latest code
cd /opt/lte-pci-mapper
sudo git pull

# Restart server
sudo pm2 restart main-api
```

## Verification
After deployment, check:
1. `pm2 status` - should show `main-api` as "online"
2. `curl http://localhost:3001/health` - should return OK
3. Frontend should be able to connect

