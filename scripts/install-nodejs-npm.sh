#!/bin/bash
# Install Node.js and npm on remote EPC
# Used for CDP/LLDP discovery and enhanced SNMP functionality

set -e

LOG_FILE="/var/log/wisptools-nodejs-install.log"
CENTRAL_SERVER="hss.wisptools.io"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [NODEJS-INSTALL] $1" | tee -a "$LOG_FILE"
}

log "Starting Node.js and npm installation..."

# Check if already installed
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    log "Node.js $NODE_VERSION and npm $NPM_VERSION already installed"
    exit 0
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_ID="$ID"
    OS_VERSION="$VERSION_ID"
else
    log "ERROR: Cannot detect OS"
    exit 1
fi

log "Detected OS: $OS_ID $OS_VERSION"

# Install Node.js based on OS
case "$OS_ID" in
    ubuntu|debian)
        log "Installing Node.js 18.x LTS from NodeSource..."
        
        # Install prerequisites
        apt-get update -qq
        apt-get install -y curl gnupg2 ca-certificates lsb-release >/dev/null 2>&1
        
        # Add NodeSource repository
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash - 2>&1 | tee -a "$LOG_FILE"
        
        # Install Node.js
        apt-get install -y nodejs >/dev/null 2>&1
        
        # Verify installation
        if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
            NODE_VERSION=$(node --version)
            NPM_VERSION=$(npm --version)
            log "✅ Node.js $NODE_VERSION and npm $NPM_VERSION installed successfully"
            
            # Install npm packages for SNMP discovery
            log "Installing npm packages for SNMP discovery..."
            cd /opt/wisptools
            if [ ! -f "package.json" ]; then
                npm init -y >/dev/null 2>&1
            fi
            
            npm install --no-save ping-scanner net-snmp >/dev/null 2>&1 || {
                log "WARNING: Failed to install npm packages"
                exit 1
            }
            
            log "✅ npm packages installed successfully"
            exit 0
        else
            log "ERROR: Installation verification failed"
            exit 1
        fi
        ;;
    *)
        log "ERROR: Unsupported OS: $OS_ID"
        exit 1
        ;;
esac

