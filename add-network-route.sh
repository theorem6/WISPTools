#!/bin/bash
# Add the /api/network route registration to server.js

cd /opt/hss-api

echo "Adding /api/network route..."

# Check if route already exists
if grep -q "app.use('/api/network'" server.js; then
  echo "Route already exists!"
else
  # Add after the system-management route or before app.listen
  if grep -q "systemManagementRouter" server.js; then
    # Add after system-management route
    sed -i "/systemManagementRouter/a\\
\\
// Unified Network API\\
app.use('/api/network', unifiedNetworkAPI);" server.js
    echo "✅ Route added after systemManagementRouter"
  else
    # Add before app.listen
    sed -i "/^app.listen/i\\
\\
// Unified Network API\\
app.use('/api/network', unifiedNetworkAPI);\\
" server.js
    echo "✅ Route added before app.listen"
  fi
fi

# Show what was added
echo ""
echo "Verifying routes in server.js:"
grep -n "app.use" server.js | head -10

echo ""
echo "Restarting service..."
systemctl restart hss-api
sleep 3

if systemctl is-active --quiet hss-api; then
  echo "✅ Service running"
  sleep 2
  echo ""
  echo "Testing endpoint:"
  curl -H "X-Tenant-ID: test" http://localhost:3000/api/network/sites
  echo ""
else
  echo "❌ Service failed!"
  journalctl -u hss-api -n 20 --no-pager
fi

