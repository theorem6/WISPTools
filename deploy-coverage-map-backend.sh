#!/bin/bash

# Deploy Coverage Map Backend to GCE VM
# This script updates the backend server with Coverage Map API routes

set -e  # Exit on error

echo "═══════════════════════════════════════════════════════════"
echo "  🗺️  Deploying Coverage Map Backend API"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Configuration
BACKEND_SERVER="root@136.112.111.167"
BACKEND_DIR="/opt/hss-api"
LOCAL_FILES_DIR="./backend-services"

echo "📦 Step 1: Preparing files..."
echo "   • coverage-map-schema.js"
echo "   • coverage-map-api.js"
echo ""

# Check if files exist locally
if [ ! -f "$LOCAL_FILES_DIR/coverage-map-schema.js" ]; then
    echo "❌ Error: coverage-map-schema.js not found"
    exit 1
fi

if [ ! -f "$LOCAL_FILES_DIR/coverage-map-api.js" ]; then
    echo "❌ Error: coverage-map-api.js not found"
    exit 1
fi

echo "📤 Step 2: Uploading files to backend server..."
scp "$LOCAL_FILES_DIR/coverage-map-schema.js" "$BACKEND_SERVER:$BACKEND_DIR/"
scp "$LOCAL_FILES_DIR/coverage-map-api.js" "$BACKEND_SERVER:$BACKEND_DIR/"
echo "   ✅ Files uploaded"
echo ""

echo "🔧 Step 3: Updating backend server..."
ssh "$BACKEND_SERVER" << 'EOF'
  cd /opt/hss-api
  
  echo "   • Checking if server.js needs updating..."
  
  # Check if Coverage Map route is already registered
  if grep -q "coverage-map-api" server.js; then
    echo "   ✅ Coverage Map routes already registered"
  else
    echo "   📝 Adding Coverage Map routes to server.js..."
    
    # Create backup
    cp server.js server.js.backup.$(date +%Y%m%d_%H%M%S)
    
    # Add require statement after other requires
    sed -i "/require('\.\/monitoring-api')/a const coverageMapAPI = require('.\/coverage-map-api');" server.js
    
    # Add route registration after other app.use statements
    sed -i "/app\.use('\/api\/monitoring', monitoringAPI)/a app.use('/api/coverage-map', coverageMapAPI);" server.js
    
    echo "   ✅ Routes added to server.js"
  fi
  
  echo "   • Restarting HSS API service..."
  systemctl restart hss-api
  sleep 3
  
  echo "   • Checking service status..."
  if systemctl is-active --quiet hss-api; then
    echo "   ✅ Service running"
  else
    echo "   ❌ Service failed to start"
    journalctl -u hss-api -n 20 --no-pager
    exit 1
  fi
  
  echo "   • Verifying Coverage Map routes..."
  # Give service time to start
  sleep 2
  
  # Test health endpoint
  if curl -s http://localhost:3000/health > /dev/null; then
    echo "   ✅ Backend responding"
  else
    echo "   ⚠️  Backend not responding - check logs"
  fi
EOF

echo ""
echo "🧪 Step 4: Testing Coverage Map API..."

# Test from local machine
echo "   • Testing tower-sites endpoint..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-Tenant-ID: test" \
  http://136.112.111.167:3000/api/coverage-map/tower-sites)

if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "401" ]; then
  echo "   ✅ Coverage Map API responding (HTTP $RESPONSE)"
else
  echo "   ⚠️  Unexpected response: HTTP $RESPONSE"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ Coverage Map Backend Deployment Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 Summary:"
echo "   • MongoDB collections: TowerSites, Sectors, CPEDevices, NetworkEquipment"
echo "   • API endpoints: /api/coverage-map/*"
echo "   • Backend server: 136.112.111.167:3000"
echo "   • Multi-tenant: Yes (X-Tenant-ID header)"
echo ""
echo "🔍 Verify Deployment:"
echo "   ssh root@136.112.111.167 'systemctl status hss-api'"
echo "   ssh root@136.112.111.167 'journalctl -u hss-api -n 50'"
echo ""
echo "🧪 Test Endpoint:"
echo "   curl -H 'X-Tenant-ID: test' http://136.112.111.167:3000/api/coverage-map/tower-sites"
echo ""
echo "✨ Next Steps:"
echo "   1. Update frontend to use MongoDB service (coverageMapService.mongodb.ts)"
echo "   2. Test Coverage Map module in browser"
echo "   3. Verify data saves to MongoDB Atlas"
echo ""

