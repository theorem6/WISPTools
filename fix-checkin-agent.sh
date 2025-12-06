#!/bin/bash
# Fix and Test Check-in Agent Script
# Run this on the remote EPC device: sudo bash fix-checkin-agent.sh
# This script MUST be run with sudo

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "ERROR: This script must be run with sudo"
    echo "Usage: sudo bash $0"
    exit 1
fi

set -e

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [FIX-CHECKIN] $1"
}

log "========================================="
log "Fixing Check-in Agent"
log "========================================="

CENTRAL_SERVER="hss.wisptools.io"
API_URL="https://${CENTRAL_SERVER}/api/epc"
CONFIG_DIR="/etc/wisptools"
LOG_FILE="/var/log/wisptools-checkin.log"
AGENT_SCRIPT="/opt/wisptools/epc-checkin-agent.sh"

# Get device code
get_device_code() {
    if [ -f "$CONFIG_DIR/device-code.env" ]; then
        source "$CONFIG_DIR/device-code.env"
        echo "$DEVICE_CODE"
    elif [ -f "$CONFIG_DIR/device_code" ]; then
        cat "$CONFIG_DIR/device_code"
    else
        ip link show | grep -A1 "state UP" | grep link/ether | head -1 | awk '{print $2}' | tr -d ':' | cut -c1-8 | tr '[:lower:]' '[:upper:]'
    fi
}

DEVICE_CODE=$(get_device_code)
log "Device Code: $DEVICE_CODE"

# Download latest check-in agent from server
log "Downloading latest check-in agent..."
curl -fsSL --max-time 60 --connect-timeout 10 "https://${CENTRAL_SERVER}/downloads/scripts/epc-checkin-agent.sh" -o /tmp/epc-checkin-agent.sh.new 2>&1 || {
    log "WARNING: Failed to download check-in agent, will try to fix existing script"
    
    # Fix syntax errors in existing script
    if [ -f "$AGENT_SCRIPT" ]; then
        log "Fixing syntax errors in existing script..."
        
        # Remove duplicate/malformed code blocks
        sed -i '/rm -f "REPORTEOF/,/REPORTEOF/d' "$AGENT_SCRIPT" 2>/dev/null || true
        sed -i '/echo "\\$(date/,/EOF/d' "$AGENT_SCRIPT" 2>/dev/null || true
        
        # Fix the exit 0 line that might have malformed code
        sed -i 's/rm -f "REPORTEOF.*exit 0/exit 0/g' "$AGENT_SCRIPT" 2>/dev/null || true
        
        log "Syntax fixes applied to existing script"
    else
        log "ERROR: Check-in agent script not found at $AGENT_SCRIPT"
        log "Attempting to download again with verbose output..."
        curl -v "https://${CENTRAL_SERVER}/downloads/scripts/epc-checkin-agent.sh" -o /tmp/epc-checkin-agent.sh.new 2>&1 || {
            log "ERROR: Cannot download or fix check-in agent"
            exit 1
        }
    fi
}

# If we downloaded a new version, replace the old one
if [ -f "/tmp/epc-checkin-agent.sh.new" ]; then
    log "Replacing check-in agent with downloaded version..."
    chmod +x /tmp/epc-checkin-agent.sh.new
    
    # Backup old version
    if [ -f "$AGENT_SCRIPT" ]; then
        cp "$AGENT_SCRIPT" "${AGENT_SCRIPT}.backup.$(date +%Y%m%d_%H%M%S)"
        log "Backed up old version"
    fi
    
    mv /tmp/epc-checkin-agent.sh.new "$AGENT_SCRIPT"
    chmod +x "$AGENT_SCRIPT"
    log "✅ Check-in agent updated"
fi

# Verify script syntax
log "Verifying script syntax..."
if bash -n "$AGENT_SCRIPT" 2>&1; then
    log "✅ Script syntax is valid"
else
    log "ERROR: Script has syntax errors"
    log "Attempting additional fixes..."
    
    # Additional fixes for common issues
    sed -i 's/response=\\$//g' "$AGENT_SCRIPT" 2>/dev/null || true
    sed -i 's/http_code=\\$//g' "$AGENT_SCRIPT" 2>/dev/null || true
    sed -i 's/\\$(date/$(date/g' "$AGENT_SCRIPT" 2>/dev/null || true
    sed -i 's/\\${CMD_ID}/${CMD_ID}/g' "$AGENT_SCRIPT" 2>/dev/null || true
    sed -i 's/\\${API_URL}/${API_URL}/g' "$AGENT_SCRIPT" 2>/dev/null || true
    sed -i 's/\\${DEVICE_CODE}/${DEVICE_CODE}/g' "$AGENT_SCRIPT" 2>/dev/null || true
    sed -i 's/\\${SUCCESS}/${SUCCESS}/g' "$AGENT_SCRIPT" 2>/dev/null || true
    sed -i 's/\\${OUTPUT}/${OUTPUT}/g' "$AGENT_SCRIPT" 2>/dev/null || true
    sed -i 's/\\${ERROR}/${ERROR}/g' "$AGENT_SCRIPT" 2>/dev/null || true
    sed -i 's/\\${EXIT_CODE}/${EXIT_CODE}/g' "$AGENT_SCRIPT" 2>/dev/null || true
    
    if bash -n "$AGENT_SCRIPT" 2>&1; then
        log "✅ Script syntax fixed"
    else
        log "ERROR: Script still has syntax errors after fixes"
        log "Please check the script manually: $AGENT_SCRIPT"
        exit 1
    fi
fi

# Test check-in manually
log "========================================="
log "Testing Check-in"
log "========================================="

log "Running check-in test..."
if [ -f "$AGENT_SCRIPT" ]; then
    # Run check-in in test mode (non-daemon)
    log "Executing: $AGENT_SCRIPT"
    bash "$AGENT_SCRIPT" 2>&1 | head -50 || {
        log "ERROR: Check-in failed"
        log "Last 20 lines of log:"
        tail -20 "$LOG_FILE" 2>/dev/null || echo "Log file not found"
        exit 1
    }
    
    log "✅ Check-in test completed"
else
    log "ERROR: Check-in agent script not found"
    exit 1
fi

# Restart service
log "========================================="
log "Restarting Check-in Service"
log "========================================="

if systemctl is-active --quiet wisptools-checkin 2>/dev/null; then
    log "Restarting wisptools-checkin service..."
    systemctl restart wisptools-checkin
    sleep 2
    
    if systemctl is-active --quiet wisptools-checkin 2>/dev/null; then
        log "✅ Service restarted successfully"
    else
        log "WARNING: Service may not be running properly"
        systemctl status wisptools-checkin --no-pager -l || true
    fi
else
    log "Service not running, attempting to start..."
    systemctl start wisptools-checkin || {
        log "Service failed to start, checking status..."
        systemctl status wisptools-checkin --no-pager -l || true
    }
fi

# Check service status
log "========================================="
log "Service Status"
log "========================================="

systemctl status wisptools-checkin --no-pager -l | head -20 || true

log "========================================="
log "Recent Check-in Logs"
log "========================================="

if [ -f "$LOG_FILE" ]; then
    tail -30 "$LOG_FILE"
else
    log "Log file not found: $LOG_FILE"
fi

log "========================================="
log "Fix and Test Complete"
log "========================================="
log "Check-in agent should now be working"
log "Monitor logs with: tail -f $LOG_FILE"

