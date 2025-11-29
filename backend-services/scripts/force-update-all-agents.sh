#!/bin/bash
#
# Force Update All Agent Scripts
# Downloads and installs all agent scripts from the server manifest
# Run this on the EPC device: curl -fsSL https://hss.wisptools.io/downloads/scripts/force-update-all-agents.sh | sudo bash
#

set -e

CENTRAL_SERVER="hss.wisptools.io"
MANIFEST_URL="https://${CENTRAL_SERVER}/api/agent/manifest"
INSTALL_DIR="/opt/wisptools"
LOG_FILE="/var/log/wisptools-force-update.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [FORCE-UPDATE] $1" | tee -a "$LOG_FILE"
}

log "Starting force update of all agent scripts"

# Create install directory
mkdir -p "$INSTALL_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

# Fetch manifest
log "Fetching agent manifest from ${MANIFEST_URL}..."
MANIFEST=$(curl -s -f "${MANIFEST_URL}")

if [ $? -ne 0 ] || [ -z "$MANIFEST" ]; then
    log "ERROR: Failed to fetch manifest from server"
    exit 1
fi

log "Manifest received successfully"

# Parse manifest and update each script
echo "$MANIFEST" | jq -r '.scripts | to_entries[] | "\(.key)|\(.value.url)|\(.value.sha256)|\(.value.install_path)|\(.value.chmod)"' | while IFS='|' read -r script_name url expected_hash install_path chmod; do
    log "Processing script: $script_name"
    log "  URL: $url"
    log "  Expected hash: ${expected_hash:0:16}..."
    log "  Install path: $install_path"
    log "  Permissions: $chmod"
    
    # Download script
    log "  Downloading script..."
    TEMP_FILE=$(mktemp)
    if ! curl -fsSL "$url" -o "$TEMP_FILE"; then
        log "  ERROR: Failed to download $script_name"
        rm -f "$TEMP_FILE"
        continue
    fi
    
    # Verify hash
    ACTUAL_HASH=$(sha256sum "$TEMP_FILE" | cut -d' ' -f1)
    log "  Actual hash: ${ACTUAL_HASH:0:16}..."
    
    if [ "$ACTUAL_HASH" != "$expected_hash" ]; then
        log "  WARNING: Hash mismatch! Expected: ${expected_hash:0:16}..., Got: ${ACTUAL_HASH:0:16}..."
        log "  Continuing anyway (force update)..."
    else
        log "  ✓ Hash verified"
    fi
    
    # Create directory if needed
    INSTALL_DIR_PATH=$(dirname "$install_path")
    mkdir -p "$INSTALL_DIR_PATH"
    
    # Install script
    log "  Installing to $install_path..."
    if cp "$TEMP_FILE" "$install_path"; then
        log "  ✓ Installed successfully"
        
        # Set permissions
        if [ -n "$chmod" ]; then
            chmod "$chmod" "$install_path"
            log "  ✓ Set permissions to $chmod"
        fi
        
        # If it's the checkin agent, make sure it's executable
        if [[ "$script_name" == *"checkin-agent"* ]]; then
            chmod +x "$install_path"
            log "  ✓ Made checkin agent executable"
        fi
    else
        log "  ERROR: Failed to install script"
    fi
    
    # Cleanup
    rm -f "$TEMP_FILE"
    log "  Completed: $script_name"
    log ""
done

log "Force update completed successfully"
log "Scripts installed to: $INSTALL_DIR"
log ""
log "Next steps:"
log "  1. Run a check-in: sudo $INSTALL_DIR/epc-checkin-agent.sh"
log "  2. The server should now detect all scripts are up to date"

