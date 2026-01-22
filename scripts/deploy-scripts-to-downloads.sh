#!/bin/bash
# Deploy EPC scripts to downloads directory for serving to remote agents
# This ensures scripts are available for download and auto-update

SCRIPTS_SOURCE_DIR="/opt/lte-pci-mapper/backend-services/scripts"
SCRIPTS_DEST_DIR="/var/www/html/downloads/scripts"

echo "📦 Deploying EPC scripts to downloads directory..."
echo "=================================================="
echo ""

# Ensure destination directory exists
mkdir -p "$SCRIPTS_DEST_DIR"

# Scripts to deploy
SCRIPTS=(
    "epc-checkin-agent.sh"
    "epc-snmp-discovery.sh"
    "epc-snmp-discovery.js"
    "epc-ping-monitor.js"
)

DEPLOYED=0
FAILED=0

for script in "${SCRIPTS[@]}"; do
    SOURCE="$SCRIPTS_SOURCE_DIR/$script"
    DEST="$SCRIPTS_DEST_DIR/$script"
    
    if [ -f "$SOURCE" ]; then
        echo "📄 Copying $script..."
        cp "$SOURCE" "$DEST"
        chmod +x "$DEST"
        chown www-data:www-data "$DEST"
        
        if [ $? -eq 0 ]; then
            echo "   ✅ Deployed successfully"
            DEPLOYED=$((DEPLOYED + 1))
        else
            echo "   ❌ Failed to deploy"
            FAILED=$((FAILED + 1))
        fi
    else
        echo "   ⚠️  Source file not found: $SOURCE"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "=================================================="
echo "📊 Summary:"
echo "   Deployed: $DEPLOYED"
echo "   Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "✅ All scripts deployed successfully"
    echo ""
    echo "Scripts are now available at:"
    echo "   https://hss.wisptools.io/downloads/scripts/"
    echo ""
    echo "EPCs will automatically receive updates on next check-in"
    exit 0
else
    echo "❌ Some scripts failed to deploy"
    exit 1
fi

