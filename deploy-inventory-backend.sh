#!/bin/bash
# Deploy Inventory Management Backend
# Run this on the GCE VM (acs-hss-server)

echo "📦 Deploying Inventory Management Backend..."
echo "=============================================="

# Navigate to code repository
cd /root/lte-pci-mapper || exit 1

# Pull latest changes
echo "📥 Pulling latest code..."
git pull origin main

# Navigate to backend directory
cd /opt/hss-api || exit 1

# Backup current server.js
echo "💾 Creating backup..."
cp server.js server.js.backup-$(date +%Y%m%d-%H%M%S)

# Copy inventory files
echo "📋 Copying inventory backend files..."
cp /root/lte-pci-mapper/backend-services/inventory-schema.js .
cp /root/lte-pci-mapper/backend-services/inventory-api.js .

# Verify files
echo "✅ Verifying files..."
if [ ! -f "inventory-schema.js" ] || [ ! -f "inventory-api.js" ]; then
    echo "❌ Error: Inventory files not found"
    exit 1
fi

# Check if inventory API is already registered
if grep -q "inventory-api" server.js; then
    echo "ℹ️  Inventory API already registered in server.js"
else
    echo "📝 Adding inventory API to server.js..."
    
    # Find the line after distributed-epc-api require
    # Add inventory API require
    sed -i "/const distributedEpcAPI = require('.\/distributed-epc-api')/a const inventoryAPI = require('.\/inventory-api');" server.js
    
    # Add inventory API route
    sed -i "/app.use('\/api\/epc', distributedEpcAPI)/a app.use('\/api\/inventory', inventoryAPI);" server.js
    
    echo "✅ Inventory API registered"
fi

# Verify syntax
echo "🔍 Checking Node.js syntax..."
node --check inventory-schema.js
node --check inventory-api.js
node --check server.js

if [ $? -ne 0 ]; then
    echo "❌ Syntax error detected!"
    echo "Restoring from backup..."
    cp server.js.backup-$(date +%Y%m%d-%H%M%S) server.js
    exit 1
fi

# Restart service
echo "🔄 Restarting hss-api service..."
systemctl restart hss-api

# Wait for service to start
echo "⏳ Waiting for service to initialize..."
sleep 5

# Check service status
SERVICE_STATUS=$(systemctl is-active hss-api)
if [ "$SERVICE_STATUS" = "active" ]; then
    echo "✅ Service is running"
    
    # Test API endpoint
    echo ""
    echo "🧪 Testing Inventory API..."
    echo "Testing: curl -H 'X-Tenant-ID: test' http://localhost:3000/api/inventory/stats"
    curl -s -H "X-Tenant-ID: test" http://localhost:3000/api/inventory/stats | head -n 10
    
    echo ""
    echo "✅ Inventory Backend Deployment Complete!"
    echo ""
    echo "📝 Summary:"
    echo "   - inventory-schema.js deployed"
    echo "   - inventory-api.js deployed"
    echo "   - API route registered: /api/inventory"
    echo "   - Service restarted successfully"
    echo ""
    echo "🎯 Available Endpoints:"
    echo "   GET    /api/inventory           - List items"
    echo "   GET    /api/inventory/stats     - Get statistics"
    echo "   GET    /api/inventory/:id       - Get single item"
    echo "   POST   /api/inventory           - Create item"
    echo "   PUT    /api/inventory/:id       - Update item"
    echo "   DELETE /api/inventory/:id       - Delete item"
    echo "   POST   /api/inventory/:id/transfer   - Transfer item"
    echo "   POST   /api/inventory/:id/deploy     - Deploy item"
    echo "   POST   /api/inventory/:id/return     - Return to inventory"
    echo "   GET    /api/inventory/by-site/:siteId - Get equipment at site"
    echo ""
    echo "Frontend will auto-deploy from Git in ~10-15 minutes"
else
    echo "❌ Service failed to start"
    echo "📋 Checking logs..."
    journalctl -u hss-api -n 30 --no-pager
    exit 1
fi

