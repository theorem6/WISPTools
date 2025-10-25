#!/bin/bash

# Quick Backend Restart Script for GCE Server
# This script pulls the latest changes and restarts the backend on port 3001

echo "🔄 Backend Restart Script"
echo "========================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# 1. Navigate to project directory
print_info "Navigating to project directory..."
cd ~/lte-pci-mapper || { print_error "Could not navigate to lte-pci-mapper directory"; exit 1; }

# 2. Pull latest changes
print_info "Pulling latest changes from Git..."
git pull origin main
if [ $? -eq 0 ]; then
    print_status "Git pull successful"
else
    print_error "Git pull failed"
    exit 1
fi

# 3. Navigate to backend directory
print_info "Navigating to backend directory..."
cd backend-services || { print_error "Could not navigate to backend-services directory"; exit 1; }

# 4. Install dependencies
print_info "Installing dependencies..."
npm install
if [ $? -eq 0 ]; then
    print_status "Dependencies installed"
else
    print_warning "npm install had issues, continuing..."
fi

# 5. Stop existing PM2 processes
print_info "Stopping existing PM2 processes..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
print_status "PM2 processes stopped"

# 6. Set environment variables
print_info "Setting environment variables..."
export MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0"
export PORT=3001
print_status "Environment variables set"

# 7. Start backend on port 3001
print_info "Starting backend on port 3001..."
pm2 start server.js --name "main-api" -- --port 3001
if [ $? -eq 0 ]; then
    print_status "Backend started on port 3001"
else
    print_error "Failed to start backend"
    exit 1
fi

# 8. Save PM2 configuration
print_info "Saving PM2 configuration..."
pm2 save
print_status "PM2 configuration saved"

# 9. Wait for startup
print_info "Waiting for backend to start..."
sleep 5

# 10. Test endpoints
print_info "Testing backend endpoints..."

# Test health endpoint
if curl -s http://localhost:3001/health > /dev/null; then
    print_status "Health endpoint working"
else
    print_warning "Health endpoint not responding"
fi

# Test admin tenants endpoint (without auth for now)
if curl -s http://localhost:3001/admin/tenants > /dev/null; then
    print_status "Admin tenants endpoint accessible"
else
    print_warning "Admin tenants endpoint not accessible (may need auth)"
fi

# 11. Show final status
echo ""
echo "================================"
print_status "BACKEND RESTART COMPLETE!"
echo "================================"
echo ""
print_info "PM2 Status:"
pm2 status

print_info "Port Status:"
netstat -tlnp | grep :3001 || print_warning "Port 3001 not listening"

print_info "Backend URLs:"
echo "  Health: http://localhost:3001/health"
echo "  Admin Tenants: http://localhost:3001/admin/tenants"
echo "  Users: http://localhost:3001/users/all"

echo ""
print_info "Cloud Function should now proxy to port 3001"
print_info "Frontend should work once Cloud Function deploys (2-3 minutes)"
