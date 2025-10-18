#!/bin/bash
# Ultimate fix - clean server.js and add routes correctly

cd /opt/hss-api

echo "Stopping service..."
systemctl stop hss-api
sleep 2

echo "Killing all node processes..."
pkill -9 node
sleep 2

echo "Restoring OLDEST backup (original working version)..."
OLDEST=$(ls -tr server.js.backup.* 2>/dev/null | head -1)
if [ -n "$OLDEST" ]; then
  cp "$OLDEST" server.js
  echo "Restored: $OLDEST"
else
  echo "No backup found!"
  exit 1
fi

echo "Adding require statement (line 7, after dotenv)..."
sed -i "7i\\
const unifiedNetworkAPI = require('./unified-network-api');" server.js

echo "Adding route (line 368, before app.listen)..."
sed -i "368i\\
app.use('/api/network', unifiedNetworkAPI);" server.js

echo ""
echo "Verification:"
grep -n "unifiedNetworkAPI" server.js

echo ""
echo "Starting service..."
systemctl start hss-api
sleep 5

echo ""
if systemctl is-active --quiet hss-api; then
  echo "✅ Service running!"
  sleep 2
  RESULT=$(curl -s -H "X-Tenant-ID: test" http://localhost:3000/api/network/sites)
  echo "Test result: $RESULT"
  if [ "$RESULT" = "[]" ]; then
    echo ""
    echo "✅✅✅ SUCCESS!"
  fi
else
  echo "❌ Failed!"
  journalctl -u hss-api -n 20 --no-pager
fi

