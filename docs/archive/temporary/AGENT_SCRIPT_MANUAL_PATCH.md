# Agent Script Manual Patch Guide

## Quick Solution

**Download the updated script** (recommended):
```bash
sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh && sudo chmod +x /opt/wisptools/epc-checkin-agent.sh && sudo systemctl restart wisptools-checkin
```

## Manual Patch Instructions

If you need to manually patch the existing script, here are the exact changes:

### Patch 1: Add epc-ping-monitor.js Hash Reporting

**File**: `/opt/wisptools/epc-checkin-agent.sh`  
**Function**: `get_versions()` (around line 218)

**Find** (around line 232):
```bash
    # Get hash for Node.js version (if exists)
    if [ -f "/opt/wisptools/epc-snmp-discovery.js" ]; then
        snmp_js_hash=$(get_file_hash "/opt/wisptools/epc-snmp-discovery.js")
    fi
    
    # Build scripts object - include ALL scripts that might be updated
```

**Add after the snmp_js_hash section** (before "Build scripts object"):
```bash
    # Get hash for ping monitor (if exists) - THIS WAS MISSING!
    if [ -f "/opt/wisptools/epc-ping-monitor.js" ]; then
        ping_monitor_hash=$(get_file_hash "/opt/wisptools/epc-ping-monitor.js")
    fi
```

**Then find** (around line 240):
```bash
    local scripts_json="\"scripts\":{\"epc-checkin-agent.sh\":{\"hash\":\"$agent_hash\"}"
    [ -n "$snmp_hash" ] && scripts_json="${scripts_json},\"epc-snmp-discovery.sh\":{\"hash\":\"$snmp_hash\"}"
    [ -n "$snmp_js_hash" ] && scripts_json="${scripts_json},\"epc-snmp-discovery.js\":{\"hash\":\"$snmp_js_hash\"}"
    scripts_json="${scripts_json}}"
```

**Change to**:
```bash
    local scripts_json="\"scripts\":{\"epc-checkin-agent.sh\":{\"hash\":\"$agent_hash\"}"
    [ -n "$snmp_hash" ] && scripts_json="${scripts_json},\"epc-snmp-discovery.sh\":{\"hash\":\"$snmp_hash\"}"
    [ -n "$snmp_js_hash" ] && scripts_json="${scripts_json},\"epc-snmp-discovery.js\":{\"hash\":\"$snmp_js_hash\"}"
    [ -n "$ping_monitor_hash" ] && scripts_json="${scripts_json},\"epc-ping-monitor.js\":{\"hash\":\"$ping_monitor_hash\"}"
    scripts_json="${scripts_json}}"
```

### Patch 2: Background Result Reporting

**File**: `/opt/wisptools/epc-checkin-agent.sh`  
**Function**: `execute_command()`  
**Case**: `script|script_execution` (around line 315)

**Find the section** where script execution completes and result is reported. It likely ends with:
```bash
    report_command_result "$cmd_id" "$result_success" "$result_output" "$result_error" $exit_code
```

**Replace that line and add BEFORE it** (right after script execution, before any result reporting):

```bash
    # CRITICAL: Report result in background process that survives daemon restart
    log "  -> Reporting command result in background (survives daemon restart)"
    
    local device_code=$(get_device_code)
    local report_script="/tmp/report-result-${cmd_id}.sh"
    local report_data="/tmp/report-data-${cmd_id}.txt"
    
    # Write data to file (base64 encoded)
    echo "$device_code" > "$report_data"
    echo "$cmd_id" >> "$report_data"
    echo "$result_success" >> "$report_data"
    echo "$exit_code" >> "$report_data"
    echo -n "$result_output" | base64 -w 0 >> "$report_data" 2>/dev/null || echo -n "$result_output" | base64 >> "$report_data" 2>/dev/null
    echo "" >> "$report_data"
    echo -n "$result_error" | base64 -w 0 >> "$report_data" 2>/dev/null || echo -n "$result_error" | base64 >> "$report_data" 2>/dev/null
    
    cat > "$report_script" << 'REPORTSCRIPT'
#!/bin/bash
API_URL="https://hss.wisptools.io/api/epc"
REPORT_DATA_FILE="$1"
DEVICE_CODE=$(sed -n '1p' "$REPORT_DATA_FILE")
CMD_ID=$(sed -n '2p' "$REPORT_DATA_FILE")
SUCCESS=$(sed -n '3p' "$REPORT_DATA_FILE")
EXIT_CODE=$(sed -n '4p' "$REPORT_DATA_FILE")
OUTPUT_B64=$(sed -n '5p' "$REPORT_DATA_FILE")
ERROR_B64=$(sed -n '6p' "$REPORT_DATA_FILE")
OUTPUT=$(echo -n "$OUTPUT_B64" | base64 -d 2>/dev/null || echo "")
ERROR=$(echo -n "$ERROR_B64" | base64 -d 2>/dev/null || echo "")
if command -v jq >/dev/null 2>&1; then
    OUTPUT_JSON=$(echo -n "$OUTPUT" | jq -Rs .)
    ERROR_JSON=$(echo -n "$ERROR" | jq -Rs .)
else
    OUTPUT_JSON="\"$(echo -n "$OUTPUT" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr '\n' ' ')\""
    ERROR_JSON="\"$(echo -n "$ERROR" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr '\n' ' ')\""
fi
sleep 2
for i in 1 2 3; do
    if command -v timeout >/dev/null 2>&1; then
        response=$(timeout 30 curl -s -w "\n%{http_code}" -X POST "${API_URL}/checkin/commands/${CMD_ID}/result" -H "Content-Type: application/json" -H "X-Device-Code: ${DEVICE_CODE}" -d "{\"success\":${SUCCESS},\"output\":${OUTPUT_JSON},\"error\":${ERROR_JSON},\"exit_code\":${EXIT_CODE}}" --max-time 25 --connect-timeout 10 2>&1)
        http_code=$(echo "$response" | tail -n1)
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/checkin/commands/${CMD_ID}/result" -H "Content-Type: application/json" -H "X-Device-Code: ${DEVICE_CODE}" -d "{\"success\":${SUCCESS},\"output\":${OUTPUT_JSON},\"error\":${ERROR_JSON},\"exit_code\":${EXIT_CODE}}" --max-time 25 --connect-timeout 10 2>&1)
        http_code=$(echo "$response" | tail -n1)
    fi
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') [CHECKIN] Command ${CMD_ID} result reported successfully (attempt $i)" >> /var/log/wisptools-checkin.log
        rm -f "$REPORT_DATA_FILE" "$0"
        exit 0
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') [CHECKIN] ERROR: Failed to report command ${CMD_ID} result (HTTP $http_code, attempt $i)" >> /var/log/wisptools-checkin.log
        if [ $i -lt 3 ]; then sleep 5; fi
    fi
done
echo "$(date '+%Y-%m-%d %H:%M:%S') [CHECKIN] ERROR: Command ${CMD_ID} result reporting failed after 3 attempts" >> /var/log/wisptools-checkin.log
rm -f "$REPORT_DATA_FILE" "$0"
REPORTSCRIPT
    chmod +x "$report_script"
    nohup bash "$report_script" "$report_data" >> /var/log/wisptools-checkin.log 2>&1 &
    log "  -> Result reporting started in background (PID: $!, script: $report_script)"
    
    # Remove the old report_command_result call - it's now done in background
```

**Remove** the old `report_command_result` call if it exists after script execution.

## Testing After Patch

```bash
# Test script syntax
bash -n /opt/wisptools/epc-checkin-agent.sh

# Restart service
sudo systemctl restart wisptools-checkin

# Check logs
sudo tail -f /var/log/wisptools-checkin.log
```

---

**Recommendation**: Use the curl download command instead of manual patching - it's faster and less error-prone.
