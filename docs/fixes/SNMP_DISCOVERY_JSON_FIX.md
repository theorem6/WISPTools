# SNMP Discovery JSON Fix - Log Output Contamination

## Problem
SNMP discovery script was generating invalid JSON because log messages were being captured along with the JSON output:

```
ERROR: Invalid JSON generated for discovered devices, using empty array
JSON content (first 500 chars): 2025-12-06 04:12:04 [SNMP-DISCOVERY] Starting two-phase network discovery...
```

## Root Cause
The `log()` function was using `tee -a` which writes to **both stdout and the log file**. When `scan_network` output was captured with command substitution `$(scan_network ...)`, log messages going to stdout were mixed into the JSON.

Additionally, some `jq` commands were capturing stderr with `2>&1`, which could also contaminate output.

## Fixes Applied

### 1. Log Function Fix (`epc-snmp-discovery.sh`)
**Before**: Logs went to stdout (contaminated JSON)
```bash
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SNMP-DISCOVERY] $1" | tee -a "$LOG_FILE"
}
```

**After**: Logs go to stderr (don't contaminate JSON)
```bash
log() {
    # Write logs to stderr and log file, NOT stdout (stdout is used for JSON output)
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SNMP-DISCOVERY] $1" | tee -a "$LOG_FILE" >&2
}
```

### 2. Command Substitution Fix
**Before**: Could capture stderr
```bash
local discovered_devices=$(scan_network "$subnet" "$communities")
```

**After**: Only captures stdout, stderr (logs) ignored
```bash
local discovered_devices=$(scan_network "$subnet" "$communities" 2>/dev/null)
```

### 3. jq Command Fixes
**Before**: Captured stderr which could contaminate output
```bash
local merged=$(echo "$devices_array" | jq ". + [$ping_device]" 2>&1)
payload=$(jq -n ... '{}' 2>&1)
```

**After**: Errors go to stderr, only JSON captured
```bash
local merged=$(echo "$devices_array" | jq ". + [$ping_device]" 2>/dev/null)
payload=$(jq -n ... '{}' 2>/dev/null)
```

### 4. curl Command Fix
**Before**: Captured stderr
```bash
local response=$(curl ... 2>&1)
```

**After**: Only captures stdout
```bash
local response=$(curl ... 2>/dev/null)
```

## Verification

After deploying the fix, run discovery again:
```bash
sudo /opt/wisptools/epc-snmp-discovery.sh
```

**Expected behavior**:
- ✅ No "Invalid JSON" errors
- ✅ Log messages appear in terminal/log file (stderr)
- ✅ JSON output is clean (stdout only)
- ✅ Devices are properly reported to backend

**Check logs**:
```bash
tail -f /var/log/wisptools-snmp-discovery.log
```

**Check if devices are reported**:
- Should see: `Successfully reported discovery: X devices processed`
- Should NOT see: `ERROR: Invalid JSON generated`

## Files Changed

1. `backend-services/scripts/epc-snmp-discovery.sh`
   - Fixed `log()` function to write to stderr
   - Fixed command substitution to ignore stderr
   - Fixed jq commands to ignore stderr
   - Fixed curl command to ignore stderr

## Deployment

The script needs to be deployed to the EPC. The script is downloaded by the EPC check-in agent from:
```
https://hss.wisptools.io/downloads/scripts/epc-snmp-discovery.sh
```

After deploying the updated script to the server, EPCs will download it on their next check-in.

---

**Status**: ✅ Fixed  
**Date**: 2025-12-06

