#!/bin/bash
# Deploy Frontend Updates to Firebase
# Automates the complete frontend build and deployment process
#
# Usage: bash deploy-frontend-updates.sh [environment]
# Environments: production (default), staging, development

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${PURPLE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║ $(printf '%58s' "$1")${NC} ${PURPLE}║${NC}"
    echo -e "${PURPLE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_status() {
    echo -e "${CYAN}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Environment
ENVIRONMENT="${1:-production}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODULE_MANAGER_DIR="$REPO_ROOT/Module_Manager"

print_header "WISPTools.io Frontend Deployment"

echo "  Environment: $ENVIRONMENT"
echo "  Repository:  $REPO_ROOT"
echo "  Frontend:    $MODULE_MANAGER_DIR"
echo ""

# Check if we're in the right directory
if [ ! -d "$MODULE_MANAGER_DIR" ]; then
    print_error "Module_Manager directory not found"
    exit 1
fi

cd "$MODULE_MANAGER_DIR"

# Check for package.json
if [ ! -f "package.json" ]; then
    print_error "package.json not found in Module_Manager"
    exit 1
fi

# Check Node.js and npm
print_header "Checking Prerequisites"

if ! command -v node &> /dev/null; then
    print_error "Node.js not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm not installed"
    exit 1
fi

print_success "Node.js: $(node --version)"
print_success "npm: $(npm --version)"

# Check Firebase CLI
if ! command -v firebase &> /dev/null; then
    print_warning "Firebase CLI not installed"
    print_status "Installing Firebase CLI..."
    npm install -g firebase-tools
fi

print_success "Firebase CLI: $(firebase --version | head -n 1)"

# Check Firebase login
print_header "Checking Firebase Authentication"

if ! firebase projects:list &> /dev/null; then
    print_warning "Not logged into Firebase"
    print_status "Logging in to Firebase..."
    firebase login
fi

print_success "Firebase authenticated"

# Install dependencies
print_header "Installing Dependencies"

print_status "Cleaning node_modules..."
rm -rf node_modules package-lock.json

print_status "Installing dependencies..."
npm install

print_success "Dependencies installed"

# Set environment variables
print_header "Configuring Environment"

case $ENVIRONMENT in
    production)
        export VITE_API_URL="https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net"
        export VITE_GCE_IP="136.112.111.167"
        export VITE_GCE_PORT="3001"
        export VITE_FIREBASE_PROJECT="lte-pci-mapper-65450042-bbf71"
        ;;
    staging)
        export VITE_API_URL="https://staging-api.wisptools.io"
        export VITE_GCE_IP="136.112.111.167"
        export VITE_GCE_PORT="3001"
        export VITE_FIREBASE_PROJECT="lte-pci-mapper-staging"
        ;;
    development)
        export VITE_API_URL="http://localhost:3001"
        export VITE_GCE_IP="136.112.111.167"
        export VITE_GCE_PORT="3001"
        export VITE_FIREBASE_PROJECT="lte-pci-mapper-dev"
        ;;
esac

print_success "Environment configured for $ENVIRONMENT"
echo "  API URL: $VITE_API_URL"
echo "  GCE IP:  $VITE_GCE_IP:$VITE_GCE_PORT"

# Build frontend
print_header "Building Frontend"

print_status "Running production build..."
npm run build

if [ ! -d "build" ]; then
    print_error "Build failed - build directory not created"
    exit 1
fi

print_success "Frontend built successfully"

# Deploy to Firebase
print_header "Deploying to Firebase"

case $ENVIRONMENT in
    production)
        print_status "Deploying to production..."
        firebase deploy --only hosting
        ;;
    staging)
        print_status "Deploying to staging..."
        firebase deploy --only hosting:staging
        ;;
    development)
        print_status "Deploying to development..."
        firebase deploy --only hosting:dev
        ;;
esac

print_success "Frontend deployed to Firebase"

# Deploy Firebase Functions (if needed)
print_header "Deploying Firebase Functions"

cd "$REPO_ROOT/functions"

if [ -f "package.json" ]; then
    print_status "Installing function dependencies..."
    npm install
    
    cd "$REPO_ROOT"
    
    print_status "Deploying functions..."
    firebase deploy --only functions
    
    print_success "Functions deployed"
else
    print_warning "No functions to deploy"
fi

# Deploy Firestore rules
print_header "Deploying Firestore Rules"

cd "$REPO_ROOT"

if [ -f "firestore.rules" ]; then
    print_status "Deploying Firestore rules..."
    firebase deploy --only firestore:rules
    print_success "Firestore rules deployed"
fi

# Deploy Storage rules
if [ -f "storage.rules" ]; then
    print_status "Deploying Storage rules..."
    firebase deploy --only storage
    print_success "Storage rules deployed"
fi

# Final summary
print_header "DEPLOYMENT COMPLETE"

echo ""
echo -e "${GREEN}✓ Frontend deployment successful!${NC}"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}DEPLOYMENT SUMMARY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "  Environment:     $ENVIRONMENT"
echo "  Firebase Project: lte-pci-mapper-65450042-bbf71"
echo "  GCE Backend:     http://136.112.111.167:3001"
echo ""

case $ENVIRONMENT in
    production)
        echo "  Live URL:        https://lte-pci-mapper-65450042-bbf71.web.app"
        echo "  Custom Domain:   https://wisptools.io"
        ;;
    staging)
        echo "  Live URL:        https://staging.wisptools.io"
        ;;
    development)
        echo "  Live URL:        https://dev.wisptools.io"
        ;;
esac

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}VERIFICATION STEPS${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "  1. Visit the live URL above"
echo "  2. Check HSS Management module"
echo "  3. Verify Deploy EPC tab is visible"
echo "  4. Test ISO generation"
echo "  5. Check browser console for errors"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}ROLLBACK (if needed)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "  firebase hosting:rollback"
echo ""
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo ""

exit 0

