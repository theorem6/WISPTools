#!/bin/bash

# Find Git Repository Script
# Run this to locate your PCI Mapper project

echo "🔍 Finding Git Repository"
echo "========================"
echo ""

# Search in common locations
SEARCH_PATHS=(
    "/home/david"
    "/home/david/pci-mapper"
    "/home/david/lte-pci-mapper"
    "/home/david/PCI_mapper"
    "/opt/pci-mapper"
    "/opt/lte-pci-mapper"
    "/var/www/pci-mapper"
    "/var/www/lte-pci-mapper"
    "/root/pci-mapper"
    "/root/lte-pci-mapper"
)

echo "Checking common locations..."
for path in "${SEARCH_PATHS[@]}"; do
    if [ -d "$path" ]; then
        echo "📁 Checking: $path"
        if [ -d "$path/.git" ]; then
            echo "  ✅ Found .git directory"
            if [ -f "$path/backend-services/server.js" ]; then
                echo "  ✅ Found backend-services/server.js"
                echo "  🎯 THIS IS YOUR PCI MAPPER PROJECT!"
                echo "  📍 Full path: $path"
                echo ""
                echo "To deploy, run:"
                echo "  cd $path"
                echo "  git pull origin main"
                echo "  sudo bash gce-deploy-planning.sh"
                echo ""
                exit 0
            else
                echo "  ⚠️  Git repo but no backend-services/server.js"
            fi
        else
            echo "  ❌ No .git directory"
        fi
    else
        echo "📁 $path - Directory not found"
    fi
    echo ""
done

echo "🔍 Searching more broadly..."
echo "============================="

# Search for any .git directories
echo "Finding all .git directories in /home:"
find /home -name ".git" -type d 2>/dev/null | while read gitdir; do
    projdir=$(dirname "$gitdir")
    echo "📁 Found git repo at: $projdir"
    
    # Check if it has backend-services/server.js
    if [ -f "$projdir/backend-services/server.js" ]; then
        echo "  ✅ This looks like PCI Mapper!"
        echo "  📍 Full path: $projdir"
        echo ""
        echo "To deploy, run:"
        echo "  cd $projdir"
        echo "  git pull origin main"
        echo "  sudo bash gce-deploy-planning.sh"
        echo ""
        exit 0
    else
        echo "  ⚠️  Not PCI Mapper (no backend-services/server.js)"
    fi
    echo ""
done

echo "❌ PCI Mapper project not found"
echo ""
echo "Please check:"
echo "1. Is the project in a different location?"
echo "2. Is it named differently?"
echo "3. Run: find / -name 'server.js' 2>/dev/null | grep backend-services"
