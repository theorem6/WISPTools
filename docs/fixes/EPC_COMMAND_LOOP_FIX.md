# EPC Command Infinite Loop Fix - $200 Issue

## Problem
The same update command keeps appearing over and over, creating an infinite loop. Each check-in gets a new command with a different ID, but the same update script runs repeatedly.

## Root Causes

1. **Missing hash reporting for epc-ping-monitor.js** - Agent doesn't report this script's hash, so backend always thinks it needs updating
2. **Result never reported** - Daemon restart kills process before HTTP request completes
3. **No check for recently completed commands** - Backend creates new command even if one just completed

## Fixes Applied

### 1. Added Missing Hash Reporting (`epc-checkin-agent.sh`)

**Problem**: Agent only reported hashes for:
- epc-checkin-agent.sh
- epc-snmp-discovery.sh  
- epc-snmp-discovery.js

**Missing**: epc-ping-monitor.js (the script being updated!)

**Fix**: Added hash reporting for epc-ping-monitor.js
```bash
# Get hash for ping monitor (if exists) - THIS WAS MISSING!
if [ -f "/opt/wisptools/epc-ping-monitor.js" ]; then
    ping_monitor_hash=$(get_file_hash "/opt/wisptools/epc-ping-monitor.js")
fi

# Include in versions JSON
[ -n "$ping_monitor_hash" ] && scripts_json="${scripts_json},\"epc-ping-monitor.js\":{\"hash\":\"$ping_monitor_hash\"}"
```

### 2. Background Result Reporting (`epc-checkin-agent.sh`)

**Problem**: Result reporting happens synchronously, but daemon restart kills process before HTTP completes.

**Fix**: Report result in background process with nohup that survives daemon restart:
```bash
# Create background script that will survive daemon restart
local report_script="/tmp/report-result-${cmd_id}.sh"
# ... script with retries ...

# Run with nohup - survives process death
nohup bash "$report_script" >> /var/log/wisptools-checkin.log 2>&1 &
```

The background script:
- Waits 2 seconds for daemon restart to complete
- Retries up to 3 times if HTTP request fails
- Logs success/failure to check-in log
- Cleans up after itself

### 3. Check Recently Completed Commands (`epc-checkin.js`)

**Problem**: Backend only checked for 'pending'/'sent', not recently completed.

**Fix**: Also check for commands completed/failed in last 5 minutes:
```javascript
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
const existingUpdate = await EPCCommand.findOne({
  epc_id: epc.epc_id,
  action: 'update_scripts',
  $or: [
    // Active commands
    { status: { $in: ['pending', 'sent'] }, expires_at: { $gt: new Date() } },
    // Recently completed/failed (within 5 minutes)
    { 
      status: { $in: ['completed', 'failed'] }, 
      completed_at: { $gte: fiveMinutesAgo }
    }
  ]
});
```

## Expected Behavior After Fix

✅ **epc-ping-monitor.js hash reported** - Backend knows script is up to date
✅ **Result reported in background** - Survives daemon restart with retries
✅ **No duplicate commands** - Checks for recently completed commands too
✅ **Commands properly completed** - Background process ensures result is sent

## Verification

After deploying, check logs:

```bash
# On EPC - should see hash for ping monitor
grep "epc-ping-monitor.js" /var/log/wisptools-checkin.log

# Should see background result reporting
grep "Result reporting started in background" /var/log/wisptools-checkin.log
grep "result reported successfully" /var/log/wisptools-checkin.log

# On backend - should see no more duplicate commands
node backend-services/scripts/check-queued-commands.js EPC-CB4C5042
```

## Files Changed

1. `backend-services/scripts/epc-checkin-agent.sh`
   - Added epc-ping-monitor.js hash reporting
   - Background result reporting with nohup
   - Retry logic for result reporting

2. `backend-services/routes/epc-checkin.js`
   - Check for recently completed commands (5 min window)
   - Prevent immediate duplicate creation

3. `backend-services/utils/epc-auto-update.js`
   - Updated comment about background reporting

---

**Status**: ✅ Fixed  
**Date**: 2025-12-06  
**Issue Value**: $200

