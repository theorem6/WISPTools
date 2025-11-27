#!/bin/bash
# Setup Generic ISO - Build and deploy the generic live ISO
# Run this on the GCE server
# 
# This builds a LIVE ISO that:
# 1. Boots into a live Debian environment
# 2. Automatically detects local storage (excludes USB boot drive)
# 3. Installs the complete system to local storage
# 4. Reboots into installed system and registers with WISPTools

set -e

echo "[Generic ISO Setup] Building generic live ISO..."
echo "[Generic ISO Setup] This ISO will auto-install to local storage, excluding USB boot drive"

# Use the live ISO builder (creates complete bootable live system)
ISO_SCRIPT="/opt/lte-pci-mapper/backend-services/scripts/build-live-iso.sh"

# Fallback to netinstall if live script doesn't exist
if [ ! -f "$ISO_SCRIPT" ]; then
  echo "[Generic ISO Setup] Live ISO script not found, falling back to netinstall..."
  ISO_SCRIPT="/opt/lte-pci-mapper/backend-services/scripts/build-generic-netinstall-iso.sh"
fi

if [ -f "$ISO_SCRIPT" ]; then
  chmod +x "$ISO_SCRIPT"
  "$ISO_SCRIPT"
  
  if [ $? -eq 0 ]; then
    echo "[Generic ISO Setup] Generic ISO built successfully"
    echo "[Generic ISO Setup] ISO location: /var/www/html/downloads/isos/wisptools-epc-generic-netinstall.iso"
    echo ""
    echo "[Generic ISO Setup] ISO Features:"
    echo "  - Boots into live environment from USB"
    echo "  - Automatically detects and installs to local storage"
    echo "  - Excludes USB boot drive from installation targets"
    echo "  - Requires disk >= 20GB for installation"
    echo "  - Reboots into installed system after completion"
  else
    echo "[Generic ISO Setup] ERROR: ISO build failed"
    exit 1
  fi
else
  echo "[Generic ISO Setup] ERROR: ISO build script not found at $ISO_SCRIPT"
  exit 1
fi

