#!/bin/bash
# Complete Automated Deployment Script
# Deploys HSS + ACS + Frontend via Firebase App Hosting
#
# Project: lte-pci-mapper-65450042-bbf71
# Instance: genieacs-backend
# Zone: us-central1-a

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Automated Cloud HSS + ACS Deployment"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Project:  lte-pci-mapper-65450042-bbf71"
echo "Instance: genieacs-backend"
echo "Zone:     us-central1-a"
echo ""
echo "This will deploy:"
echo "  ✅ Frontend → Firebase App Hosting"
echo "  ✅ HSS Server → GCE genieacs-backend"
echo "  ✅ GenieACS → GCE genieacs-backend"
echo "  ✅ Nginx reverse proxy"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check if running for first time
if [ "$1" = "--first-time" ]; then
  echo "📋 First-time setup detected. Running prerequisite checks..."
  echo ""
  
  # Check gcloud
  if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI not found"
    echo "   Install: https://cloud.google.com/sdk/docs/install"
    exit 1
  fi
  
  # Check firebase
  if ! command -v firebase &> /dev/null; then
    echo "❌ Error: firebase CLI not found"
    echo "   Install: npm install -g firebase-tools"
    exit 1
  fi
  
  # Set project
  echo "🔧 Setting Google Cloud project..."
  gcloud config set project lte-pci-mapper-65450042-bbf71
  
  # Check secrets
  echo "🔐 Checking secrets..."
  if ! gcloud secrets describe mongodb-uri &> /dev/null; then
    echo "❌ Error: mongodb-uri secret not found"
    echo ""
    echo "Create it with:"
    echo "  echo -n 'YOUR_MONGODB_URI' | gcloud secrets create mongodb-uri --data-file=-"
    echo ""
    exit 1
  fi
  
  if ! gcloud secrets describe hss-encryption-key &> /dev/null; then
    echo "⚠️  hss-encryption-key secret not found. Generating..."
    ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo -n "$ENCRYPTION_KEY" | gcloud secrets create hss-encryption-key --data-file=-
    echo "✅ Generated and stored HSS encryption key"
  fi
  
  # Check permissions
  echo "🔑 Checking Cloud Build permissions..."
  PROJECT_NUMBER=$(gcloud projects describe lte-pci-mapper-65450042-bbf71 --format="value(projectNumber)")
  
  # Grant secret access
  gcloud secrets add-iam-policy-binding mongodb-uri \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" &> /dev/null || true
  
  gcloud secrets add-iam-policy-binding hss-encryption-key \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" &> /dev/null || true
  
  # Grant compute permissions
  gcloud projects add-iam-policy-binding lte-pci-mapper-65450042-bbf71 \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/compute.admin" &> /dev/null || true
  
  gcloud projects add-iam-policy-binding lte-pci-mapper-65450042-bbf71 \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser" &> /dev/null || true
  
  # Enable APIs
  echo "🔌 Enabling required APIs..."
  gcloud services enable cloudbuild.googleapis.com --quiet
  gcloud services enable compute.googleapis.com --quiet
  gcloud services enable secretmanager.googleapis.com --quiet
  gcloud services enable apphosting.googleapis.com --quiet
  
  echo ""
  echo "✅ First-time setup complete!"
  echo ""
fi

# Deploy backend to GCE
echo "📦 Step 1/3: Deploying HSS + GenieACS to GCE..."
echo ""
gcloud builds submit --config=firebase-automation/deploy-hss-to-gce.yaml

# Get external IP
echo ""
echo "🌐 Getting external IP..."
EXTERNAL_IP=$(gcloud compute instances describe genieacs-backend --zone=us-central1-a --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
echo "   External IP: $EXTERNAL_IP"

# Update apphosting.yaml with IP
echo ""
echo "📝 Step 2/3: Updating configuration with external IP..."
if command -v sed &> /dev/null; then
  # Update all <GCE-IP> placeholders
  sed -i.bak "s|<GCE-IP>|$EXTERNAL_IP|g" apphosting.yaml
  echo "   ✅ apphosting.yaml updated"
else
  echo "   ⚠️  Please manually update <GCE-IP> in apphosting.yaml with: $EXTERNAL_IP"
fi

# Deploy frontend
echo ""
echo "🎨 Step 3/3: Deploying frontend to Firebase App Hosting..."
echo ""
firebase deploy --only apphosting

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ DEPLOYMENT COMPLETE!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🌐 Your Services:"
echo ""
echo "Frontend:"
echo "  https://lte-pci-mapper-65450042-bbf71.web.app"
echo ""
echo "Backend (GCE: $EXTERNAL_IP):"
echo "  HSS REST API:     http://$EXTERNAL_IP/api/hss/"
echo "  HSS S6a:          $EXTERNAL_IP:3868"
echo "  GenieACS NBI:     http://$EXTERNAL_IP/nbi/"
echo "  GenieACS CWMP:    http://$EXTERNAL_IP:7547"
echo "  GenieACS UI:      http://$EXTERNAL_IP/admin/"
echo "  Health Check:     http://$EXTERNAL_IP/health"
echo ""
echo "📊 Monitoring:"
echo "  Firebase Console: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71"
echo "  GCE Console:      https://console.cloud.google.com/compute/instances?project=lte-pci-mapper-65450042-bbf71"
echo ""
echo "🧪 Test Your Deployment:"
echo "  curl http://$EXTERNAL_IP/health"
echo "  curl http://$EXTERNAL_IP/api/hss/health"
echo ""
echo "📝 Next Steps:"
echo "  1. Test the health endpoints above"
echo "  2. Open the web UI and navigate to HSS Management"
echo "  3. Create bandwidth plans and groups"
echo "  4. Add test subscribers"
echo "  5. Configure remote MME connections"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

