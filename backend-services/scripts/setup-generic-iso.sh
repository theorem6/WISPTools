#!/bin/bash
# Setup Generic ISO - Build and deploy the generic netinstall ISO
# Run this on the GCE server

set -e

echo "[Generic ISO Setup] Building generic netinstall ISO..."

ISO_SCRIPT="/opt/lte-pci-mapper/backend-services/scripts/build-generic-netinstall-iso.sh"

if [ -f "$ISO_SCRIPT" ]; then
  chmod +x "$ISO_SCRIPT"
  "$ISO_SCRIPT"
  
  if [ $? -eq 0 ]; then
    echo "[Generic ISO Setup] Generic ISO built successfully"
    echo "[Generic ISO Setup] ISO location: /var/www/html/downloads/isos/wisptools-epc-generic-netinstall.iso"
  else
    echo "[Generic ISO Setup] ERROR: ISO build failed"
    exit 1
  fi
else
  echo "[Generic ISO Setup] ERROR: ISO build script not found at $ISO_SCRIPT"
  exit 1
fi

