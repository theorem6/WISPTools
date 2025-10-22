#!/bin/bash
# Fix backend API registration

set -e

echo "=== Fixing Backend API Registration ==="

# SSH and fix the server.js
ssh root@136.112.111.167 << 'EOF'
cd /opt/hss-api

echo "Current server.js route registrations:"
grep "app.use.*api" server.js || echo "No API routes found!"

echo ""
echo "Checking if user-tenant-api.js exists..."
ls -lh user-tenant-api.js

echo ""
echo "Checking if user-tenant API is registered..."
if grep -q "user-tenant-api" server.js; then
  echo "✓ user-tenant API is already registered"
else
  echo "✗ user-tenant API is NOT registered"
  echo ""
  echo "Showing end of server.js to find where to add it:"
  tail -50 server.js
fi

echo ""
echo "=== Manual Fix Required ==="
echo "Please run these commands on the GCE server:"
echo ""
echo "1. Check what APIs are currently registered:"
echo "   grep -n 'const.*Api = require' /opt/hss-api/server.js"
echo ""
echo "2. Check where app.use is called:"
echo "   grep -n 'app.use.*api' /opt/hss-api/server.js"
echo ""
echo "3. Show the full server.js structure:"
echo "   cat /opt/hss-api/server.js | head -150"

EOF

echo ""
echo "=== Next Steps ==="
echo "Based on the output above, you need to:"
echo "1. Find where other APIs are registered (const workOrderApi = require...)"
echo "2. Add after that line: const userTenantApi = require('./user-tenant-api');"
echo "3. Find where app.use('/api/work-orders', ...) is"
echo "4. Add after that line: app.use('/api/user-tenants', userTenantApi);"
echo "5. Restart: systemctl restart hss-api"

