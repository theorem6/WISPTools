#!/bin/bash

# Setup Google Cloud Build Trigger for Automated Deployment
# This script configures automatic deployment from git repository

set -e

echo "🚀 Setting up Google Cloud Build Trigger for Automated Deployment..."

# Check if gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Please install Google Cloud SDK first."
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Not authenticated with gcloud. Please run 'gcloud auth login' first."
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ No project ID set. Please run 'gcloud config set project YOUR_PROJECT_ID' first."
    exit 1
fi

echo "📋 Project ID: $PROJECT_ID"

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable apphosting.googleapis.com
gcloud services enable firebase.googleapis.com
gcloud services enable compute.googleapis.com

# Create Cloud Build trigger
echo "🎯 Creating Cloud Build trigger..."

# Create trigger configuration
cat > cloud-build-trigger.json << EOF
{
  "name": "auto-deploy-wisptools",
  "description": "Automated deployment of WISPTools.io from git repository",
  "github": {
    "owner": "theorem6",
    "name": "lte-pci-mapper",
    "push": {
      "branch": "main"
    }
  },
  "filename": "cloudbuild-auto-deploy.yaml",
  "substitutions": {
    "_FIREBASE_TOKEN": "",
    "_GCE_ZONE": "us-central1-a",
    "_GCE_INSTANCE": "backend-server"
  },
  "options": {
    "logging": "CLOUD_LOGGING_ONLY",
    "machineType": "N1_HIGHCPU_8",
    "diskSizeGb": 100
  }
}
EOF

# Create the trigger
gcloud builds triggers create github \
  --trigger-config=cloud-build-trigger.json \
  --project=$PROJECT_ID

echo "✅ Cloud Build trigger created successfully!"

# Create service account for deployment
echo "🔐 Creating service account for deployment..."
gcloud iam service-accounts create wisptools-deploy \
  --display-name="WISPTools Deployment Service Account" \
  --description="Service account for automated WISPTools deployment" \
  --project=$PROJECT_ID

# Grant necessary permissions
echo "🔑 Granting permissions..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:wisptools-deploy@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:wisptools-deploy@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/firebase.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:wisptools-deploy@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/compute.instanceAdmin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:wisptools-deploy@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Create GCS bucket for deployments
echo "📦 Creating deployment storage bucket..."
gsutil mb -p $PROJECT_ID gs://$PROJECT_ID-deployments || echo "Bucket already exists"

# Set up Firebase token (requires manual step)
echo "🔑 Setting up Firebase token..."
echo "⚠️  Manual step required:"
echo "1. Go to: https://console.firebase.google.com/project/$PROJECT_ID/settings/serviceaccounts/adminsdk"
echo "2. Generate a new private key"
echo "3. Save it as 'firebase-service-account.json' in your project root"
echo "4. Run: gcloud secrets create firebase-token --data-file=firebase-service-account.json"

# Create deployment script for GCE
echo "📝 Creating GCE deployment script..."
cat > deploy-to-gce.sh << 'EOF'
#!/bin/bash

# Deploy backend services to GCE instance
# This script is run on the GCE instance to update the backend

set -e

echo "🚀 Starting backend deployment on GCE..."

# Create deployment directory
sudo mkdir -p /opt/wisptools
cd /opt/wisptools

# Download latest deployment
echo "📥 Downloading latest deployment..."
gsutil cp gs://$PROJECT_ID-deployments/backend-*.tar.gz backend-latest.tar.gz

# Extract deployment
echo "📦 Extracting deployment..."
tar -xzf backend-latest.tar.gz
cd backend-services

# Install dependencies
echo "🔧 Installing dependencies..."
npm install --production

# Create systemd service for backend
echo "⚙️ Creating systemd service..."
sudo tee /etc/systemd/system/wisptools-backend.service > /dev/null << 'SERVICE_EOF'
[Unit]
Description=WISPTools Backend API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/wisptools/backend-services
ExecStart=/usr/bin/node server-modular.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# Create systemd service for HSS
sudo tee /etc/systemd/system/wisptools-hss.service > /dev/null << 'SERVICE_EOF'
[Unit]
Description=WISPTools HSS Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/wisptools/backend-services
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# Enable and start services
echo "🔄 Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable wisptools-backend
sudo systemctl enable wisptools-hss
sudo systemctl restart wisptools-backend
sudo systemctl restart wisptools-hss

# Check service status
echo "🏥 Checking service status..."
sudo systemctl status wisptools-backend --no-pager
sudo systemctl status wisptools-hss --no-pager

echo "✅ Backend deployment complete!"
echo "🌐 Backend API: http://$(curl -s ifconfig.me):3000"
echo "🔐 HSS API: http://$(curl -s ifconfig.me):3001"
EOF

chmod +x deploy-to-gce.sh

# Upload deployment script to GCS
gsutil cp deploy-to-gce.sh gs://$PROJECT_ID-deployments/

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Set up Firebase token as described above"
echo "2. Create a GCE instance named 'backend-server' in us-central1-a"
echo "3. Upload the deployment script to the GCE instance"
echo "4. Push changes to the main branch to trigger deployment"
echo ""
echo "🔗 Useful links:"
echo "- Cloud Build: https://console.cloud.google.com/cloud-build/triggers?project=$PROJECT_ID"
echo "- Firebase Console: https://console.firebase.google.com/project/$PROJECT_ID"
echo "- GCE Instances: https://console.cloud.google.com/compute/instances?project=$PROJECT_ID"
echo ""
echo "🎉 Automated deployment is now configured!"