#!/bin/bash
# Setup CBRS SAS API Secrets for Firebase
# This configures the platform-level shared API credentials

set -e

echo "=================================="
echo "CBRS SAS API Secrets Setup"
echo "=================================="
echo ""

PROJECT_ID="lte-pci-mapper-65450042-bbf71"

echo "Setting up Firebase secrets for Google SAS..."

# Google SAS OAuth Client Secret
echo "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" | \
  firebase functions:secrets:set GOOGLE_SAS_CLIENT_SECRET \
  --project=$PROJECT_ID \
  --data-file=-

echo "✅ Google SAS Client Secret configured"
echo ""

# Instructions for Federated Wireless (when available)
echo "=================================="
echo "To configure Federated Wireless:"
echo "=================================="
echo ""
echo "When you receive your Federated Wireless API key, run:"
echo ""
echo "  echo 'YOUR_FW_API_KEY' | firebase functions:secrets:set FEDERATED_WIRELESS_API_KEY --project=$PROJECT_ID --data-file=-"
echo ""

# MongoDB URI (if not already set)
echo "=================================="
echo "MongoDB URI:"
echo "=================================="
echo ""
echo "If MongoDB is not yet configured, run:"
echo ""
echo "  echo 'YOUR_MONGODB_URI' | firebase functions:secrets:set MONGODB_URI --project=$PROJECT_ID --data-file=-"
echo ""

echo "=================================="
echo "Setup Complete!"
echo "=================================="
echo ""
echo "Google SAS Configuration:"
echo "  Client ID: 1044782186913-7ukvo096g0r9oal2lg2tehiunae49ceq.apps.googleusercontent.com"
echo "  Client Secret: *** (stored in Firebase Secrets)"
echo "  Endpoint: https://sas.googleapis.com/v1"
echo ""
echo "Next Steps:"
echo "  1. Deploy functions: firebase deploy --only functions"
echo "  2. Configure platform keys in: Tenant Management > CBRS Platform Keys"
echo "  3. Enter Client ID and select 'Use OAuth' mode"
echo ""

