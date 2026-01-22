#!/bin/bash
# Clear old update commands with incorrect hashes
# This script should be run on the backend server

EPC_ID="${1:-EPC-CB4C5042}"

echo "Clearing old update commands for EPC: $EPC_ID"

# Use MongoDB CLI to delete old commands
mongosh "$MONGODB_URI" --eval "
  const result = db.epccommands.deleteMany({
    epc_id: '$EPC_ID',
    command_type: 'script_execution',
    status: { \\\$in: ['pending', 'sent', 'failed'] },
    script_content: /Auto-generated update script/
  });
  print('Deleted ' + result.deletedCount + ' old update command(s)');
"

echo "Done. Next check-in will generate new commands with correct hashes."

