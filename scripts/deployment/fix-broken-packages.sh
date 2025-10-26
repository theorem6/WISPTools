#!/bin/bash
# Quick fix for broken package issues on Ubuntu
# Run this if you encounter "held broken packages" errors
#
# Usage: sudo bash fix-broken-packages.sh

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

# Check root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          Fix Broken Packages - Ubuntu/Debian              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

print_status "Step 1: Configuring any unconfigured packages..."
dpkg --configure -a

print_status "Step 2: Fixing broken dependencies..."
apt-get install -f -y

print_status "Step 3: Cleaning package cache..."
apt-get clean
apt-get autoclean

print_status "Step 4: Removing unused packages..."
apt-get autoremove -y

print_status "Step 5: Updating package lists..."
apt-get update

print_success "Package system repaired!"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "System Status:"
echo "═══════════════════════════════════════════════════════"

# Check Node.js
if command -v node >/dev/null 2>&1; then
    echo "✓ Node.js: $(node --version)"
else
    echo "✗ Node.js: Not installed"
fi

# Check npm
if command -v npm >/dev/null 2>&1; then
    echo "✓ npm: v$(npm --version)"
else
    echo "✗ npm: Not installed"
fi

# Check for held packages
HELD=$(dpkg -l | grep "^h" || true)
if [ -z "$HELD" ]; then
    echo "✓ No held packages"
else
    echo "⚠ Held packages found:"
    echo "$HELD"
fi

echo ""
echo "If npm is still missing but Node.js is installed:"
echo "  apt-get remove -y nodejs npm"
echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"
echo "  apt-get install -y nodejs"
echo ""

exit 0

