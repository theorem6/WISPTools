#!/bin/bash

# HSS Backend Deployment Script
# Deploys updated backend code to GCE server at 136.112.111.167

echo "🚀 Starting HSS Backend Deployment..."
echo "======================================"

# SSH into server and run deployment
ssh root@136.112.111.167 << 'ENDSSH'

echo "📥 Step 1: Pulling latest code from GitHub..."
cd /root/lte-pci-mapper
git fetch origin
git reset --hard origin/main
git pull origin main

echo ""
echo "📋 Step 2: Verifying updated files exist..."
echo "hss-management.js:"
ls -lh backend-services/routes/hss-management.js
wc -l backend-services/routes/hss-management.js
echo ""
echo "epc.js:"
ls -lh backend-services/routes/epc.js
wc -l backend-services/routes/epc.js
echo ""
echo "distributed-epc-schema.js:"
ls -lh backend-services/models/distributed-epc-schema.js

echo ""
echo "🔍 Step 3: Checking for critical endpoints in code..."
echo "Groups POST endpoint:"
grep -n "router.post('/groups'" backend-services/routes/hss-management.js | head -1
echo "Groups DELETE endpoint:"
grep -n "router.delete('/groups" backend-services/routes/hss-management.js | head -1
echo "Bandwidth plans POST endpoint:"
grep -n "router.post('/bandwidth-plans'" backend-services/routes/hss-management.js | head -1
echo "Bandwidth plans DELETE endpoint:"
grep -n "router.delete('/bandwidth-plans" backend-services/routes/hss-management.js | head -1

echo ""
echo "🔄 Step 4: Restarting backend service (PM2 will reload from git)..."
pm2 restart main-api
sleep 3

echo ""
echo "📊 Step 5: Checking PM2 status..."
pm2 status

echo ""
echo "📝 Step 6: Checking logs for startup errors..."
pm2 logs main-api --lines 30 --nostream

echo ""
echo "✅ Deployment complete!"
echo "======================================"
echo ""
echo "🧪 Testing endpoints..."
echo ""
echo "Test 1: Health check"
curl -s http://localhost:3001/health | jq .

echo ""
echo "Test 2: Groups list (with tenant)"
curl -s -H "X-Tenant-ID: 68f8df4d38ce540968cdc450" http://localhost:3001/api/hss/groups | jq '.'

echo ""
echo "Test 3: Bandwidth plans list (with tenant)"
curl -s -H "X-Tenant-ID: 68f8df4d38ce540968cdc450" http://localhost:3001/api/hss/bandwidth-plans | jq '.'

echo ""
echo "Test 4: Create a test group (POST)"
curl -s -X POST http://localhost:3001/api/hss/groups \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: 68f8df4d38ce540968cdc450" \
  -d '{"name":"test-deploy-group","description":"Test group from deployment"}' | jq '.'

echo ""
echo "✅ All tests complete!"

ENDSSH

echo ""
echo "🎉 Backend deployment finished!"
echo "The GCE server now has the latest code."
echo ""
echo "Next steps:"
echo "1. Hard refresh the frontend (Ctrl+Shift+R)"
echo "2. Test creating a group in the HSS module"
echo "3. Test deleting a bandwidth plan"
echo "4. Check the Network tab in browser for 200 responses"

