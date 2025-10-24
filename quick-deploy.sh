#!/bin/bash

# Quick deployment script for GCE server
# Based on server location: root@acs-hss-server:/home/david

echo "🚀 Quick PCI Mapper Deployment"
echo "==============================="

# Go to the likely project directory
cd /home/david

echo "📁 Current directory: $(pwd)"
echo "📋 Contents:"
ls -la

echo ""
echo "🔍 Looking for git repository..."

# Check if this is a git repo
if [ -d ".git" ]; then
    echo "✅ Found git repository"
    echo ""
    echo "📥 Pulling latest changes..."
    git pull origin main
    
    if [ $? -eq 0 ]; then
        echo "✅ Git pull successful"
        echo ""
        echo "🚀 Running deployment script..."
        if [ -f "gce-deploy-planning.sh" ]; then
            sudo bash gce-deploy-planning.sh
        else
            echo "❌ gce-deploy-planning.sh not found"
            echo "Available files:"
            ls -la *.sh
        fi
    else
        echo "❌ Git pull failed"
    fi
else
    echo "❌ Not a git repository"
    echo ""
    echo "🔍 Searching for git repositories in subdirectories..."
    find . -name ".git" -type d 2>/dev/null | head -5
    
    echo ""
    echo "Please navigate to the correct directory and run:"
    echo "cd /path/to/pci-mapper"
    echo "git pull origin main"
    echo "sudo bash gce-deploy-planning.sh"
fi
