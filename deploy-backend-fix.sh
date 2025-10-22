#!/bin/bash
set -e

cd /opt/hss-api

# Pull latest code
git pull

# Copy the API file
cp /root/lte-pci-mapper/backend-services/user-tenant-api.js .

# Add the require line after workOrdersApi
sed -i '/const workOrdersApi = require/a const userTenantApi = require('\''./user-tenant-api'\'');' server.js

# Add the app.use line after work-orders route
sed -i '/app.use.*\/api\/work-orders/a app.use('\''/api/user-tenants'\'', userTenantApi);' server.js

# Restart service
systemctl restart hss-api

# Wait and check status
sleep 3
systemctl status hss-api --no-pager -l

