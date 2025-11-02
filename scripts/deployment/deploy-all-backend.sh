#!/bin/bash
# Deploy All Backend Updates to GCE Server
# This includes:
# - Monetization updates (billing, equipment pricing, etc.)
# - EPC dependency fixes (cmake, flex, bison)
# - All route and utility updates

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║      Deploy All Backend Updates to GCE Server             ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
BACKEND_DIR="/opt/hss-api"
REPO_DIR="/root/lte-pci-mapper"
SERVICE_NAME="hss-api"
GCE_BACKEND_DIR="/opt/gce-backend"

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
cp -r "$BACKEND_DIR/models" "$BACKEND_DIR/" 2>/dev/null || true
cp -r "$BACKEND_DIR/routes" "$BACKEND_DIR/" 2>/dev/null || true
cp -r "$BACKEND_DIR/utils" "$BACKEND_DIR/" 2>/dev/null || true
echo -e "${GREEN}✓${NC} Backup created at $BACKUP_DIR"

echo ""
echo -e "${CYAN}▶${NC} Step 3: Stopping service..."
systemctl stop "$SERVICE_NAME" || {
    echo -e "${YELLOW}⚠${NC} Service was not running"
}
sleep 2
echo -e "${GREEN}✓${NC} Service stopped"

echo ""
echo -e "${CYAN}▶${NC} Step 4: Copying files..."

# Create directories
mkdir -p "$BACKEND_DIR/middleware"
mkdir -p "$BACKEND_DIR/models"
mkdir -p "$BACKEND_DIR/routes"
mkdir -p "$BACKEND_DIR/utils"

# Copy all backend-services files
echo "   Copying backend-services files..."

# Copy middleware
if [ -f "$REPO_DIR/backend-services/middleware/admin-auth.js" ]; then
    cp "$REPO_DIR/backend-services/middleware/admin-auth.js" "$BACKEND_DIR/middleware/" && echo "   ✓ admin-auth.js"
fi

# Copy models
for model in equipment-pricing.js installation-documentation.js subcontractor.js; do
    if [ -f "$REPO_DIR/backend-services/models/$model" ]; then
        cp "$REPO_DIR/backend-services/models/$model" "$BACKEND_DIR/models/" && echo "   ✓ $model"
    fi
done

# Copy routes
for route in epc-deployment.js epc.js hss-management.js equipment-pricing.js installation-documentation.js subcontractors.js plans.js system.js; do
    if [ -f "$REPO_DIR/backend-services/routes/$route" ]; then
        cp "$REPO_DIR/backend-services/routes/$route" "$BACKEND_DIR/routes/" && echo "   ✓ $route"
    fi
done

# Copy utilities (EPC deployment helpers - includes cmake/flex/bison fix)
if [ -f "$REPO_DIR/gce-backend/utils/deployment-helpers.js" ]; then
    cp "$REPO_DIR/gce-backend/utils/deployment-helpers.js" "$BACKEND_DIR/utils/" && echo "   ✓ deployment-helpers.js (EPC dependencies fix)"
fi
if [ -f "$REPO_DIR/gce-backend/utils/bootstrap-helpers.js" ]; then
    cp "$REPO_DIR/gce-backend/utils/bootstrap-helpers.js" "$BACKEND_DIR/utils/" && echo "   ✓ bootstrap-helpers.js"
fi
if [ -f "$REPO_DIR/gce-backend/utils/iso-helpers.js" ]; then
    cp "$REPO_DIR/gce-backend/utils/iso-helpers.js" "$BACKEND_DIR/utils/" && echo "   ✓ iso-helpers.js"
fi

# Copy main backend files
for file in billing-api.js monitoring-service.js server.js; do
    if [ -f "$REPO_DIR/backend-services/$file" ]; then
        cp "$REPO_DIR/backend-services/$file" "$BACKEND_DIR/" && echo "   ✓ $file"
    fi
done

echo -e "${GREEN}✓${NC} Files copied"

echo ""
echo -e "${CYAN}▶${NC} Step 5: Verifying syntax..."
cd "$BACKEND_DIR"
ERRORS=0

# Check all JavaScript files
for file in $(find . -name "*.js" -type f); do
    if node --check "$file" 2>/dev/null; then
        continue
    else
        echo -e "${RED}✗${NC} Syntax error in $file"
        ERRORS=$((ERRORS + 1))
    fi
done

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}✗${NC} Found $ERRORS file(s) with syntax errors"
    exit 1
fi
echo -e "${GREEN}✓${NC} All files syntax OK"

echo ""
echo -e "${CYAN}▶${NC} Step 6: Checking .env file..."
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "   Creating .env file from template..."
    if [ -f "$REPO_DIR/backend-services/.env.example" ]; then
        cp "$REPO_DIR/backend-services/.env.example" "$BACKEND_DIR/.env" && echo -e "${GREEN}✓${NC} .env created"
    fi
    echo -e "${YELLOW}⚠${NC} Please edit $BACKEND_DIR/.env and configure required variables"
else
    echo -e "${GREEN}✓${NC} .env file exists"
fi

echo ""
echo -e "${CYAN}▶${NC} Step 7: Starting service..."
systemctl daemon-reload
systemctl start "$SERVICE_NAME"
sleep 3

if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}✓${NC} Service started successfully"
else
    echo -e "${RED}✗${NC} Service failed to start"
    echo "   Checking logs..."
    journalctl -u "$SERVICE_NAME" -n 30 --no-pager
    exit 1
fi

echo ""
echo -e "${CYAN}▶${NC} Step 8: Testing endpoints..."
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
echo "  ✓ All backend routes updated"
echo "  ✓ Monetization system deployed (billing, equipment pricing)"
echo "  ✓ EPC dependency fixes deployed (cmake, flex, bison)"
echo "  ✓ Installation documentation system deployed"
echo "  ✓ Subcontractor management deployed"
echo ""
echo "Service Status:"
systemctl status "$SERVICE_NAME" --no-pager -l | head -n 10
echo ""
echo "Backup location: $BACKUP_DIR"
echo ""

