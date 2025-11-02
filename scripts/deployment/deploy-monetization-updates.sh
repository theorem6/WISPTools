#!/bin/bash
# Deploy Monetization Updates to GCE Backend
# This script deploys:
# - Admin authentication middleware
# - Billing API updates
# - Equipment pricing system
# - System routes updates
# - Server.js updates

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Deploy Monetization Updates to GCE Backend           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
BACKEND_DIR="/opt/hss-api"
REPO_DIR="/root/lte-pci-mapper"
SERVICE_NAME="hss-api"

# Check if running on GCE server
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}✗${NC} Backend directory not found. This script must run on the GCE server."
    echo "   SSH into the server first: ssh root@136.112.111.167"
    exit 1
fi

echo -e "${CYAN}▶${NC} Step 1: Updating repository..."
cd "$REPO_DIR"
git pull origin main || {
    echo -e "${YELLOW}⚠${NC} Git pull failed. Trying fetch and merge..."
    git fetch origin main
    git merge origin/main || {
        echo -e "${RED}✗${NC} Failed to update repository. Please check git status."
        exit 1
    }
}
echo -e "${GREEN}✓${NC} Repository updated"

echo ""
echo -e "${CYAN}▶${NC} Step 2: Creating backup..."
BACKUP_DIR="$BACKEND_DIR/backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r "$BACKEND_DIR"/*.js "$BACKUP_DIR/" 2>/dev/null || true
cp -r "$BACKEND_DIR/middleware" "$BACKUP_DIR/" 2>/dev/null || true
cp -r "$BACKEND_DIR/models" "$BACKUP_DIR/" 2>/dev/null || true
cp -r "$BACKEND_DIR/routes" "$BACKUP_DIR/" 2>/dev/null || true
echo -e "${GREEN}✓${NC} Backup created at $BACKUP_DIR"

echo ""
echo -e "${CYAN}▶${NC} Step 3: Stopping service..."
systemctl stop "$SERVICE_NAME" || {
    echo -e "${YELLOW}⚠${NC} Service was not running"
}
sleep 2
echo -e "${GREEN}✓${NC} Service stopped"

echo ""
echo -e "${CYAN}▶${NC} Step 4: Copying new files..."

# Create directories if they don't exist
mkdir -p "$BACKEND_DIR/middleware"
mkdir -p "$BACKEND_DIR/models"
mkdir -p "$BACKEND_DIR/routes"

# Copy admin authentication middleware
echo "   Copying admin-auth.js..."
cp "$REPO_DIR/backend-services/middleware/admin-auth.js" "$BACKEND_DIR/middleware/" || {
    echo -e "${RED}✗${NC} Failed to copy admin-auth.js"
    exit 1
}

# Copy billing API
echo "   Copying billing-api.js..."
cp "$REPO_DIR/backend-services/billing-api.js" "$BACKEND_DIR/" || {
    echo -e "${RED}✗${NC} Failed to copy billing-api.js"
    exit 1
}

# Copy equipment pricing model
echo "   Copying equipment-pricing.js model..."
cp "$REPO_DIR/backend-services/models/equipment-pricing.js" "$BACKEND_DIR/models/" || {
    echo -e "${RED}✗${NC} Failed to copy equipment-pricing.js model"
    exit 1
}

# Copy equipment pricing routes
echo "   Copying equipment-pricing.js route..."
cp "$REPO_DIR/backend-services/routes/equipment-pricing.js" "$BACKEND_DIR/routes/" || {
    echo -e "${RED}✗${NC} Failed to copy equipment-pricing.js route"
    exit 1
}

# Copy updated system routes
echo "   Copying system.js route..."
cp "$REPO_DIR/backend-services/routes/system.js" "$BACKEND_DIR/routes/" || {
    echo -e "${RED}✗${NC} Failed to copy system.js"
    exit 1
}

# Copy updated plans route
echo "   Copying plans.js route..."
cp "$REPO_DIR/backend-services/routes/plans.js" "$BACKEND_DIR/routes/" || {
    echo -e "${RED}✗${NC} Failed to copy plans.js"
    exit 1
}

# Copy updated EPC deployment route
echo "   Copying epc-deployment.js route..."
cp "$REPO_DIR/backend-services/routes/epc-deployment.js" "$BACKEND_DIR/routes/" || {
    echo -e "${RED}✗${NC} Failed to copy epc-deployment.js"
    exit 1
}

# Copy server.js if it needs the billing route (check if it's already there)
if ! grep -q "app.use('/api/billing'" "$BACKEND_DIR/server.js" 2>/dev/null; then
    echo "   Updating server.js with billing route..."
    cp "$BACKEND_DIR/server.js" "$BACKEND_DIR/server.js.backup-$(date +%Y%m%d-%H%M%S)"
    # Add billing route after system route
    sed -i "/app.use('\/api\/system'/a app.use('/api/billing', require('./billing-api'));" "$BACKEND_DIR/server.js" || {
        echo -e "${YELLOW}⚠${NC} Could not auto-add billing route. Please add manually:"
        echo "   app.use('/api/billing', require('./billing-api'));"
    }
fi

# Check if equipment-pricing route is in server.js
if ! grep -q "app.use('/api/equipment-pricing'" "$BACKEND_DIR/server.js" 2>/dev/null; then
    echo "   Updating server.js with equipment-pricing route..."
    sed -i "/app.use('\/api\/billing'/a app.use('/api/equipment-pricing', require('./routes/equipment-pricing'));" "$BACKEND_DIR/server.js" || {
        echo -e "${YELLOW}⚠${NC} Could not auto-add equipment-pricing route. Please add manually:"
        echo "   app.use('/api/equipment-pricing', require('./routes/equipment-pricing'));"
    }
fi

echo -e "${GREEN}✓${NC} Files copied"

echo ""
echo -e "${CYAN}▶${NC} Step 5: Verifying syntax..."
cd "$BACKEND_DIR"
node --check middleware/admin-auth.js && echo "   ✓ admin-auth.js syntax OK" || {
    echo -e "${RED}✗${NC} admin-auth.js has syntax errors"
    exit 1
}
node --check billing-api.js && echo "   ✓ billing-api.js syntax OK" || {
    echo -e "${RED}✗${NC} billing-api.js has syntax errors"
    exit 1
}
node --check models/equipment-pricing.js && echo "   ✓ equipment-pricing.js model syntax OK" || {
    echo -e "${RED}✗${NC} equipment-pricing.js model has syntax errors"
    exit 1
}
node --check routes/equipment-pricing.js && echo "   ✓ equipment-pricing.js route syntax OK" || {
    echo -e "${RED}✗${NC} equipment-pricing.js route has syntax errors"
    exit 1
}
node --check routes/system.js && echo "   ✓ system.js syntax OK" || {
    echo -e "${RED}✗${NC} system.js has syntax errors"
    exit 1
}
node --check routes/plans.js && echo "   ✓ plans.js syntax OK" || {
    echo -e "${RED}✗${NC} plans.js has syntax errors"
    exit 1
}
node --check server.js && echo "   ✓ server.js syntax OK" || {
    echo -e "${RED}✗${NC} server.js has syntax errors"
    exit 1
}

echo ""
echo -e "${CYAN}▶${NC} Step 6: Checking .env file..."
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "   Creating .env file from template..."
    cp "$REPO_DIR/backend-services/.env.example" "$BACKEND_DIR/.env" || {
        echo -e "${YELLOW}⚠${NC} Could not copy .env.example. Please create .env manually."
    }
    echo -e "${YELLOW}⚠${NC} IMPORTANT: Edit $BACKEND_DIR/.env and add your PayPal credentials!"
    echo "   Required variables:"
    echo "   - PAYPAL_CLIENT_ID"
    echo "   - PAYPAL_CLIENT_SECRET"
    echo "   - PAYPAL_ENVIRONMENT (sandbox or live)"
else
    echo -e "${GREEN}✓${NC} .env file exists"
    if ! grep -q "PAYPAL_CLIENT_ID=" "$BACKEND_DIR/.env"; then
        echo -e "${YELLOW}⚠${NC} PayPal credentials not found in .env. Please add them!"
    fi
fi

echo ""
echo -e "${CYAN}▶${NC} Step 7: Starting service..."
systemctl start "$SERVICE_NAME"
sleep 3

if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}✓${NC} Service started successfully"
else
    echo -e "${RED}✗${NC} Service failed to start"
    echo "   Checking logs..."
    journalctl -u "$SERVICE_NAME" -n 20 --no-pager
    exit 1
fi

echo ""
echo -e "${CYAN}▶${NC} Step 8: Testing health endpoint..."
sleep 2
if curl -s http://localhost:3001/health > /dev/null; then
    echo -e "${GREEN}✓${NC} Health check passed"
else
    echo -e "${YELLOW}⚠${NC} Health check failed (service may still be starting)"
fi

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ DEPLOYMENT COMPLETE${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Summary:"
echo "  ✓ Admin authentication middleware deployed"
echo "  ✓ Billing API deployed"
echo "  ✓ Equipment pricing system deployed"
echo "  ✓ System routes updated"
echo "  ✓ Plans route updated"
echo "  ✓ EPC deployment route updated"
echo ""
echo "Next steps:"
echo "  1. Edit $BACKEND_DIR/.env and add PayPal credentials"
echo "  2. Test billing endpoints with admin token"
echo "  3. Verify service: systemctl status $SERVICE_NAME"
echo "  4. Check logs: journalctl -u $SERVICE_NAME -f"
echo ""
echo "Backup location: $BACKUP_DIR"
echo ""
