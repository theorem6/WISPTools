#!/bin/bash
# Deploy GenieACS Module to Firebase Web IDE
# Run this script to deploy the complete GenieACS module

echo "🚀 Deploying GenieACS CPE Management Module..."

# Navigate to Module Manager
cd Module_Manager

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building the project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Check if Firebase CLI is available
if ! command -v firebase &> /dev/null; then
    echo "⚠️ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Deploy to Firebase
echo "🔥 Deploying to Firebase..."
firebase deploy --only hosting

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "🎉 GenieACS CPE Management Module is now live!"
    echo ""
    echo "📋 What's available:"
    echo "   - PCI Resolution & Network Optimization"
    echo "   - GenieACS CPE Management (NEW!)"
    echo "   - TR-069 device monitoring"
    echo "   - GPS location mapping"
    echo "   - Real-time CPE status"
    echo ""
    echo "🔗 Access your platform at the Firebase hosting URL"
else
    echo "❌ Deployment failed!"
    echo "Check the error messages above for details."
fi

# Return to original directory
cd ..
