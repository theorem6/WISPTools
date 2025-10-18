#!/bin/bash
# Unified Network Backend Deployment
# Run this on the GCE VM after pulling from Git

cd /opt/hss-api

echo "🗺️  Deploying Unified Network API..."

# Backup server.js
cp server.js server.js.backup.$(date +%Y%m%d_%H%M%S)

# Copy new files
cp /root/lte-pci-mapper/backend-services/unified-network-schema.js .
cp /root/lte-pci-mapper/backend-services/unified-network-api.js .

# Check if routes already added
if ! grep -q "unified-network-api" server.js; then
  # Add require statement
  sed -i "/const monitoringAPI = require('.\/monitoring-api')/a const unifiedNetworkAPI = require('.\/unified-network-api');" server.js
  
  # Add route
  sed -i "/app.use('\/api\/monitoring', monitoringAPI)/a app.use('\/api\/network', unifiedNetworkAPI);" server.js
  
  echo "✅ Routes added to server.js"
else
  echo "✅ Routes already exist"
fi

# Restart service
systemctl stop hss-api
sleep 2
systemctl start hss-api
sleep 3

# Check status
if systemctl is-active --quiet hss-api; then
  echo "✅ Service running"
  echo ""
  echo "Test: curl -H 'X-Tenant-ID: test' http://localhost:3000/api/network/sites"
else
  echo "❌ Service failed!"
  journalctl -u hss-api -n 30 --no-pager
fi

