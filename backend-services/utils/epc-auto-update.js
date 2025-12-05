/**
 * EPC Auto-Update Utility
 * Checks if remote EPC scripts need to be updated and provides download URLs
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const SCRIPTS_DIR = '/var/www/html/downloads/scripts';
const CENTRAL_SERVER = 'hss.wisptools.io';

/**
 * Get the SHA256 hash of a file
 */
async function getFileHash(filePath) {
  try {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (error) {
    console.error(`[EPC Auto-Update] Error hashing file ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Check if scripts need updating and return update information
 * @param {string} epc_id - The EPC ID
 * @param {Object} currentVersions - Current script versions on the EPC (optional)
 * @returns {Promise<Object>} Update information with script URLs and hashes
 */
async function checkForUpdates(epc_id, currentVersions = {}) {
  const scripts = [
    'epc-checkin-agent.sh',
    'epc-snmp-discovery.sh',
    'epc-snmp-discovery.js',  // Node.js version
    'epc-ping-monitor.js'     // Ping monitoring script
  ];
  
  const updates = {};
  
  for (const scriptName of scripts) {
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    
    try {
      // Check if script exists
      await fs.access(scriptPath);
      
      // Get current hash
      const currentHash = await getFileHash(scriptPath);
      if (!currentHash) {
        console.warn(`[EPC Auto-Update] Failed to hash ${scriptPath}, skipping`);
        continue;
      }
      
      // Get current version from EPC (if provided)
      const currentVersion = currentVersions?.[scriptName] || 
                            (currentVersions?.scripts && currentVersions.scripts[scriptName]) ||
                            null;
      
      // If version doesn't match or doesn't exist, mark for update
      const epcHash = currentVersion?.hash || null;
      
      // Always check for updates - if no hash reported or hash differs, update
      if (!epcHash || epcHash !== currentHash) {
        updates[scriptName] = {
          url: `https://${CENTRAL_SERVER}/downloads/scripts/${scriptName}`,
          hash: currentHash,
          size: (await fs.stat(scriptPath)).size,
          updated: true
        };
        console.log(`[EPC Auto-Update] ${scriptName} needs update. EPC: ${epcHash || 'none'}, Server: ${currentHash}`);
      } else {
        console.log(`[EPC Auto-Update] ${scriptName} is up to date (${currentHash.substring(0, 8)}...)`);
      }
    } catch (error) {
      // Script doesn't exist, skip
      console.warn(`[EPC Auto-Update] Script ${scriptName} not found at ${scriptPath}:`, error.message);
    }
  }
  
  return {
    has_updates: Object.keys(updates).length > 0,
    scripts: updates
  };
}

/**
 * Generate an update command for the EPC to download and update scripts
 * @param {Object} updateInfo - Update information from checkForUpdates
 * @returns {Object} EPC command to execute
 */
function generateUpdateCommand(updateInfo) {
  if (!updateInfo.has_updates) {
    return null;
  }
  
  // Create update script
  const updateScript = Object.entries(updateInfo.scripts).map(([scriptName, info]) => {
    const scriptExt = scriptName.endsWith('.js') ? 'js' : 'sh';
    return `
# Update ${scriptName}
log "Updating ${scriptName}..."
curl -fsSL "${info.url}" -o /opt/wisptools/${scriptName}.tmp
if [ $? -eq 0 ]; then
    mv /opt/wisptools/${scriptName}.tmp /opt/wisptools/${scriptName}
    chmod +x /opt/wisptools/${scriptName}
    log "Updated ${scriptName} successfully"
else
    log "ERROR: Failed to download ${scriptName}"
fi
`;
  }).join('\n');
  
  const fullScript = `#!/bin/bash
# Auto-update script for EPC agent scripts
CONFIG_DIR="/etc/wisptools"
LOG_FILE="/var/log/wisptools-checkin.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [AUTO-UPDATE] $1" | tee -a "$LOG_FILE"
}

${updateScript}

# Restart check-in service if agent was updated
if [ -f /opt/wisptools/epc-checkin-agent.sh ]; then
    systemctl restart wisptools-checkin 2>/dev/null || true
    log "Restarted check-in agent"
fi

log "Auto-update complete"
`;
  
  return {
    command_type: 'script_execution',
    action: 'update_scripts',
    script_content: fullScript,
    priority: 5, // Higher priority for updates (lower number = higher priority)
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  };
}

module.exports = {
  checkForUpdates,
  generateUpdateCommand
};

