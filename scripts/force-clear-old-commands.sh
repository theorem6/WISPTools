#!/bin/bash
# Force clear old update commands with wrong hashes

EPC_ID="${1:-EPC-CB4C5042}"

echo "Force clearing old update commands for EPC: $EPC_ID"

# Connect to MongoDB and delete old commands
mongosh "mongodb+srv://david_peterson_consulting_com:3cG5pF2mK8vQ9xR7@lte-pci-mapper.wjvcc.mongodb.net/lte-pci-mapper?retryWrites=true&w=majority" --quiet <<EOF
db.epccommands.deleteMany({
  epc_id: "$EPC_ID",
  command_type: "script_execution",
  script_content: { \$regex: "Auto-generated update script" }
});

print("Commands cleared. Check the result above.");
EOF

echo "Done. Next check-in will generate new commands with correct hashes."

