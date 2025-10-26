#!/bin/bash

# Simple deployment script
# This script can be run manually or via cron

set -e

echo "🚀 Starting WISPTools.io deployment..."

# Configuration
REPO_URL="https://github.com/theorem6/lte-pci-mapper.git"
DEPLOY_DIR="/opt/wisptools"
BACKUP_DIR="/opt/wisptools-backup-$(date +%Y%m%d-%H%M%S)"

# Create deployment directory
sudo mkdir -p "$DEPLOY_DIR"
sudo chown $USER:$USER "$DEPLOY_DIR"

# Create backup if exists
if [ -d "$DEPLOY_DIR" ] && [ "$(ls -A $DEPLOY_DIR)" ]; then
    echo "📦 Creating backup..."
    sudo cp -r "$DEPLOY_DIR" "$BACKUP_DIR"
fi

# Clone or update repository
if [ -d "$DEPLOY_DIR/.git" ]; then
    echo "🔄 Updating repository..."
    cd "$DEPLOY_DIR"
    git fetch origin
    git reset --hard origin/main
else
    echo "📥 Cloning repository..."
    git clone "$REPO_URL" "$DEPLOY_DIR"
    cd "$DEPLOY_DIR"
fi

# Install backend dependencies
echo "🔧 Installing backend dependencies..."
cd backend-services
npm install --production

# Create systemd services
echo "⚙️ Creating systemd services..."

# Backend API service
sudo tee /etc/systemd/system/wisptools-backend.service > /dev/null << 'SERVICE_EOF'
[Unit]
Description=WISPTools Backend API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/wisptools/backend-services
ExecStart=/usr/bin/node server-modular.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# HSS service
sudo tee /etc/systemd/system/wisptools-hss.service > /dev/null << 'SERVICE_EOF'
[Unit]
Description=WISPTools HSS Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/wisptools/backend-services
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# Enable and start services
echo "🔄 Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable wisptools-backend
sudo systemctl enable wisptools-hss
sudo systemctl restart wisptools-backend
sudo systemctl restart wisptools-hss

# Wait for services to start
sleep 5

# Check service status
echo "🏥 Checking service status..."
if sudo systemctl is-active --quiet wisptools-backend; then
    echo "✅ Backend API service is running"
else
    echo "❌ Backend API service failed to start"
    sudo systemctl status wisptools-backend --no-pager
fi

if sudo systemctl is-active --quiet wisptools-hss; then
    echo "✅ HSS service is running"
else
    echo "❌ HSS service failed to start"
    sudo systemctl status wisptools-hss --no-pager
fi

# Get server IP
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

echo ""
echo "🎉 Deployment completed!"
echo "🌐 Backend API: http://$SERVER_IP:3000"
echo "🔐 HSS API: http://$SERVER_IP:3001"
echo "🏥 Health Check: http://$SERVER_IP:3000/health"
