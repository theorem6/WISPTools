#!/bin/bash
# Deploy User Management API to GCE Backend
# New backend services for role-based access control

echo "🚀 Deploying User Management Backend"
echo "====================================="

cd /root/lte-pci-mapper || exit 1
git pull origin main

echo ""
echo "Step 1: Stop service..."
systemctl stop hss-api
sleep 3

echo ""
echo "Step 2: Deploy new backend files..."
cd /opt/hss-api

# Backup current server.js
cp server.js "server.js.backup-$(date +%Y%m%d-%H%M%S)"
echo "✅ Backup created"

# Copy new backend service files
echo "Copying role-based access control files..."
cp /root/lte-pci-mapper/backend-services/role-auth-middleware.js .
cp /root/lte-pci-mapper/backend-services/user-management-api.js .

# Verify files exist
if [ -f "role-auth-middleware.js" ] && [ -f "user-management-api.js" ]; then
    echo "✅ Files copied successfully"
else
    echo "❌ Failed to copy files"
    exit 1
fi

echo ""
echo "Step 3: Check file syntax..."
if node --check role-auth-middleware.js 2>&1; then
    echo "✅ role-auth-middleware.js - OK"
else
    echo "❌ role-auth-middleware.js - SYNTAX ERROR"
    exit 1
fi

if node --check user-management-api.js 2>&1; then
    echo "✅ user-management-api.js - OK"
else
    echo "❌ user-management-api.js - SYNTAX ERROR"
    exit 1
fi

echo ""
echo "Step 4: Update server.js to use new middleware..."

# Check if Firebase Admin is initialized
if ! grep -q "const admin = require('firebase-admin')" server.js; then
    echo "Adding Firebase Admin initialization..."
    # Add after requires section (before app.use statements)
    sed -i "/const express = require('express')/a const admin = require('firebase-admin');" server.js
fi

# Import middleware (add after requires)
if ! grep -q "role-auth-middleware" server.js; then
    echo "Adding role-auth-middleware import..."
    sed -i "/const express = require('express')/a const { verifyAuth, extractTenantId, requireRole, requireModule } = require('./role-auth-middleware');" server.js
fi

# Import user management API
if ! grep -q "user-management-api" server.js; then
    echo "Adding user-management-api route..."
    # Find where other API routes are registered
    if grep -q "distributedEpcAPI" server.js; then
        sed -i "/const distributedEpcAPI = require('.\/distributed-epc-api')/a const userManagementAPI = require('./user-management-api');" server.js
        sed -i "/app.use('\/api\/epc', distributedEpcAPI)/a app.use('/api/users', userManagementAPI);" server.js
    else
        # Fallback - add at end of require section
        sed -i "/const app = express()/i const userManagementAPI = require('./user-management-api');" server.js
        # Add route
        sed -i "/app.use(express.json())/a app.use('/api/users', userManagementAPI);" server.js
    fi
fi

echo "✅ server.js updated"

echo ""
echo "Step 5: Test configuration..."
if node --check server.js; then
    echo "✅ server.js syntax valid"
else
    echo "❌ server.js has syntax errors!"
    echo "Restoring backup..."
    cp "server.js.backup-$(date +%Y%m%d-%H%M%S | head -1)" server.js
    exit 1
fi

echo ""
echo "Step 6: Start service..."
systemctl enable hss-api
systemctl start hss-api
sleep 3

# Check if service started
if systemctl is-active --quiet hss-api; then
    echo "✅ Service started successfully"
else
    echo "❌ Service failed to start"
    echo "Checking logs..."
    journalctl -u hss-api -n 50 --no-pager
    exit 1
fi

echo ""
echo "Step 7: Verify API endpoints..."
sleep 2

# Test health endpoint
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Backend is responding"
else
    echo "⚠️  Backend might not be responding yet (give it a moment)"
fi

echo ""
echo "=========================================="
echo "✅ USER MANAGEMENT BACKEND DEPLOYED!"
echo "=========================================="
echo ""
echo "New endpoints available:"
echo "  POST   /api/users/invite"
echo "  GET    /api/users/tenant/:tenantId"
echo "  PUT    /api/users/:userId/role"
echo "  PUT    /api/users/:userId/modules"
echo "  POST   /api/users/:userId/suspend"
echo "  POST   /api/users/:userId/activate"
echo "  DELETE /api/users/:userId/tenant/:tenantId"
echo ""
echo "Middleware available:"
echo "  - verifyAuth()"
echo "  - extractTenantId()"
echo "  - requireRole([roles])"
echo "  - requireModule(moduleName)"
echo "  - requireWorkOrderPermission(permission)"
echo ""
echo "Next steps:"
echo "  1. Update Firestore rules (already in repo)"
echo "  2. Deploy frontend User Management module"
echo "  3. Test user invitation flow"
echo ""
echo "Check logs: journalctl -u hss-api -f"
echo "=========================================="

