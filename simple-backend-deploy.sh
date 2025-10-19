#!/bin/bash
# Simple backend deployment - no loops, no complexity
# Just stop, deploy, start

echo "🚀 Simple Backend Deployment"
echo "============================"

cd /root/lte-pci-mapper || exit 1
git pull origin main

echo ""
echo "Step 1: Stop service and wait for it to fully stop..."
systemctl stop hss-api

# Wait for systemd to fully stop (important!)
sleep 5

# Check if actually stopped
if systemctl is-active --quiet hss-api; then
    echo "⚠️  Service still active, forcing stop..."
    systemctl kill hss-api
    sleep 3
fi

echo "✅ Service stopped"

echo ""
echo "Step 2: Kill any orphaned processes (ONE TIME ONLY)..."
PIDS=$(lsof -ti:3000 2>/dev/null)
if [ ! -z "$PIDS" ]; then
    echo "Found orphaned processes: $PIDS"
    echo "$PIDS" | xargs kill -9 2>/dev/null
    sleep 2
else
    echo "✅ No orphaned processes"
fi

# One final check
if lsof -ti:3000 >/dev/null 2>&1; then
    echo "❌ Port still in use. Trying one more time..."
    kill -9 $(lsof -ti:3000) 2>/dev/null
    sleep 3
    
    if lsof -ti:3000 >/dev/null 2>&1; then
        echo "❌ Cannot free port. Rebooting might be needed."
        echo "Current port users:"
        lsof -i:3000
        exit 1
    fi
fi

echo "✅ Port 3000 is free"

echo ""
echo "Step 3: Deploy files..."
cd /opt/hss-api

# Backup
cp server.js server.js.backup-now
echo "Backup created"

# Copy files
cp /root/lte-pci-mapper/backend-services/unified-network-schema.js . 2>/dev/null
cp /root/lte-pci-mapper/backend-services/unified-network-api.js . 2>/dev/null
cp /root/lte-pci-mapper/backend-services/inventory-schema.js . 2>/dev/null
cp /root/lte-pci-mapper/backend-services/inventory-api.js . 2>/dev/null

echo "✅ Files copied"

echo ""
echo "Step 4: Update server.js (clean approach)..."

# Remove ALL old references
sed -i '/unifiedNetworkAPI/d' server.js
sed -i '/inventoryAPI/d' server.js

# Add after monitoring API (single insertion point)
if grep -q "monitoringAPI" server.js; then
    # Add requires
    sed -i "/const monitoringAPI = require('.\/monitoring-api');/a\\
const unifiedNetworkAPI = require('.\/unified-network-api');\\
const inventoryAPI = require('.\/inventory-api');" server.js
    
    # Add routes  
    sed -i "/app.use('\/api\/monitoring', monitoringAPI);/a\\
app.use('\/api\/network', unifiedNetworkAPI);\\
app.use('\/api\/inventory', inventoryAPI);" server.js
    
    echo "✅ Routes added"
else
    echo "❌ Cannot find monitoring API"
    exit 1
fi

# Validate
if node --check server.js; then
    echo "✅ Syntax valid"
else
    echo "❌ Syntax error"
    cp server.js.backup-now server.js
    exit 1
fi

echo ""
echo "Step 5: Start service (ONE TIME)..."
systemctl start hss-api

# Wait for startup
echo "Waiting 10 seconds for startup..."
sleep 10

# Check status
if systemctl is-active --quiet hss-api; then
    echo "✅ Service is RUNNING"
    
    # Test
    echo ""
    echo "Testing endpoints..."
    curl -s http://localhost:3000/health
    echo ""
    
    echo "✅ DEPLOYMENT SUCCESSFUL!"
    echo ""
    echo "Available APIs:"
    echo "  /api/network/* (Coverage Map)"
    echo "  /api/inventory/* (Inventory)"
    echo ""
else
    echo "❌ Service failed to start"
    echo ""
    journalctl -u hss-api -n 30 --no-pager
    exit 1
fi

