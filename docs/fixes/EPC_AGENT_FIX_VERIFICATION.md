# EPC Agent Fix Verification

## Fix Applied: epc-ping-monitor.js Hash Reporting

### What Was Fixed

The agent script now reports the hash of `epc-ping-monitor.js` in check-ins, preventing infinite update loops.

### Source Code Location

**File**: `backend-services/scripts/epc-checkin-agent.sh`

**Lines 234-243**:
```bash
# Get hash for ping monitor (if exists) - THIS WAS MISSING!
if [ -f "/opt/wisptools/epc-ping-monitor.js" ]; then
    ping_monitor_hash=$(get_file_hash "/opt/wisptools/epc-ping-monitor.js")
fi

# Build scripts object - include ALL scripts that might be updated
local scripts_json="\"scripts\":{\"epc-checkin-agent.sh\":{\"hash\":\"$agent_hash\"}"
[ -n "$snmp_hash" ] && scripts_json="${scripts_json},\"epc-snmp-discovery.sh\":{\"hash\":\"$snmp_hash\"}"
[ -n "$snmp_js_hash" ] && scripts_json="${scripts_json},\"epc-snmp-discovery.js\":{\"hash\":\"$snmp_js_hash\"}"
[ -n "$ping_monitor_hash" ] && scripts_json="${scripts_json},\"epc-ping-monitor.js\":{\"hash\":\"$ping_monitor_hash\"}"
scripts_json="${scripts_json}}"
```

### Deployment Status

✅ **Source Code**: Fixed (committed to git)  
✅ **Downloads Directory**: Updated on backend server (`/var/www/html/downloads/scripts/epc-checkin-agent.sh`)  
✅ **EPC Device**: Manually patched (10.0.25.134)

### Verification Commands

**On EPC Device:**
```bash
# Check if fix is present
grep -n "epc-ping-monitor.js" /opt/wisptools/epc-checkin-agent.sh

# Test hash reporting
bash -c "source /opt/wisptools/epc-checkin-agent.sh 2>/dev/null; get_versions" | jq '.scripts'
```

**On Backend Server:**
```bash
# Verify downloads directory has fix
grep -n "epc-ping-monitor.js" /var/www/html/downloads/scripts/epc-checkin-agent.sh

# Verify source code has fix
grep -n "epc-ping-monitor.js" /opt/lte-pci-mapper/backend-services/scripts/epc-checkin-agent.sh
```

### For Future Agents

All new agents will automatically get this fix because:
1. ✅ The fix is in the source code (`backend-services/scripts/epc-checkin-agent.sh`)
2. ✅ The source code is copied to the downloads directory during deployment
3. ✅ New agents download from `https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh`

### Manual Update for Existing Agents

If an existing agent needs the fix:

```bash
# On EPC device:
sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh
sudo chmod +x /opt/wisptools/epc-checkin-agent.sh
sudo systemctl restart wisptools-checkin
```

---

**Status**: ✅ Fixed in source code and deployed  
**Date**: 2025-12-06
