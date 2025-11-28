#!/bin/bash
# Uninstall Node.js and npm from remote EPC
# Removes Node.js, npm, and related packages

set -e

LOG_FILE="/var/log/wisptools-nodejs-uninstall.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [NODEJS-UNINSTALL] $1" | tee -a "$LOG_FILE"
}

log "Starting Node.js and npm uninstallation..."

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_ID="$ID"
else
    log "ERROR: Cannot detect OS"
    exit 1
fi

case "$OS_ID" in
    ubuntu|debian)
        log "Uninstalling Node.js and npm..."
        
        # Remove Node.js packages
        apt-get remove -y nodejs npm 2>/dev/null || true
        apt-get purge -y nodejs npm 2>/dev/null || true
        apt-get autoremove -y 2>/dev/null || true
        
        # Remove NodeSource repository if present
        if [ -f /etc/apt/sources.list.d/nodesource.list ]; then
            rm -f /etc/apt/sources.list.d/nodesource.list
            apt-get update -qq 2>/dev/null || true
        fi
        
        # Remove npm packages directory
        if [ -d /opt/wisptools/node_modules ]; then
            log "Removing npm packages..."
            rm -rf /opt/wisptools/node_modules
        fi
        
        if [ -f /opt/wisptools/package.json ]; then
            rm -f /opt/wisptools/package.json
            rm -f /opt/wisptools/package-lock.json
        fi
        
        log "✅ Node.js and npm uninstalled"
        exit 0
        ;;
    *)
        log "ERROR: Unsupported OS: $OS_ID"
        exit 1
        ;;
esac

