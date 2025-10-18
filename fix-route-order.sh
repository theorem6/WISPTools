#!/bin/bash
# Fix the route registration order in server.js

cd /opt/hss-api

echo "Fixing server.js route order..."

# Restore clean backup
cp $(ls -t server.js.backup.* | head -1) server.js

# Remove any existing duplicate lines
sed -i '/^app.use(.\/api\/network/d' server.js
sed -i '/Unified Network API/d' server.js

# Add the require statement ONLY (after dotenv, before creating app)
sed -i "/require('dotenv').config()/a\\
const unifiedNetworkAPI = require('./unified-network-api');" server.js

# Add the route registration AFTER line 365 (after system router)
sed -i "365a\\
app.use('/api/network', unifiedNetworkAPI);" server.js

echo "✅ Fixed server.js"
echo ""
echo "Contents around the routes:"
sed -n '360,370p' server.js

echo ""
echo "Starting service..."
systemctl start hss-api
sleep 3

if systemctl is-active --quiet hss-api; then
  echo "✅ Service running!"
  sleep 2
  echo ""
  echo "Testing endpoint:"
  RESULT=$(curl -s -H "X-Tenant-ID: test" http://localhost:3000/api/network/sites)
  echo "$RESULT"
  
  if [ "$RESULT" = "[]" ]; then
    echo ""
    echo "✅✅✅ SUCCESS! Backend is working!"
  fi
else
  echo "❌ Service failed!"
  journalctl -u hss-api -n 20 --no-pager
fi

