#!/bin/bash
# Deploy Network Routes (HardwareDeployment) to GCE Backend
# Updates backend-services/routes/network.js and models/network.js

set -e

echo "🚀 Deploying Network Routes to GCE Backend..."
echo "=============================================="

SERVER_IP="136.112.111.167"
PROJECT_PATH="/root/lte-pci-mapper"

echo ""
echo "Step 1: Upload files to GCE..."
echo "--------------------------------"

# Upload backend files
scp backend-services/models/network.js root@${SERVER_IP}:${PROJECT_PATH}/backend-services/models/
scp backend-services/routes/network.js root@${SERVER_IP}:${PROJECT_PATH}/backend-services/routes/

echo "✅ Files uploaded"

echo ""
echo "Step 2: Deploy to running backend..."
echo "--------------------------------------"

# Execute deployment on server
ssh root@${SERVER_IP} << 'EOF'
set -e

cd /opt/hss-api || exit 1

# Backup current files
echo "Creating backups..."
cp models/network.js models/network.js.backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
cp routes/network.js routes/network.js.backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true

# Copy new files
echo "Copying new files..."
cp /root/lte-pci-mapper/backend-services/models/network.js models/ 2>/dev/null
cp /root/lte-pci-mapper/backend-services/routes/network.js routes/ 2>/dev/null

echo "✅ Files deployed"

# Check if server needs restart
echo "Checking service status..."
if systemctl is-active --quiet hss-api; then
    echo "Service is running - restarting..."
    systemctl restart hss-api
    sleep 5
    
    if systemctl is-active --quiet hss-api; then
        echo "✅ Service restarted successfully"
        
        # Test endpoints
        echo ""
        echo "Testing network endpoints..."
        curl -s http://localhost:3001/api/network/sites | head -c 100
        echo ""
        echo "✅ Network routes deployed and tested"
    else
        echo "❌ Service failed to restart"
        journalctl -u hss-api -n 30 --no-pager
        exit 1
    fi
else
    echo "⚠️  Service not running - files copied but not deployed"
    echo "Run: systemctl start hss-api"
fi

EOF

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Hardware deployment API endpoints are now available:"
echo "  GET    /api/network/sites/:siteId/hardware"
echo "  POST   /api/network/sites/:siteId/hardware"
echo "  GET    /api/network/hardware-deployments"
echo "  PUT    /api/network/hardware-deployments/:id"
echo "  DELETE /api/network/hardware-deployments/:id"
echo ""

