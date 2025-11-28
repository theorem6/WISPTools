#!/bin/bash
# Install missing dependencies for EPC/SNMP remote units
# This script installs Node.js/npm and other required components

set -e

LOG_FILE="/var/log/wisptools-install.log"
CENTRAL_SERVER="hss.wisptools.io"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "Starting EPC dependency installation..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    log "ERROR: This script must be run as root (use sudo)"
    exit 1
fi

# Install Node.js and npm if not already installed
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    log "Installing Node.js and npm..."
    
    # Check OS version
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        log "ERROR: Cannot determine OS version"
        exit 1
    fi
    
    if [ "$OS" = "debian" ] || [ "$OS" = "ubuntu" ]; then
        # Install Node.js from NodeSource repository
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
        
        # Verify installation
        if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
            NODE_VERSION=$(node --version)
            NPM_VERSION=$(npm --version)
            log "✅ Node.js $NODE_VERSION and npm $NPM_VERSION installed successfully"
        else
            log "ERROR: Node.js/npm installation failed"
            exit 1
        fi
    else
        log "ERROR: Unsupported OS: $OS"
        exit 1
    fi
else
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    log "✅ Node.js $NODE_VERSION and npm $NPM_VERSION already installed"
fi

# Install required npm packages globally if needed
log "Installing required npm packages..."
npm install -g ping-scanner net-snmp 2>&1 | tee -a "$LOG_FILE" || log "WARNING: Some npm packages may have failed to install"

# Ensure required system packages are installed
log "Installing required system packages..."
apt-get update
apt-get install -y \
    curl \
    wget \
    jq \
    snmp \
    snmpd \
    net-snmp \
    net-snmp-utils \
    nmap \
    2>&1 | tee -a "$LOG_FILE"

# Verify snmpd is installed
if command -v snmpd >/dev/null 2>&1; then
    log "✅ SNMP daemon is installed"
else
    log "ERROR: SNMP daemon installation failed"
    exit 1
fi

# Create directory for scripts if it doesn't exist
mkdir -p /opt/wisptools

log "✅ Dependency installation completed successfully"
log "Installed components:"
log "  - Node.js: $(node --version 2>/dev/null || echo 'N/A')"
log "  - npm: $(npm --version 2>/dev/null || echo 'N/A')"
log "  - snmpd: $(snmpd -v 2>&1 | head -1 || echo 'N/A')"
log "  - jq: $(jq --version 2>/dev/null || echo 'N/A')"

exit 0

