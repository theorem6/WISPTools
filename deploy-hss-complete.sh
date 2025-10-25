#!/bin/bash
# Deploy Complete HSS Backend Implementation
# This script updates the HSS management routes with full CRUD operations

set -e

echo "🚀 Deploying Complete HSS Backend Implementation"
echo "================================================"
echo ""

# Check if running on GCE server
if [ ! -d "/root/lte-pci-mapper" ]; then
  echo "❌ Error: /root/lte-pci-mapper directory not found"
  echo "   This script should be run on the GCE server"
  exit 1
fi

echo "Step 1: Pull latest code from GitHub..."
cd /root/lte-pci-mapper
git pull origin main

echo "✅ Code pulled"
echo ""

echo "Step 2: Stop backend service..."
pm2 stop main-api 2>/dev/null || systemctl stop hss-api 2>/dev/null || true
sleep 3

echo "✅ Service stopped"
echo ""

echo "Step 3: Deploy updated HSS management routes..."
cd /opt/hss-api

# Backup existing file
if [ -f "routes/hss-management.js" ]; then
  cp routes/hss-management.js routes/hss-management.js.backup-$(date +%s)
  echo "✅ Backup created"
fi

# Copy new file
cp /root/lte-pci-mapper/backend-services/routes/hss-management.js routes/

echo "✅ Files deployed"
echo ""

echo "Step 4: Verify Node.js syntax..."
if node --check routes/hss-management.js; then
  echo "✅ Syntax valid"
else
  echo "❌ Syntax error - restoring backup"
  mv routes/hss-management.js.backup-* routes/hss-management.js 2>/dev/null || true
  exit 1
fi

echo ""
echo "Step 5: Restart backend service..."
pm2 restart main-api 2>/dev/null || systemctl start hss-api || true
sleep 5

echo "✅ Service restarted"
echo ""

echo "Step 6: Check service status..."
if pm2 list 2>/dev/null | grep -q "main-api.*online"; then
  echo "✅ PM2 service is running"
  STATUS_CMD="pm2 logs main-api --lines 20"
elif systemctl is-active --quiet hss-api; then
  echo "✅ Systemd service is running"
  STATUS_CMD="journalctl -u hss-api -n 20 --no-pager"
else
  echo "❌ Service not running!"
  echo ""
  echo "Checking logs..."
  pm2 logs main-api --lines 30 --nostream 2>/dev/null || journalctl -u hss-api -n 30 --no-pager
  exit 1
fi

echo ""
echo "Step 7: Test HSS endpoints..."

# Test health endpoint
echo -n "Testing /health... "
if curl -sf http://localhost:3001/health > /dev/null; then
  echo "✅"
else
  echo "❌"
fi

# Test groups endpoint (should return 400 for missing tenant)
echo -n "Testing /api/hss/groups... "
GROUPS_RESPONSE=$(curl -sf http://localhost:3001/api/hss/groups 2>&1 || echo "fail")
if echo "$GROUPS_RESPONSE" | grep -q "Tenant ID required"; then
  echo "✅"
else
  echo "⚠️  (unexpected response)"
fi

# Test bandwidth-plans endpoint
echo -n "Testing /api/hss/bandwidth-plans... "
PLANS_RESPONSE=$(curl -sf http://localhost:3001/api/hss/bandwidth-plans 2>&1 || echo "fail")
if echo "$PLANS_RESPONSE" | grep -q "Tenant ID required"; then
  echo "✅"
else
  echo "⚠️  (unexpected response)"
fi

# Test dashboard/stats endpoint
echo -n "Testing /api/hss/dashboard/stats... "
STATS_RESPONSE=$(curl -sf http://localhost:3001/api/hss/dashboard/stats 2>&1 || echo "fail")
if echo "$STATS_RESPONSE" | grep -q "Tenant ID required"; then
  echo "✅"
else
  echo "⚠️  (unexpected response)"
fi

echo ""
echo "================================================"
echo "✅ HSS BACKEND DEPLOYMENT COMPLETE!"
echo "================================================"
echo ""
echo "📡 Available Endpoints:"
echo "   GET    /api/hss/groups"
echo "   GET    /api/hss/groups/:group_id"
echo "   POST   /api/hss/groups"
echo "   PUT    /api/hss/groups/:group_id"
echo "   DELETE /api/hss/groups/:group_id"
echo ""
echo "   GET    /api/hss/bandwidth-plans"
echo "   GET    /api/hss/bandwidth-plans/:plan_id"
echo "   POST   /api/hss/bandwidth-plans"
echo "   PUT    /api/hss/bandwidth-plans/:plan_id"
echo "   DELETE /api/hss/bandwidth-plans/:plan_id"
echo ""
echo "   GET    /api/hss/dashboard/stats"
echo ""
echo "📋 Next Steps:"
echo "   1. Test from frontend: https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app"
echo "   2. Open HSS Management modal in Deploy module"
echo "   3. Try creating/editing groups and bandwidth plans"
echo ""
echo "📊 Monitor logs:"
echo "   $STATUS_CMD"
echo ""

