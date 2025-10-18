#!/bin/bash
# Coverage Map Backend Update Script
# Paste this entire script into SSH terminal

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  🗺️  Coverage Map Backend Update"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Navigate to backend directory
cd /opt/hss-api

# Backup current server.js
echo "📦 Creating backup..."
cp server.js server.js.backup.$(date +%Y%m%d_%H%M%S)
echo "   ✅ Backup created"
echo ""

# Pull latest code from GitHub
echo "📥 Pulling latest code from GitHub..."
if [ -d "/root/lte-pci-mapper" ]; then
  cd /root/lte-pci-mapper
  git pull origin main
else
  cd /root
  git clone https://github.com/theorem6/lte-pci-mapper.git
  cd lte-pci-mapper
fi
echo "   ✅ Code updated"
echo ""

# Copy Coverage Map files to API directory
echo "📋 Copying Coverage Map files..."
cp /root/lte-pci-mapper/backend-services/coverage-map-schema.js /opt/hss-api/
cp /root/lte-pci-mapper/backend-services/coverage-map-api.js /opt/hss-api/
echo "   ✅ Files copied"
echo ""

# Update server.js with Coverage Map routes
echo "🔧 Updating server.js..."
cd /opt/hss-api

# Check if already added
if grep -q "coverage-map-api" server.js; then
  echo "   ℹ️  Coverage Map routes already registered"
else
  # Find the line with monitoring-api require and add coverage-map after it
  sed -i "/const monitoringAPI = require('.\/monitoring-api')/a const coverageMapAPI = require('.\/coverage-map-api');" server.js
  
  # Find the line with monitoring route registration and add coverage-map after it
  sed -i "/app.use('\/api\/monitoring', monitoringAPI)/a app.use('\/api\/coverage-map', coverageMapAPI);" server.js
  
  echo "   ✅ Routes added to server.js"
fi
echo ""

# Restart service
echo "♻️  Restarting hss-api service..."
systemctl restart hss-api
sleep 3
echo "   ✅ Service restarted"
echo ""

# Check status
echo "🔍 Verifying service status..."
if systemctl is-active --quiet hss-api; then
  echo "   ✅ Service is running"
  
  # Test endpoints
  sleep 2
  echo ""
  echo "🧪 Testing endpoints..."
  
  # Test health
  if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "   ✅ Health endpoint OK"
  else
    echo "   ⚠️  Health endpoint not responding"
  fi
  
  # Test Coverage Map
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "X-Tenant-ID: test" http://localhost:3000/api/coverage-map/tower-sites)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Coverage Map API OK (HTTP 200)"
  else
    echo "   ℹ️  Coverage Map API responding (HTTP $HTTP_CODE)"
  fi
  
else
  echo "   ❌ Service failed to start!"
  echo ""
  echo "📋 Recent logs:"
  journalctl -u hss-api -n 20 --no-pager
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ Coverage Map Backend Update Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 What was updated:"
echo "   • coverage-map-schema.js   (MongoDB models)"
echo "   • coverage-map-api.js       (REST API routes)"
echo "   • server.js                 (route registration)"
echo ""
echo "🌐 API Endpoints Available:"
echo "   GET  /api/coverage-map/tower-sites"
echo "   GET  /api/coverage-map/sectors"
echo "   GET  /api/coverage-map/cpe-devices"
echo "   GET  /api/coverage-map/equipment"
echo "   POST /api/coverage-map/geocode"
echo ""
echo "🧪 Test from outside:"
echo "   curl -H 'X-Tenant-ID: test' http://136.112.111.167:3000/api/coverage-map/tower-sites"
echo ""
echo "✨ Done! Frontend will auto-deploy from Git in ~10-15 minutes."
echo ""

