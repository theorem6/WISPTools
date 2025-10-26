#!/bin/bash
# Reinstall Node.js and npm cleanly
# Fixes conflicts between system Node.js and NodeSource versions
#
# Usage: sudo bash reinstall-nodejs.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

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

# Check root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          Node.js & npm Clean Reinstall                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check current installation
if command -v node >/dev/null 2>&1; then
    CURRENT_NODE=$(node --version)
    print_warning "Current Node.js: $CURRENT_NODE"
else
    CURRENT_NODE="Not installed"
    print_status "Node.js: Not installed"
fi

if command -v npm >/dev/null 2>&1; then
    CURRENT_NPM=$(npm --version)
    print_warning "Current npm: v$CURRENT_NPM"
else
    CURRENT_NPM="Not installed"
    print_status "npm: Not installed"
fi

echo ""
read -p "Continue with reinstallation? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_status "Cancelled"
    exit 0
fi

# Step 1: Fix broken packages
print_status "Step 1: Fixing broken packages..."
dpkg --configure -a 2>/dev/null || true
apt-get install -f -y 2>/dev/null || true

# Step 2: Remove ALL existing Node.js installations
print_status "Step 2: Removing existing Node.js installations..."

# Remove NodeSource Node.js
apt-get remove -y nodejs npm 2>/dev/null || true

# Remove system Node.js
apt-get remove -y nodejs-legacy nodejs-doc 2>/dev/null || true

# Remove n and nvm installations
rm -rf /usr/local/bin/node 2>/dev/null || true
rm -rf /usr/local/bin/npm 2>/dev/null || true
rm -rf /usr/local/lib/node_modules 2>/dev/null || true
rm -rf ~/.npm 2>/dev/null || true
rm -rf ~/.node-gyp 2>/dev/null || true

# Clean up
apt-get autoremove -y
apt-get autoclean

print_success "Cleanup complete"

# Step 3: Install fresh from NodeSource
print_status "Step 3: Installing Node.js 20.x from NodeSource..."

# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# Update package list
apt-get update

# Install Node.js (includes npm)
print_status "Installing nodejs package (includes npm)..."
DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs

print_success "Installation complete"

# Step 4: Verify installation
print_status "Step 4: Verifying installation..."

echo ""
echo "═══════════════════════════════════════════════════════"
echo "Installation Results:"
echo "═══════════════════════════════════════════════════════"

if command -v node >/dev/null 2>&1; then
    NEW_NODE=$(node --version)
    print_success "Node.js: $NEW_NODE"
else
    print_error "Node.js: Installation failed!"
    exit 1
fi

if command -v npm >/dev/null 2>&1; then
    NEW_NPM=$(npm --version)
    print_success "npm: v$NEW_NPM"
else
    print_error "npm: Installation failed!"
    exit 1
fi

# Show installed location
NODE_PATH=$(which node)
NPM_PATH=$(which npm)

echo ""
echo "Paths:"
echo "  Node.js: $NODE_PATH"
echo "  npm:     $NPM_PATH"

# Show global packages
echo ""
echo "Global npm packages:"
npm list -g --depth=0 2>/dev/null || echo "  (none)"

echo ""
echo "═══════════════════════════════════════════════════════"
print_success "Node.js and npm successfully installed!"
echo ""
echo "You can now run:"
echo "  node --version"
echo "  npm --version"
echo ""

exit 0

