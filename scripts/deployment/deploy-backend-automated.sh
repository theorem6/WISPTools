#!/bin/bash
# Automated Backend Deployment Script
# Deploys backend changes to GCE and restarts services automatically

set -e  # Exit on error

INSTANCE_NAME="acs-hss-server"
ZONE="us-central1-a"
PROJECT="lte-pci-mapper-65450042-bbf71"
TEMP_DIR="/tmp/backend-deploy-$$"

echo "🚀 Starting automated backend deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if gcloud is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${RED}❌ Error: Not authenticated with gcloud${NC}"
    echo "Please run: gcloud auth login"
    exit 1
fi

# Create temp directory on server
echo -e "${YELLOW}📦 Preparing deployment...${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="mkdir -p $TEMP_DIR" || exit 1

# Files to deploy (routes, models, middleware, etc.)
FILES=(
    "backend-services/routes/customers.js"
    "backend-services/models/customer.js"
    "backend-services/routes/work-orders.js"
    "backend-services/models/work-order.js"
    "backend-services/routes/plans.js"
    "backend-services/models/plan.js"
)

# Copy files to server
echo -e "${YELLOW}📤 Copying files to server...${NC}"
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "  → Copying $filename"
        gcloud compute scp "$file" $INSTANCE_NAME:$TEMP_DIR/$filename --zone=$ZONE || {
            echo -e "${RED}❌ Failed to copy $file${NC}"
            exit 1
        }
    else
        echo -e "${YELLOW}⚠️  File not found: $file (skipping)${NC}"
    fi
done

# Deploy and restart
echo -e "${YELLOW}🔧 Deploying to /opt/hss-api...${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
    set -e
    
    # Backup existing files
    BACKUP_DIR=\"/opt/hss-api/routes/backups/backup-\$(date +%Y%m%d-%H%M%S)\"
    mkdir -p \$BACKUP_DIR
    mkdir -p /opt/hss-api/routes
    mkdir -p /opt/hss-api/models
    
    # Backup and copy customers route
    if [ -f /opt/hss-api/customer-api.js ]; then
        cp /opt/hss-api/customer-api.js \$BACKUP_DIR/customer-api.js.backup 2>/dev/null || true
    fi
    if [ -f $TEMP_DIR/customers.js ]; then
        cp $TEMP_DIR/customers.js /opt/hss-api/customer-api.js
        sed -i 's|../models/customer|./customer-schema|g' /opt/hss-api/customer-api.js
        chown root:root /opt/hss-api/customer-api.js
        node --check /opt/hss-api/customer-api.js || exit 1
    fi
    
    # Copy models
    if [ -f $TEMP_DIR/customer.js ]; then
        if [ -f /opt/hss-api/customer-schema.js ]; then
            cp /opt/hss-api/customer-schema.js \$BACKUP_DIR/customer-schema.js.backup 2>/dev/null || true
        fi
        cp $TEMP_DIR/customer.js /opt/hss-api/customer-schema.js
        chown root:root /opt/hss-api/customer-schema.js
        node --check /opt/hss-api/customer-schema.js || exit 1
    fi
    
    # Copy other routes to routes directory
    if [ -f $TEMP_DIR/work-orders.js ]; then
        if [ -f /opt/hss-api/routes/work-orders.js ]; then
            cp /opt/hss-api/routes/work-orders.js \$BACKUP_DIR/work-orders.js.backup 2>/dev/null || true
        fi
        cp $TEMP_DIR/work-orders.js /opt/hss-api/routes/work-orders.js
        chown root:root /opt/hss-api/routes/work-orders.js
        node --check /opt/hss-api/routes/work-orders.js || exit 1
    fi
    
    if [ -f $TEMP_DIR/plans.js ]; then
        if [ -f /opt/hss-api/routes/plans.js ]; then
            cp /opt/hss-api/routes/plans.js \$BACKUP_DIR/plans.js.backup 2>/dev/null || true
        fi
        cp $TEMP_DIR/plans.js /opt/hss-api/routes/plans.js
        chown root:root /opt/hss-api/routes/plans.js
        node --check /opt/hss-api/routes/plans.js || exit 1
    fi
    
    # Cleanup temp files
    rm -rf $TEMP_DIR
    
    echo '✅ Files deployed successfully'
" || {
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
}

# Restart service
echo -e "${YELLOW}🔄 Restarting hss-api service...${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
    sudo systemctl daemon-reload
    sudo systemctl restart hss-api
    sleep 3
    sudo systemctl status hss-api --no-pager -l | head -n 15
" || {
    echo -e "${RED}❌ Service restart failed${NC}"
    exit 1
}

# Health check
echo -e "${YELLOW}🏥 Checking service health...${NC}"
HEALTH=$(gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
    curl -s http://localhost:3001/health 2>/dev/null || curl -s http://localhost:3000/health 2>/dev/null || echo 'FAILED'
" 2>/dev/null)

if echo "$HEALTH" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Service is healthy!${NC}"
    echo "$HEALTH"
else
    echo -e "${RED}⚠️  Service health check returned:${NC}"
    echo "$HEALTH"
    echo -e "${YELLOW}⚠️  Service may still be starting up. Please check manually.${NC}"
fi

echo -e "${GREEN}✨ Deployment complete!${NC}"

