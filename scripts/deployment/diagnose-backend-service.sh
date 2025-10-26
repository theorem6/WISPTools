#!/bin/bash
# Diagnose GCE Backend Service Issues
# Usage: sudo bash diagnose-backend-service.sh

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
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

BACKEND_DIR="/opt/gce-backend"

print_header "Backend Service Diagnostics"

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    print_error "Backend directory not found: $BACKEND_DIR"
    exit 1
fi

print_success "Backend directory exists: $BACKEND_DIR"

# Check main files
print_header "Checking Backend Files"

FILES_TO_CHECK=(
    "$BACKEND_DIR/server.js"
    "$BACKEND_DIR/package.json"
    "$BACKEND_DIR/.env"
    "$BACKEND_DIR/routes/epc-deployment.js"
)

for file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$file" ]; then
        print_success "$(basename $file) exists"
    else
        print_error "$(basename $file) NOT FOUND"
    fi
done

# Check Node.js and npm
print_header "Checking Node.js Environment"

if command -v node >/dev/null 2>&1; then
    print_success "Node.js: $(node --version)"
else
    print_error "Node.js not installed"
fi

if command -v npm >/dev/null 2>&1; then
    print_success "npm: v$(npm --version)"
else
    print_error "npm not installed"
fi

# Check node_modules
print_header "Checking Dependencies"

if [ -d "$BACKEND_DIR/node_modules" ]; then
    print_success "node_modules exists"
    MODULE_COUNT=$(find "$BACKEND_DIR/node_modules" -maxdepth 1 -type d | wc -l)
    echo "  Installed modules: $MODULE_COUNT"
else
    print_error "node_modules NOT FOUND"
    echo "  Run: cd $BACKEND_DIR && npm install"
fi

# Check required dependencies
REQUIRED_MODULES=(
    "express"
    "cors"
    "morgan"
    "dotenv"
)

for module in "${REQUIRED_MODULES[@]}"; do
    if [ -d "$BACKEND_DIR/node_modules/$module" ]; then
        print_success "$module installed"
    else
        print_error "$module NOT INSTALLED"
    fi
done

# Check .env file
print_header "Checking Environment Configuration"

if [ -f "$BACKEND_DIR/.env" ]; then
    print_success ".env file exists"
    echo ""
    echo "Environment variables:"
    cat "$BACKEND_DIR/.env" | grep -v "SECRET" | grep -v "PASSWORD"
else
    print_error ".env file NOT FOUND"
fi

# Try to run the server manually
print_header "Testing Server Manually"

echo "Attempting to start server for 3 seconds..."
cd "$BACKEND_DIR"
timeout 3 node server.js 2>&1 | head -20

# Check recent logs
print_header "Recent Service Logs (Last 50 lines)"

journalctl -u gce-backend.service -n 50 --no-pager

# Check systemd service file
print_header "Systemd Service Configuration"

if [ -f "/etc/systemd/system/gce-backend.service" ]; then
    print_success "Service file exists"
    echo ""
    cat /etc/systemd/system/gce-backend.service
else
    print_error "Service file NOT FOUND"
fi

# Check permissions
print_header "File Permissions"

ls -lah "$BACKEND_DIR/server.js" 2>/dev/null || print_error "server.js not found"
ls -lah "$BACKEND_DIR/.env" 2>/dev/null || print_error ".env not found"

# Suggestions
print_header "Suggested Fixes"

echo "1. Install dependencies:"
echo "   cd $BACKEND_DIR && npm install"
echo ""
echo "2. Test server manually:"
echo "   cd $BACKEND_DIR && node server.js"
echo ""
echo "3. Check full logs:"
echo "   journalctl -u gce-backend.service -n 100 --no-pager"
echo ""
echo "4. Restart service:"
echo "   systemctl restart gce-backend.service"
echo ""

exit 0

