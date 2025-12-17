#!/bin/bash
# Deploy improved ping and SNMP monitoring scripts to downloads directory
# This script should be run on the GCE server to make scripts available for auto-update

set -e

REPO_DIR="/opt/lte-pci-mapper"
SCRIPTS_SOURCE_DIR="${REPO_DIR}/backend-services/scripts"
SCRIPTS_DEST_DIR="/var/www/html/downloads/scripts"

echo "🚀 Deploying Improved Monitoring Scripts"
echo "=========================================="
echo ""

# Ensure directories exist
mkdir -p "$SCRIPTS_DEST_DIR"

# Pull latest from git first
if [ -d "$REPO_DIR/.git" ]; then
    echo "📥 Pulling latest code from GitHub..."
    cd "$REPO_DIR"
    git pull origin main || echo "⚠️  Git pull failed, continuing with existing files..."
    echo ""
fi

# Deploy improved ping monitor (replaces epc-ping-monitor.js)
if [ -f "${SCRIPTS_SOURCE_DIR}/epc-ping-monitor.js" ]; then
    echo "📄 Deploying improved ping monitor (epc-ping-monitor.js)..."
    cp "${SCRIPTS_SOURCE_DIR}/epc-ping-monitor.js" "${SCRIPTS_DEST_DIR}/epc-ping-monitor.js"
    chmod +x "${SCRIPTS_DEST_DIR}/epc-ping-monitor.js"
    chown www-data:www-data "${SCRIPTS_DEST_DIR}/epc-ping-monitor.js"
    echo "   ✅ Deployed successfully"
    
    # Show hash for verification
    HASH=$(sha256sum "${SCRIPTS_DEST_DIR}/epc-ping-monitor.js" | cut -d' ' -f1)
    echo "   📋 Hash: ${HASH:0:16}..."
else
    echo "   ❌ Source file not found: ${SCRIPTS_SOURCE_DIR}/epc-ping-monitor.js"
    exit 1
fi

echo ""

# Also ensure other required scripts are present
REQUIRED_SCRIPTS=(
    "epc-checkin-agent.sh"
    "epc-snmp-discovery.sh"
    "epc-snmp-discovery.js"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
    if [ -f "${SCRIPTS_SOURCE_DIR}/${script}" ]; then
        if [ ! -f "${SCRIPTS_DEST_DIR}/${script}" ] || [ "${SCRIPTS_SOURCE_DIR}/${script}" -nt "${SCRIPTS_DEST_DIR}/${script}" ]; then
            echo "📄 Deploying ${script}..."
            cp "${SCRIPTS_SOURCE_DIR}/${script}" "${SCRIPTS_DEST_DIR}/${script}"
            chmod +x "${SCRIPTS_DEST_DIR}/${script}"
            chown www-data:www-data "${SCRIPTS_DEST_DIR}/${script}"
            echo "   ✅ Deployed successfully"
        else
            echo "📄 ${script} is up to date"
        fi
    else
        echo "   ⚠️  Source file not found: ${SCRIPTS_SOURCE_DIR}/${script}"
    fi
done

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo ""
echo "Scripts are now available at:"
echo "   https://hss.wisptools.io/downloads/scripts/"
echo ""
echo "Existing EPCs will automatically receive updates on next check-in"
echo "New EPCs will get the improved scripts during initial setup"
echo ""

