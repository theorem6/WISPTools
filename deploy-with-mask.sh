#!/bin/bash
# Backend deployment with systemd masking
# Prevents systemd from restarting the service during deployment

echo "🚀 Backend Deployment (with systemd mask)"
echo "=========================================="

cd /root/lte-pci-mapper || exit 1
git pull origin main

echo ""
echo "Step 1: MASK the service (prevents ANY restart)..."
systemctl stop hss-api
systemctl mask hss-api  # This is stronger than disable
sleep 3

echo ""
echo "Step 2: Kill ALL processes on port 3000..."
# Kill everything, systemd can't restart because it's masked
while lsof -ti:3000 >/dev/null 2>&1; do
    PIDS=$(lsof -ti:3000)
    echo "Killing: $PIDS"
    kill -9 $PIDS 2>/dev/null
    sleep 1
done

# Double-check with fuser
fuser -k -9 3000/tcp 2>/dev/null
sleep 2

# Verify
if lsof -ti:3000 >/dev/null 2>&1; then
    echo "❌ Still can't free port 3000"
    lsof -i:3000
    systemctl unmask hss-api
    exit 1
fi

echo "✅ Port 3000 is completely free"

echo ""
echo "Step 3: Deploy backend files..."
cd /opt/hss-api

# Backup server.js
BACKUP="server.js.backup-$(date +%Y%m%d-%H%M%S)"
cp server.js "$BACKUP"
echo "Backup: $BACKUP"

# Copy backend files
cp /root/lte-pci-mapper/backend-services/unified-network-schema.js .
cp /root/lte-pci-mapper/backend-services/unified-network-api.js .
cp /root/lte-pci-mapper/backend-services/inventory-schema.js .
cp /root/lte-pci-mapper/backend-services/inventory-api.js .

echo "✅ Files copied"

echo ""
echo "Step 4: Clean server.js and add routes..."

# Remove old route declarations
sed -i '/const unifiedNetworkAPI = require/d' server.js
sed -i '/const inventoryAPI = require/d' server.js
sed -i "/app.use('\/api\/network'/d" server.js
sed -i "/app.use('\/api\/inventory'/d" server.js

# Add requires after monitoring-api
sed -i "/const monitoringAPI = require('.\/monitoring-api');$/a\\
const unifiedNetworkAPI = require('.\/unified-network-api');\\
const inventoryAPI = require('.\/inventory-api');" server.js

# Add routes after monitoring route
sed -i "/app.use('\/api\/monitoring', monitoringAPI);$/a\\
app.use('\/api\/network', unifiedNetworkAPI);\\
app.use('\/api\/inventory', inventoryAPI);" server.js

echo "✅ Routes registered"

# Verify syntax
if ! node --check server.js; then
    echo "❌ Syntax error!"
    cp "$BACKUP" server.js
    systemctl unmask hss-api
    systemctl start hss-api
    exit 1
fi

echo "✅ Syntax valid"

echo ""
echo "Step 5: Unmask and start service..."
systemctl unmask hss-api
systemctl daemon-reload  # Reload systemd config
systemctl start hss-api

# Wait and monitor startup
echo "Waiting for service..."
for i in {1..15}; do
    sleep 1
    if systemctl is-active --quiet hss-api; then
        echo "✅ Service running (${i}s)"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "❌ Timeout waiting for service"
        journalctl -u hss-api -n 50 --no-pager
        exit 1
    fi
done

echo ""
echo "Step 6: Test endpoints..."
sleep 2

echo -n "Health: "
curl -sf http://localhost:3000/health >/dev/null && echo "✅" || echo "❌"

echo -n "Network API: "
curl -sf -H "X-Tenant-ID: test" http://localhost:3000/api/network/sites >/dev/null && echo "✅" || echo "❌"

echo -n "Inventory API: "
curl -sf -H "X-Tenant-ID: test" http://localhost:3000/api/inventory/stats >/dev/null && echo "✅" || echo "❌"

echo ""
echo "=========================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "Service is running on port 3000"
echo "Frontend will auto-deploy from Git in ~10-15 min"
echo ""

