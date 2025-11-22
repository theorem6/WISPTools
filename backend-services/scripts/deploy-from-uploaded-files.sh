#!/bin/bash
# Deploy Monitoring Backend from uploaded files
# This script copies files from /tmp and deploys them

set -e

echo "🚀 Deploying LTE WISP Monitoring Backend from uploaded files..."

# Configuration
BACKEND_DIR="/home/david_peterson_consulting_com/lte-wisp-backend"
SERVICE_NAME="lte-wisp-backend"
PORT=3003

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${YELLOW}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Step 1: Create backend directory structure
print_status "Step 1: Setting up backend directory..."
mkdir -p "$BACKEND_DIR"
mkdir -p "$BACKEND_DIR/routes"
mkdir -p "$BACKEND_DIR/models"
mkdir -p "$BACKEND_DIR/config"
print_success "Directory structure created"

# Step 2: Copy monitoring backend server from uploaded file
print_status "Step 2: Copying monitoring backend server..."
if [ -f "/tmp/monitoring-backend-server.js" ]; then
    cp "/tmp/monitoring-backend-server.js" "$BACKEND_DIR/server.js"
    print_success "Server file copied"
else
    print_error "Server file not found at /tmp/monitoring-backend-server.js"
    exit 1
fi

# Step 3: Copy route files from existing backend-services if available, otherwise from /opt/gce-backend
print_status "Step 3: Copying route files..."
if [ -d "/opt/gce-backend/routes" ]; then
    cp /opt/gce-backend/routes/monitoring.js "$BACKEND_DIR/routes/" 2>/dev/null || print_error "Failed to copy monitoring.js"
    cp /opt/gce-backend/routes/epc.js "$BACKEND_DIR/routes/" 2>/dev/null || print_error "Failed to copy epc.js"
    cp /opt/gce-backend/routes/mikrotik.js "$BACKEND_DIR/routes/" 2>/dev/null || print_error "Failed to copy mikrotik.js"
    cp /opt/gce-backend/routes/snmp.js "$BACKEND_DIR/routes/" 2>/dev/null || print_error "Failed to copy snmp.js"
    cp /opt/gce-backend/routes/network.js "$BACKEND_DIR/routes/" 2>/dev/null || print_error "Failed to copy network.js"
    cp /opt/gce-backend/routes/epc-deployment.js "$BACKEND_DIR/routes/" 2>/dev/null || print_error "Failed to copy epc-deployment.js"
    print_success "Route files copied from /opt/gce-backend/routes"
else
    print_error "Route files directory not found. Please ensure routes exist."
    exit 1
fi

# Step 4: Copy model files
print_status "Step 4: Copying model files..."
if [ -f "/opt/gce-backend/models/network.js" ]; then
    cp /opt/gce-backend/models/network.js "$BACKEND_DIR/models/" || print_error "Failed to copy network.js"
elif [ -d "/opt/lte-pci-mapper/backend-services/models" ]; then
    cp /opt/lte-pci-mapper/backend-services/models/network.js "$BACKEND_DIR/models/" || print_error "Failed to copy network.js"
else
    print_error "Model file not found. Creating minimal model file..."
    mkdir -p "$BACKEND_DIR/models"
    cat > "$BACKEND_DIR/models/network.js" << 'EOF'
// Network Equipment Models
const mongoose = require('mongoose');
const { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment, HardwareDeployment } = require('../models/network');
module.exports = { UnifiedSite, UnifiedSector, UnifiedCPE, NetworkEquipment, HardwareDeployment };
EOF
fi
print_success "Model files copied"

# Step 5: Create package.json
print_status "Step 5: Creating package.json..."
cat > "$BACKEND_DIR/package.json" << 'EOF'
{
  "name": "lte-wisp-monitoring-backend",
  "version": "1.0.0",
  "description": "LTE WISP Management Platform - Monitoring Backend",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "mongoose": "^7.5.0",
    "dotenv": "^16.3.1"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
EOF
print_success "package.json created"

# Step 6: Install dependencies
print_status "Step 6: Installing dependencies..."
cd "$BACKEND_DIR"
npm install --production --quiet 2>&1 | grep -v "npm WARN" || true
print_success "Dependencies installed"

# Step 7: Ensure ISO directory exists
print_status "Step 7: Creating ISO directory..."
sudo mkdir -p /var/www/html/downloads/isos
sudo mkdir -p /tmp/iso-downloads
sudo mkdir -p /opt/epc-iso-builder
sudo chmod 755 /var/www/html/downloads/isos
sudo chmod 755 /tmp/iso-downloads
sudo chmod 755 /opt/epc-iso-builder
print_success "ISO directories created"

# Step 8: Create systemd service
print_status "Step 8: Creating systemd service..."
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=LTE WISP Monitoring Backend
After=network.target

[Service]
Type=simple
User=david_peterson_consulting_com
WorkingDirectory=$BACKEND_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=MONGODB_URI=mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0
StandardOutput=append:$BACKEND_DIR/logs/backend.log
StandardError=append:$BACKEND_DIR/logs/backend-error.log

[Install]
WantedBy=multi-user.target
EOF
print_success "Systemd service created"

# Step 9: Create logs directory
print_status "Step 9: Creating logs directory..."
mkdir -p "$BACKEND_DIR/logs"
print_success "Logs directory created"

# Step 10: Reload systemd and restart service
print_status "Step 10: Reloading systemd and restarting service..."
sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}
sudo systemctl restart ${SERVICE_NAME}
print_success "Service restarted"

# Step 11: Wait for service to start
print_status "Step 11: Waiting for service to start..."
sleep 5

# Step 12: Check service status
print_status "Step 12: Checking service status..."
if sudo systemctl is-active --quiet ${SERVICE_NAME}; then
    print_success "Service is running"
else
    print_error "Service failed to start"
    echo "Checking logs..."
    sudo journalctl -u ${SERVICE_NAME} -n 30 --no-pager
    exit 1
fi

# Step 13: Test health endpoint
print_status "Step 13: Testing health endpoint..."
if curl -f -s http://localhost:${PORT}/health > /dev/null; then
    print_success "Health check passed"
else
    print_error "Health check failed"
    exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Deployment Complete!                             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "✅ Monitoring Backend deployed successfully"
echo "🌐 Backend URL: http://136.112.111.167:${PORT}"
echo "📊 Health Check: http://136.112.111.167:${PORT}/health"
echo "📋 Service Status: sudo systemctl status ${SERVICE_NAME}"
echo "📝 Logs: sudo journalctl -u ${SERVICE_NAME} -f"

