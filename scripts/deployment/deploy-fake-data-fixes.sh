#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Deploying fake data fixes to GCE server..."
echo ""

# Configuration
INSTANCE_NAME="acs-hss-server"
ZONE="us-central1-a"
PROJECT="lte-pci-mapper-65450042-bbf71"

echo "📡 Connecting to GCE instance: $INSTANCE_NAME"
echo ""

# Deploy script that will run on the GCE server
DEPLOY_SCRIPT=$(cat <<'DEPLOY_EOF'
#!/bin/bash
set -euo pipefail

echo "🔄 Starting deployment..."
cd /opt/lte-pci-mapper || {
  echo "❌ Directory /opt/lte-pci-mapper not found. Please clone the repo first."
  exit 1
}

echo "📥 Pulling latest code from GitHub..."
git fetch origin
git reset --hard origin/main

echo "✅ Code updated to latest commit:"
git log -1 --oneline

echo ""
echo "🔧 Installing/updating dependencies..."
cd backend-services
npm ci --production || npm install --production

echo ""
echo "🔄 Restarting PM2 services..."
pm2 restart main-api || echo "⚠️  main-api not found, skipping..."
pm2 restart epc-api || echo "⚠️  epc-api not found, skipping..."
pm2 restart hss-api || echo "⚠️  hss-api not found, skipping..."

echo ""
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "🧹 Running cleanup script to remove fake data..."
cd /opt/lte-pci-mapper/backend-services/scripts
node cleanup-fake-data.js || {
  echo "⚠️  Cleanup script failed or no fake data found"
}

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Check PM2 status: pm2 status"
echo "2. Check logs: pm2 logs main-api --lines 50"
echo "3. Verify API is working: curl http://localhost:3000/api/health"
DEPLOY_EOF
)

# Execute the deployment script on the remote server
gcloud compute ssh "$INSTANCE_NAME" \
  --zone="$ZONE" \
  --tunnel-through-iap \
  --command="bash -s" <<< "$DEPLOY_SCRIPT"

echo ""
echo "✅ Backend deployment to GCE complete!"

