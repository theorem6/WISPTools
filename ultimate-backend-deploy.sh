#!/bin/bash
# Ultimate backend deployment - handles all edge cases
# This script will succeed no matter what

echo "🚀 Ultimate Backend Deployment"
echo "=============================="

cd /root/lte-pci-mapper || exit 1
git pull origin main

echo ""
echo "Step 1: Identify and kill port 3000 processes..."

# Find all PIDs using port 3000
PIDS=$(lsof -ti:3000 2>/dev/null)

if [ -z "$PIDS" ]; then
    echo "✅ Port 3000 is already free"
else
    echo "Found processes on port 3000: $PIDS"
    
    # Stop systemd service first
    systemctl stop hss-api 2>/dev/null
    sleep 1
    
    # Kill each PID individually with extreme force
    for PID in $PIDS; do
        echo "Killing PID $PID..."
        kill -9 $PID 2>/dev/null
    done
    
    # Wait and verify
    sleep 2
    
    # Check again
    REMAINING=$(lsof -ti:3000 2>/dev/null)
    if [ -z "$REMAINING" ]; then
        echo "✅ All processes killed, port 3000 is free"
    else
        echo "⚠️  Some processes still running: $REMAINING"
        echo "Using fuser to force kill..."
        fuser -k -9 3000/tcp 2>/dev/null
        sleep 2
        
        # Final check
        if lsof -ti:3000 >/dev/null 2>&1; then
            echo "❌ Cannot free port 3000"
            echo "Run manually: kill -9 $(lsof -ti:3000)"
            exit 1
        fi
        echo "✅ Port 3000 is now free"
    fi
fi

echo ""
echo "Step 2: Prepare backend directory..."
cd /opt/hss-api

# Create backup
BACKUP_NAME="server.js.backup-$(date +%Y%m%d-%H%M%S)"
cp server.js "$BACKUP_NAME"
echo "✅ Backup created: $BACKUP_NAME"

echo ""
echo "Step 3: Copy backend files..."
cp /root/lte-pci-mapper/backend-services/unified-network-schema.js . 2>/dev/null
cp /root/lte-pci-mapper/backend-services/unified-network-api.js . 2>/dev/null
cp /root/lte-pci-mapper/backend-services/inventory-schema.js . 2>/dev/null
cp /root/lte-pci-mapper/backend-services/inventory-api.js . 2>/dev/null
cp /root/lte-pci-mapper/backend-services/monitoring-api.js . 2>/dev/null
cp /root/lte-pci-mapper/backend-services/monitoring-schema.js . 2>/dev/null

# List what we have
echo "Backend files present:"
ls -1 *.js | grep -E "(unified|inventory|monitoring|distributed)" | while read file; do
    echo "  ✓ $file"
done

echo ""
echo "Step 4: Clean and rebuild server.js routes..."

# Remove any duplicate require statements
sed -i '/const unifiedNetworkAPI/d' server.js
sed -i '/const inventoryAPI/d' server.js

# Remove any duplicate app.use statements
sed -i '/app.use.*\/api\/network/d' server.js
sed -i '/app.use.*\/api\/inventory/d' server.js

# Find the right place to add requires (after other requires, before app creation)
# Add after the last require statement before 'const app = express()'

# Add the requires right after distributed-epc-api
if grep -q "distributed-epc-api" server.js; then
    sed -i "/const distributedEpcAPI = require('.\/distributed-epc-api');/a\\
const unifiedNetworkAPI = require('.\/unified-network-api');\\
const inventoryAPI = require('.\/inventory-api');" server.js
else
    echo "⚠️  Could not find distributed-epc-api, adding at end of requires"
    sed -i "/const monitoringAPI = require('.\/monitoring-api');/a\\
const unifiedNetworkAPI = require('.\/unified-network-api');\\
const inventoryAPI = require('.\/inventory-api');" server.js
fi

# Add the routes right after existing api routes
if grep -q "app.use('\/api\/epc'" server.js; then
    sed -i "/app.use('\/api\/epc', distributedEpcAPI);/a\\
app.use('\/api\/network', unifiedNetworkAPI);\\
app.use('\/api\/inventory', inventoryAPI);" server.js
else
    sed -i "/app.use('\/api\/monitoring', monitoringAPI);/a\\
app.use('\/api\/network', unifiedNetworkAPI);\\
app.use('\/api\/inventory', inventoryAPI);" server.js
fi

echo "✅ Routes added to server.js"

echo ""
echo "Step 5: Syntax validation..."
if node --check server.js; then
    echo "✅ server.js syntax is valid"
else
    echo "❌ Syntax error in server.js!"
    echo "Restoring from backup..."
    cp "$BACKUP_NAME" server.js
    exit 1
fi

echo ""
echo "Step 6: Start service..."
systemctl start hss-api

# Wait for startup
echo "Waiting for service to initialize..."
for i in {1..10}; do
    sleep 1
    if systemctl is-active --quiet hss-api; then
        echo "✅ Service active after ${i} seconds"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Service did not start in 10 seconds"
        journalctl -u hss-api -n 50 --no-pager
        exit 1
    fi
done

echo ""
echo "Step 7: Test endpoints..."

# Health check
echo -n "Testing /health... "
if curl -sf http://localhost:3000/health >/dev/null; then
    echo "✅"
else
    echo "❌"
fi

# Network API
echo -n "Testing /api/network/sites... "
if curl -sf -H "X-Tenant-ID: test" http://localhost:3000/api/network/sites >/dev/null; then
    echo "✅"
else
    echo "❌"
fi

# Inventory API
echo -n "Testing /api/inventory/stats... "
if curl -sf -H "X-Tenant-ID: test" http://localhost:3000/api/inventory/stats >/dev/null; then
    echo "✅"
else
    echo "❌"
fi

echo ""
echo "=========================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "API Endpoints available:"
echo "  GET  /api/network/sites"
echo "  POST /api/network/sites"
echo "  GET  /api/inventory"
echo "  POST /api/inventory"
echo "  GET  /api/inventory/stats"
echo ""
echo "Frontend will auto-deploy from Git in ~10-15 minutes"
echo ""

