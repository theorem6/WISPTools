#!/bin/bash
# Simple Firebase Hosting Deployment for Module_Manager
# This deploys ONLY the web application to Firebase Hosting

echo "================================================"
echo "  Firebase Hosting Deployment - Module Manager"
echo "================================================"
echo ""

# Build the app
echo "Building Module Manager..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""

# Deploy to Firebase
echo "Deploying to Firebase Hosting..."
cd ..
firebase deploy --only hosting

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed!"
    exit 1
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Your app is live at: https://YOUR-PROJECT-ID.web.app"
echo "Check Firebase Console for the exact URL"

