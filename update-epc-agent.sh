#!/bin/bash
# Manual EPC Agent Update Script
# Run this on the EPC device to update the check-in agent

set -e

CENTRAL_SERVER="hss.wisptools.io"
AGENT_SCRIPT="/opt/wisptools/epc-checkin-agent.sh"
SERVICE_NAME="wisptools-checkin"
LOG_FILE="/var/log/wisptools-checkin.log"

echo "========================================"
echo "EPC Check-in Agent Update"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Backup current script
if [ -f "$AGENT_SCRIPT" ]; then
    echo "📦 Backing up current agent..."
    cp "$AGENT_SCRIPT" "${AGENT_SCRIPT}.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✅ Backup created"
fi

# Download latest script
echo ""
echo "📥 Downloading latest agent from ${CENTRAL_SERVER}..."
if curl -fsSL "https://${CENTRAL_SERVER}/downloads/scripts/epc-checkin-agent.sh" -o "${AGENT_SCRIPT}.tmp"; then
    echo "✅ Download successful"
    
    # Verify it's a valid script
    if ! bash -n "${AGENT_SCRIPT}.tmp" 2>/dev/null; then
        echo "❌ Downloaded file has syntax errors, restoring backup"
        if [ -f "${AGENT_SCRIPT}.backup."* ]; then
            cp "${AGENT_SCRIPT}.backup."* "$AGENT_SCRIPT" 2>/dev/null || true
        fi
        rm -f "${AGENT_SCRIPT}.tmp"
        exit 1
    fi
    
    # Replace old script
    mv "${AGENT_SCRIPT}.tmp" "$AGENT_SCRIPT"
    chmod +x "$AGENT_SCRIPT"
    echo "✅ Script updated and made executable"
else
    echo "❌ Failed to download agent script"
    exit 1
fi

# Restart service
echo ""
echo "🔄 Restarting ${SERVICE_NAME} service..."
if systemctl restart "$SERVICE_NAME" 2>/dev/null; then
    sleep 2
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo "✅ Service restarted successfully"
    else
        echo "⚠️  Service may not be running, checking status..."
        systemctl status "$SERVICE_NAME" --no-pager -l || true
    fi
else
    echo "⚠️  Failed to restart service (may not be installed)"
    echo "   You can start it manually with: systemctl start $SERVICE_NAME"
fi

# Show recent logs
echo ""
echo "📋 Recent check-in logs:"
echo "----------------------------------------"
tail -n 10 "$LOG_FILE" 2>/dev/null || echo "No log file found"

echo ""
echo "========================================"
echo "✅ Update complete!"
echo "========================================"
echo ""
echo "Check status: systemctl status $SERVICE_NAME"
echo "View logs: tail -f $LOG_FILE"
echo ""

