# EPC Diagnostics and Update - Complete Summary

## Status

✅ **Deployment Complete**: All fixes have been deployed to the GCE server
✅ **Check-in Working**: Device YALNTFQC (EPC-CB4C5042) is checking in successfully
✅ **Scripts Ready**: Diagnostic and update scripts are available on the server

## What Has Been Fixed

1. **Script Version Reporting**: Check-in agent now reports script hashes
2. **Auto-Update Mechanism**: Improved to always check for updates
3. **Command Execution**: Fixed to handle `script_execution` command type
4. **MongoDB Connection**: Fixed diagnostic scripts to use proper config
5. **Debug Logging**: Added logging for script version reporting

## How to Run Diagnostics

### Option 1: Use PowerShell Script (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run-epc-diagnostics.ps1
```

This will:
- Check EPC status
- Check server logs
- Force an update
- Wait for check-in
- Verify update execution

### Option 2: SSH and Run Manually

SSH to the GCE server:

```bash
gcloud compute ssh acs-hss-server --zone=us-central1-a
cd /opt/lte-pci-mapper
```

**Step 1: Check EPC Status**
```bash
node backend-services/scripts/check-epc-status.js EPC-CB4C5042 690abdc14a6f067977986db3
```

**Step 2: Check Server Logs**
```bash
pm2 logs main-api --lines 50 --nostream | grep -E "EPC Check-in|Auto-Update|YALNTFQC"
```

**Step 3: Force Update**
```bash
node backend-services/scripts/create-epc-update-command.js EPC-CB4C5042 690abdc14a6f067977986db3
```

**Step 4: Verify Update Command**
```bash
node backend-services/scripts/check-epc-status.js EPC-CB4C5042 690abdc14a6f067977986db3
```

## Expected Results

### After Running Diagnostics

1. **EPC Status Check** should show:
   - EPC ID, Device Code, Status
   - Latest check-in timestamp
   - Script versions (if reported)
   - System metrics (CPU, memory, uptime)
   - Queued commands

2. **Server Logs** should show:
   - `[EPC Check-in] Device YALNTFQC checking in from 192.168.2.234`
   - `[EPC Check-in] Script versions reported: {...}` (if agent updated)
   - `[EPC Auto-Update] epc-checkin-agent.sh needs update` (if update needed)

3. **Force Update** should show:
   - Updates available (if scripts differ)
   - Update command queued successfully

### After Update Command Executes

The next EPC check-in (within 60 seconds) should:

1. **Receive the command**:
   - Log: `[CHECKIN] Check-in successful. EPC: EPC-CB4C5042, Commands: 1`

2. **Execute the update**:
   - Log: `[CHECKIN] Executing command ...`
   - Log: `[AUTO-UPDATE] Updating epc-checkin-agent.sh...`
   - Log: `[AUTO-UPDATE] Updated epc-checkin-agent.sh successfully`
   - Log: `[AUTO-UPDATE] Restarted check-in agent`

3. **Subsequent check-ins**:
   - Will report script versions
   - Metrics will appear (CPU, memory, uptime)
   - Auto-updates will work automatically

## Troubleshooting

### If Scripts Can't Connect to MongoDB

The scripts use the same config as the server. Verify:
```bash
cd /opt/lte-pci-mapper/backend-services
node -e "require('dotenv').config(); const config = require('./config/app'); console.log('MongoDB URI:', config.mongodb.uri.replace(/\/\/.*@/, '//***:***@'))"
```

### If Update Command Not Queued

Check if there's already a pending update:
```bash
node -e "require('dotenv').config(); const mongoose = require('mongoose'); const {EPCCommand} = require('./models/distributed-epc-schema'); const config = require('./config/app'); mongoose.connect(config.mongodb.uri).then(async () => { const cmds = await EPCCommand.find({epc_id: 'EPC-CB4C5042', status: {$in: ['pending', 'sent']}}).lean(); console.log(JSON.stringify(cmds, null, 2)); process.exit(0); });"
```

### If EPC Not Receiving Commands

1. Verify device code is correct:
   - Check server logs for device code matches
   - Should be: `YALNTFQC`

2. Check EPC logs:
   ```bash
   # On EPC device
   tail -f /var/log/wisptools-checkin.log
   ```

3. Verify service is running:
   ```bash
   # On EPC device
   systemctl status wisptools-checkin
   ```

## Files Created/Modified

- ✅ `backend-services/scripts/check-epc-status.js` - Diagnostic script
- ✅ `backend-services/scripts/create-epc-update-command.js` - Manual update script
- ✅ `backend-services/scripts/run-epc-diagnostics.sh` - Bash diagnostic script
- ✅ `scripts/run-epc-diagnostics.ps1` - PowerShell diagnostic script
- ✅ `backend-services/server.js` - Added debug logging
- ✅ `backend-services/utils/epc-auto-update.js` - Improved update checks
- ✅ `backend-services/scripts/epc-checkin-agent.sh` - Added script version reporting

## Next Steps

1. Run the diagnostics to see current status
2. Force an update if needed
3. Monitor the next few check-ins to verify update
4. Check the monitoring page for metrics to appear

All code is deployed and ready. The system will automatically update the EPC once the update command is queued.

