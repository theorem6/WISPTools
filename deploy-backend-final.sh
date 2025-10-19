#!/bin/bash
# Final backend deployment - handles systemd auto-restart
# The issue: systemd keeps restarting the service when we kill it

echo "🚀 Backend Deployment (Systemd-Safe)"
echo "===================================="

cd /root/lte-pci-mapper || exit 1
git pull origin main

echo ""
echo "Step 1: Disable auto-restart temporarily..."
# Stop and disable the service (prevents auto-restart)
systemctl stop hss-api
systemctl disable hss-api
sleep 2

echo ""
echo "Step 2: Kill any remaining processes..."
# Now kill any remaining processes (systemd won't restart them)
PIDS=$(lsof -ti:3000 2>/dev/null)
if [ ! -z "$PIDS" ]; then
    echo "Killing remaining processes: $PIDS"
    kill -9 $PIDS 2>/dev/null
    sleep 2
fi

# Use fuser as backup
fuser -k -9 3000/tcp 2>/dev/null
sleep 2

# Final verification
if lsof -ti:3000 >/dev/null 2>&1; then
    echo "❌ Port still in use!"
    lsof -i:3000
    echo "Re-enabling service..."
    systemctl enable hss-api
    exit 1
fi

echo "✅ Port 3000 is free"

echo ""
echo "Step 3: Deploy backend files..."
cd /opt/hss-api

# Backup
cp server.js "server.js.pre-deploy-$(date +%Y%m%d-%H%M%S)"

# Copy files
echo "Copying schema and API files..."
cp /root/lte-pci-mapper/backend-services/unified-network-schema.js .
cp /root/lte-pci-mapper/backend-services/unified-network-api.js .
cp /root/lte-pci-mapper/backend-services/inventory-schema.js .
cp /root/lte-pci-mapper/backend-services/inventory-api.js .

# Verify files exist
for file in unified-network-schema.js unified-network-api.js inventory-schema.js inventory-api.js; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file MISSING!"
        exit 1
    fi
done

echo ""
echo "Step 4: Update server.js..."

# Clean existing references
sed -i '/require.*unified-network-api/d' server.js
sed -i '/require.*inventory-api/d' server.js
sed -i "/app.use('\/api\/network'/d" server.js
sed -i "/app.use('\/api\/inventory'/d" server.js

# Find where to insert (after monitoring-api require)
if grep -q "monitoringAPI = require" server.js; then
    # Add requires
    sed -i "/const monitoringAPI = require('.\/monitoring-api');$/a\\
const unifiedNetworkAPI = require('.\/unified-network-api');\\
const inventoryAPI = require('.\/inventory-api');" server.js
    
    # Add routes
    sed -i "/app.use('\/api\/monitoring', monitoringAPI);$/a\\
app.use('\/api\/network', unifiedNetworkAPI);\\
app.use('\/api\/inventory', inventoryAPI);" server.js
    
    echo "✅ Routes added after monitoring API"
else
    echo "❌ Could not find monitoring API in server.js"
    echo "Please check server.js structure"
    systemctl enable hss-api
    exit 1
fi

echo ""
echo "Step 5: Validate syntax..."
if node --check server.js 2>&1; then
    echo "✅ server.js syntax valid"
else
    echo "❌ Syntax error detected!"
    node --check server.js
    systemctl enable hss-api
    exit 1
fi

echo ""
echo "Step 6: Re-enable and start service..."
systemctl enable hss-api
systemctl start hss-api

# Wait for startup (max 15 seconds)
echo "Waiting for service to start..."
for i in {1..15}; do
    sleep 1
    if systemctl is-active --quiet hss-api; then
        echo "✅ Service started after ${i} seconds"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "❌ Service failed to start"
        journalctl -u hss-api -n 50 --no-pager
        exit 1
    fi
done

echo ""
echo "Step 7: Test endpoints..."
sleep 3

echo "Testing /health..."
curl -s http://localhost:3000/health
echo ""

echo "Testing /api/network/sites..."
curl -s -H "X-Tenant-ID: test" http://localhost:3000/api/network/sites | head -n 5
echo ""

echo "Testing /api/inventory/stats..."
curl -s -H "X-Tenant-ID: test" http://localhost:3000/api/inventory/stats | head -n 5
echo ""

echo "=========================================="
echo "✅ DEPLOYMENT SUCCESSFUL!"
echo "=========================================="
echo ""
echo "Backend API is now running with:"
echo "  - Coverage Map API (/api/network/*)"
echo "  - Inventory API (/api/inventory/*)"
echo "  - Monitoring API (/api/monitoring/*)"
echo "  - Distributed EPC API (/api/epc/*)"
echo ""

