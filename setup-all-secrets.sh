#!/bin/bash
# Automated Firebase Secrets Setup
# Configures all secrets for the LTE WISP Management Platform

set -e

PROJECT_ID="lte-pci-mapper-65450042-bbf71"

# Parse arguments
MONGODB_URI=""
FEDERATED_WIRELESS_KEY=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --mongodb-uri)
      MONGODB_URI="$2"
      shift 2
      ;;
    --federated-wireless)
      FEDERATED_WIRELESS_KEY="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

echo "========================================"
echo "Firebase Secrets Automated Setup"
echo "========================================"
echo ""
echo "Project: $PROJECT_ID"
echo ""

# Function to set secret
set_secret() {
    local SECRET_NAME=$1
    local SECRET_VALUE=$2
    local DESCRIPTION=$3
    
    if [ -z "$SECRET_VALUE" ]; then
        echo "⏭️  Skipping $SECRET_NAME (no value provided)"
        return 1
    fi
    
    echo "Setting secret: $SECRET_NAME..."
    
    if ! command -v firebase &> /dev/null; then
        echo "❌ Firebase CLI not found. Please install: npm install -g firebase-tools"
        return 1
    fi
    
    echo "$SECRET_VALUE" | firebase functions:secrets:set "$SECRET_NAME" \
        --project="$PROJECT_ID" \
        --data-file=- \
        --force > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ $SECRET_NAME configured successfully"
        return 0
    else
        echo "❌ Failed to set $SECRET_NAME"
        return 1
    fi
}

echo "========================================"
echo "Step 1: Google SAS Configuration"
echo "========================================"
echo ""

# Google SAS Client Secret
GOOGLE_SECRET="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"
set_secret "google-sas-client-secret" "$GOOGLE_SECRET" "Google SAS OAuth Client Secret"
RESULT1=$?

echo ""

echo "========================================"
echo "Step 2: MongoDB Configuration"
echo "========================================"
echo ""

if [ -z "$MONGODB_URI" ]; then
    echo "⚠️  MongoDB URI not provided"
    echo "   To set MongoDB URI later, run:"
    echo "   echo 'YOUR_MONGODB_URI' | firebase functions:secrets:set mongodb-uri --project=$PROJECT_ID --data-file=-"
    RESULT2=1
else
    set_secret "mongodb-uri" "$MONGODB_URI" "MongoDB Connection URI"
    RESULT2=$?
fi

echo ""

echo "========================================"
echo "Step 3: Federated Wireless Configuration"
echo "========================================"
echo ""

if [ -z "$FEDERATED_WIRELESS_KEY" ]; then
    echo "⚠️  Federated Wireless API key not provided"
    echo "   To set Federated Wireless key later, run:"
    echo "   echo 'YOUR_FW_API_KEY' | firebase functions:secrets:set federated-wireless-api-key --project=$PROJECT_ID --data-file=-"
    RESULT3=1
else
    set_secret "federated-wireless-api-key" "$FEDERATED_WIRELESS_KEY" "Federated Wireless API Key"
    RESULT3=$?
fi

echo ""

echo "========================================"
echo "Summary"
echo "========================================"
echo ""

if [ $RESULT1 -eq 0 ]; then
    echo "✅ Google SAS Client Secret: Configured"
else
    echo "❌ Google SAS Client Secret: Failed or Skipped"
fi

if [ -z "$MONGODB_URI" ]; then
    echo "⏭️  MongoDB URI: Not provided (optional)"
elif [ $RESULT2 -eq 0 ]; then
    echo "✅ MongoDB URI: Configured"
else
    echo "❌ MongoDB URI: Failed"
fi

if [ -z "$FEDERATED_WIRELESS_KEY" ]; then
    echo "⏭️  Federated Wireless API Key: Not provided (optional)"
elif [ $RESULT3 -eq 0 ]; then
    echo "✅ Federated Wireless API Key: Configured"
else
    echo "❌ Federated Wireless API Key: Failed"
fi

echo ""
echo "========================================"
echo "Next Steps"
echo "========================================"
echo ""

if [ $RESULT1 -eq 0 ]; then
    echo "1. Uncomment secrets in Module_Manager/apphosting.yaml"
    echo "2. Commit and push: git add . && git commit -m 'config: Enable secrets' && git push"
    echo "3. Deploy: firebase deploy --only apphosting"
    echo "4. Configure in UI: Tenant Management > CBRS Platform Keys"
fi

echo ""
echo "Usage Examples:"
echo ""
echo "With MongoDB:"
echo "  ./setup-all-secrets.sh --mongodb-uri 'mongodb+srv://user:pass@cluster.mongodb.net/db'"
echo ""
echo "With Federated Wireless:"
echo "  ./setup-all-secrets.sh --federated-wireless 'fw_live_abc123...'"
echo ""
echo "With both:"
echo "  ./setup-all-secrets.sh --mongodb-uri 'mongodb+srv://...' --federated-wireless 'fw_live_...'"
echo ""

