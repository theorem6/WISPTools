#!/bin/bash
# Simple HSS Deployment Script for Firebase Studio
# Assumes: Secrets already created in Secret Manager
# Deploys: HSS to existing genieacs-backend instance

set -e

PROJECT_ID="lte-pci-mapper-65450042-bbf71"
ZONE="us-central1-a"
INSTANCE="genieacs-backend"

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Deploying HSS to Existing ACS Server"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Project:  $PROJECT_ID"
echo "Instance: $INSTANCE"
echo "Zone:     $ZONE"
echo ""
echo "Prerequisites:"
echo "  ✅ MongoDB URI secret exists"
echo "  ✅ HSS encryption key secret exists"
echo "  ✅ Existing GCE instance running"
echo ""

# Verify secrets exist
echo "🔐 Verifying secrets..."
if ! gcloud secrets describe mongodb-uri --project=$PROJECT_ID &>/dev/null; then
  echo "❌ Error: mongodb-uri secret not found"
  echo "   Create it first in Secret Manager"
  exit 1
fi

if ! gcloud secrets describe hss-encryption-key --project=$PROJECT_ID &>/dev/null; then
  echo "❌ Error: hss-encryption-key secret not found"
  echo "   Create it first in Secret Manager"
  exit 1
fi

echo "✅ Secrets verified"
echo ""

# Trigger Cloud Build deployment
echo "🚀 Triggering Cloud Build deployment..."
echo ""

gcloud builds submit \
  --config=firebase-automation/add-hss-to-existing-gce.yaml \
  --project=$PROJECT_ID \
  --async

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ DEPLOYMENT TRIGGERED"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 Monitor deployment:"
echo "   https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"
echo ""
echo "⏱️  Deployment takes ~3-5 minutes"
echo ""
echo "After completion:"
echo "   1. Get IP: https://console.cloud.google.com/compute/instances?project=$PROJECT_ID"
echo "   2. Test: curl http://EXTERNAL_IP/api/hss/health"
echo "   3. Web UI: https://lte-pci-mapper-65450042-bbf71.web.app"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

