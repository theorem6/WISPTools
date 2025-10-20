#!/bin/bash
# Deploy Work Order/Ticketing Backend to GCE VM

echo "📋 Deploying Work Order Backend..."

# Stop the service
echo "⏸️  Stopping hss-api service..."
sudo systemctl stop hss-api

# Kill any lingering processes
echo "🔪 Killing lingering node processes..."
sudo pkill -9 node
sleep 2

# Copy schema and API files
echo "📦 Copying work order files..."
sudo cp backend-services/work-order-schema.js /opt/hss-api/
sudo cp backend-services/work-order-api.js /opt/hss-api/

# Add route to server.js (after inventory route)
echo "🔧 Adding work order routes to server.js..."
if ! grep -q "work-order-api" /opt/hss-api/server.js; then
  sudo sed -i "/const inventoryAPI = require('.\/inventory-api');/a\\
const workOrderAPI = require('.\/work-order-api');" /opt/hss-api/server.js

  sudo sed -i "/app.use('\/api\/inventory', inventoryAPI);/a\\
app.use('\/api\/work-orders', workOrderAPI);" /opt/hss-api/server.js
  
  echo "✅ Work order routes added"
else
  echo "ℹ️  Work order routes already exist"
fi

# Verify
echo "✅ Verifying..."
grep "work-order" /opt/hss-api/server.js

# Start the service
echo "▶️  Starting hss-api service..."
sudo systemctl start hss-api

# Wait for startup
echo "⏳ Waiting for service to start..."
sleep 5

# Check status
echo "📊 Service status:"
sudo systemctl status hss-api --no-pager -l | head -20

# Test the API
echo ""
echo "🧪 Testing Work Order API..."
sleep 2
curl -s -H "X-Tenant-ID: test" http://localhost:3001/api/work-orders | jq . || echo "API not responding yet (may need more time)"

echo ""
echo "✅ Work Order Backend Deployment Complete!"
echo "💡 Try creating a work order in the web platform"

