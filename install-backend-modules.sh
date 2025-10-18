#!/bin/bash
# ============================================
# Backend Module Update Script
# ============================================

set -e

echo "🚀 Backend Module Update Script"
echo "================================"
echo ""

# 1. Create temp directory
echo "📂 Creating temporary directory..."
mkdir -p /tmp/backend-update
cd /tmp/backend-update

# 2. Download updated file from GitHub (using raw URL)
echo "📥 Downloading updated system-management.js..."
curl -H "Authorization: token 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" \
     -H 'Accept: application/vnd.github.v3.raw' \
     -o system-management.js \
     -L https://api.github.com/repos/theorem6/lte-pci-mapper/contents/backend-services/system-management.js

# 3. Ensure backend-services directory exists
echo "📁 Ensuring backend-services directory exists..."
mkdir -p /opt/hss-api/backend-services

# 4. Copy the file
echo "📋 Copying system-management.js to /opt/hss-api/backend-services/..."
cp system-management.js /opt/hss-api/backend-services/

# 5. Restart PM2
echo "🔄 Restarting hss-api service..."
cd /opt/hss-api
pm2 restart hss-api

# 6. Wait for restart
echo "⏳ Waiting for service to start..."
sleep 3

# 7. Check status
echo "✅ Checking service status..."
pm2 status hss-api

echo ""
echo "✨ Update complete!"
echo ""
echo "🧪 Test the new API endpoints:"
echo "   curl -H 'Authorization: Bearer test' http://localhost:3000/api/system/services/status"
echo ""
