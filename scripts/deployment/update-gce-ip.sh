#!/bin/bash
# Update GCE IP Address Across All System Components
# Usage: bash update-gce-ip.sh [NEW_IP_ADDRESS]
#
# Updates:
# - Backend configuration
# - Frontend UI
# - Deployment scripts
# - Environment files

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

# Current and new IP
CURRENT_IP="136.112.111.167"
NEW_IP="${1:-$CURRENT_IP}"

if [ "$NEW_IP" == "$CURRENT_IP" ]; then
    print_status "IP is already set to $CURRENT_IP"
    print_status "To change, run: bash $0 [NEW_IP]"
    exit 0
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          Update GCE IP Address Configuration              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "  Current IP: $CURRENT_IP"
echo "  New IP:     $NEW_IP"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_status "Cancelled"
    exit 0
fi

# Find repository root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

print_status "Repository: $REPO_ROOT"

# Update files
FILES_TO_UPDATE=(
    "gce-backend/routes/epc-deployment.js"
    "Module_Manager/src/routes/modules/hss-management/components/DeployEPC.svelte"
    "distributed-epc/utils/script-generator.js"
    "scripts/deployment/deploy-gce-iso-builder.sh"
    "scripts/deployment/deploy-all-automated.sh"
)

UPDATED_COUNT=0

for file in "${FILES_TO_UPDATE[@]}"; do
    if [ -f "$file" ]; then
        print_status "Updating $file..."
        
        # Create backup
        cp "$file" "$file.bak"
        
        # Replace IP
        sed -i "s/$CURRENT_IP/$NEW_IP/g" "$file"
        
        # Check if actually changed
        if ! diff -q "$file" "$file.bak" > /dev/null 2>&1; then
            print_success "Updated $file"
            ((UPDATED_COUNT++))
        else
            print_status "No changes needed in $file"
        fi
        
        rm "$file.bak"
    else
        print_error "File not found: $file"
    fi
done

# Update .env files if they exist
print_status "Updating environment files..."

if [ -f "gce-backend/.env" ]; then
    sed -i "s/GCE_PUBLIC_IP=.*/GCE_PUBLIC_IP=$NEW_IP/" gce-backend/.env
    print_success "Updated gce-backend/.env"
fi

if [ -f "/opt/gce-backend/.env" ]; then
    sudo sed -i "s/GCE_PUBLIC_IP=.*/GCE_PUBLIC_IP=$NEW_IP/" /opt/gce-backend/.env
    print_success "Updated /opt/gce-backend/.env"
fi

# Update systemd service if exists
if [ -f "/etc/systemd/system/wisptools-backend.service" ]; then
    print_status "Updating systemd service..."
    sudo sed -i "s/Environment=\"GCE_PUBLIC_IP=.*\"/Environment=\"GCE_PUBLIC_IP=$NEW_IP\"/" /etc/systemd/system/wisptools-backend.service
    sudo systemctl daemon-reload
    print_success "Updated systemd service"
fi

# Summary
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          IP Update Complete                                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
print_success "Updated $UPDATED_COUNT files"
echo ""
echo "  Old IP: $CURRENT_IP"
echo "  New IP: $NEW_IP"
echo ""

if systemctl is-active --quiet wisptools-backend 2>/dev/null; then
    read -p "Restart backend service? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo systemctl restart wisptools-backend
        print_success "Backend service restarted"
    fi
fi

print_status "Done! Remember to commit and push changes to Git."
echo ""

