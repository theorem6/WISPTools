#!/bin/bash
# Setup Firebase Secrets for GenieACS MongoDB Integration
# This script helps you configure all required secrets for different environments

set -e

echo "🔐 Firebase Secrets Setup for PCI Mapper"
echo "=========================================="
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Login to Firebase
echo "🔑 Logging into Firebase..."
firebase login

# Set project
echo "📋 Setting Firebase project..."
firebase use lte-pci-mapper-65450042-bbf71

echo ""
echo "📝 We'll now set up MongoDB connection secrets for each environment."
echo ""

# Production MongoDB Secret
echo "🏭 PRODUCTION MongoDB Secret"
echo "----------------------------"
echo "Please enter your PRODUCTION MongoDB connection string:"
echo "Format: mongodb+srv://username:password@cluster.mongodb.net/genieacs?retryWrites=true&w=majority"
read -p "Production MongoDB URI: " PROD_MONGO_URI

if [ ! -z "$PROD_MONGO_URI" ]; then
    echo "$PROD_MONGO_URI" | firebase functions:secrets:set mongodb-connection-url
    echo "✅ Production MongoDB secret set!"
else
    echo "⚠️  Skipping production secret (empty input)"
fi

echo ""

# Staging MongoDB Secret
echo "🧪 STAGING MongoDB Secret"
echo "-------------------------"
echo "Please enter your STAGING MongoDB connection string (or press Enter to skip):"
read -p "Staging MongoDB URI: " STAGING_MONGO_URI

if [ ! -z "$STAGING_MONGO_URI" ]; then
    echo "$STAGING_MONGO_URI" | firebase functions:secrets:set mongodb-staging-connection-url
    echo "✅ Staging MongoDB secret set!"
else
    echo "⚠️  Skipping staging secret (empty input)"
fi

echo ""

# Development MongoDB Secret
echo "💻 DEVELOPMENT MongoDB Secret"
echo "-----------------------------"
echo "Please enter your DEVELOPMENT MongoDB connection string (or press Enter to skip):"
read -p "Development MongoDB URI: " DEV_MONGO_URI

if [ ! -z "$DEV_MONGO_URI" ]; then
    echo "$DEV_MONGO_URI" | firebase functions:secrets:set mongodb-dev-connection-url
    echo "✅ Development MongoDB secret set!"
else
    echo "⚠️  Skipping development secret (empty input)"
fi

echo ""
echo "📊 Listing all configured secrets..."
firebase functions:secrets:list

echo ""
echo "✅ Secret setup complete!"
echo ""
echo "🎯 Next Steps:"
echo "1. Set environment name in Firebase Console:"
echo "   https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting"
echo ""
echo "2. Deploy your functions:"
echo "   firebase deploy --only functions"
echo ""
echo "3. Test your APIs:"
echo "   See FIREBASE_API_SETUP.md for testing instructions"
echo ""

