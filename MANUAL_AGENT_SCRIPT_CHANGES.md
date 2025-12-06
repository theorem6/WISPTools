# Manual Agent Script Changes Required

## Overview

The agent script on the EPC device needs **two critical changes** to fix the infinite update loop:

1. **Report `epc-ping-monitor.js` hash** - So backend knows it's up to date
2. **Background result reporting** - So results are reported even after daemon restart

## Change 1: Add epc-ping-monitor.js Hash Reporting

**Location**: In the `get_versions()` function (around line 218-246)

**Find this section:**
```bash
# Get script versions/hashes - CRITICAL: Must report ALL script hashes to prevent duplicate updates
local agent_hash=$(get_file_hash "/opt/wisptools/epc-checkin-agent.sh")
local snmp_hash=""
local snmp_js_hash=""
local ping_monitor_hash=""  # <-- This line might be missing or empty

# Get hash for bash version (if exists)
if [ -f "/opt/wisptools/epc-snmp-discovery.sh" ]; then
    snmp_hash=$(get_file_hash "/opt/wisptools/epc-snmp-discovery.sh")
fi

# Get hash for Node.js version (if exists)
if [ -f "/opt/wisptools/epc-snmp-discovery.js" ]; then
    snmp_js_hash=$(get_file_hash "/opt/wisptools/epc-snmp-discovery.js")
fi

# Build scripts object - include ALL scripts that might be updated
local scripts_json="\"scripts\":{\"epc-checkin-agent.sh\":{\"hash\":\"$agent_hash\"}"
[ -n "$snmp_hash" ] && scripts_json="${scripts_json},\"epc-snmp-discovery.sh\":{\"hash\":\"$snmp_hash\"}"
[ -n "$snmp_js_hash" ] && scripts_json="${scripts_json},\"epc-snmp-discovery.js\":{\"hash\":\"$snmp_js_hash\"}"
scripts_json="${scripts_json}}"
```

**Add this AFTER the snmp_js_hash section (before building scripts_json):**
```bash
# Get hash for ping monitor (if exists) - THIS WAS MISSING!
if [ -f "/opt/wisptools/epc-ping-monitor.js" ]; then
    ping_monitor_hash=$(get_file_hash "/opt/wisptools/epc-ping-monitor.js")
fi
```

**Then update the scripts_json building to include it:**
```bash
# Build scripts object - include ALL scripts that might be updated
local scripts_json="\"scripts\":{\"epc-checkin-agent.sh\":{\"hash\":\"$agent_hash\"}"
[ -n "$snmp_hash" ] && scripts_json="${scripts_json},\"epc-snmp-discovery.sh\":{\"hash\":\"$snmp_hash\"}"
[ -n "$snmp_js_hash" ] && scripts_json="${scripts_json},\"epc-snmp-discovery.js\":{\"hash\":\"$snmp_js_hash\"}"
[ -n "$ping_monitor_hash" ] && scripts_json="${scripts_json},\"epc-ping-monitor.js\":{\"hash\":\"$ping_monitor_hash\"}"  # <-- ADD THIS LINE
scripts_json="${scripts_json}}"
```

## Change 2: Background Result Reporting for Script Execution

**Location**: In the `execute_command()` function, in the `script|script_execution` case (around line 315-370)

**Find the section where script execution happens and result is reported. It probably looks like:**
```bash
script|script_execution)
    log "  -> Executing script"
    # ... script execution code ...
    
    # Report result
    report_command_result "$cmd_id" "$result_success" "$result_output" "$result_error" $exit_code
    ;;
```

**Replace the result reporting with this background reporting code:**
```bash
script|script_execution)
    log "  -> Executing script"
    local script_file="/tmp/wisptools-cmd-$cmd_id.sh"
    
    if [ -n "$script_content" ]; then
        log "  -> Script provided as content (${#script_content} chars)"
        echo "$script_content" > "$script_file" 2>&1 || {
            result_success=false
            result_error="Failed to write script file"
            exit_code=1
            log "ERROR: Failed to write script to $script_file"
        }
    elif [ -n "$script_url" ]; then
        log "  -> Downloading script from $script_url"
        if ! curl -fsSL "$script_url" -o "$script_file" 2>&1; then
            result_success=false
            result_error="Failed to download script from $script_url"
            exit_code=1
            log "ERROR: Failed to download script: $result_error"
        fi
    fi
    
    if [ -f "$script_file" ]; then
        log "  -> Running script..."
        chmod +x "$script_file"
        if output=$(bash "$script_file" 2>&1); then
            result_output="$output"
            exit_code=0
        else
            exit_code=$?
            result_success=false
            result_error="$output"
            log "ERROR: Script execution failed with exit code $exit_code"
            log "ERROR: Script output: $(echo "$output" | head -10 | tr '\n' '; ')"
        fi
    fi
    
    # CRITICAL: Report result in background process that survives daemon restart
    # The script may restart the daemon, killing this process before HTTP request completes
    # So we report in a background process that will continue even if this process dies
    log "  -> Reporting command result in background (survives daemon restart)"
    
    # Get device code for background script
    local device_code=$(get_device_code)
    
    # Create a temporary script to report the result
    local report_script="/tmp/report-result-${cmd_id}.sh"
    local report_data="/tmp/report-data-${cmd_id}.txt"
    
    # Write data to file (base64 encoded to avoid escaping issues)
    echo "$device_code" > "$report_data"
    echo "$cmd_id" >> "$report_data"
    echo "$result_success" >> "$report_data"
    echo "$exit_code" >> "$report_data"
    echo -n "$result_output" | base64 -w 0 >> "$report_data" 2>/dev/null || echo -n "$result_output" | base64 >> "$report_data" 2>/dev/null
    echo "" >> "$report_data"
    echo -n "$result_error" | base64 -w 0 >> "$report_data" 2>/dev/null || echo -n "$result_error" | base64 >> "$report_data" 2>/dev/null
    
    cat > "$report_script" << 'REPORTSCRIPT'
#!/bin/bash
# Background result reporting script - survives daemon restart
API_URL="https://hss.wisptools.io/api/epc"
REPORT_DATA_FILE="$1"

# Read data from file
DEVICE_CODE=$(sed -n '1p' "$REPORT_DATA_FILE")
CMD_ID=$(sed -n '2p' "$REPORT_DATA_FILE")
SUCCESS=$(sed -n '3p' "$REPORT_DATA_FILE")
EXIT_CODE=$(sed -n '4p' "$REPORT_DATA_FILE")
OUTPUT_B64=$(sed -n '5p' "$REPORT_DATA_FILE")
ERROR_B64=$(sed -n '6p' "$REPORT_DATA_FILE")

# Decode base64
OUTPUT=$(echo -n "$OUTPUT_B64" | base64 -d 2>/dev/null || echo "")
ERROR=$(echo -n "$ERROR_B64" | base64 -d 2>/dev/null || echo "")

# Escape for JSON using jq if available, otherwise manual escaping
if command -v jq >/dev/null 2>&1; then
    OUTPUT_JSON=$(echo -n "$OUTPUT" | jq -Rs .)
    ERROR_JSON=$(echo -n "$ERROR" | jq -Rs .)
else
    OUTPUT_JSON="\"$(echo -n "$OUTPUT" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr '\n' ' ' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')\""
    ERROR_JSON="\"$(echo -n "$ERROR" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr '\n' ' ' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')\""
fi

# Wait for daemon restart to complete
sleep 2

# Report result with retries
for i in 1 2 3; do
    if command -v timeout >/dev/null 2>&1; then
        response=$(timeout 30 curl -s -w "\n%{http_code}" -X POST "${API_URL}/checkin/commands/${CMD_ID}/result" \
            -H "Content-Type: application/json" \
            -H "X-Device-Code: ${DEVICE_CODE}" \
            -d "{\"success\":${SUCCESS},\"output\":${OUTPUT_JSON},\"error\":${ERROR_JSON},\"exit_code\":${EXIT_CODE}}" \
            --max-time 25 \
            --connect-timeout 10 \
            2>&1)
        http_code=$(echo "$response" | tail -n1)
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/checkin/commands/${CMD_ID}/result" \
            -H "Content-Type: application/json" \
            -H "X-Device-Code: ${DEVICE_CODE}" \
            -d "{\"success\":${SUCCESS},\"output\":${OUTPUT_JSON},\"error\":${ERROR_JSON},\"exit_code\":${EXIT_CODE}}" \
            --max-time 25 \
            --connect-timeout 10 \
            2>&1)
        http_code=$(echo "$response" | tail -n1)
    fi
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') [CHECKIN] Command ${CMD_ID} result reported successfully (attempt $i)" >> /var/log/wisptools-checkin.log
        rm -f "$REPORT_DATA_FILE" "$0"
        exit 0
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') [CHECKIN] ERROR: Failed to report command ${CMD_ID} result (HTTP $http_code, attempt $i)" >> /var/log/wisptools-checkin.log
        if [ $i -lt 3 ]; then
            sleep 5
        fi
    fi
done

# If all retries failed, log it
echo "$(date '+%Y-%m-%d %H:%M:%S') [CHECKIN] ERROR: Command ${CMD_ID} result reporting failed after 3 attempts" >> /var/log/wisptools-checkin.log
rm -f "$REPORT_DATA_FILE" "$0"
REPORTSCRIPT
    chmod +x "$report_script"
    
    # Run in background with nohup - this will survive daemon restart
    # Pass data file as argument
    nohup bash "$report_script" "$report_data" >> /var/log/wisptools-checkin.log 2>&1 &
    local report_pid=$!
    log "  -> Result reporting started in background (PID: $report_pid, script: $report_script)"
    
    # DO NOT call report_command_result here - it's done in background
    ;;
```

## Quick Update Command (Easier)

Instead of manual editing, you can download the updated script:

```bash
# On EPC device, run:
sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh && sudo chmod +x /opt/wisptools/epc-checkin-agent.sh && sudo systemctl restart wisptools-checkin
```

## Verification

After making changes, verify:

```bash
# Check if ping monitor hash is being reported
grep "epc-ping-monitor.js" /var/log/wisptools-checkin.log

# Check if background reporting is working
grep "Result reporting started in background" /var/log/wisptools-checkin.log
grep "result reported successfully" /var/log/wisptools-checkin.log

# Check service status
sudo systemctl status wisptools-checkin
```

## Summary

**Two critical changes needed:**
1. ✅ Add `epc-ping-monitor.js` hash reporting (lines ~234-243)
2. ✅ Replace synchronous result reporting with background reporting (lines ~370-520)

**Or simply download the updated script** using the curl command above.

---

**Status**: Manual update required on EPC device  
**Date**: 2025-12-06
