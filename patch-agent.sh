#!/bin/bash
# Patch script to add epc-ping-monitor.js hash reporting

AGENT_FILE="/opt/wisptools/epc-checkin-agent.sh"

# Check if already patched
if grep -q "epc-ping-monitor.js.*hash.*ping_monitor_hash" "$AGENT_FILE"; then
    echo "Already patched - epc-ping-monitor.js hash reporting exists"
    exit 0
fi

# Find the line number where we need to insert the ping monitor hash check
INSERT_LINE=$(grep -n "# Get hash for Node.js version (if exists)" "$AGENT_FILE" | cut -d: -f1)
if [ -z "$INSERT_LINE" ]; then
    echo "ERROR: Could not find insertion point"
    exit 1
fi

# Create backup
cp "$AGENT_FILE" "${AGENT_FILE}.backup"

# Insert the ping monitor hash check after the Node.js hash check
sed -i "${INSERT_LINE}a\\
    # Get hash for ping monitor (if exists) - THIS WAS MISSING!\\
    if [ -f \"/opt/wisptools/epc-ping-monitor.js\" ]; then\\
        ping_monitor_hash=\$(get_file_hash \"/opt/wisptools/epc-ping-monitor.js\")\\
    fi" "$AGENT_FILE"

# Find the line where we add to scripts_json
JSON_LINE=$(grep -n "epc-snmp-discovery.js.*hash.*scripts_json" "$AGENT_FILE" | tail -1 | cut -d: -f1)
if [ -z "$JSON_LINE" ]; then
    echo "ERROR: Could not find scripts_json line"
    exit 1
fi

# Add ping monitor to scripts_json
sed -i "${JSON_LINE}a\\
    [ -n \"\$ping_monitor_hash\" ] && scripts_json=\"\${scripts_json},\\\"epc-ping-monitor.js\\\":{\\\"hash\\\":\\\"\$ping_monitor_hash\\\"}\"" "$AGENT_FILE"

# Verify the patch
if grep -q "epc-ping-monitor.js.*hash.*ping_monitor_hash" "$AGENT_FILE"; then
    echo "✅ Patch applied successfully"
    chmod +x "$AGENT_FILE"
    exit 0
else
    echo "ERROR: Patch verification failed"
    mv "${AGENT_FILE}.backup" "$AGENT_FILE"
    exit 1
fi
