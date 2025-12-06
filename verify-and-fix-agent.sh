#!/bin/bash
# Verify and fix agent script on EPC device

AGENT_FILE="/opt/wisptools/epc-checkin-agent.sh"

echo "Checking agent script..."

# Check if ping_monitor_hash is declared
if ! grep -q "ping_monitor_hash=" "$AGENT_FILE"; then
    echo "ERROR: ping_monitor_hash variable not found"
    exit 1
fi

# Check if ping monitor hash is being calculated
if ! grep -q "get_file_hash.*epc-ping-monitor.js" "$AGENT_FILE"; then
    echo "ERROR: epc-ping-monitor.js hash calculation not found"
    exit 1
fi

# Check if ping monitor is included in scripts_json
if ! grep -q "epc-ping-monitor.js.*hash.*ping_monitor_hash" "$AGENT_FILE"; then
    echo "ERROR: epc-ping-monitor.js not included in scripts_json"
    exit 1
fi

echo "✅ Agent script appears to have the fix"

# Test the get_versions function
echo "Testing get_versions function..."
bash -c "source $AGENT_FILE 2>/dev/null; get_versions" | jq -r '.scripts | keys[]' 2>/dev/null | grep -q "epc-ping-monitor.js" && echo "✅ epc-ping-monitor.js hash is being reported" || echo "❌ epc-ping-monitor.js hash NOT being reported"
