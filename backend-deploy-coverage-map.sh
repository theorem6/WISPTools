#!/bin/bash
# Coverage Map Backend Deployment
# Run this on the GCE VM after pulling from Git

cd /opt/hss-api

echo "🗺️  Deploying Coverage Map Backend..."

# Backup server.js
cp server.js server.js.backup.$(date +%Y%m%d_%H%M%S)

# Copy new files
cp /root/lte-pci-mapper/backend-services/coverage-map-schema.js .
cp /root/lte-pci-mapper/backend-services/coverage-map-api.js .

# Check if routes already added
if ! grep -q "coverage-map-api" server.js; then
  # Add require statement
  sed -i "/const monitoringAPI = require('.\/monitoring-api')/a const coverageMapAPI = require('.\/coverage-map-api');" server.js
  
  # Add route
  sed -i "/app.use('\/api\/monitoring', monitoringAPI)/a app.use('\/api\/coverage-map', coverageMapAPI);" server.js
  
  echo "✅ Routes added to server.js"
else
  echo "✅ Routes already exist"
fi

# Restart service
systemctl restart hss-api
sleep 2

# Check status
if systemctl is-active --quiet hss-api; then
  echo "✅ Service running"
  echo ""
  echo "Test: curl -H 'X-Tenant-ID: test' http://localhost:3000/api/coverage-map/tower-sites"
else
  echo "❌ Service failed!"
  journalctl -u hss-api -n 20 --no-pager
fi

