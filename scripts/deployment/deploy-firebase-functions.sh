#!/bin/bash
# Deploy Firebase Cloud Functions
# Specifically updates hssProxy and other functions after code changes
# Can be run from Cloud Shell or locally with Firebase CLI

set -e

FUNCTION_NAME="${1:-hssProxy}"
DEPLOY_ALL="${2:-false}"

echo "🚀 Firebase Functions Deployment Script"
echo "====================================="
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found!"
    echo ""
    echo "Installing Firebase CLI..."
    npm install -g firebase-tools
fi

FIREBASE_VERSION=$(firebase --version)
echo "✅ Firebase CLI found: $FIREBASE_VERSION"
echo ""

# Get script directory and navigate to functions
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"
FUNCTIONS_DIR="$PROJECT_ROOT/functions"

if [ ! -d "$FUNCTIONS_DIR" ]; then
    echo "❌ Functions directory not found: $FUNCTIONS_DIR"
    exit 1
fi

cd "$FUNCTIONS_DIR"

echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

echo "🔨 Building TypeScript..."
npm run build
echo "✅ Build successful"
echo ""

# Deploy
if [ "$DEPLOY_ALL" = "true" ] || [ "$DEPLOY_ALL" = "all" ]; then
    echo "🚀 Deploying ALL functions..."
    firebase deploy --only functions
else
    echo "🚀 Deploying function: $FUNCTION_NAME"
    firebase deploy --only functions:$FUNCTION_NAME
fi

echo ""
echo "✅ Deployment successful!"
echo ""
echo "Function URLs:"
if [ "$DEPLOY_ALL" = "true" ] || [ "$DEPLOY_ALL" = "all" ] || [ "$FUNCTION_NAME" = "hssProxy" ]; then
    echo "  hssProxy: https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy"
fi
echo ""
echo "🧪 Test the proxy:"
echo "  curl https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/health"
echo ""

