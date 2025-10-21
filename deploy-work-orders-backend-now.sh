#!/bin/bash
# Deploy Work Orders API to GCE Backend
# Quick deployment for work order endpoints

echo "🚀 Deploying Work Orders API"
echo "============================"

cd /root/lte-pci-mapper || exit 1
git pull origin main

echo ""
echo "Step 1: Stop service..."
systemctl stop hss-api
sleep 2

echo ""
echo "Step 2: Deploy work order files..."
cd /opt/hss-api

# Backup
cp server.js "server.js.backup-$(date +%Y%m%d-%H%M%S)"

# Copy work order files
cp /root/lte-pci-mapper/backend-services/work-order-schema.js .
cp /root/lte-pci-mapper/backend-services/work-order-api.js .

# Verify files exist
if [ -f "work-order-schema.js" ] && [ -f "work-order-api.js" ]; then
    echo "✅ Files copied"
else
    echo "❌ Failed to copy files"
    exit 1
fi

# Check syntax
node --check work-order-schema.js
node --check work-order-api.js

echo ""
echo "Step 3: Update server.js..."

# Add work order API import and route if not already there
if ! grep -q "work-order-api" server.js; then
    echo "Adding work-order-api..."
    sed -i "/const express = require('express')/a const workOrderAPI = require('./work-order-api');" server.js
    
    # Add route
    if grep -q "app.use('/api/users'" server.js; then
        sed -i "/app.use('\/api\/users'/a app.use('/api/work-orders', workOrderAPI);" server.js
    else
        sed -i "/app.use(express.json())/a app.use('/api/work-orders', workOrderAPI);" server.js
    fi
    
    echo "✅ Work order API added to server.js"
else
    echo "✅ Work order API already in server.js"
fi

# Verify syntax
node --check server.js

echo ""
echo "Step 4: Start service..."
systemctl start hss-api
sleep 3

# Check status
if systemctl is-active --quiet hss-api; then
    echo "✅ Service started"
else
    echo "❌ Service failed to start"
    journalctl -u hss-api -n 50 --no-pager
    exit 1
fi

echo ""
echo "Step 5: Test endpoint..."
sleep 2
curl -s http://localhost:3001/health

echo ""
echo "=========================================="
echo "✅ WORK ORDERS API DEPLOYED!"
echo "=========================================="
echo ""
echo "Endpoints available:"
echo "  GET    /api/work-orders"
echo "  POST   /api/work-orders"
echo "  GET    /api/work-orders/:id"
echo "  PUT    /api/work-orders/:id"
echo "  DELETE /api/work-orders/:id"
echo "  GET    /api/work-orders/stats"
echo ""
echo "Help Desk should now work!"
echo "=========================================="

