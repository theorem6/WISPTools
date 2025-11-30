#!/bin/bash
# Force reset EPC scripts to latest version
# This script downloads and installs all agent scripts directly with correct hashes

EPC_ID="${1:-EPC-CB4C5042}"
BASE_URL="https://hss.wisptools.io/downloads/scripts"
INSTALL_DIR="/opt/wisptools"

# Scripts and their correct hashes from manifest
declare -A SCRIPTS=(
  ["epc-checkin-agent.sh"]="2a7bb5c69d26aae3f793da0766f6219fbec0f3c952ad8efbfb28ef9eb7463181"
  ["epc-snmp-discovery.js"]="b11d13244a256939a9880ba821e06fa3ee04394be6d1a9e22e183339c4d9cc81"
  ["epc-snmp-discovery.sh"]="ba437a014fcedf5a31c414156a090f05145841f6ff50476dce7fbcb77de0fc47"
  ["install-epc-dependencies.sh"]="92855d81de5a334ce07f6a50bd41c9a1dbb3ea8bf1b217cd422dcd2e06b41a80"
)

echo "=== Force Resetting EPC Scripts ==="
echo "EPC: $EPC_ID"
echo ""

# Create install directory if needed
mkdir -p "$INSTALL_DIR"

for script in "${!SCRIPTS[@]}"; do
  expected_hash="${SCRIPTS[$script]}"
  url="${BASE_URL}/${script}"
  install_path="${INSTALL_DIR}/${script}"
  temp_file="/tmp/${script}.$$"
  
  echo "[$script] Downloading..."
  if ! curl -fsSL "$url" -o "$temp_file"; then
    echo "  ERROR: Failed to download $script"
    continue
  fi
  
  echo "[$script] Verifying hash..."
  actual_hash=$(sha256sum "$temp_file" | awk '{print $1}')
  
  if [ "$actual_hash" != "$expected_hash" ]; then
    echo "  ERROR: Hash mismatch!"
    echo "    Expected: $expected_hash"
    echo "    Actual: $actual_hash"
    rm -f "$temp_file"
    continue
  fi
  
  echo "[$script] Hash verified: ${actual_hash:0:16}..."
  
  echo "[$script] Installing..."
  if mv "$temp_file" "$install_path"; then
    chmod 755 "$install_path"
    echo "  ✅ $script installed successfully"
  else
    echo "  ERROR: Failed to install $script"
    rm -f "$temp_file"
  fi
done

echo ""
echo "=== Reset Complete ==="

