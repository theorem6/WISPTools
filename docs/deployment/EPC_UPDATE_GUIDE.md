# EPC Update and Reporting Fix Guide

## Current Status

Your EPC device (YALNTFQC / EPC-CB4C5042) is checking in successfully, but showing "Commands: 0", which means no update command is being queued.

## Why This Happens

The auto-update mechanism checks if the scripts on the EPC match the scripts on the server. If they match, no update is needed. However, if the EPC is running an older version of the check-in agent that doesn't report script hashes, the update check might not work correctly.

## Solution: Force an Update

### Option 1: Manual Update Command (Recommended)

SSH to your GCE server and run:

```bash
cd /opt/lte-pci-mapper
node backend-services/scripts/create-epc-update-command.js EPC-CB4C5042 690abdc14a6f067977986db3
```

Or using device code:

```bash
node backend-services/scripts/create-epc-update-command.js YALNTFQC 690abdc14a6f067977986db3
```

This will:
1. Check if updates are available
2. Create an update command
3. Queue it for the EPC

### Option 2: Check Current Status

First, check what's happening:

```bash
cd /opt/lte-pci-mapper
node backend-services/scripts/check-epc-status.js EPC-CB4C5042
```

This will show:
- Current EPC status
- Latest check-in data
- Script versions reported (if any)
- Queued commands
- Whether updates are available

### Option 3: Direct Script Update on EPC

If you have SSH access to the EPC:

```bash
# Download latest agent
curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh
chmod +x /opt/wisptools/epc-checkin-agent.sh

# Restart the service
systemctl restart wisptools-checkin
```

## What to Look For

After running the manual update command, you should see:

1. **In the update command output:**
   - ✅ Updates available: epc-checkin-agent.sh, epc-snmp-discovery.sh
   - ✅ Update command queued successfully

2. **In the next EPC check-in log (within 60 seconds):**
   - `[CHECKIN] Check-in successful. EPC: EPC-CB4C5042, Commands: 1`
   - `[CHECKIN] Executing command ...`

3. **After update completes:**
   - `[AUTO-UPDATE] Updated epc-checkin-agent.sh successfully`
   - `[AUTO-UPDATE] Restarted check-in agent`
   - `[AUTO-UPDATE] Auto-update complete`

4. **In subsequent check-ins:**
   - Script versions will be reported in the check-in payload
   - Metrics (CPU, memory, uptime) will start appearing
   - Server logs will show: `[EPC Check-in] Script versions reported: {...}`

## Troubleshooting

### If update command doesn't work:

1. **Check server logs:**
   ```bash
   # On GCE server
   pm2 logs main-api --lines 50 | grep "EPC Check-in"
   ```

2. **Check if scripts exist on server:**
   ```bash
   ls -lh /var/www/html/downloads/scripts/
   ```

3. **Verify MongoDB connection:**
   ```bash
   node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wisptools').then(() => console.log('Connected')).catch(e => console.error(e))"
   ```

### If EPC doesn't receive commands:

1. **Check EPC logs:**
   ```bash
   # On EPC device
   tail -f /var/log/wisptools-checkin.log
   ```

2. **Verify device code is correct:**
   ```bash
   cat /etc/wisptools/device_code
   # Should match: YALNTFQC
   ```

3. **Check service status:**
   ```bash
   systemctl status wisptools-checkin
   ```

## Expected Behavior After Update

Once the agent is updated, you should see:

1. **Script version reporting:**
   - Each check-in includes script hashes
   - Server logs show: `[EPC Check-in] Script versions reported: {...}`

2. **Auto-update working:**
   - Future script changes will automatically update
   - No manual intervention needed

3. **Metrics appearing:**
   - CPU, memory, uptime in monitoring page
   - System metrics in EPC details

4. **Better logging:**
   - More detailed check-in logs
   - Update commands logged clearly

