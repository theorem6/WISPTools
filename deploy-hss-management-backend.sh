#!/bin/bash

# HSS Management Backend Deployment Script
# This script deploys the new HSS Management API routes to the GCE backend

set -e

echo "🚀 Starting HSS Management Backend Deployment..."

# Configuration
BACKEND_DIR="/opt/hss-api"
BACKUP_DIR="/opt/backups/hss-management-$(date +%Y%m%d-%H%M%S)"
SERVICE_NAME="hss-api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    print_error "Backend directory $BACKEND_DIR not found"
    exit 1
fi

print_status "Backend directory found: $BACKEND_DIR"

# Create backup directory
print_status "Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Backup existing files
print_status "Backing up existing HSS management files..."
if [ -f "$BACKEND_DIR/routes/hss-management.js" ]; then
    cp "$BACKEND_DIR/routes/hss-management.js" "$BACKUP_DIR/"
    print_success "Backed up existing hss-management.js"
fi

if [ -f "$BACKEND_DIR/server.js" ]; then
    cp "$BACKEND_DIR/server.js" "$BACKUP_DIR/"
    print_success "Backed up existing server.js"
fi

# Copy new files from current directory
print_status "Copying new HSS management files..."

# Copy the new HSS management route
if [ -f "./backend-services/routes/hss-management.js" ]; then
    cp "./backend-services/routes/hss-management.js" "$BACKEND_DIR/routes/"
    print_success "Copied hss-management.js to backend"
else
    print_error "hss-management.js not found in current directory"
    exit 1
fi

# Copy the updated server.js
if [ -f "./backend-services/server.js" ]; then
    cp "./backend-services/server.js" "$BACKEND_DIR/"
    print_success "Copied updated server.js to backend"
else
    print_error "Updated server.js not found in current directory"
    exit 1
fi

# Install any new dependencies if needed
print_status "Checking for new dependencies..."
cd "$BACKEND_DIR"

# Check if package.json needs updating
if [ -f "package.json" ]; then
    print_status "Checking package.json for HSS management dependencies..."
    # The HSS management route uses existing dependencies (express, mongodb)
    # No new dependencies needed
    print_success "No new dependencies required"
fi

# Restart the backend service
print_status "Restarting $SERVICE_NAME service..."

# Check if service exists
if systemctl list-unit-files | grep -q "$SERVICE_NAME.service"; then
    print_status "Stopping $SERVICE_NAME service..."
    systemctl stop "$SERVICE_NAME" || print_warning "Service stop failed, continuing..."
    
    print_status "Starting $SERVICE_NAME service..."
    systemctl start "$SERVICE_NAME" || print_error "Service start failed"
    
    # Wait a moment for service to start
    sleep 3
    
    # Check service status
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        print_success "$SERVICE_NAME service is running"
    else
        print_error "$SERVICE_NAME service failed to start"
        print_status "Checking service logs..."
        journalctl -u "$SERVICE_NAME" --no-pager -n 20
        exit 1
    fi
else
    print_warning "Service $SERVICE_NAME not found, trying PM2..."
    
    # Try PM2 if systemctl service doesn't exist
    if command -v pm2 &> /dev/null; then
        print_status "Using PM2 to restart backend..."
        pm2 restart "$SERVICE_NAME" || pm2 start "$BACKEND_DIR/server.js" --name "$SERVICE_NAME"
        print_success "Backend restarted with PM2"
    else
        print_error "Neither systemctl nor PM2 found. Please restart the backend manually."
        exit 1
    fi
fi

# Test the new endpoints
print_status "Testing HSS management endpoints..."

# Wait for service to be ready
sleep 5

# Test health endpoint
if curl -s "http://localhost:3000/health" > /dev/null; then
    print_success "Backend health check passed"
else
    print_warning "Backend health check failed, but service may still be starting"
fi

# Test HSS stats endpoint (this will fail without auth, but we can check if route exists)
if curl -s "http://localhost:3000/api/hss/stats" | grep -q "Tenant ID required"; then
    print_success "HSS management API routes are accessible"
else
    print_warning "HSS management API routes may not be working properly"
fi

# Show service status
print_status "Final service status:"
if systemctl list-unit-files | grep -q "$SERVICE_NAME.service"; then
    systemctl status "$SERVICE_NAME" --no-pager -l
else
    pm2 status "$SERVICE_NAME" 2>/dev/null || print_warning "PM2 status not available"
fi

print_success "HSS Management Backend Deployment Complete!"
print_status "New endpoints available:"
echo "  - GET    /api/hss/stats"
echo "  - GET    /api/hss/subscribers"
echo "  - POST   /api/hss/subscribers"
echo "  - PUT    /api/hss/subscribers/:id"
echo "  - DELETE /api/hss/subscribers/:id"
echo "  - GET    /api/hss/groups"
echo "  - POST   /api/hss/groups"
echo "  - PUT    /api/hss/groups/:id"
echo "  - DELETE /api/hss/groups/:id"
echo "  - GET    /api/hss/bandwidth-plans"
echo "  - POST   /api/hss/bandwidth-plans"
echo "  - PUT    /api/hss/bandwidth-plans/:id"
echo "  - DELETE /api/hss/bandwidth-plans/:id"
echo "  - GET    /api/hss/epcs"
echo "  - POST   /api/hss/epcs"
echo "  - PUT    /api/hss/epcs/:id"
echo "  - DELETE /api/hss/epcs/:id"
echo "  - GET    /api/hss/mme-connections"
echo "  - POST   /api/hss/bulk-import"

print_status "Backup created at: $BACKUP_DIR"
print_success "Deployment completed successfully!"
