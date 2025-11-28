#!/bin/bash
# Force EPC Update Script
# Manually triggers an update command for a specific EPC device
# Usage: ./force-epc-update.sh <EPC_ID> [TENANT_ID]

EPC_ID=${1:-""}
TENANT_ID=${2:-""}

if [ -z "$EPC_ID" ]; then
    echo "Usage: $0 <EPC_ID> [TENANT_ID]"
    echo "Example: $0 EPC-12345 690abdc14a6f067977986db3"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UTILS_DIR="$SCRIPT_DIR/../utils"
SCRIPTS_DIR="/var/www/html/downloads/scripts"
CENTRAL_SERVER="hss.wisptools.io"

# Load Node.js module to check for updates
NODE_CMD="node -e \"
const { checkForUpdates, generateUpdateCommand } = require('$UTILS_DIR/epc-auto-update');
const { EPCCommand } = require('$SCRIPT_DIR/../models/distributed-epc-schema');
const mongoose = require('mongoose');

(async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wisptools');
    
    // Check for updates (empty versions to force update)
    const updateInfo = await checkForUpdates('$EPC_ID', {});
    
    if (!updateInfo.has_updates) {
      console.log('No updates available for $EPC_ID');
      process.exit(0);
    }
    
    console.log('Updates available:', Object.keys(updateInfo.scripts).join(', '));
    
    // Generate update command
    const updateCommand = generateUpdateCommand(updateInfo);
    
    if (!updateCommand) {
      console.log('Failed to generate update command');
      process.exit(1);
    }
    
    // Create and save command
    const tenantId = '$TENANT_ID' || '690abdc14a6f067977986db3';
    const cmd = new EPCCommand({
      ...updateCommand,
      epc_id: '$EPC_ID',
      tenant_id: tenantId,
      status: 'pending',
      created_at: new Date(),
      description: 'Manual script update: ' + Object.keys(updateInfo.scripts).join(', ')
    });
    
    await cmd.save();
    console.log('Update command queued successfully for $EPC_ID');
    console.log('Command ID:', cmd._id.toString());
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
\""

eval $NODE_CMD

