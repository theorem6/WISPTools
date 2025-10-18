#!/bin/bash
# Backend deployment script for backhaul link and NOC support
# Run this on the GCE VM (acs-hss-server)

echo "🔗 Deploying backhaul and NOC backend updates..."
echo "================================================"

# Navigate to backend directory
cd /opt/hss-api || exit 1

# Pull latest changes
echo "📥 Pulling latest backend files..."
cd /root/lte-pci-mapper
git pull origin main

# Copy updated schema
echo "📋 Updating unified network schema (adding NOC site type)..."
cp /root/lte-pci-mapper/backend-services/unified-network-schema.js /opt/hss-api/

# Verify the schema file
echo "✅ Verifying schema update..."
if grep -q "'noc'" /opt/hss-api/unified-network-schema.js; then
    echo "✅ NOC site type added to schema"
else
    echo "⚠️  Warning: NOC type may not have been added"
fi

# Restart the service
echo "🔄 Restarting hss-api service..."
systemctl restart hss-api

# Wait for service to start
echo "⏳ Waiting for service to initialize..."
sleep 3

# Test the service
echo "🧪 Testing backend service..."
SERVICE_STATUS=$(systemctl is-active hss-api)
if [ "$SERVICE_STATUS" = "active" ]; then
    echo "✅ Service is running"
    
    # Test API endpoint
    echo "🧪 Testing API endpoint..."
    curl -s -H "X-Tenant-ID: test" http://localhost:3000/api/network/sites | head -n 5
    
    echo ""
    echo "✅ Backend deployment complete!"
    echo ""
    echo "📝 Summary:"
    echo "   - Updated unified-network-schema.js with NOC support"
    echo "   - Backend now supports 'noc' as a site type"
    echo "   - Backhaul links stored as equipment with type='backhaul'"
    echo "   - Frontend will auto-deploy from Git in ~10-15 minutes"
    echo ""
    echo "🎯 To create backhaul links:"
    echo "   1. Create at least 2 sites (towers or NOCs)"
    echo "   2. Click a tower → Add Backhaul"
    echo "   3. Select from/to sites and configure"
    echo "   4. Lines will appear on map connecting the sites"
else
    echo "❌ Service failed to start"
    echo "📋 Checking logs..."
    journalctl -u hss-api -n 20 --no-pager
    exit 1
fi

