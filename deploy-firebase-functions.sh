#!/bin/bash
# Deploy Firebase Functions (hssProxy) from Google Cloud Shell
# Run this in Cloud Shell: https://console.cloud.google.com

set -e

PROJECT_ID="lte-pci-mapper-65450042-bbf71"

echo "🚀 Deploying Firebase Functions for HSS Proxy..."
echo ""

# Clone or update repository
if [ -d "/home/user/lte-pci-mapper" ]; then
  echo "📥 Updating existing repository..."
  cd /home/user/lte-pci-mapper
  git pull origin main
else
  echo "📥 Cloning repository..."
  cd /home/user
  git clone https://github.com/theorem6/lte-pci-mapper.git
  cd lte-pci-mapper
fi

# Navigate to functions directory
cd functions

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Build TypeScript
echo ""
echo "🔨 Building TypeScript..."
npm run build

# Deploy function
echo ""
echo "🚀 Deploying hssProxy function..."
firebase deploy --only functions:hssProxy --project $PROJECT_ID

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Test the proxy:"
echo "curl https://us-central1-$PROJECT_ID.cloudfunctions.net/hssProxy/health"
echo ""
echo "🌐 Frontend will auto-deploy in 5-10 minutes"
echo "Monitor at: https://console.firebase.google.com/project/$PROJECT_ID/apphosting"
echo ""
echo "Once deployed, access HSS module at:"
echo "https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app/modules/hss-management"

