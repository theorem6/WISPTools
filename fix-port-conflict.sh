#!/bin/bash
# Fix port conflict between GenieACS UI (port 3000) and HSS API
# Solution: Move HSS API to port 3001

echo "🔧 Fixing Port Conflict"
echo "======================"
echo "GenieACS UI: port 3000"
echo "HSS API: port 3001 (new)"
echo ""

# Stop HSS API
systemctl stop hss-api
sleep 2

# Navigate to backend directory
cd /opt/hss-api

# Backup server.js
cp server.js server.js.before-port-change

# Change port from 3000 to 3001
sed -i 's/PORT = process\.env\.PORT || 3000/PORT = process.env.PORT || 3001/g' server.js
sed -i 's/:3000/:3001/g' server.js

echo "✅ Changed HSS API port from 3000 to 3001"

# Verify the change
echo ""
echo "Verifying port change in server.js:"
grep -n "PORT.*3001" server.js | head -3

# Start the service
echo ""
echo "Starting HSS API on port 3001..."
systemctl start hss-api

# Wait for startup
sleep 5

# Check status
if systemctl is-active --quiet hss-api; then
    echo "✅ HSS API is running on port 3001"
    
    # Test the new port
    echo ""
    echo "Testing endpoints on port 3001:"
    curl -s http://localhost:3001/health | head -3
    echo ""
    curl -s -H "X-Tenant-ID: test" http://localhost:3001/api/inventory/stats
    echo ""
    
    echo ""
    echo "=========================================="
    echo "✅ PORT CONFLICT RESOLVED!"
    echo "=========================================="
    echo ""
    echo "Services:"
    echo "  - GenieACS UI: http://localhost:3000"
    echo "  - HSS API: http://localhost:3001"
    echo ""
    echo "⚠️  IMPORTANT: Update hssProxy Cloud Function"
    echo "   to point to port 3001 instead of 3000"
    echo ""
else
    echo "❌ Service failed to start"
    journalctl -u hss-api -n 30 --no-pager
    exit 1
fi

