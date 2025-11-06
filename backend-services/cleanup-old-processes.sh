#!/bin/bash
#
# Cleanup Script - Remove old/conflicting API processes
# Ensures only PM2-managed services are running
#

echo "=========================================="
echo "API Services Cleanup"
echo "=========================================="
echo ""

# Find all node processes running server.js files
echo "Finding all Node.js server processes..."
ps aux | grep 'node.*server.js' | grep -v grep
echo ""

# Kill root-owned processes on ports 3001 and 3002
echo "Killing root-owned processes on ports 3001 and 3002..."
sudo lsof -ti:3001 -u root | xargs -r sudo kill -9 2>/dev/null
sudo lsof -ti:3002 -u root | xargs -r sudo kill -9 2>/dev/null
sleep 2

# Kill all root-owned node server processes
echo "Killing root-owned Node.js server processes..."
sudo pkill -9 -f 'node.*server.js' -u root 2>/dev/null
sleep 2

# Verify ports are free
echo ""
echo "Checking port status..."
sudo lsof -i:3001 -i:3002 | grep LISTEN || echo "Ports 3001 and 3002 are free"
echo ""

# Restart PM2 services
echo "Restarting PM2 services..."
cd /opt/gce-backend
pm2 delete all 2>/dev/null
pm2 start ecosystem.config.js
sleep 5

# Show status
echo ""
echo "PM2 Status:"
pm2 status

echo ""
echo "Health Checks:"
curl -s http://localhost:3001/health && echo " ✅ Main API"
curl -s http://localhost:3002/health && echo " ✅ EPC API"

echo ""
echo "=========================================="
echo "Cleanup complete!"

