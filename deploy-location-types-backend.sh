#!/bin/bash
# Deploy updated unified-network-schema.js to support NOC, warehouse, vehicle, RMA

echo "🗺️ Deploying Location Types Backend Update..."

# Stop the service
echo "⏸️  Stopping hss-api service..."
sudo systemctl stop hss-api

# Kill any lingering processes
echo "🔪 Killing lingering node processes..."
sudo pkill -9 node
sleep 2

# Backup current schema
echo "💾 Backing up current schema..."
sudo cp /opt/hss-api/unified-network-schema.js /opt/hss-api/unified-network-schema.js.backup-$(date +%s) 2>/dev/null || true

# Copy updated schema
echo "📦 Copying updated schema..."
sudo cp backend-services/unified-network-schema.js /opt/hss-api/

# Verify the file
echo "✅ Verifying schema update..."
if grep -q "warehouse" /opt/hss-api/unified-network-schema.js && \
   grep -q "noc" /opt/hss-api/unified-network-schema.js && \
   grep -q "vehicle" /opt/hss-api/unified-network-schema.js && \
   grep -q "rma" /opt/hss-api/unified-network-schema.js; then
    echo "✅ Schema contains all new location types"
else
    echo "❌ Schema missing location types!"
    exit 1
fi

# Start the service
echo "▶️  Starting hss-api service..."
sudo systemctl start hss-api

# Wait for startup
echo "⏳ Waiting for service to start..."
sleep 5

# Check status
echo "📊 Checking service status..."
sudo systemctl status hss-api --no-pager -l | head -20

# Test the API
echo ""
echo "🧪 Testing API..."
sleep 2
curl -s -H "X-Tenant-ID: test" http://localhost:3001/health | jq . || echo "API not responding yet"

echo ""
echo "✅ Deployment complete!"
echo "💡 Try creating a NOC or vehicle now"

