#!/bin/bash
# Deploy user-tenant API to GCE backend

set -e

echo "=== Deploying User-Tenant API to GCE Backend ==="

# Copy the new API file
echo "Copying user-tenant-api.js..."
scp backend-services/user-tenant-api.js root@136.112.111.167:/opt/hss-api/

# SSH and register the API in server.js if not already registered
echo "Registering API in server.js..."
ssh root@136.112.111.167 << 'EOF'
cd /opt/hss-api

# Check if user-tenant API is already registered
if ! grep -q "user-tenant-api" server.js; then
  echo "Adding user-tenant API to server.js..."
  
  # Find the line with work-order-api and add user-tenant-api after it
  sed -i '/workOrdersApi = require/a const userTenantApi = require('"'"'./user-tenant-api'"'"');' server.js
  sed -i '/app.use.*\/api\/work-orders/a app.use('"'"'/api/user-tenants'"'"', userTenantApi);' server.js
  
  echo "✓ Registered user-tenant API"
else
  echo "✓ User-tenant API already registered"
fi

# Restart the service
echo "Restarting hss-api service..."
systemctl restart hss-api

# Wait a moment
sleep 3

# Check status
systemctl status hss-api --no-pager -l

echo "✓ Deployment complete!"
EOF

echo ""
echo "=== Deployment Complete ==="
echo "Test the API:"
echo "curl https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/api/user-tenants/YOUR_USER_ID"

