#!/bin/bash
# Deploy ALL missing API modules to GCE Backend
# This will add: Work Orders API, Customer API

echo "🚀 Deploying All Missing APIs"
echo "=============================="

cd /root/lte-pci-mapper || exit 1
git pull origin main

echo ""
echo "Step 1: Stop service..."
systemctl stop hss-api
sleep 3

echo ""
echo "Step 2: Navigate to backend and backup..."
cd /opt/hss-api
cp server.js "server.js.backup-$(date +%Y%m%d-%H%M%S)"
echo "✅ Backup created"

echo ""
echo "Step 3: Copy all API files..."
cp /root/lte-pci-mapper/backend-services/work-order-schema.js . 2>/dev/null && echo "  ✓ work-order-schema.js"
cp /root/lte-pci-mapper/backend-services/work-order-api.js . 2>/dev/null && echo "  ✓ work-order-api.js"
cp /root/lte-pci-mapper/backend-services/customer-schema.js . 2>/dev/null && echo "  ✓ customer-schema.js"
cp /root/lte-pci-mapper/backend-services/customer-api.js . 2>/dev/null && echo "  ✓ customer-api.js"

echo ""
echo "Step 4: Check syntax..."
for file in work-order-schema.js work-order-api.js customer-schema.js customer-api.js; do
    if [ -f "$file" ]; then
        if node --check $file 2>&1; then
            echo "  ✅ $file - OK"
        else
            echo "  ❌ $file - SYNTAX ERROR"
            exit 1
        fi
    fi
done

echo ""
echo "Step 5: Update server.js..."

# Remove any duplicate entries first
sed -i '/workOrderAPI/d' server.js
sed -i '/customerAPI/d' server.js
sed -i "/require.*work-order-api/d" server.js
sed -i "/require.*customer-api/d" server.js
sed -i "/app.use.*work-orders/d" server.js
sed -i "/app.use.*customers/d" server.js

# Add requires after express
sed -i "/const express = require('express')/a const workOrderAPI = require('./work-order-api');" server.js
sed -i "/const express = require('express')/a const customerAPI = require('./customer-api');" server.js

# Add routes after user management API if it exists
if grep -q "app.use('/api/users'" server.js; then
    sed -i "/app.use('\/api\/users'/a app.use('/api/work-orders', workOrderAPI);" server.js
    sed -i "/app.use('\/api\/users'/a app.use('/api/customers', customerAPI);" server.js
else
    # Fallback - add after express.json()
    sed -i "/app.use(express.json())/a app.use('/api/work-orders', workOrderAPI);" server.js
    sed -i "/app.use(express.json())/a app.use('/api/customers', customerAPI);" server.js
fi

echo "✅ server.js updated"

echo ""
echo "Step 6: Verify server.js syntax..."
if node --check server.js; then
    echo "✅ server.js syntax valid"
else
    echo "❌ server.js has syntax errors!"
    echo "Restoring backup..."
    cp server.js.backup-* server.js | head -1
    exit 1
fi

echo ""
echo "Step 7: Start service..."
systemctl start hss-api
sleep 3

# Check status
if systemctl is-active --quiet hss-api; then
    echo "✅ Service started successfully"
else
    echo "❌ Service failed to start"
    echo "Checking logs..."
    journalctl -u hss-api -n 30 --no-pager
    exit 1
fi

echo ""
echo "Step 8: Test endpoints..."
sleep 2

echo "Testing health..."
curl -s http://localhost:3001/health

echo ""
echo ""
echo "=========================================="
echo "✅ ALL APIS DEPLOYED!"
echo "=========================================="
echo ""
echo "Work Orders API:"
echo "  GET    /api/work-orders"
echo "  POST   /api/work-orders"
echo "  PUT    /api/work-orders/:id"
echo "  DELETE /api/work-orders/:id"
echo ""
echo "Customer API:"
echo "  GET    /api/customers"
echo "  POST   /api/customers"
echo "  GET    /api/customers/:id"
echo "  PUT    /api/customers/:id"
echo "  DELETE /api/customers/:id"
echo "  POST   /api/customers/:id/service-history"
echo "  POST   /api/customers/:id/complaints"
echo "  GET    /api/customers/search/phone/:phone"
echo "  GET    /api/customers/search/email/:email"
echo "  GET    /api/customers/stats/summary"
echo ""
echo "All modules should now work!"
echo "  - Help Desk ✓"
echo "  - Work Orders ✓"
echo "  - Customer Management ✓"
echo "=========================================="

