#!/bin/bash
# Complete backend deployment - all modules
# Handles port conflicts and ensures clean deployment

echo "🚀 Complete Backend Deployment"
echo "=============================="

# Navigate to repository
cd /root/lte-pci-mapper || exit 1

# Pull latest
echo "📥 Pulling latest code..."
git pull origin main

echo ""
echo "🔧 Step 1: Stop all services and clean port 3000..."
systemctl stop hss-api
sleep 2

# Aggressive port cleanup
fuser -k 3000/tcp 2>/dev/null
pkill -9 -f "/opt/hss-api/server.js" 2>/dev/null
sleep 3

# Verify port is free
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ Cannot free port 3000. Manual kill required:"
    echo "   kill -9 $(lsof -ti:3000)"
    exit 1
fi

echo "✅ Port 3000 is free"

echo ""
echo "🔧 Step 2: Copy all backend files..."
cd /opt/hss-api

# Backup server.js
cp server.js server.js.backup-$(date +%Y%m%d-%H%M%S)

# Copy all backend service files
cp /root/lte-pci-mapper/backend-services/unified-network-schema.js .
cp /root/lte-pci-mapper/backend-services/unified-network-api.js .
cp /root/lte-pci-mapper/backend-services/inventory-schema.js .
cp /root/lte-pci-mapper/backend-services/inventory-api.js .

echo "✅ Files copied"

echo ""
echo "🔧 Step 3: Verify file syntax..."
for file in unified-network-schema.js unified-network-api.js inventory-schema.js inventory-api.js; do
    if node --check $file 2>&1; then
        echo "✅ $file - OK"
    else
        echo "❌ $file - SYNTAX ERROR"
        exit 1
    fi
done

echo ""
echo "🔧 Step 4: Register API routes in server.js..."

# Check if routes are already registered
if ! grep -q "unified-network-api" server.js; then
    echo "Adding unified-network-api..."
    sed -i "/const distributedEpcAPI = require('.\/distributed-epc-api')/a const unifiedNetworkAPI = require('.\/unified-network-api');" server.js
    sed -i "/app.use('\/api\/epc', distributedEpcAPI)/a app.use('\/api\/network', unifiedNetworkAPI);" server.js
fi

if ! grep -q "inventory-api" server.js; then
    echo "Adding inventory-api..."
    sed -i "/const distributedEpcAPI = require('.\/distributed-epc-api')/a const inventoryAPI = require('.\/inventory-api');" server.js
    sed -i "/app.use('\/api\/epc', distributedEpcAPI)/a app.use('\/api\/inventory', inventoryAPI);" server.js
fi

echo "✅ Routes registered"

echo ""
echo "🔧 Step 5: Verify server.js syntax..."
if node --check server.js; then
    echo "✅ server.js - OK"
else
    echo "❌ server.js - SYNTAX ERROR"
    echo "Restoring backup..."
    cp server.js.backup-$(date +%Y%m%d-%H%M%S) server.js
    exit 1
fi

echo ""
echo "🔧 Step 6: Start service..."
systemctl start hss-api
sleep 5

# Check service status
if systemctl is-active --quiet hss-api; then
    echo "✅ Service is running!"
    echo ""
    echo "🧪 Testing endpoints..."
    
    echo "Health check:"
    curl -s http://localhost:3000/health | head -n 3
    echo ""
    
    echo "Network sites:"
    curl -s -H "X-Tenant-ID: test" http://localhost:3000/api/network/sites | head -n 5
    echo ""
    
    echo "Inventory stats:"
    curl -s -H "X-Tenant-ID: test" http://localhost:3000/api/inventory/stats | head -n 5
    echo ""
    
    echo "✅ DEPLOYMENT COMPLETE!"
    echo ""
    echo "Available endpoints:"
    echo "  - /api/network/* (Coverage Map)"
    echo "  - /api/inventory/* (Inventory Management)"
    echo "  - /api/epc/* (Distributed EPC)"
    echo "  - /api/monitoring/* (Monitoring)"
else
    echo "❌ Service failed to start!"
    echo ""
    echo "Logs:"
    journalctl -u hss-api -n 30 --no-pager
    exit 1
fi

