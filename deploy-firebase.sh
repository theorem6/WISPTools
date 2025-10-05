#!/bin/bash
# Firebase GenieACS Integration Deployment Script (Linux/macOS)
# Run this script to deploy the complete integration

echo "🔥 Deploying Firebase GenieACS Integration..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install Firebase CLI. Please install Node.js first."
        exit 1
    fi
fi

# Check if logged in to Firebase
echo "🔐 Checking Firebase authentication..."
firebase projects:list
if [ $? -ne 0 ]; then
    echo "🔐 Please login to Firebase first:"
    firebase login
fi

# Set MongoDB connection URL
echo "🗄️ Configuring MongoDB connection..."
firebase functions:config:set mongodb.connection_url="mongodb+srv://genieacs-user:fg2E8I10Pnx58gYP@cluster0.1radgkw.mongodb.net/genieacs?retryWrites=true&w=majority&appName=Cluster0"

# Install Firebase Functions dependencies
echo "📦 Installing Firebase Functions dependencies..."
cd functions
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Build Firebase Functions
echo "🔨 Building Firebase Functions..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Failed to build functions"
    exit 1
fi

cd ..

# Deploy Firebase Functions
echo "🚀 Deploying Firebase Functions..."
firebase deploy --only functions
if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy functions"
    exit 1
fi

# Deploy Firestore rules and indexes
echo "📋 Deploying Firestore rules and indexes..."
firebase deploy --only firestore:rules,firestore:indexes
if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy Firestore configuration"
    exit 1
fi

# Deploy Firebase Hosting (if needed)
echo "🌐 Deploying Firebase Hosting..."
firebase deploy --only hosting
if [ $? -ne 0 ]; then
    echo "⚠️ Failed to deploy hosting (this might be expected)"
fi

echo "✅ Deployment completed successfully!"
echo ""
echo "📊 Next steps:"
echo "1. Test the integration: curl https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/syncCPEDevices"
echo "2. Initialize GenieACS data in MongoDB Atlas"
echo "3. Update your PCI Mapper to use the new GenieACS service"
echo ""
echo "🔗 Firebase Console: https://console.firebase.google.com"
echo "🗄️ MongoDB Atlas: https://cloud.mongodb.com"
