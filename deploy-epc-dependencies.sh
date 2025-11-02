#!/bin/bash
# Deploy EPC dependency fixes to GCE Backend
# This script copies the updated files to the GCE server and restarts the service

set -e

BACKEND_DIR="/opt/hss-api"
REPO_DIR="/root/lte-pci-mapper"
SERVICE_NAME="hss-api"
GCE_IP="136.112.111.167"

echo "🚀 Deploying EPC Dependency Fixes to GCE Backend"
echo "================================================"
echo ""

# Pull latest code
echo "📥 Pulling latest code from GitHub..."
cd "$REPO_DIR"
git pull origin main
echo "✅ Code updated"
echo ""

# Copy updated files
echo "📋 Copying updated EPC deployment files..."

# Copy epc-deployment.js route
if [ -f "$REPO_DIR/gce-backend/routes/epc-deployment.js" ]; then
    mkdir -p "$BACKEND_DIR/routes"
    cp "$REPO_DIR/gce-backend/routes/epc-deployment.js" "$BACKEND_DIR/routes/epc-deployment.js"
    echo "✅ Copied epc-deployment.js"
else
    echo "⚠️  gce-backend/routes/epc-deployment.js not found, trying backend-services..."
    if [ -f "$REPO_DIR/backend-services/routes/epc-deployment.js" ]; then
        mkdir -p "$BACKEND_DIR/routes"
        cp "$REPO_DIR/backend-services/routes/epc-deployment.js" "$BACKEND_DIR/routes/epc-deployment.js"
        echo "✅ Copied backend-services/routes/epc-deployment.js"
    fi
fi

# Copy deployment-helpers.js utility
if [ -f "$REPO_DIR/gce-backend/utils/deployment-helpers.js" ]; then
    mkdir -p "$BACKEND_DIR/utils"
    cp "$REPO_DIR/gce-backend/utils/deployment-helpers.js" "$BACKEND_DIR/utils/deployment-helpers.js"
    echo "✅ Copied deployment-helpers.js"
else
    echo "⚠️  gce-backend/utils/deployment-helpers.js not found"
fi

# Verify syntax
echo ""
echo "🔍 Verifying Node.js syntax..."
if [ -f "$BACKEND_DIR/routes/epc-deployment.js" ]; then
    node -c "$BACKEND_DIR/routes/epc-deployment.js" || {
        echo "❌ Syntax error in epc-deployment.js"
        exit 1
    }
    echo "✅ epc-deployment.js syntax valid"
fi

if [ -f "$BACKEND_DIR/utils/deployment-helpers.js" ]; then
    node -c "$BACKEND_DIR/utils/deployment-helpers.js" || {
        echo "❌ Syntax error in deployment-helpers.js"
        exit 1
    }
    echo "✅ deployment-helpers.js syntax valid"
fi

# Restart service
echo ""
echo "🔄 Restarting $SERVICE_NAME service..."
systemctl daemon-reload
systemctl restart "$SERVICE_NAME"
sleep 3

# Verify service is running
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✅ Service is running"
else
    echo "❌ Service failed to start"
    echo "Checking logs..."
    journalctl -u "$SERVICE_NAME" -n 20 --no-pager
    exit 1
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Backend updated with EPC dependency fixes (cmake, flex, bison)"
echo "Service running at: http://$GCE_IP:3001"
echo ""

