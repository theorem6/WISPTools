#!/usr/bin/env bash
set -euo pipefail

echo "[remote] Ensuring repo state..."
if [ -d /opt/lte-pci-mapper ]; then
  cd /opt/lte-pci-mapper
  git fetch origin
  git reset --hard origin/main
else
  sudo mkdir -p /opt/lte-pci-mapper
  sudo chown $(id -u):$(id -g) /opt/lte-pci-mapper
  cd /opt
  git clone https://github.com/theorem6/lte-pci-mapper.git
  cd lte-pci-mapper
fi

echo "[remote] Installing backend dependencies..."
cd backend-services
if [ -f package-lock.json ]; then
  npm ci --omit=dev
else
  npm install --production
fi

echo "[remote] Restarting PM2 service..."
if ! command -v pm2 >/dev/null 2>&1; then
  npm i -g pm2
fi
pm2 delete hss-api || true
pm2 start server.js --name hss-api
pm2 save

echo "[remote] Done."


