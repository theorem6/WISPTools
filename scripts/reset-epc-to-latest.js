/**
 * Reset EPC to Latest Scripts
 * Clears all old update commands and queues a direct update with correct hashes
 */

const mongoose = require('mongoose');
const { EPCCommand } = require('../models/distributed-epc-schema');
const agentVersionManager = require('../utils/agent-version-manager');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || require('../config/app').mongodb.uri;
const EPC_ID = process.argv[2] || 'EPC-CB4C5042';

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find EPC to get tenant_id
    const { RemoteEPC } = require('../models/distributed-epc-schema');
    const epc = await RemoteEPC.findOne({ epc_id: EPC_ID }).lean();
    
    if (!epc) {
      console.error(`EPC ${EPC_ID} not found`);
      process.exit(1);
    }

    const tenantId = epc.tenant_id;
    console.log(`\nResetting EPC: ${EPC_ID} (Tenant: ${tenantId})\n`);

    // Step 1: Delete all old update commands
    console.log('Step 1: Clearing old update commands...');
    const deleteResult = await EPCCommand.deleteMany({
      epc_id: EPC_ID,
      command_type: 'script_execution',
      script_content: { $regex: 'Auto-generated update script' }
    });
    console.log(`  ✅ Deleted ${deleteResult.deletedCount} old command(s)\n`);

    // Step 2: Get manifest with correct hashes
    console.log('Step 2: Loading manifest...');
    const manifest = await agentVersionManager.getCurrentManifest();
    if (!manifest) {
      console.error('  ❌ Failed to load manifest');
      process.exit(1);
    }
    console.log(`  ✅ Manifest loaded (${Object.keys(manifest.scripts).length} scripts)\n`);

    // Step 3: Create inline script that downloads all scripts directly
    console.log('Step 3: Creating reset script...');
    const resetScript = createResetScript(manifest);
    
    // Step 4: Queue the reset script
    console.log('Step 4: Queuing reset command...');
    const command = new EPCCommand({
      epc_id: EPC_ID,
      tenant_id: tenantId,
      command_type: 'script_execution',
      priority: -10, // Absolute highest priority
      script_content: resetScript,
      notes: 'Force reset all agent scripts to latest versions',
      created_by: 'system',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    await command.save();
    console.log(`  ✅ Reset command queued (ID: ${command._id})\n`);

    console.log('=== Reset Complete ===');
    console.log(`Next check-in will execute the reset script and update all scripts.`);
    console.log(`Run: sudo /opt/wisptools/epc-checkin-agent.sh`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

function createResetScript(manifest) {
  const scripts = Object.entries(manifest.scripts || {});
  
  let scriptParts = scripts.map(([scriptName, info]) => {
    return `
# Update ${scriptName}
log "  [RESET] Updating ${scriptName}..."
curl -fsSL "${info.url}" -o "/tmp/${scriptName}.tmp"
if [ $? -eq 0 ]; then
    ACTUAL_HASH=$(sha256sum "/tmp/${scriptName}.tmp" | awk '{print $1}')
    if [ "$ACTUAL_HASH" = "${info.sha256}" ]; then
        mkdir -p "$(dirname "${info.install_path}")"
        mv "/tmp/${scriptName}.tmp" "${info.install_path}"
        chmod ${info.chmod || '755'} "${info.install_path}"
        log "  [RESET] ✅ ${scriptName} updated successfully"
    else
        log "  [RESET] ❌ Hash mismatch for ${scriptName}"
        log "    Expected: ${info.sha256}"
        log "    Actual: $ACTUAL_HASH"
        rm -f "/tmp/${scriptName}.tmp"
    fi
else
    log "  [RESET] ❌ Failed to download ${scriptName}"
fi`;
  }).join('\n');

  return `#!/bin/bash
# Force Reset All Agent Scripts
# Generated: ${new Date().toISOString()}

LOG_FILE="/var/log/wisptools-checkin.log"
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [RESET] $1" | tee -a "$LOG_FILE"
}

log "=== Starting Force Reset of All Agent Scripts ==="
${scriptParts}
log "=== Reset Complete ==="
`;
}

main();

