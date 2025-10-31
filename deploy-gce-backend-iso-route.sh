#!/bin/bash
# Deploy GCE Backend ISO Route - Quick Deployment Script
# This script deploys the updated epc-deployment route to the GCE server

set -e

GCE_SERVER="136.112.111.167"
GCE_USER="root"
REPO_DIR="/root/lte-pci-mapper"
BACKEND_DIR="/opt/gce-backend"

echo "🚀 Deploying GCE Backend ISO Route..."
echo "======================================"
echo ""
echo "Target: ${GCE_USER}@${GCE_SERVER}"
echo "Backend: ${BACKEND_DIR}"
echo ""

# SSH command to deploy
ssh ${GCE_USER}@${GCE_SERVER} << 'DEPLOY_SCRIPT'
set -e

REPO_DIR="/root/lte-pci-mapper"
BACKEND_DIR="/opt/gce-backend"

echo "📥 Pulling latest code from GitHub..."
cd "$REPO_DIR"
git pull origin main || {
    echo "⚠️  Git pull failed, trying to fetch and reset..."
    git fetch origin main
    git reset --hard origin/main
}

echo "✅ Code updated"
echo ""

echo "📋 Copying updated backend files..."
# Ensure backend directory exists
mkdir -p "$BACKEND_DIR/routes"
mkdir -p "$BACKEND_DIR/logs"

# Copy updated files
if [ -f "$REPO_DIR/gce-backend/routes/epc-deployment.js" ]; then
    cp "$REPO_DIR/gce-backend/routes/epc-deployment.js" "$BACKEND_DIR/routes/"
    echo "✅ Copied epc-deployment.js"
else
    echo "❌ epc-deployment.js not found in repo"
    exit 1
fi

if [ -f "$REPO_DIR/gce-backend/server.js" ]; then
    cp "$REPO_DIR/gce-backend/server.js" "$BACKEND_DIR/"
    echo "✅ Copied server.js"
fi

echo ""

# Check if service is managed by systemd
if systemctl list-units --type=service --all | grep -q "gce-backend.service"; then
    echo "🔄 Restarting gce-backend.service..."
    systemctl daemon-reload
    systemctl restart gce-backend.service
    sleep 2
    
    if systemctl is-active --quiet gce-backend.service; then
        echo "✅ gce-backend.service restarted successfully"
    else
        echo "⚠️  Service might have issues, checking logs..."
        journalctl -u gce-backend.service -n 20 --no-pager
    fi
elif pm2 list | grep -q "epc-api\|gce-backend"; then
    echo "🔄 Restarting PM2 service..."
    pm2 restart epc-api --update-env || pm2 restart gce-backend --update-env
    sleep 2
    pm2 save
    echo "✅ PM2 service restarted"
else
    echo "⚠️  No service found (systemd or PM2). Starting manually..."
    cd "$BACKEND_DIR"
    PORT=3002 node server.js &
    echo "✅ Started manually on port 3002"
fi

echo ""
echo "🧪 Testing endpoint..."
sleep 3

# Test health endpoint
if curl -s http://localhost:3002/health > /dev/null; then
    echo "✅ Health check passed"
else
    echo "⚠️  Health check failed"
fi

# Test the route
if curl -s -X POST http://localhost:3002/api/deploy/generate-epc-iso \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: test" \
    -d '{"siteName":"Test"}' > /dev/null 2>&1; then
    echo "✅ Route /api/deploy/generate-epc-iso is accessible"
else
    echo "⚠️  Route test returned non-zero (might be expected error, check logs)"
fi

echo ""
echo "📊 Service Status:"
if systemctl list-units --type=service --all | grep -q "gce-backend.service"; then
    systemctl status gce-backend.service --no-pager -l | head -10
elif pm2 list | grep -q "epc-api\|gce-backend"; then
    pm2 status
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Check logs:"
echo "   systemctl logs -u gce-backend.service -f"
echo "   or"
echo "   pm2 logs epc-api"
DEPLOY_SCRIPT

echo ""
echo "✅ Deployment script executed on GCE server"
echo ""
echo "🧪 Testing external endpoint..."
sleep 2

if curl -s http://${GCE_SERVER}:3002/health > /dev/null 2>&1; then
    echo "✅ External health check passed"
else
    echo "⚠️  External health check failed (firewall might block port 3002)"
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Test the endpoint:"
echo "  curl -X POST http://${GCE_SERVER}:3002/api/deploy/generate-epc-iso \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'X-Tenant-ID: test' \\"
echo "    -d '{\"siteName\":\"Test Site\"}'"

