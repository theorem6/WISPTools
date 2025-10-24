#!/bin/bash

# Find PCI Mapper project and deploy planning system
# Run this from anywhere to locate and deploy

echo "🔍 Finding PCI Mapper project..."
echo "================================"

# Search for the project directory
FOUND_DIR=""
SEARCH_PATHS=(
    "/home/*/pci-mapper"
    "/home/*/lte-pci-mapper"
    "/home/*/PCI_mapper"
    "/opt/pci-mapper"
    "/opt/lte-pci-mapper"
    "/var/www/pci-mapper"
    "/var/www/lte-pci-mapper"
    "/root/pci-mapper"
    "/root/lte-pci-mapper"
    "/home/david/pci-mapper"
    "/home/david/lte-pci-mapper"
    "/home/david/PCI_mapper"
)

echo "Searching in common locations..."
for pattern in "${SEARCH_PATHS[@]}"; do
    for dir in $pattern; do
        if [ -d "$dir" ] && [ -f "$dir/.git/config" ] && [ -f "$dir/backend-services/server.js" ]; then
            FOUND_DIR="$dir"
            echo "✅ Found project at: $dir"
            break 2
        fi
    done
done

if [ -z "$FOUND_DIR" ]; then
    echo "❌ PCI Mapper project not found in common locations"
    echo ""
    echo "Let's search more broadly..."
    
    # Search in /home directories
    echo "Searching in /home directories..."
    find /home -name "*.git" -type d 2>/dev/null | while read gitdir; do
        projdir=$(dirname "$gitdir")
        if [ -f "$projdir/backend-services/server.js" ]; then
            echo "✅ Found project at: $projdir"
            FOUND_DIR="$projdir"
            break
        fi
    done
    
    if [ -z "$FOUND_DIR" ]; then
        echo "❌ Still not found. Let's check what's in /home/david:"
        ls -la /home/david/
        echo ""
        echo "Please run: cd /path/to/your/pci-mapper && git pull origin main"
        echo "Then run: sudo bash gce-deploy-planning.sh"
        exit 1
    fi
fi

echo ""
echo "📁 Changing to project directory: $FOUND_DIR"
cd "$FOUND_DIR"
echo "✅ Now in: $(pwd)"
echo ""

echo "📥 Pulling latest changes..."
git pull origin main

if [ $? -eq 0 ]; then
    echo "✅ Git pull successful"
    echo ""
    echo "🚀 Running deployment script..."
    sudo bash gce-deploy-planning.sh
else
    echo "❌ Git pull failed"
    echo "Please check your git configuration and try again"
    exit 1
fi
