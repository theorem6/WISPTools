# EPC Command Result Reporting Fix - Daemon Restart Issue

## Problem
Commands are executed successfully, but the result is never reported because the auto-update script restarts the daemon, killing the process before it can report the result. This causes the same command (or new ones) to appear repeatedly.

## Root Cause
The auto-update script contains:
```bash
systemctl restart wisptools-checkin
```

When this runs:
1. Script executes successfully
2. Script restarts the daemon (kills current process)
3. Result reporting never happens (process is dead)
4. Command stays in 'sent' status (never marked as completed)
5. Next check-in creates a new command because the old one is still 'sent'

## Fix Applied

### Report Result IMMEDIATELY After Script Execution

**Before**: Result reported at the end of `execute_command`, after script completes
```bash
# Script runs
output=$("$script_file" 2>&1)
# ... process output ...
# Report result (but daemon might restart before this happens)
report_command_result ...
```

**After**: Result reported immediately after script execution, before any daemon restart
```bash
# Script runs
output=$("$script_file" 2>&1)
# Report result IMMEDIATELY (before daemon can restart)
report_command_result "$cmd_id" "$result_success" "$result_output" "$result_error" "$exit_code"
# Now if daemon restarts, result is already reported
```

### Changes Made

1. **`epc-checkin-agent.sh` - Script Execution Case**:
   - Detect if script will restart daemon (grep for restart commands)
   - Report result IMMEDIATELY after script execution
   - Skip duplicate reporting at end of function
   - Added warning log if script will restart daemon

2. **`epc-checkin-agent.sh` - execute_command Function**:
   - Only report result at end for non-script commands
   - Script commands report immediately (already done above)

3. **`epc-auto-update.js` - Update Script Template**:
   - Added comment explaining restart happens after result is reported
   - Clarified that agent reports result before restart

## Expected Behavior After Fix

✅ **Result reported before daemon restart** - Result is sent immediately after script execution
✅ **Commands marked as completed** - Server receives result and marks command as completed/failed
✅ **No duplicate commands** - Completed commands won't be returned again
✅ **Better logging** - Warnings when script will restart daemon

## Verification

### Check logs for result reporting:
```bash
# On EPC
grep "Reporting command result immediately" /var/log/wisptools-checkin.log
grep "Command.*result reported successfully" /var/log/wisptools-checkin.log
```

### Check that commands are marked as completed:
```bash
# On backend - check MongoDB
db.epccommands.find({ 
  epc_id: "EPC-CB4C5042",
  action: "update_scripts",
  status: { $in: ["completed", "failed"] }
}).sort({ created_at: -1 }).limit(5)
```

### Expected log sequence:
```
[CHECKIN] Executing command X: script_execution / update_scripts
[CHECKIN]   -> Running script...
[AUTO-UPDATE] Updating epc-ping-monitor.js...
[AUTO-UPDATE] Updated epc-ping-monitor.js successfully
[CHECKIN]   -> Script executed successfully
[CHECKIN]   -> Reporting command result immediately (before any daemon restart)
[CHECKIN]   -> Command result reported successfully
[CHECKIN]   -> WARNING: Script will restart daemon - result already reported
[AUTO-UPDATE] Restarting check-in agent (result already reported)
[AUTO-UPDATE] Restarted check-in agent
[CHECKIN] Starting check-in daemon (interval: 60s)
```

## Files Changed

1. `backend-services/scripts/epc-checkin-agent.sh`
   - Report result immediately after script execution
   - Detect scripts that will restart daemon
   - Skip duplicate reporting for script commands

2. `backend-services/utils/epc-auto-update.js`
   - Added comment about restart timing

---

**Status**: ✅ Fixed  
**Date**: 2025-12-06

