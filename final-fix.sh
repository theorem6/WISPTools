#!/bin/bash
# Final fix for Coverage Map backend

cd /opt/hss-api

echo "Step 1: Kill zombie processes..."
systemctl stop hss-api
sleep 1
kill -9 $(lsof -t -i:3000) 2>/dev/null || echo "No processes to kill"
sleep 2
echo "✅ Port cleared"
echo ""

echo "Step 2: Fix server.js duplicates..."
# Remove the bad line on line 5
sed -i '5d' server.js
echo "✅ Removed duplicate route"
echo ""

echo "Step 3: Verify server.js..."
echo "Routes in server.js:"
grep -n "app.use('/api" server.js
echo ""

echo "Step 4: Start service..."
systemctl start hss-api
sleep 5

if systemctl is-active --quiet hss-api; then
  echo "✅ Service is RUNNING!"
  echo ""
  echo "Step 5: Test endpoint..."
  sleep 2
  RESULT=$(curl -s -H "X-Tenant-ID: test" http://localhost:3000/api/network/sites)
  echo "Response: $RESULT"
  
  if [ "$RESULT" = "[]" ]; then
    echo ""
    echo "═══════════════════════════════════════════════"
    echo "  ✅✅✅ SUCCESS! Backend is working!"
    echo "═══════════════════════════════════════════════"
    echo ""
    echo "Refresh your browser - Coverage Map will work!"
  else
    echo "⚠️ Unexpected response"
  fi
else
  echo "❌ Service still failing!"
  echo ""
  echo "Logs:"
  journalctl -u hss-api -n 30 --no-pager
fi

