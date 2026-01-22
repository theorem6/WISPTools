/**
 * Force Reset EPC - Clear all old commands and queue a fresh reset
 * Usage: node force-reset-epc.js EPC-CB4C5042
 */

const mongoose = require('mongoose');
const { EPCCommand } = require('../models/distributed-epc-schema');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || require('../config/app').mongodb.uri;
const EPC_ID = process.argv[2] || 'EPC-CB4C5042';
const TENANT_ID = process.argv[3] || '690abdc14a6f067977986db3';

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.\n');

    console.log(`=== FORCE RESET for ${EPC_ID} ===\n`);

    // Step 1: Delete ALL script_execution commands
    console.log('Step 1: Deleting ALL old commands...');
    const deleteResult = await EPCCommand.deleteMany({
      epc_id: EPC_ID,
      command_type: 'script_execution'
    });
    console.log(`  ✅ Deleted ${deleteResult.deletedCount} command(s)\n`);

    // Step 2: Load manifest with correct hashes
    console.log('Step 2: Loading manifest with correct hashes...');
    const agentVersionManager = require('../utils/agent-version-manager');
    const manifest = await agentVersionManager.getCurrentManifest();
    
    if (!manifest) {
      throw new Error('Failed to load manifest');
    }
    
    console.log(`  ✅ Manifest loaded (${Object.keys(manifest.scripts).length} scripts)\n`);

    // Step 3: Create reset script with correct hashes
    console.log('Step 3: Creating reset script with correct hashes...');
    const scripts = Object.entries(manifest.scripts || {});
    
    const scriptParts = scripts.map(([scriptName, info]) => {
      // Escape special characters in paths and hashes
      const installPath = (info.install_path || '').replace(/"/g, '\\"');
      const expectedHash = (info.sha256 || '').replace(/"/g, '\\"');
      const chmod = info.chmod || '755';
      
      return `
# Update ${scriptName}
log "  [RESET] Starting update for ${scriptName}..."
if curl -fsSL "${info.url}" -o "/tmp/${scriptName}.tmp" 2>/dev/null; then
    ACTUAL_HASH=$(sha256sum "/tmp/${scriptName}.tmp" 2>/dev/null | awk '{print $1}' | tr -d '\\n\\r')
    if [ -n "$ACTUAL_HASH" ] && [ "$ACTUAL_HASH" = "${expectedHash}" ]; then
        mkdir -p "$(dirname "${installPath}")" 2>/dev/null
        if mv "/tmp/${scriptName}.tmp" "${installPath}" 2>/dev/null; then
            chmod ${chmod} "${installPath}" 2>/dev/null || true
            log "  [RESET] ✅ ${scriptName} updated successfully"
        else
            log "  [RESET] ❌ Failed to install ${scriptName} to ${installPath}"
            rm -f "/tmp/${scriptName}.tmp" 2>/dev/null || true
        fi
    else
        log "  [RESET] ❌ Hash mismatch for ${scriptName}"
        log "    Expected: ${expectedHash}"
        if [ -z "$ACTUAL_HASH" ]; then
            log "    Actual: (failed to calculate)"
        else
            log "    Actual: $ACTUAL_HASH"
        fi
        rm -f "/tmp/${scriptName}.tmp" 2>/dev/null || true
    fi
else
    log "  [RESET] ❌ Failed to download ${scriptName} from ${info.url}"
fi`;
    }).join('\n');

    const resetScript = `#!/bin/bash
# Force Reset All Agent Scripts
# Generated: ${new Date().toISOString()}
set +e  # Don't exit on errors, continue processing all scripts

LOG_FILE="/var/log/wisptools-checkin.log"
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [RESET] $1" | tee -a "$LOG_FILE"
}

log "=== Starting Force Reset of All Agent Scripts ==="
log "Will update ${scripts.length} script(s): ${scripts.map(([n]) => n).join(', ')}"
${scriptParts}
log "=== Reset Complete ==="
`;

    // Step 4: Queue reset command with highest priority
    console.log('Step 4: Queuing reset command...');
    const command = new EPCCommand({
      epc_id: EPC_ID,
      tenant_id: TENANT_ID,
      command_type: 'script_execution',
      priority: -100, // Absolute highest priority (lowest number = executed first)
      script_content: resetScript,
      notes: 'Force reset all agent scripts to latest versions',
      created_by: 'system',
      status: 'pending',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    await command.save();
    console.log(`  ✅ Reset command queued (ID: ${command._id})\n`);

    console.log('=== RESET COMPLETE ===');
    console.log(`\n⚠️  IMPORTANT: The backend is still generating commands with wrong hashes.`);
    console.log(`   To prevent this, the automatic update check must be disabled on the server.`);
    console.log(`   The reset script (priority -100) should run first and update everything.`);
    console.log(`\nNext check-in will execute the reset script.`);
    console.log(`Run: sudo /opt/wisptools/epc-checkin-agent.sh\n`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
