#!/bin/bash
# Fix EADDRINUSE error by killing all processes on port 3000

echo "🔧 Fixing port 3000 conflict..."
echo "================================"

# Stop the service first
echo "⏸️  Stopping hss-api service..."
systemctl stop hss-api
sleep 2

# Kill any process using port 3000
echo "🔪 Killing processes on port 3000..."
lsof -ti:3000 | xargs -r kill -9

# Double check - kill any remaining node processes in /opt/hss-api
echo "🔪 Killing any remaining node processes..."
pkill -9 -f "/opt/hss-api/server.js"

# Wait for processes to die
echo "⏳ Waiting for cleanup..."
sleep 3

# Verify port is free
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "❌ Port 3000 is still in use!"
    echo "Remaining processes:"
    lsof -i :3000
    exit 1
else
    echo "✅ Port 3000 is now free"
fi

# Start the service
echo "🚀 Starting hss-api service..."
systemctl start hss-api

# Wait for startup
sleep 5

# Check status
if systemctl is-active --quiet hss-api; then
    echo "✅ Service started successfully!"
    echo ""
    echo "Testing API..."
    curl -s -H "X-Tenant-ID: test" http://localhost:3000/health | head -n 5
    echo ""
    echo "✅ All fixed!"
else
    echo "❌ Service failed to start"
    echo "Checking logs..."
    journalctl -u hss-api -n 20 --no-pager
    exit 1
fi

