#!/bin/bash

# Fix Firebase App Hosting Traffic Routing
# Forces traffic to the latest successful build

echo "🔄 Fixing traffic routing for Firebase App Hosting..."
echo ""
echo "Current Issue:"
echo "  - New builds are deploying successfully"
echo "  - But traffic is stuck on old failing revision"
echo ""

# Get the project ID
PROJECT_ID="lte-pci-mapper-65450042-bbf71"
SERVICE_NAME="pci-mapper"
REGION="us-central1"

echo "📊 Getting latest revision..."

# Get the latest ready revision
LATEST_REVISION=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format='value(status.latestReadyRevisionName)')

echo "✅ Latest ready revision: $LATEST_REVISION"
echo ""
echo "🚀 Routing 100% traffic to latest revision..."

# Update traffic to latest revision
gcloud run services update-traffic $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --to-latest

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Traffic successfully routed to latest revision!"
  echo ""
  echo "🌐 Your app should now be accessible at:"
  echo "   https://pci-mapper-nfomthzoza-uc.a.run.app"
  echo ""
  echo "🔍 Verify by checking for:"
  echo "   - No more 'Cannot find module /workspace/index.js' errors"
  echo "   - No more 'Cannot call goto on server' errors"
  echo "   - No more 'Firebase auth/invalid-api-key' errors"
else
  echo ""
  echo "❌ Failed to update traffic routing"
  echo ""
  echo "Manual fix:"
  echo "1. Go to: https://console.cloud.google.com/run/detail/us-central1/pci-mapper"
  echo "2. Click 'MANAGE TRAFFIC'"
  echo "3. Route 100% traffic to: $LATEST_REVISION"
  echo "4. Click 'SAVE'"
fi

