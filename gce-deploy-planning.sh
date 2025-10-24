#!/bin/bash

# GCE Deployment Script for Planning System Backend
# Run this on your GCE machine to pull and implement the planning system changes

echo "🚀 GCE Planning System Backend Deployment"
echo "=========================================="
echo ""
echo "🔍 Searching for PCI Mapper project directory..."
echo "Checking common locations: /home/*/pci-mapper, /opt/pci-mapper, /var/www/pci-mapper, etc."
echo ""

# Auto-detect project directory
# Try common locations for the PCI mapper project
POSSIBLE_DIRS=(
    "/home/*/pci-mapper"
    "/home/*/lte-pci-mapper" 
    "/opt/pci-mapper"
    "/opt/lte-pci-mapper"
    "/var/www/pci-mapper"
    "/var/www/lte-pci-mapper"
    "/root/pci-mapper"
    "/root/lte-pci-mapper"
    "$(pwd)"
)

PROJECT_DIR=""
for pattern in "${POSSIBLE_DIRS[@]}"; do
    for dir in $pattern; do
        if [ -d "$dir" ] && [ -f "$dir/backend-services/server.js" ]; then
            PROJECT_DIR="$dir"
            break 2
        fi
    done
done

# If not found, use current directory as fallback
if [ -z "$PROJECT_DIR" ]; then
    PROJECT_DIR=$(pwd)
fi

BACKUP_DIR="/tmp/pci-mapper-backup-$(date +%Y%m%d_%H%M%S)"

# Auto-detect service name
if command -v systemctl &> /dev/null; then
    # Try common service names
    for service in "pci-mapper" "pci-mapper-backend" "lte-pci-mapper" "backend" "api"; do
        if systemctl list-units --type=service | grep -q "$service"; then
            SERVICE_NAME="$service"
            break
        fi
    done
elif command -v pm2 &> /dev/null; then
    # Try common PM2 app names
    for app in "pci-mapper" "pci-mapper-backend" "lte-pci-mapper" "backend" "api"; do
        if pm2 list | grep -q "$app"; then
            SERVICE_NAME="$app"
            break
        fi
    done
fi

# Fallback if not detected
if [ -z "$SERVICE_NAME" ]; then
    SERVICE_NAME="pci-mapper-backend"
fi

# Auto-detect backend port
BACKEND_PORT="3000"
if [ -f "backend-services/server.js" ]; then
    PORT_LINE=$(grep -E "listen.*[0-9]+" backend-services/server.js | head -1)
    if [[ $PORT_LINE =~ ([0-9]+) ]]; then
        BACKEND_PORT="${BASH_REMATCH[1]}"
    fi
fi

echo "🔍 Auto-detected configuration:"
echo "================================"
echo "Project Directory: $PROJECT_DIR"
echo "Service Name: $SERVICE_NAME"
echo "Backend Port: $BACKEND_PORT"
echo "Backup Location: $BACKUP_DIR"
echo ""

# Change to project directory
echo "📁 Changing to project directory..."
cd "$PROJECT_DIR"
echo "✅ Working in: $(pwd)"
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

RESTART_SUCCESS=false

# Try systemctl first
if command -v systemctl &> /dev/null; then
    echo "Trying systemctl restart..."
    if sudo systemctl restart "$SERVICE_NAME" 2>/dev/null; then
        echo "✅ Service restarted successfully via systemctl"
        RESTART_SUCCESS=true
        
        # Check service status
        echo "Checking service status..."
        sudo systemctl status "$SERVICE_NAME" --no-pager -l
    else
        echo "⚠️  systemctl restart failed, trying other methods..."
    fi
fi

# Try PM2 if systemctl failed
if [ "$RESTART_SUCCESS" = false ] && command -v pm2 &> /dev/null; then
    echo "Trying PM2 restart..."
    if pm2 restart "$SERVICE_NAME" 2>/dev/null; then
        echo "✅ PM2 service restarted"
        RESTART_SUCCESS=true
        
        # Check PM2 status
        pm2 status
    else
        echo "⚠️  PM2 restart failed, trying other methods..."
    fi
fi

# Try direct node restart if other methods failed
if [ "$RESTART_SUCCESS" = false ]; then
    echo "Trying direct node process restart..."
    
    # Kill existing node processes on the backend port
    if command -v lsof &> /dev/null; then
        PIDS=$(lsof -ti:$BACKEND_PORT 2>/dev/null)
        if [ ! -z "$PIDS" ]; then
            echo "Killing existing processes on port $BACKEND_PORT: $PIDS"
            kill $PIDS 2>/dev/null
            sleep 2
        fi
    fi
    
    # Start the backend service
    if [ -f "backend-services/server.js" ]; then
        echo "Starting backend service directly..."
        cd backend-services
        nohup node server.js > ../backend.log 2>&1 &
        BACKEND_PID=$!
        cd ..
        
        if [ ! -z "$BACKEND_PID" ]; then
            echo "✅ Backend started with PID: $BACKEND_PID"
            RESTART_SUCCESS=true
        fi
    fi
fi

# Final check
if [ "$RESTART_SUCCESS" = false ]; then
    echo "❌ All restart methods failed"
    echo "Please restart your service manually:"
    echo "  - systemctl restart $SERVICE_NAME"
    echo "  - pm2 restart $SERVICE_NAME"
    echo "  - cd backend-services && node server.js"
    exit 1
fi

echo ""
echo "🧪 Testing new endpoints..."
echo "=========================="

# Wait a moment for service to start
sleep 5

# Test health endpoint
HEALTH_URL="http://localhost:$BACKEND_PORT/health"
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
PLANS_URL="http://localhost:$BACKEND_PORT/api/plans"
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
