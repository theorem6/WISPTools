#!/bin/bash
# Direct fix for EPC - updates all scripts with correct hashes
# Run this on the EPC: ssh wisp@10.0.25.134

EPC_IP="10.0.25.134"
EPC_USER="wisp"
EPC_PASS="wisp123"

# Correct hashes from manifest
declare -A SCRIPTS=(
    ["epc-checkin-agent.sh"]="2a7bb5c69d26aae3f793da0766f6219fbec0f3c952ad8efbfb28ef9eb7463181"
    ["epc-snmp-discovery.js"]="b11d13244a256939a9880ba821e06fa3ee04394be6d1a9e22e183339c4d9cc81"
    ["epc-snmp-discovery.sh"]="ba437a014fcedf5a31c414156a090f05145841f6ff50476dce7fbcb77de0fc47"
    ["install-epc-dependencies.sh"]="92855d81de5a334ce07f6a50bd41c9a1dbb3ea8bf1b217cd422dcd2e06b41a80"
)

echo "=== Fixing EPC Scripts Directly ==="
echo "SSH to: $EPC_USER@$EPC_IP"
echo ""

# Use sshpass for password authentication
if ! command -v sshpass &> /dev/null; then
    echo "Installing sshpass..."
    sudo apt-get update && sudo apt-get install -y sshpass
fi

for SCRIPT in "${!SCRIPTS[@]}"; do
    EXPECTED_HASH="${SCRIPTS[$SCRIPT]}"
    URL="https://hss.wisptools.io/downloads/scripts/$SCRIPT"
    INSTALL_PATH="/opt/wisptools/$SCRIPT"
    
    echo "Updating $SCRIPT..."
    
    sshpass -p "$EPC_PASS" ssh -o StrictHostKeyChecking=no "$EPC_USER@$EPC_IP" << EOF
        echo "Downloading $SCRIPT..."
        curl -fsSL "$URL" -o "/tmp/$SCRIPT.tmp"
        
        if [ \$? -eq 0 ]; then
            ACTUAL_HASH=\$(sha256sum "/tmp/$SCRIPT.tmp" | awk '{print \$1}')
            if [ "\$ACTUAL_HASH" = "$EXPECTED_HASH" ]; then
                sudo mkdir -p \$(dirname "$INSTALL_PATH")
                sudo mv "/tmp/$SCRIPT.tmp" "$INSTALL_PATH"
                sudo chmod 755 "$INSTALL_PATH"
                echo "✅ $SCRIPT updated successfully (hash verified)"
            else
                echo "❌ Hash mismatch for $SCRIPT"
                echo "  Expected: $EXPECTED_HASH"
                echo "  Actual: \$ACTUAL_HASH"
                rm -f "/tmp/$SCRIPT.tmp"
            fi
        else
            echo "❌ Failed to download $SCRIPT"
        fi
EOF
    
    echo ""
done

echo "=== All scripts updated ==="

