#!/bin/bash
# Clean up MongoDB repository configuration
# Run this to fix "Release file" errors during apt-get update
#
# Usage: sudo bash cleanup-mongodb-repo.sh

set -e

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${CYAN}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          Cleanup MongoDB Repository                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

print_status "Removing MongoDB repository files..."

# Remove MongoDB repo list files
rm -f /etc/apt/sources.list.d/mongodb*.list 2>/dev/null || true
print_success "Removed MongoDB repository files"

# Remove MongoDB GPG keys
rm -f /usr/share/keyrings/mongodb*.gpg 2>/dev/null || true
apt-key del $(apt-key list 2>/dev/null | grep -i mongodb -B 1 | grep pub | cut -d'/' -f2 | cut -d' ' -f1) 2>/dev/null || true
print_success "Removed MongoDB GPG keys"

# Update package lists
print_status "Updating package lists..."
apt-get update -qq
print_success "Package lists updated"

echo ""
print_success "MongoDB repository cleanup complete!"
echo ""
echo "You can now run: apt-get update"
echo ""

exit 0
