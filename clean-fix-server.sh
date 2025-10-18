#!/bin/bash
# Clean fix for server.js - restores to working state and adds network route

cd /opt/hss-api

echo "🔧 Clean Fix for Coverage Map Backend"
echo ""

# Stop service and kill zombies
echo "Step 1: Stopping all processes..."
systemctl stop hss-api
sleep 2
pkill -9 node
sleep 2
echo "✅ All stopped"
echo ""

# Find the OLDEST backup (original working version)
echo "Step 2: Finding original backup..."
ORIGINAL_BACKUP=$(ls -tr server.js.backup.* | head -1)
echo "Using backup: $ORIGINAL_BACKUP"
cp "$ORIGINAL_BACKUP" server.js
echo "✅ Restored original"
echo ""

# Add require AFTER the dotenv line
echo "Step 3: Adding require statement..."
sed -i "/require('dotenv').config();/a\\
const unifiedNetworkAPI = require('./unified-network-api');" server.js
echo "✅ Added require"
echo ""

# Add route BEFORE app.listen
echo "Step 4: Adding route registration..."
sed -i "/^app.listen/i\\
app.use('/api/network', unifiedNetworkAPI);\\
" server.js
echo "✅ Added route"
echo ""

# Verify
echo "Step 5: Verifying changes..."
grep -n "unifiedNetworkAPI" server.js
echo ""

# Check syntax
echo "Step 6: Checking syntax..."
node --check server.js
if [ $? -eq 0 ]; then
  echo "✅ Syntax OK"
else
  echo "❌ Syntax error!"
  exit 1
fi
echo ""

# Start service
echo "Step 7: Starting service..."
systemctl start hss-api
sleep 5

if systemctl is-active --quiet hss-api; then
  echo "✅ Service RUNNING!"
  echo ""
  sleep 2
  echo "Step 8: Testing..."
  curl -s -H "X-Tenant-ID: test" http://localhost:3000/api/network/sites
  echo ""
  echo ""
  echo "✅✅✅ If you see [] above, it's working!"
  echo "Refresh your browser!"
else
  echo "❌ Failed!"
  journalctl -u hss-api -n 20 --no-pager
fi

