#!/bin/bash
set -e
TARGET=/opt/lte-pci-mapper/backend-services
PARENT=$(dirname "$TARGET")
sudo mkdir -p "$PARENT" 2>/dev/null || true
sudo chown -R "$USER":"$USER" "$PARENT" 2>/dev/null || true
sudo rm -rf "${TARGET}.bak"
sudo mv "$TARGET" "${TARGET}.bak" 2>/dev/null || true
sudo mv /tmp/backend-services-deploy "$TARGET"
sudo chown -R "$USER":"$USER" "$TARGET"
# Preserve server .env so INTERNAL_API_KEY, MONGODB_URI, etc. are not lost
if [ -f "${TARGET}.bak/.env" ]; then
  cp "${TARGET}.bak/.env" "$TARGET/.env"
  echo "Preserved .env from previous deploy"
fi
cd "$TARGET" && npm install --omit=dev
command -v pm2 >/dev/null 2>&1 || sudo npm install -g pm2
pm2 reload ecosystem.config.js 2>/dev/null || (cd "$TARGET" && pm2 start ecosystem.config.js)
pm2 save || true
echo "Backend deployment complete."
