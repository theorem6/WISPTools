#!/bin/bash
# Clear old auto-update commands for EPC
# Usage: ./clear-epc-commands.sh EPC-CB4C5042

EPC_ID="${1:-EPC-CB4C5042}"

# Set MONGODB_URI in environment or .env - never commit credentials
MONGODB_URI="${MONGODB_URI:-}"

echo "=== Deleting old auto-update commands for ${EPC_ID} ==="

mongosh "$MONGODB_URI" --quiet --eval "
db.epccommands.deleteMany({
  epc_id: '${EPC_ID}',
  \$or: [
    { script_content: { \$regex: 'Auto-generated update script' } },
    { script_content: { \$regex: '9a95994f1dcc8092037c2df5f28c28ef45535f08f077628152344c0e08df13d2' } },
    { script_content: { \$regex: '1780dd83d5e189e55c690f37062e1c13b17e76505da20e96298ef56bfaf19da6' } },
    { script_content: { \$regex: '5aa0bcc4b95dec66e441c938b132f8e3a7c07533e8db8643ff819d4c03404f58' } }
  ]
}).then(result => {
  print('✅ Deleted ' + result.deletedCount + ' command(s)');
}).catch(err => {
  print('❌ Error: ' + err.message);
  quit(1);
});
"

echo ""
echo "=== Done ==="

