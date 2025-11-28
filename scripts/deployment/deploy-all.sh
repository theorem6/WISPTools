#!/bin/bash
# Deploy All - Complete Deployment Script
# Deploys backend to GCE and ensures all scripts are in place

set -e

GCE_INSTANCE="acs-hss-server"
GCE_ZONE="us-central1-a"
GCE_IP="136.112.111.167"
REPO_DIR="/opt/lte-pci-mapper"
SCRIPTS_DIR="/var/www/html/downloads/scripts"

echo "🚀 Starting Complete Deployment"
echo "================================"
echo ""

# Check if gcloud is available
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI not found"
    echo "   Please install Google Cloud SDK first"
    exit 1
fi

echo "✅ gcloud CLI found"
echo ""

# Function to run command on GCE server
run_on_gce() {
    gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --command="$1"
}

echo "📡 Connecting to GCE server..."
echo ""

# Step 1: Update backend from GitHub
echo "📥 Step 1: Updating backend from GitHub..."
run_on_gce "cd $REPO_DIR && sudo bash scripts/deployment/update-backend-from-git.sh"

echo ""
echo "✅ Backend updated from GitHub"
echo ""

# Step 2: Ensure scripts directory exists
echo "📁 Step 2: Ensuring scripts directory exists..."
run_on_gce "sudo mkdir -p $SCRIPTS_DIR && sudo chown -R www-data:www-data /var/www/html/downloads && sudo chmod -R 755 /var/www/html/downloads"

echo ""
echo "✅ Scripts directory ready"
echo ""

# Step 3: Copy EPC scripts to download directory
echo "📋 Step 3: Copying EPC scripts to download directory..."

# Copy check-in agent
echo "  → Copying epc-checkin-agent.sh..."
run_on_gce "sudo cp $REPO_DIR/backend-services/scripts/epc-checkin-agent.sh $SCRIPTS_DIR/ && sudo chmod 755 $SCRIPTS_DIR/epc-checkin-agent.sh"

# Copy SNMP discovery script
echo "  → Copying epc-snmp-discovery.sh..."
run_on_gce "sudo cp $REPO_DIR/backend-services/scripts/epc-snmp-discovery.sh $SCRIPTS_DIR/ && sudo chmod 755 $SCRIPTS_DIR/epc-snmp-discovery.sh"

echo ""
echo "✅ Scripts copied successfully"
echo ""

# Step 4: Verify services are running
echo "🔍 Step 4: Verifying services..."
run_on_gce "pm2 status"

echo ""
echo "✅ Services verified"
echo ""

# Step 5: Show latest commit
echo "📝 Step 5: Latest deployment commit..."
run_on_gce "cd $REPO_DIR && git log -1 --oneline"

echo ""
echo "================================"
echo "✅ Deployment Complete!"
echo ""
echo "🔗 Services:"
echo "  - Frontend: https://wisptools-production.web.app"
echo "  - Backend API: https://hss.wisptools.io"
echo ""
echo "📋 Scripts available at:"
echo "  - https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh"
echo "  - https://hss.wisptools.io/downloads/scripts/epc-snmp-discovery.sh"
echo ""

