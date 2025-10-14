#!/bin/bash
# Deploy All Tenant System and CBRS Fixes
# This deploys both Firestore rules and the updated application code

set -e  # Exit on any error

echo "=========================================="
echo "🚀 Deploying Tenant System Refactor"
echo "=========================================="
echo ""

# Step 1: Deploy Firestore Rules
echo "📋 Step 1: Deploying Firestore Rules..."
echo "   - Updated tenant permissions"
echo "   - Added CBRS config permissions"
echo "   - Added CBRS devices permissions"
echo ""

firebase deploy --only firestore:rules

echo ""
echo "✅ Firestore rules deployed!"
echo ""

# Step 2: Build and Deploy the App
echo "📦 Step 2: Building and deploying application..."
echo "   - New centralized tenant store"
echo "   - TenantGuard component"
echo "   - Simplified CBRS module"
echo "   - All db() function fixes"
echo ""

# Navigate to Module_Manager directory
cd Module_Manager

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📥 Installing dependencies..."
  npm install
fi

# Build the app
echo "🔨 Building application..."
npm run build

# Return to root
cd ..

# Deploy to Firebase App Hosting
echo "🚀 Deploying to Firebase App Hosting..."
firebase deploy --only apphosting

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Wait 1-2 minutes for deployment to finish"
echo "2. Clear browser cache (Ctrl + Shift + Delete)"
echo "3. Hard refresh your app (Ctrl + F5)"
echo "4. Login and test!"
echo ""
echo "Expected behavior:"
echo "  ✅ Tenant loads: 'Peterson Consulting'"
echo "  ✅ No redirect loops"
echo "  ✅ CBRS config saves successfully"
echo "  ✅ No permission errors"
echo "  ✅ Fast page loads (~50ms)"
echo ""

