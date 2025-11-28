#!/bin/bash
# Complete EPC Update Script
# Downloads and installs all latest scripts and configurations
# Run this on the EPC device: curl -fsSL https://hss.wisptools.io/downloads/scripts/complete-epc-update.sh | sudo bash

CENTRAL_SERVER="hss.wisptools.io"
SCRIPTS_URL="https://${CENTRAL_SERVER}/downloads/scripts"
CONFIG_DIR="/etc/wisptools"
INSTALL_DIR="/opt/wisptools"
LOG_FILE="/var/log/wisptools-checkin.log"

echo "========================================"
echo "Complete EPC Update"
echo "========================================"
echo ""

# Create directories
mkdir -p "$INSTALL_DIR"
mkdir -p "$CONFIG_DIR"

# Function to download and update a script
update_script() {
    local script_name=$1
    local dest_path="$INSTALL_DIR/$script_name"
    
    echo "📥 Downloading $script_name..."
    if curl -fsSL "${SCRIPTS_URL}/${script_name}" -o "${dest_path}.tmp" 2>/dev/null; then
        mv "${dest_path}.tmp" "$dest_path"
        chmod +x "$dest_path"
        echo "✅ Updated $script_name"
        return 0
    else
        echo "❌ Failed to download $script_name"
        rm -f "${dest_path}.tmp"
        return 1
    fi
}

# Update all scripts
echo "Updating scripts..."
echo ""

update_script "epc-checkin-agent.sh"
update_script "epc-snmp-discovery.sh"

# Verify scripts are executable
chmod +x "$INSTALL_DIR"/*.sh 2>/dev/null

echo ""
echo "========================================"
echo "Restarting Services"
echo "========================================"
echo ""

# Restart check-in service if it exists
if systemctl is-active --quiet wisptools-checkin 2>/dev/null; then
    echo "🔄 Restarting wisptools-checkin service..."
    systemctl restart wisptools-checkin
    sleep 2
    if systemctl is-active --quiet wisptools-checkin; then
        echo "✅ Service restarted successfully"
    else
        echo "⚠️  Service restart may have failed, checking status..."
        systemctl status wisptools-checkin --no-pager -l
    fi
else
    echo "⚠️  wisptools-checkin service not running"
    echo "   Starting service..."
    systemctl start wisptools-checkin 2>/dev/null || echo "   Could not start service"
fi

echo ""
echo "========================================"
echo "Verification"
echo "========================================"
echo ""

# Check installed scripts
echo "Installed scripts:"
ls -lh "$INSTALL_DIR"/*.sh 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'

echo ""
echo "Service status:"
systemctl status wisptools-checkin --no-pager -l | head -5

echo ""
echo "========================================"
echo "Next Steps"
echo "========================================"
echo ""
echo "1. Trigger a manual check-in:"
echo "   sudo $INSTALL_DIR/epc-checkin-agent.sh once"
echo ""
echo "2. Watch the logs:"
echo "   tail -f $LOG_FILE"
echo ""
echo "3. Check service status:"
echo "   systemctl status wisptools-checkin"
echo ""
echo "========================================"
echo "✅ Update Complete!"
echo "========================================"

