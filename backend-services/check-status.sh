#!/bin/bash
#
# Quick Status Check Script
# Shows status of all API services
#

echo "=========================================="
echo "API Services Status"
echo "=========================================="
echo ""

# PM2 Status
echo "PM2 Process Status:"
pm2 status
echo ""

# Health Checks
echo "Health Checks:"
echo -n "Main API (3001): "
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null && echo " ✅" || echo " ❌"

echo -n "EPC API (3002): "
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/health 2>/dev/null && echo " ✅" || echo " ❌"
echo ""

# Port Status
echo "Port Status:"
sudo lsof -i:3001 -i:3002 | grep LISTEN || echo "No processes listening on ports 3001-3002"
echo ""

# Recent Logs
echo "Recent Main API Logs (last 5 lines):"
pm2 logs main-api --lines 5 --nostream 2>/dev/null | tail -5 || echo "No logs available"
echo ""

echo "=========================================="

