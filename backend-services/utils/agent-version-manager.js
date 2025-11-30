/**
 * Agent Version Manager
 * Manages version checking and update commands for EPC agent scripts
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

// Try multiple possible paths for the manifest file
const MANIFEST_PATH = (() => {
  const possiblePaths = [
    path.join(__dirname, '../agent-manifest.json'), // Standard location (relative to utils/)
    path.join(process.cwd(), 'agent-manifest.json'), // Current working directory
    '/home/david_peterson_consulting_com/lte-wisp-backend/agent-manifest.json', // Server location
  ];
  
  // Check which path exists and return it
  const fs = require('fs');
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        return p;
      }
    } catch (e) {
      // Continue to next path
    }
  }
  
  // Default to first path if none found
  return possiblePaths[0];
})();
const DOWNLOAD_BASE_URL = 'https://hss.wisptools.io/downloads/scripts';

/**
 * Load the agent manifest
 * Tries multiple possible paths to find the manifest file
 */
async function loadManifest() {
  const possiblePaths = [
    path.join(__dirname, '../agent-manifest.json'), // Standard location (relative to utils/)
    path.join(process.cwd(), 'agent-manifest.json'), // Current working directory
    '/home/david_peterson_consulting_com/lte-wisp-backend/agent-manifest.json', // Server location
  ];
  
  for (const manifestPath of possiblePaths) {
    try {
      await fs.access(manifestPath);
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);
      console.log(`[Agent Version Manager] Loaded manifest from: ${manifestPath}`);
      // Log first script hash for debugging
      const firstScript = Object.keys(manifest.scripts || {})[0];
      if (firstScript && manifest.scripts[firstScript]) {
        console.log(`[Agent Version Manager] Sample hash from manifest: ${firstScript} = ${manifest.scripts[firstScript].sha256?.substring(0, 16)}...`);
      }
      return manifest;
    } catch (error) {
      // Try next path
      continue;
    }
  }
  
  console.error('[Agent Version Manager] Failed to load manifest from any path:', possiblePaths);
  return null;
}

/**
 * Get current version manifest (from file - use hashes as-is, don't recalculate)
 * The manifest file should be kept in sync with the actual files on the server
 */
async function getCurrentManifest() {
  const manifest = await loadManifest();
  if (!manifest) {
    return null;
  }
  
  // Use the manifest as-is - hashes should match what's actually on the server
  // The manifest is updated via update-agent-manifest.js script
  // We trust the hashes in the manifest file rather than recalculating from local files
  // since local files might differ from what's served from /downloads/scripts/
  
  return manifest;
}

/**
 * Compare agent script versions and determine which need updates
 * @param {Object} currentVersions - Current versions from agent (may be nested in .scripts or flat)
 * @param {Object} serverVersions - Server manifest with scripts
 */
function compareVersions(currentVersions, serverVersions) {
  const updatesNeeded = [];
  
  // Normalize currentVersions - it might be the scripts object directly or nested
  const currentScripts = currentVersions?.scripts || currentVersions || {};
  
  console.log(`[Agent Version Manager] Comparing versions:`, {
    currentScriptsKeys: Object.keys(currentScripts),
    serverScriptsKeys: Object.keys(serverVersions?.scripts || {})
  });
  
  for (const [scriptName, serverInfo] of Object.entries(serverVersions.scripts || {})) {
    // Current version from agent (nested in scripts or direct)
    const currentInfo = currentScripts[scriptName];
    
    if (!currentInfo || !currentInfo.hash) {
      // Script doesn't exist on agent or has no hash - add it
      console.log(`[Agent Version Manager] Script ${scriptName} needs install (missing on agent)`);
      updatesNeeded.push({
        script: scriptName,
        action: 'install',
        current_version: null,
        server_version: serverInfo.version,
        server_hash: serverInfo.sha256,
        info: serverInfo
      });
    } else if (currentInfo.hash !== serverInfo.sha256) {
      // Hash mismatch - update needed
      console.log(`[Agent Version Manager] Script ${scriptName} needs update:`, {
        current: currentInfo.hash?.substring(0, 16) + '...',
        server: serverInfo.sha256?.substring(0, 16) + '...'
      });
      updatesNeeded.push({
        script: scriptName,
        action: 'update',
        current_version: currentInfo.version || currentInfo.hash?.substring(0, 8),
        server_version: serverInfo.version,
        current_hash: currentInfo.hash,
        server_hash: serverInfo.sha256,
        info: serverInfo
      });
    } else {
      console.log(`[Agent Version Manager] Script ${scriptName} is up to date (hash: ${currentInfo.hash.substring(0, 16)}...)`);
    }
  }
  
  return updatesNeeded;
}

/**
 * Create update command for a script
 */
function createUpdateCommand(epcId, tenantId, updateInfo) {
  const { script, action, server_hash, info } = updateInfo;
  
  const updateScript = `#!/bin/bash
# Auto-generated update script for ${script}
# Action: ${action}
# Server version: ${updateInfo.server_version}
# Server hash: ${server_hash}

set -e
LOG_FILE="/var/log/wisptools-checkin.log"
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [UPDATE] $1" | tee -a "$LOG_FILE"
}

INSTALL_PATH="${info.install_path}"
DOWNLOAD_URL="${info.url}"
EXPECTED_HASH="${server_hash}"
TEMP_FILE="/tmp/${script}.$$"

log "Updating ${script} (${action})..."
log "  Download URL: $DOWNLOAD_URL"
log "  Install path: $INSTALL_PATH"
log "  Expected hash: $EXPECTED_HASH"

# Create install directory if needed
mkdir -p "$(dirname "$INSTALL_PATH")"

# Download the script
log "  Downloading ${script}..."
if command -v curl &> /dev/null; then
    DOWNLOAD_CMD="curl -fsSL"
elif command -v wget &> /dev/null; then
    DOWNLOAD_CMD="wget -qO-"
else
    log "ERROR: Neither curl nor wget available"
    exit 1
fi

if ! $DOWNLOAD_CMD "$DOWNLOAD_URL" > "$TEMP_FILE"; then
    log "ERROR: Failed to download ${script}"
    rm -f "$TEMP_FILE"
    exit 1
fi

# Verify hash if provided
if [ -n "$EXPECTED_HASH" ] && command -v sha256sum &> /dev/null; then
    ACTUAL_HASH=$(sha256sum "$TEMP_FILE" | awk '{print $1}')
    if [ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]; then
        log "ERROR: Hash mismatch for ${script}"
        log "  Expected: $EXPECTED_HASH"
        log "  Actual: $ACTUAL_HASH"
        rm -f "$TEMP_FILE"
        exit 1
    fi
    log "  Hash verified: $ACTUAL_HASH"
fi

# Install the script
log "  Installing to $INSTALL_PATH..."
if mv "$TEMP_FILE" "$INSTALL_PATH"; then
    chmod ${info.chmod || '755'} "$INSTALL_PATH"
    log "  ${script} ${action === 'install' ? 'installed' : 'updated'} successfully"
    
    # If this is the check-in agent, notify that a restart is needed
    if [ "$script" = "epc-checkin-agent.sh" ]; then
        log "  NOTE: Check-in agent updated. Systemd service will use new version on next check-in."
    fi
    
    exit 0
else
    log "ERROR: Failed to install ${script}"
    rm -f "$TEMP_FILE"
    exit 1
fi
`;

  return {
    epc_id: epcId,
    tenant_id: tenantId,
    command_type: 'script_execution',
    priority: 2, // Medium priority (higher than regular commands, lower than emergency)
    script_content: updateScript,
    notes: `Auto-update ${action} for ${script} (${updateInfo.current_version || 'none'} -> ${updateInfo.server_version})`,
    created_by: 'system',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  };
}

/**
 * Check for updates and queue update commands
 * @param {string} epcId - EPC ID
 * @param {string} tenantId - Tenant ID
 * @param {Object} currentVersions - Current script versions from agent (may be flat scripts object or nested)
 */
async function checkAndQueueUpdates(epcId, tenantId, currentVersions) {
  const EPCCommand = require('../models/distributed-epc-schema').EPCCommand;
  const serverVersions = await getCurrentManifest();
  
  if (!serverVersions) {
    console.warn('[Agent Version Manager] Could not load server manifest, skipping update check');
    return [];
  }
  
  console.log(`[Agent Version Manager] Checking updates for EPC ${epcId}`);
  console.log(`[Agent Version Manager] Agent reported scripts:`, currentVersions ? Object.keys(currentVersions).join(', ') : 'none');
  
  const updatesNeeded = compareVersions(currentVersions, serverVersions);
  
  console.log(`[Agent Version Manager] Found ${updatesNeeded.length} update(s) needed`);
  
  if (updatesNeeded.length === 0) {
    console.log(`[Agent Version Manager] EPC ${epcId} has all scripts up to date`);
    return [];
  }
  
  console.log(`[Agent Version Manager] EPC ${epcId} needs ${updatesNeeded.length} update(s):`, 
    updatesNeeded.map(u => `${u.script} (${u.action})`).join(', '));
  
  // Queue update commands
  const commands = [];
  for (const update of updatesNeeded) {
    // Check if update command already exists for this script
    // Skip if there's a pending/sent command OR a recently completed one (within last hour)
    // BUT allow failed commands to be re-queued (they might have wrong hashes)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const existingCommand = await EPCCommand.findOne({
      epc_id: epcId,
      $or: [
        { status: { $in: ['pending', 'sent'] }, notes: new RegExp(`Auto-update.*${update.script}`) },
        { status: 'completed', created_at: { $gte: oneHourAgo }, notes: new RegExp(`Auto-update.*${update.script}`) }
      ]
    });
    
    if (existingCommand) {
      console.log(`[Agent Version Manager] Update command for ${update.script} already exists (status: ${existingCommand.status}), skipping`);
      continue;
    }
    
    // If there's a failed command with wrong hash, delete it so we can create a new one
    const failedCommand = await EPCCommand.findOne({
      epc_id: epcId,
      status: 'failed',
      notes: new RegExp(`Auto-update.*${update.script}`)
    });
    
    if (failedCommand) {
      console.log(`[Agent Version Manager] Found failed update command for ${update.script}, deleting it to allow retry with correct hash`);
      await EPCCommand.deleteOne({ _id: failedCommand._id });
    }
    
    const commandData = createUpdateCommand(epcId, tenantId, update);
    const command = new EPCCommand(commandData);
    await command.save();
    commands.push(command);
    
    console.log(`[Agent Version Manager] Queued ${update.action} command for ${update.script} (command ${command._id})`);
  }
  
  return commands;
}

module.exports = {
  loadManifest,
  getCurrentManifest,
  compareVersions,
  createUpdateCommand,
  checkAndQueueUpdates
};

