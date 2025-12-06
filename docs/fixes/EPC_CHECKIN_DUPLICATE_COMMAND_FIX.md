# EPC Check-in Duplicate Command Fix

## Problem
The check-in process keeps showing "1 update over and over" - the same command keeps appearing in every check-in response.

## Root Causes Identified

1. **Auto-update check only looks for 'pending' commands** - If a command is marked as 'sent' but the result hasn't been reported yet, a duplicate command is created
2. **Command result reporting fails silently** - The result reporting uses `>/dev/null 2>&1` which hides errors, so failed reports aren't detected
3. **No verification that result was reported** - The agent doesn't check if the result reporting actually succeeded

## Fixes Applied

### 1. Fixed Auto-Update Duplicate Prevention (`epc-checkin.js`)

**Before**: Only checked for 'pending' status
```javascript
const existingUpdate = await EPCCommand.findOne({
  epc_id: epc.epc_id,
  action: 'update_scripts',
  status: 'pending',  // Only checks pending
  expires_at: { $gt: new Date() }
});
```

**After**: Checks both 'pending' and 'sent' status
```javascript
const existingUpdate = await EPCCommand.findOne({
  epc_id: epc.epc_id,
  action: 'update_scripts',
  status: { $in: ['pending', 'sent'] },  // Check both pending and sent
  expires_at: { $gt: new Date() }
});
```

This prevents creating duplicate commands when a command is already 'sent' but hasn't completed yet.

### 2. Enhanced Command Result Reporting (`epc-checkin-agent.sh`)

**Before**: Silent failure with no verification
```bash
curl ... >/dev/null 2>&1 || log "WARNING: Failed to report command result (non-critical)"
```

**After**: Verifies HTTP response and logs errors
```bash
local result_response=$(timeout 35 curl -s -w "\n%{http_code}" ...)
local result_http_code=$(echo "$result_response" | tail -n1)
if [ "$result_http_code" = "200" ] || [ "$result_http_code" = "201" ]; then
    result_reported=true
    log "Command $cmd_id result reported successfully: success=$success"
else
    log "ERROR: Failed to report command result (HTTP $result_http_code) - command may be re-queued"
    log "Response: $(echo "$result_response" | head -c 200)"
fi
```

This ensures we know if result reporting failed and can take action.

## Verification Steps

### 1. Check for duplicate commands in database
```javascript
// In MongoDB or via backend API
db.epccommands.find({
  epc_id: "YOUR_EPC_ID",
  action: "update_scripts",
  status: { $in: ["pending", "sent"] }
}).sort({ created_at: -1 })
```

### 2. Check command result reporting in logs
```bash
# On EPC
grep "Command.*result reported" /var/log/wisptools-checkin.log | tail -10

# Look for errors
grep "ERROR.*Failed to report command result" /var/log/wisptools-checkin.log
```

### 3. Monitor check-in responses
```bash
# On EPC - check if same command ID appears multiple times
grep "Commands:" /var/log/wisptools-checkin.log | tail -20
```

## Expected Behavior After Fix

✅ **No duplicate commands** - Auto-update check won't create duplicates if a command is already 'sent'
✅ **Result reporting verified** - Agent checks HTTP response to confirm result was recorded
✅ **Better error logging** - Failed result reports are logged with details
✅ **Commands marked as completed** - Once result is reported, command status changes to 'completed' or 'failed'

## Files Changed

1. `backend-services/routes/epc-checkin.js`
   - Fixed auto-update duplicate check to include 'sent' status
   - Added better logging for duplicate prevention

2. `backend-services/scripts/epc-checkin-agent.sh`
   - Enhanced command result reporting with HTTP response verification
   - Added error logging when result reporting fails
   - Removed silent failure (`>/dev/null`)

3. `backend-services/services/epc-checkin-service.js`
   - Added comment clarifying that only 'pending' commands are returned

## Deployment

1. **Deploy backend changes** - Update `epc-checkin.js` and `epc-checkin-service.js` on server
2. **Deploy agent script** - EPCs will download updated script on next check-in
3. **Monitor logs** - Watch for "Update command already exists" messages (should see this instead of creating duplicates)

## Troubleshooting

### If commands still duplicate:

1. **Check command status in database**:
   ```javascript
   // Find commands stuck in 'sent' status
   db.epccommands.find({ status: 'sent', sent_at: { $lt: new Date(Date.now() - 300000) } })
   ```

2. **Manually mark old 'sent' commands as failed**:
   ```javascript
   db.epccommands.updateMany(
     { status: 'sent', sent_at: { $lt: new Date(Date.now() - 3600000) } },
     { $set: { status: 'failed', completed_at: new Date() } }
   )
   ```

3. **Check if result reporting endpoint is working**:
   ```bash
   curl -X POST https://hss.wisptools.io/api/epc/checkin/commands/COMMAND_ID/result \
     -H "Content-Type: application/json" \
     -H "X-Device-Code: DEVICE_CODE" \
     -d '{"success": true, "output": "test", "error": "", "exit_code": 0}'
   ```

---

**Status**: ✅ Fixed  
**Date**: 2025-12-06

