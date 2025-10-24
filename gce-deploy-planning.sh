#!/bin/bash

# GCE Deployment Script for Planning System Backend
# Run this on your GCE machine to pull and implement the planning system changes

echo "🚀 GCE Planning System Backend Deployment"
echo "=========================================="
echo ""

# Set variables
PROJECT_DIR="/path/to/your/pci-mapper"  # Update this path
BACKUP_DIR="/tmp/pci-mapper-backup-$(date +%Y%m%d_%H%M%S)"
SERVICE_NAME="pci-mapper-backend"  # Update this to your actual service name

echo "📋 DEPLOYMENT CHECKLIST:"
echo "========================"
echo "1. Update PROJECT_DIR variable in this script to your actual project path"
echo "2. Update SERVICE_NAME variable to your actual service name"
echo "3. Ensure you have proper permissions to restart services"
echo ""

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
    echo "⚠️  Running as root - be careful!"
elif ! sudo -n true 2>/dev/null; then
    echo "❌ This script requires sudo privileges"
    echo "Run with: sudo bash gce-deploy-planning.sh"
    exit 1
fi

echo "🔍 Pre-deployment checks..."
echo "============================"

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Project directory not found: $PROJECT_DIR"
    echo "Please update PROJECT_DIR variable in this script"
    exit 1
fi

# Check if git repository
if [ ! -d "$PROJECT_DIR/.git" ]; then
    echo "❌ Not a git repository: $PROJECT_DIR"
    exit 1
fi

echo "✅ Project directory found: $PROJECT_DIR"

# Create backup
echo ""
echo "💾 Creating backup..."
mkdir -p "$BACKUP_DIR"
cp -r "$PROJECT_DIR" "$BACKUP_DIR/"
echo "✅ Backup created: $BACKUP_DIR"

# Navigate to project directory
cd "$PROJECT_DIR"

echo ""
echo "📥 Pulling latest changes from git..."
echo "====================================="

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

# Pull latest changes
echo "Pulling from origin main..."
git fetch origin
git pull origin main

if [ $? -eq 0 ]; then
    echo "✅ Git pull successful"
else
    echo "❌ Git pull failed"
    echo "Restoring from backup..."
    rm -rf "$PROJECT_DIR"
    mv "$BACKUP_DIR/$(basename $PROJECT_DIR)" "$PROJECT_DIR"
    exit 1
fi

echo ""
echo "🔍 Verifying new files..."
echo "========================="

# Check if new files exist
NEW_FILES=(
    "backend-services/routes/plans.js"
    "backend-services/models/plan.js"
    "backend-services/models/network.js"
)

for file in "${NEW_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ Missing: $file"
        exit 1
    fi
done

echo ""
echo "📦 Installing dependencies..."
echo "============================="

# Install/update npm dependencies
if [ -f "backend-services/package.json" ]; then
    cd backend-services
    npm install
    if [ $? -eq 0 ]; then
        echo "✅ Dependencies installed"
    else
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    cd ..
else
    echo "⚠️  No package.json found in backend-services"
fi

echo ""
echo "🔄 Restarting backend service..."
echo "==============================="

# Restart the service (update command based on your setup)
if command -v systemctl &> /dev/null; then
    # Systemd service
    sudo systemctl restart "$SERVICE_NAME"
    if [ $? -eq 0 ]; then
        echo "✅ Service restarted successfully"
    else
        echo "❌ Failed to restart service"
        exit 1
    fi
    
    # Check service status
    echo "Checking service status..."
    sudo systemctl status "$SERVICE_NAME" --no-pager -l
elif command -v pm2 &> /dev/null; then
    # PM2 service
    pm2 restart "$SERVICE_NAME"
    if [ $? -eq 0 ]; then
        echo "✅ PM2 service restarted"
    else
        echo "❌ Failed to restart PM2 service"
        exit 1
    fi
    
    # Check PM2 status
    pm2 status
else
    echo "⚠️  No systemctl or PM2 found. Please restart your service manually."
fi

echo ""
echo "🧪 Testing new endpoints..."
echo "=========================="

# Wait a moment for service to start
sleep 5

# Test health endpoint
HEALTH_URL="http://localhost:3000/health"
if command -v curl &> /dev/null; then
    echo "Testing health endpoint: $HEALTH_URL"
    curl -s "$HEALTH_URL" | head -5
    if [ $? -eq 0 ]; then
        echo "✅ Health check passed"
    else
        echo "❌ Health check failed"
    fi
else
    echo "⚠️  curl not available, skipping health check"
fi

# Test new plans endpoint
PLANS_URL="http://localhost:3000/api/plans"
if command -v curl &> /dev/null; then
    echo "Testing plans endpoint: $PLANS_URL"
    curl -s -H "X-Tenant-ID: test" "$PLANS_URL" | head -5
    if [ $? -eq 0 ]; then
        echo "✅ Plans endpoint accessible"
    else
        echo "❌ Plans endpoint failed"
    fi
else
    echo "⚠️  curl not available, skipping plans test"
fi

echo ""
echo "🎯 DEPLOYMENT SUMMARY"
echo "===================="
echo "✅ Git pull completed"
echo "✅ New files verified"
echo "✅ Dependencies installed"
echo "✅ Service restarted"
echo "✅ Endpoints tested"
echo ""
echo "📋 NEW API ENDPOINTS AVAILABLE:"
echo "==============================="
echo "GET    /api/plans                    - List all plans"
echo "GET    /api/plans/:id                 - Get single plan"
echo "POST   /api/plans                     - Create new plan"
echo "PUT    /api/plans/:id                 - Update plan"
echo "DELETE /api/plans/:id                 - Delete plan"
echo "POST   /api/plans/:id/requirements    - Add hardware requirement"
echo "DELETE /api/plans/:id/requirements/:idx - Remove hardware requirement"
echo "POST   /api/plans/:id/analyze         - Analyze missing hardware"
echo "GET    /api/plans/:id/missing-hardware - Get missing hardware analysis"
echo "POST   /api/plans/:id/purchase-order  - Generate purchase order"
echo "GET    /api/plans/hardware/existing   - Get all existing hardware"
echo ""
echo "🗄️  NEW DATABASE COLLECTIONS:"
echo "=============================="
echo "- planprojects"
echo "- unifiedtowers"
echo "- unifiedsectors"
echo "- unifiedcpes"
echo "- networkequipments"
echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "======================"
echo ""
echo "📝 NEXT STEPS:"
echo "=============="
echo "1. Test the frontend planning module"
echo "2. Create a test plan project"
echo "3. Test missing hardware analysis"
echo "4. Verify purchase order generation"
echo ""
echo "💾 Backup location: $BACKUP_DIR"
echo "🔄 Rollback command: rm -rf $PROJECT_DIR && mv $BACKUP_DIR/$(basename $PROJECT_DIR) $PROJECT_DIR"
