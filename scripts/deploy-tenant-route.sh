#!/bin/bash
# Deploy tenant creation route to GCE backend

echo "🚀 Deploying tenant creation route to GCE backend..."

# Copy files
gcloud compute scp backend-services/routes/tenants.js acs-hss-server:/opt/hss-api/routes/ --zone=us-central1-a
gcloud compute scp backend-services/server.js acs-hss-server:/opt/hss-api/ --zone=us-central1-a

# Restart backend service
echo "🔄 Restarting backend service..."
gcloud compute ssh acs-hss-server --zone=us-central1-a --command="cd /opt/hss-api && pm2 restart main-api"

echo "✅ Deployment complete!"

