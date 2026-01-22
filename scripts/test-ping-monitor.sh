#!/bin/bash
# Test script to manually trigger ping monitoring on EPC
# This helps diagnose why ping metrics aren't being collected

echo "🧪 Testing Ping Monitor Script"
echo "================================"
echo ""

# Check if script exists
if [ ! -f /opt/wisptools/epc-ping-monitor.js ]; then
    echo "❌ ERROR: Ping monitor script not found at /opt/wisptools/epc-ping-monitor.js"
    exit 1
fi

echo "✅ Ping monitor script found"

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "❌ ERROR: Node.js not found"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check device code
if [ -f /etc/wisptools/device-code.env ]; then
    source /etc/wisptools/device-code.env
    echo "✅ Device code from env: $DEVICE_CODE"
elif [ -f /etc/wisptools/device_code ]; then
    DEVICE_CODE=$(cat /etc/wisptools/device_code)
    echo "✅ Device code from file: $DEVICE_CODE"
else
    echo "⚠️  WARNING: Device code not found, script will try to generate from MAC"
fi

echo ""
echo "Running ping monitor cycle..."
echo "----------------------------"
echo ""

# Run the ping monitor
node /opt/wisptools/epc-ping-monitor.js cycle

EXIT_CODE=$?

echo ""
echo "----------------------------"
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Ping monitor completed successfully (exit code: $EXIT_CODE)"
else
    echo "❌ Ping monitor failed (exit code: $EXIT_CODE)"
    echo ""
    echo "Check the log file: /var/log/wisptools-ping-monitor.log"
fi

exit $EXIT_CODE

