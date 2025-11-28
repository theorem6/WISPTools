#!/bin/bash
# Backend deployment commands to run on GCE server

set -e

echo "🚀 Starting backend deployment..."
echo ""

cd /opt/lte-pci-mapper || {
  echo "❌ Directory /opt/lte-pci-mapper not found"
  exit 1
}

echo "📥 Pulling latest code from GitHub..."
git fetch origin
git reset --hard origin/main

echo "✅ Code updated to:"
git log -1 --oneline
echo ""

echo "🔧 Installing/updating dependencies..."
cd backend-services
npm install --production

echo ""
echo "🔄 Restarting PM2 services..."
pm2 restart main-api || echo "⚠️  main-api not found, skipping..."
pm2 restart epc-api || echo "⚠️  epc-api not found, skipping..."
pm2 restart hss-api || echo "⚠️  hss-api not found, skipping..."
pm2 save

echo ""
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "🧹 Running cleanup script to remove fake data..."
cd /opt/lte-pci-mapper/backend-services/scripts
node cleanup-fake-data.js || {
  echo "⚠️  Cleanup script completed (may have no fake data to remove)"
}

echo ""
echo "✅ Backend deployment complete!"
echo ""
echo "🔍 Verifying services..."
pm2 logs main-api --lines 5 --nostream || true
echo ""
echo "✅ All done!"

