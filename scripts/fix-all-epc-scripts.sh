#!/bin/bash
# Fix all EPC scripts directly on the EPC
# Run this on the EPC: ssh wisp@10.0.25.134

set -e

echo "=== Fixing All EPC Scripts ==="
echo ""

# Correct hashes from manifest
declare -A SCRIPTS=(
    ["epc-checkin-agent.sh"]="2a7bb5c69d26aae3f793da0766f6219fbec0f3c952ad8efbfb28ef9eb7463181:755"
    ["epc-snmp-discovery.js"]="b11d13244a256939a9880ba821e06fa3ee04394be6d1a9e22e183339c4d9cc81:644"
    ["epc-snmp-discovery.sh"]="ba437a014fcedf5a31c414156a090f05145841f6ff50476dce7fbcb77de0fc47:755"
    ["install-epc-dependencies.sh"]="92855d81de5a334ce07f6a50bd41c9a1dbb3ea8bf1b217cd422dcd2e06b41a80:755"
)

for SCRIPT in "${!SCRIPTS[@]}"; do
    HASH_CHMOD="${SCRIPTS[$SCRIPT]}"
    EXPECTED_HASH="${HASH_CHMOD%%:*}"
    CHMOD="${HASH_CHMOD##*:}"
    URL="https://hss.wisptools.io/downloads/scripts/$SCRIPT"
    INSTALL_PATH="/opt/wisptools/$SCRIPT"
    
    echo "Updating $SCRIPT..."
    
    # Download
    if curl -fsSL "$URL" -o "/tmp/$SCRIPT.tmp" 2>/dev/null; then
        # Verify hash
        ACTUAL_HASH=$(sha256sum "/tmp/$SCRIPT.tmp" | awk '{print $1}')
        if [ "$ACTUAL_HASH" = "$EXPECTED_HASH" ]; then
            # Install
            sudo mkdir -p "$(dirname "$INSTALL_PATH")"
            sudo mv "/tmp/$SCRIPT.tmp" "$INSTALL_PATH"
            sudo chmod "$CHMOD" "$INSTALL_PATH"
            echo "  ✅ $SCRIPT updated successfully (hash verified)"
        else
            echo "  ❌ Hash mismatch for $SCRIPT"
            echo "    Expected: $EXPECTED_HASH"
            echo "    Actual: $ACTUAL_HASH"
            rm -f "/tmp/$SCRIPT.tmp"
        fi
    else
        echo "  ❌ Failed to download $SCRIPT"
    fi
    echo ""
done

echo "=== Verification ==="
for SCRIPT in "${!SCRIPTS[@]}"; do
    INSTALL_PATH="/opt/wisptools/$SCRIPT"
    if [ -f "$INSTALL_PATH" ]; then
        ACTUAL_HASH=$(sha256sum "$INSTALL_PATH" | awk '{print $1}')
        HASH_CHMOD="${SCRIPTS[$SCRIPT]}"
        EXPECTED_HASH="${HASH_CHMOD%%:*}"
        if [ "$ACTUAL_HASH" = "$EXPECTED_HASH" ]; then
            echo "✅ $SCRIPT: CORRECT ($(echo $ACTUAL_HASH | cut -c1-16)...)"
        else
            echo "⚠️  $SCRIPT: WRONG HASH"
        fi
    else
        echo "❌ $SCRIPT: NOT FOUND"
    fi
done

echo ""
echo "=== Done! ==="

