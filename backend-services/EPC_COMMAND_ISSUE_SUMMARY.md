# EPC Auto-Update Command Issue - Final Resolution

## Problem Summary

Commands are being created with **wrong hashes** even though:
1. ✅ EPC scripts have correct hashes installed
2. ✅ Backend manifest has correct hashes
3. ✅ Auto-update code is disabled in server.js
4. ✅ We've deleted 79+ old commands

## Root Cause

The backend service is likely:
- Running OLD code that still has auto-update enabled, OR
- Not restarted after disabling auto-update, OR  
- Running from a different location than expected

## Solution Steps

### 1. Verify Backend Service Status

Check if backend is running and which code it's using:
```bash
gcloud compute ssh acs-hss-server --zone=us-central1-a --command="sudo systemctl status lte-wisp-backend"
```

### 2. Stop Backend Service (if running)

```bash
gcloud compute ssh acs-hss-server --zone=us-central1-a --command="sudo systemctl stop lte-wisp-backend"
```

### 3. Deploy Updated server.js

```bash
# Copy updated server.js with auto-update disabled
gcloud compute scp backend-services/server.js acs-hss-server:/tmp/server.js --zone=us-central1-a
gcloud compute ssh acs-hss-server --zone=us-central1-a --command="sudo cp /tmp/server.js /home/david_peterson_consulting_com/lte-wisp-backend/server.js"
```

### 4. Ensure Manifest is Updated

```bash
# Copy manifest
gcloud compute scp backend-services/agent-manifest.json acs-hss-server:/tmp/agent-manifest.json --zone=us-central1-a
gcloud compute ssh acs-hss-server --zone=us-central1-a --command="sudo cp /tmp/agent-manifest.json /home/david_peterson_consulting_com/lte-wisp-backend/agent-manifest.json"
```

### 5. Delete ALL Remaining Commands

Run this locally:
```powershell
cd backend-services
node scripts/delete-all-auto-update-commands-final.js EPC-CB4C5042
```

### 6. Verify No Commands Remain

```powershell
node scripts/check-all-recent-commands.js EPC-CB4C5042
```

### 7. Test Check-in

On EPC, run:
```bash
sudo /opt/wisptools/epc-checkin-agent.sh
```

Should see: **Commands: 0**

## Current Status

- ✅ 79+ old commands deleted
- ✅ EPC scripts updated with correct hashes  
- ✅ Manifest updated with correct hashes
- ✅ Auto-update disabled in code
- ❌ Backend service may still be running old code
- ❌ Commands may still be getting created during check-ins

## Next Check-in Expected Result

```
Check-in successful. EPC: EPC-CB4C5042, Commands: 0
```

No hash mismatch errors, no auto-update commands.

