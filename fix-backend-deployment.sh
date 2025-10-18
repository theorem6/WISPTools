#!/bin/bash
# Fix Backend Deployment - Run on GCE VM
# This script fixes the Coverage Map backend deployment

set -e  # Exit on error

echo "═══════════════════════════════════════════════════════════"
echo "  🔧 Fixing Coverage Map Backend Deployment"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Step 1: Kill any zombie processes on port 3000
echo "🧹 Step 1: Cleaning up zombie processes..."
if lsof -t -i:3000 > /dev/null 2>&1; then
  echo "   Found processes on port 3000, killing them..."
  kill -9 $(lsof -t -i:3000) || echo "   No processes to kill"
  sleep 2
  echo "   ✅ Port 3000 cleared"
else
  echo "   ✅ Port 3000 is free"
fi
echo ""

# Step 2: Pull latest code
echo "📥 Step 2: Pulling latest code from GitHub..."
cd /root/lte-pci-mapper
git pull origin main
echo "   ✅ Code updated"
echo ""

# Step 3: Copy unified network files
echo "📋 Step 3: Copying unified network files..."
cd /opt/hss-api
cp /root/lte-pci-mapper/backend-services/unified-network-schema.js .
cp /root/lte-pci-mapper/backend-services/unified-network-api.js .

if [ -f "unified-network-schema.js" ] && [ -f "unified-network-api.js" ]; then
  echo "   ✅ Files copied successfully"
else
  echo "   ❌ Files not found!"
  exit 1
fi
echo ""

# Step 4: Update server.js
echo "🔧 Step 4: Updating server.js..."

# Create backup
cp server.js server.js.backup.$(date +%Y%m%d_%H%M%S)
echo "   ✅ Backup created"

# Check if routes already exist
if grep -q "unified-network-api" server.js; then
  echo "   ℹ️  Routes already registered in server.js"
else
  echo "   📝 Adding routes to server.js..."
  
  # Add require statement after monitoring-api
  if grep -q "monitoringAPI = require" server.js; then
    sed -i "/const monitoringAPI = require('.\/monitoring-api')/a const unifiedNetworkAPI = require('.\/unified-network-api');" server.js
    echo "   ✅ Require statement added"
  else
    echo "   ⚠️  Could not find monitoring-api require, adding at end of requires"
    # Add before the app.use statements
    sed -i "/^app\.use/i const unifiedNetworkAPI = require('.\/unified-network-api');" server.js
  fi
  
  # Add route registration after monitoring route
  if grep -q "app.use('/api/monitoring'" server.js; then
    sed -i "/app.use('\/api\/monitoring', monitoringAPI)/a app.use('\/api\/network', unifiedNetworkAPI);" server.js
    echo "   ✅ Route registration added"
  else
    echo "   ⚠️  Could not find monitoring route, adding manually"
    sed -i "/^app\.listen/i app.use('/api/network', unifiedNetworkAPI);" server.js
  fi
fi
echo ""

# Step 5: Verify server.js changes
echo "🔍 Step 5: Verifying server.js..."
if grep -q "unified-network-api" server.js && grep -q "/api/network" server.js; then
  echo "   ✅ Routes properly registered"
else
  echo "   ❌ Routes not found in server.js!"
  echo "   Please add manually:"
  echo "   const unifiedNetworkAPI = require('./unified-network-api');"
  echo "   app.use('/api/network', unifiedNetworkAPI);"
  exit 1
fi
echo ""

# Step 6: Start the service
echo "🚀 Step 6: Starting hss-api service..."
systemctl start hss-api
sleep 3
echo ""

# Step 7: Check service status
echo "🔍 Step 7: Checking service status..."
if systemctl is-active --quiet hss-api; then
  echo "   ✅ Service is running!"
  
  # Wait for service to fully start
  sleep 2
  
  # Test the health endpoint
  echo ""
  echo "🧪 Step 8: Testing endpoints..."
  
  if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "   ✅ Health endpoint OK"
  else
    echo "   ⚠️  Health endpoint not responding"
  fi
  
  # Test unified network endpoint
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "X-Tenant-ID: test" http://localhost:3000/api/network/sites)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Unified Network API OK (HTTP 200)"
    
    # Show the response
    echo ""
    echo "   📊 Test response:"
    curl -s -H "X-Tenant-ID: test" http://localhost:3000/api/network/sites | head -c 200
    echo ""
  else
    echo "   ⚠️  Unexpected response: HTTP $HTTP_CODE"
  fi
  
else
  echo "   ❌ Service failed to start!"
  echo ""
  echo "📋 Last 30 lines of logs:"
  journalctl -u hss-api -n 30 --no-pager
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ Backend Deployment Successful!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 Deployed:"
echo "   • unified-network-schema.js (MongoDB models)"
echo "   • unified-network-api.js (Express routes)"
echo "   • /api/network/* endpoints"
echo ""
echo "🌐 API Endpoints:"
echo "   GET  /api/network/sites"
echo "   GET  /api/network/sectors"
echo "   GET  /api/network/cpe"
echo "   GET  /api/network/equipment"
echo "   POST /api/network/geocode"
echo ""
echo "🧪 Test from outside:"
echo "   curl -H 'X-Tenant-ID: test' http://136.112.111.167:3000/api/network/sites"
echo ""
echo "✨ Refresh your browser - Coverage Map should work now!"
echo ""

