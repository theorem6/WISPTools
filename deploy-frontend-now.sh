#!/bin/bash
# Deploy frontend to Firebase Hosting via Google Cloud Build

set -e

PROJECT_ID="lte-pci-mapper-65450042-bbf71"
REGION="us-central1"

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Deploying Frontend to Firebase Hosting"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Project: $PROJECT_ID"
echo "Build Config: deploy-frontend-production.yaml"
echo ""

# Trigger Cloud Build
gcloud builds submit \
  --config=deploy-frontend-production.yaml \
  --project=$PROJECT_ID \
  --region=$REGION \
  .

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ Frontend Deployment Complete"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🌐 Your app is now live at:"
echo "   https://lte-pci-mapper-65450042-bbf71.web.app"
echo ""

