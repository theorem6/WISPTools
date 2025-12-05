#!/bin/bash
# Bash Script to Deploy Backend Dependency Updates to GCE
# This script will SSH to GCE server, pull latest code, install dependencies, and restart services

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🚀 Backend Dependency Updates Deployment${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

# Configuration
GCE_INSTANCE="acs-hss-server"
GCE_ZONE="us-central1-a"
REPO_DIR="/opt/lte-pci-mapper"
REPO_DIR_ALT="/root/lte-pci-mapper"

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "  Instance: $GCE_INSTANCE"
echo "  Zone: $GCE_ZONE"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Error: gcloud CLI not found${NC}"
    echo "   Please install Google Cloud SDK first"
    echo "   Download from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo -e "${GREEN}✅ gcloud CLI found${NC}"
echo ""

# Check authentication
echo -e "${YELLOW}🔐 Checking authentication...${NC}"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${RED}❌ Error: Not authenticated with gcloud${NC}"
    echo "   Please run: gcloud auth login"
    exit 1
fi

AUTH_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n 1)
echo -e "${GREEN}✅ Authenticated as: $AUTH_ACCOUNT${NC}"
echo ""

# Deployment commands
DEPLOYMENT_SCRIPT="
set -e

echo '🚀 Starting backend dependency updates deployment...'
echo ''

# Determine repo directory
if [ -d '$REPO_DIR/.git' ]; then
    REPO_DIR='$REPO_DIR'
elif [ -d '$REPO_DIR_ALT/.git' ]; then
    REPO_DIR='$REPO_DIR_ALT'
else
    echo '❌ Error: Repository not found at $REPO_DIR or $REPO_DIR_ALT'
    echo '   Please check repository location'
    exit 1
fi

echo \"📁 Using repository directory: \$REPO_DIR\"
echo ''

# Navigate to repo
cd \"\$REPO_DIR\"

# Pull latest changes
echo '📥 Pulling latest code from GitHub...'
git fetch origin main
git pull origin main --no-edit || {
    echo '⚠️  Pull failed, resetting to GitHub state...'
    git fetch origin main
    git reset --hard origin/main
}

echo '✅ Code updated from GitHub'
echo ''

# Check latest commit
echo '📝 Latest commit:'
git log -1 --oneline
echo ''

# Navigate to backend services
cd \"\$REPO_DIR/backend-services\"

# Install updated dependencies
echo '📦 Installing updated npm dependencies...'
npm install --production

echo ''
echo '✅ Dependencies installed'
echo ''

# Restart PM2 services
echo '🔄 Restarting PM2 services...'

# Restart all services
pm2 restart all --update-env || true

echo ''
echo '✅ Services restarted'
echo ''

# Save PM2 process list
pm2 save

echo ''
echo '📊 Service Status:'
pm2 status

echo ''
echo '✅ Backend deployment complete!'
"

echo -e "${YELLOW}📤 Connecting to GCE server and deploying...${NC}"
echo ""

# Execute deployment
if gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --command="$DEPLOYMENT_SCRIPT" --tunnel-through-iap; then
    echo ""
    echo -e "${GREEN}✅ Backend deployment completed successfully!${NC}"
    echo ""
    echo -e "${CYAN}🧪 Verify deployment:${NC}"
    echo "  1. Check API health: https://hss.wisptools.io/api/health"
    echo "  2. Check PM2 status on server"
    echo "  3. Monitor logs for any errors"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Deployment failed${NC}"
    echo ""
    echo -e "${YELLOW}📋 Manual deployment instructions:${NC}"
    echo "  1. SSH to server: gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --tunnel-through-iap"
    echo "  2. Run: cd /opt/lte-pci-mapper"
    echo "  3. Run: git pull origin main"
    echo "  4. Run: cd backend-services && npm install --production"
    echo "  5. Run: pm2 restart all"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 All done!${NC}"

