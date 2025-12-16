#!/bin/bash
# Install npm packages for EPC SNMP discovery on remote EPCs
# This script installs ping-scanner and net-snmp packages

CENTRAL_SERVER="hss.wisptools.io"
NPM_DIR="/opt/wisptools"
LOG_FILE="/var/log/wisptools-npm-install.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [NPM-INSTALL] $1" | tee -a "$LOG_FILE"
}

log "Installing npm packages for SNMP discovery..."

# Check if Node.js is installed
if ! command -v node >/dev/null 2>&1; then
    log "ERROR: Node.js is not installed"
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    log "ERROR: npm is not installed"
    exit 1
fi

# Create npm directory if it doesn't exist
mkdir -p "$NPM_DIR"
cd "$NPM_DIR"

# Initialize package.json if it doesn't exist
if [ ! -f "package.json" ]; then
    log "Initializing package.json..."
    npm init -y >/dev/null 2>&1 || {
        log "ERROR: Failed to initialize package.json"
        exit 1
    }
fi

# Install packages
# Note: We use native 'ping' command for ping monitoring (no npm package needed)
# Only install net-snmp for SNMP queries

log "Installing net-snmp (SNMP library)..."
npm install --no-save net-snmp >> "$LOG_FILE" 2>&1 || {
    log "ERROR: Failed to install net-snmp"
    exit 1
}

log "Note: Using native 'ping' command for ping monitoring (no npm package required)"

log "npm packages installed successfully"

