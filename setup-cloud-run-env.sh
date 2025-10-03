#!/bin/bash
# Setup Cloud Run environment variables for Firebase App Hosting

echo "🔧 Setting up Cloud Run environment variables..."
echo ""

# Project configuration
PROJECT_ID="lte-pci-mapper-65450042-bbf71"
SERVICE_NAME="pci-mapper"
REGION="us-central1"

echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo ""

# Set Firebase configuration as JSON
echo "Setting FIREBASE_CONFIG..."
gcloud run services update $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --update-env-vars FIREBASE_CONFIG='{"databaseURL":"","projectId":"lte-pci-mapper-65450042-bbf71","storageBucket":"lte-pci-mapper-65450042-bbf71.firebasestorage.app","apiKey":"AIzaSyCaMoHY6ZKcV_uazY0HlwolxVgPwwLT8V0"}'

echo ""
echo "Setting individual environment variables..."

# Set all public environment variables
gcloud run services update $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --update-env-vars \
PUBLIC_FIREBASE_API_KEY=AIzaSyCaMoHY6ZKcV_uazY0HlwolxVgPwwLT8V0,\
PUBLIC_FIREBASE_AUTH_DOMAIN=lte-pci-mapper-65450042-bbf71.firebaseapp.com,\
PUBLIC_FIREBASE_PROJECT_ID=lte-pci-mapper-65450042-bbf71,\
PUBLIC_FIREBASE_STORAGE_BUCKET=lte-pci-mapper-65450042-bbf71.firebasestorage.app,\
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1044782186913,\
PUBLIC_FIREBASE_APP_ID=1:1044782186913:web:a5367441ce136118948be0,\
PUBLIC_ARCGIS_API_KEY=AAPT85fOqywZsicJupSmVSCGrjWNNjURUpnE--wnh6GZUreHU00VSEoRGgbf0JZjKYEmLnUXJw8E5r8Nz55eqYvvfcecdjs2BjpjcShOZgei0o-Myxttbl5f1qu9-AfdJaw4w3ugB4-uH6dh9v0PNN--vklICR-vCwt8YjMxw7CBrsZ5vxsZjo_jp31mV5hlMSSxQMJsKtFh0ltDrN4YwuK_8ZLmHMdIp5w9_jZrqJVlC2I.AT2_12sjSDHZ,\
PUBLIC_GEMINI_API_KEY=AIzaSyAVBmH_eC98f6GCIpHZJ8B_y40TuoIjXOg,\
PUBLIC_WOLFRAM_APP_ID=WQPAJ72446

echo ""
echo "✅ Environment variables set successfully!"
echo ""
echo "📋 Verify variables:"
echo "gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID --format='value(spec.template.spec.containers[0].env)'"
echo ""
echo "🚀 Your service should now work with Firebase!"

