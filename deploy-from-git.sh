#!/bin/bash

# Deploy WISPTools.io from Git Repository
# This script pulls the latest changes and deploys them

set -e

echo "🚀 Starting deployment from Git repository..."

# Configuration
PROJECT_ID=${PROJECT_ID:-"lte-pci-mapper-65450042-bbf71"}
BRANCH=${BRANCH:-"main"}
DEPLOY_DIR="/opt/wisptools"
BACKUP_DIR="/opt/wisptools-backup-$(date +%Y%m%d-%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please don't run this script as root"
    exit 1
fi

# Check if git is available
if ! command -v git &> /dev/null; then
    print_error "Git is not installed"
    exit 1
fi

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    print_error "Not in a git repository"
    exit 1
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
print_status "Current branch: $CURRENT_BRANCH"

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    print_warning "You have uncommitted changes. Stashing them..."
    git stash push -m "Auto-stash before deployment $(date)"
fi

# Pull latest changes
print_status "Pulling latest changes from origin/$BRANCH..."
git fetch origin
git reset --hard origin/$BRANCH

# Check if there are new changes
if [ "$(git rev-parse HEAD)" = "$(git rev-parse @{u})" ]; then
    print_status "No new changes to deploy"
    exit 0
fi

print_status "New changes detected, starting deployment..."

# Create backup of current deployment
if [ -d "$DEPLOY_DIR" ]; then
    print_status "Creating backup of current deployment..."
    sudo cp -r "$DEPLOY_DIR" "$BACKUP_DIR"
    print_status "Backup created at: $BACKUP_DIR"
fi

# Create deployment directory
sudo mkdir -p "$DEPLOY_DIR"
sudo chown $USER:$USER "$DEPLOY_DIR"

# Copy backend services
print_status "Deploying backend services..."
cp -r backend-services "$DEPLOY_DIR/"

# Install dependencies
print_status "Installing backend dependencies..."
cd "$DEPLOY_DIR/backend-services"
npm install --production

# Create systemd services
print_status "Creating systemd services..."

# Backend API service
sudo tee /etc/systemd/system/wisptools-backend.service > /dev/null << EOF
[Unit]
Description=WISPTools Backend API
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$DEPLOY_DIR/backend-services
ExecStart=/usr/bin/node server-modular.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=PROJECT_ID=$PROJECT_ID

[Install]
WantedBy=multi-user.target
EOF

# HSS service
sudo tee /etc/systemd/system/wisptools-hss.service > /dev/null << EOF
[Unit]
Description=WISPTools HSS Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$DEPLOY_DIR/backend-services
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=PROJECT_ID=$PROJECT_ID

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and restart services
print_status "Restarting services..."
sudo systemctl daemon-reload
sudo systemctl enable wisptools-backend
sudo systemctl enable wisptools-hss
sudo systemctl restart wisptools-backend
sudo systemctl restart wisptools-hss

# Wait for services to start
sleep 5

# Check service status
print_status "Checking service status..."
if sudo systemctl is-active --quiet wisptools-backend; then
    print_status "✅ Backend API service is running"
else
    print_error "❌ Backend API service failed to start"
    sudo systemctl status wisptools-backend --no-pager
fi

if sudo systemctl is-active --quiet wisptools-hss; then
    print_status "✅ HSS service is running"
else
    print_error "❌ HSS service failed to start"
    sudo systemctl status wisptools-hss --no-pager
fi

# Get server IP
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

# Run health checks
print_status "Running health checks..."
sleep 10

# Check backend API
if curl -f "http://localhost:3000/health" > /dev/null 2>&1; then
    print_status "✅ Backend API health check passed"
else
    print_warning "⚠️ Backend API health check failed"
fi

# Check HSS API
if curl -f "http://localhost:3001/health" > /dev/null 2>&1; then
    print_status "✅ HSS API health check passed"
else
    print_warning "⚠️ HSS API health check failed"
fi

# Display deployment summary
echo ""
print_status "🎉 Deployment completed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "  • Branch: $BRANCH"
echo "  • Commit: $(git rev-parse --short HEAD)"
echo "  • Deploy Directory: $DEPLOY_DIR"
echo "  • Backup: $BACKUP_DIR"
echo ""
echo "🌐 Service URLs:"
echo "  • Backend API: http://$SERVER_IP:3000"
echo "  • HSS API: http://$SERVER_IP:3001"
echo "  • Health Check: http://$SERVER_IP:3000/health"
echo ""
echo "🔧 Service Management:"
echo "  • Backend: sudo systemctl status wisptools-backend"
echo "  • HSS: sudo systemctl status wisptools-hss"
echo "  • Logs: journalctl -u wisptools-backend -f"
echo ""

# Clean up old backups (keep last 5)
print_status "Cleaning up old backups..."
sudo find /opt -name "wisptools-backup-*" -type d | sort -r | tail -n +6 | sudo xargs rm -rf

print_status "Deployment script completed!"