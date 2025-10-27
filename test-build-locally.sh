#!/bin/bash

# Test Cloud Build Configuration Locally
# This script simulates the Cloud Build process locally

echo "🧪 Testing Cloud Build Configuration Locally"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "cloudbuild-simple.yaml" ]; then
    echo "❌ cloudbuild-simple.yaml not found. Please run this from the project root."
    exit 1
fi

# Step 1: Install Firebase CLI
echo ""
echo "🔧 Step 1: Installing Firebase CLI..."
if ! command -v firebase &> /dev/null; then
    npm install -g firebase-tools
    echo "✅ Firebase CLI installed"
else
    echo "✅ Firebase CLI already installed"
fi

# Step 2: Install Functions dependencies and build
echo ""
echo "📦 Step 2: Installing Functions dependencies and building..."
cd functions
if [ ! -f "package.json" ]; then
    echo "❌ functions/package.json not found"
    exit 1
fi

npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install Functions dependencies"
    exit 1
fi

npm run build
if [ $? -ne 0 ]; then
    echo "❌ Failed to build Functions"
    exit 1
fi

echo "✅ Functions built successfully"
cd ..

# Step 3: Check Firestore configuration
echo ""
echo "📊 Step 3: Checking Firestore configuration..."
if [ -f "firestore.rules" ] && [ -f "firestore.indexes.json" ]; then
    echo "✅ Firestore rules and indexes found"
else
    echo "⚠️ Firestore configuration files missing"
fi

# Step 4: Check Firebase configuration
echo ""
echo "🔧 Step 4: Checking Firebase configuration..."
if [ -f "firebase.json" ]; then
    echo "✅ firebase.json found"
    # Validate firebase.json
    if firebase use --add 2>/dev/null | grep -q "No project"; then
        echo "⚠️ No Firebase project configured. Run 'firebase use --add' to configure."
    else
        echo "✅ Firebase project configured"
    fi
else
    echo "❌ firebase.json not found"
fi

# Step 5: Test Firebase Functions locally
echo ""
echo "🧪 Step 5: Testing Firebase Functions locally..."
cd functions
if [ -d "lib" ] && [ -f "lib/index.js" ]; then
    echo "✅ Functions compiled successfully"
    echo "📁 Generated files in lib/:"
    ls -la lib/ | head -10
else
    echo "❌ Functions compilation failed or lib directory missing"
fi
cd ..

echo ""
echo "🎉 Local build test completed!"
echo ""
echo "📝 Next steps:"
echo "1. If all steps passed, your configuration should work in Cloud Build"
echo "2. Push your changes to trigger a Cloud Build"
echo "3. Monitor the build in Google Cloud Console"
echo ""
echo "🔗 Cloud Build Console: https://console.cloud.google.com/cloud-build/builds?project=lte-pci-mapper-65450042-bbf71"