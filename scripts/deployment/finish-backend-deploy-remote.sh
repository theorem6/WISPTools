#!/bin/bash
set -e
TARGET=/opt/lte-pci-mapper/backend-services
PARENT=$(dirname "$TARGET")
sudo mkdir -p "$PARENT" 2>/dev/null
sudo chown -R $USER:$USER "$PARENT" 2>/dev/null
mv "$TARGET" "${TARGET}.bak" 2>/dev/null || true
mv /tmp/backend-services-deploy "$TARGET"
cd "$TARGET" && npm install --omit=dev
command -v pm2 >/dev/null 2>&1 || sudo npm install -g pm2
pm2 reload ecosystem.config.js 2>/dev/null || (cd "$TARGET" && pm2 start ecosystem.config.js)
pm2 save
echo Done.
