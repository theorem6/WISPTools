#!/bin/bash
# ============================================
# Complete Backend System Management Update
# ============================================

set -e

echo "🚀 Complete Backend System Management Update"
echo "============================================"
echo ""

# 1. Create temp directory
echo "📂 Creating temporary directory..."
mkdir -p /tmp/backend-update
cd /tmp/backend-update

# 2. Download the complete updated file
echo "📥 Downloading complete system-management.js..."
curl -H "Authorization: token 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" \
     -H 'Accept: application/vnd.github.v3.raw' \
     -o system-management.js \
     -L https://api.github.com/repos/theorem6/lte-pci-mapper/contents/backend-services/system-management.js

# 3. Verify the file has the resources endpoint
echo "🔍 Verifying resources endpoint..."
if grep -q "router.get('/resources'" system-management.js; then
    echo "✅ Resources endpoint found"
else
    echo "❌ Resources endpoint missing - file may be incomplete"
    exit 1
fi

# 4. Ensure backend-services directory exists
echo "📁 Ensuring backend-services directory exists..."
mkdir -p /opt/hss-api/backend-services

# 5. Backup current file
echo "💾 Backing up current file..."
cp /opt/hss-api/backend-services/system-management.js /opt/hss-api/backend-services/system-management.js.backup 2>/dev/null || true

# 6. Copy the new file
echo "📋 Installing updated system-management.js..."
cp system-management.js /opt/hss-api/backend-services/

# 7. Restart PM2
echo "🔄 Restarting hss-api service..."
cd /opt/hss-api
pm2 restart hss-api

# 8. Wait for restart
echo "⏳ Waiting for service to start..."
sleep 3

# 9. Test both endpoints
echo "🧪 Testing endpoints..."
echo ""
echo "Testing services endpoint:"
curl -H 'Authorization: Bearer test' http://localhost:3000/api/system/services/status | jq '.services | length' 2>/dev/null || echo "Services endpoint failed"

echo ""
echo "Testing resources endpoint:"
curl -H 'Authorization: Bearer test' http://localhost:3000/api/system/resources | jq '.success' 2>/dev/null || echo "Resources endpoint failed"

echo ""
echo "✅ Update complete!"
echo ""
echo "Expected results:"
echo "- Services endpoint: Should return 5 services (no MongoDB)"
echo "- Resources endpoint: Should return system metrics"
echo ""

