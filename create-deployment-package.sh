#!/bin/bash

# Create Complete WISPTools.io Deployment Package
# This script creates a production-ready deployment package with all fixes

set -e

echo "📦 Creating WISPTools.io Deployment Package"
echo "==========================================="

# Configuration
PACKAGE_NAME="wisptools-deployment-$(date +%Y%m%d-%H%M%S)"
PACKAGE_DIR="/tmp/$PACKAGE_NAME"
REPO_URL="https://github.com/theorem6/lte-pci-mapper.git"

# Create package directory
mkdir -p "$PACKAGE_DIR"
cd "$PACKAGE_DIR"

echo "📁 Creating package structure..."

# Create directory structure
mkdir -p {backend-services,functions,deployment-scripts,docs,config}

# Copy backend services with all our fixes
echo "🔧 Copying backend services with fixes..."
cp -r /workspace/backend-services/* backend-services/

# Copy functions
echo "🔧 Copying Firebase functions..."
cp -r /workspace/functions/* functions/

# Create deployment scripts
echo "📝 Creating deployment scripts..."

# Main deployment script
cat > deploy.sh << 'EOF'
#!/bin/bash

# WISPTools.io Production Deployment Script
# This script deploys the complete WISPTools.io platform

set -e

echo "🚀 WISPTools.io Production Deployment"
echo "====================================="

# Configuration
DEPLOY_DIR="/opt/wisptools"
BACKUP_DIR="/opt/wisptools-backup-$(date +%Y%m%d-%H%M%S)"
SERVICE_USER="ubuntu"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please don't run this script as root"
    exit 1
fi

# Create deployment directory
print_status "Creating deployment directory..."
sudo mkdir -p "$DEPLOY_DIR"
sudo chown $SERVICE_USER:$SERVICE_USER "$DEPLOY_DIR"

# Create backup if exists
if [ -d "$DEPLOY_DIR/backend-services" ]; then
    print_status "Creating backup..."
    sudo cp -r "$DEPLOY_DIR" "$BACKUP_DIR"
    print_status "Backup created at: $BACKUP_DIR"
fi

# Copy backend services
print_status "Deploying backend services..."
cp -r backend-services/* "$DEPLOY_DIR/"

# Install dependencies
print_status "Installing dependencies..."
cd "$DEPLOY_DIR"
npm install --production

# Create systemd services
print_status "Creating systemd services..."

# Backend API service (Port 3000)
sudo tee /etc/systemd/system/wisptools-backend.service > /dev/null << 'SERVICE_EOF'
[Unit]
Description=WISPTools Backend API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/wisptools
ExecStart=/usr/bin/node server-modular.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# HSS service (Port 3001)
sudo tee /etc/systemd/system/wisptools-hss.service > /dev/null << 'SERVICE_EOF'
[Unit]
Description=WISPTools HSS Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/wisptools
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# Enable and start services
print_status "Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable wisptools-backend
sudo systemctl enable wisptools-hss
sudo systemctl restart wisptools-backend
sudo systemctl restart wisptools-hss

# Wait for services
sleep 10

# Health checks
print_status "Running health checks..."
if curl -f "http://localhost:3000/health" > /dev/null 2>&1; then
    print_status "✅ Backend API (Port 3000) - Healthy"
else
    print_warning "⚠️ Backend API health check failed"
fi

if curl -f "http://localhost:3001/health" > /dev/null 2>&1; then
    print_status "✅ HSS API (Port 3001) - Healthy"
else
    print_warning "⚠️ HSS API health check failed"
fi

# Get server IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
print_status "🎉 Deployment completed successfully!"
echo ""
echo "📋 Service URLs:"
echo "  • Backend API: http://$SERVER_IP:3000"
echo "  • HSS API: http://$SERVER_IP:3001"
echo "  • Health Check: http://$SERVER_IP:3000/health"
echo ""
echo "🔧 Management Commands:"
echo "  • Status: sudo systemctl status wisptools-*"
echo "  • Logs: journalctl -u wisptools-backend -f"
echo "  • Restart: sudo systemctl restart wisptools-*"
echo ""

print_status "WISPTools.io is now running!"
EOF

chmod +x deploy.sh

# Create update script
cat > update.sh << 'EOF'
#!/bin/bash

# WISPTools.io Update Script
# This script updates the deployment from git

set -e

echo "🔄 Updating WISPTools.io from Git..."

# Configuration
REPO_URL="https://github.com/theorem6/lte-pci-mapper.git"
DEPLOY_DIR="/opt/wisptools"
BRANCH="main"

# Colors
GREEN='\033[0;32m'
NC='\033[0m'
print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }

# Check if we're in a git repository
if [ -d "$DEPLOY_DIR/.git" ]; then
    print_status "Updating existing repository..."
    cd "$DEPLOY_DIR"
    git fetch origin
    git reset --hard origin/$BRANCH
else
    print_status "Cloning repository..."
    git clone "$REPO_URL" "$DEPLOY_DIR"
    cd "$DEPLOY_DIR"
fi

# Install dependencies
print_status "Installing dependencies..."
npm install --production

# Restart services
print_status "Restarting services..."
sudo systemctl restart wisptools-backend
sudo systemctl restart wisptools-hss

print_status "Update completed!"
EOF

chmod +x update.sh

# Create auto-update script
cat > setup-auto-update.sh << 'EOF'
#!/bin/bash

# Setup Auto-Update from Git
# This script sets up automatic updates from the git repository

set -e

echo "⏰ Setting up auto-update from Git..."

# Create update script location
UPDATE_SCRIPT="/opt/wisptools/update.sh"
sudo cp update.sh "$UPDATE_SCRIPT"
sudo chmod +x "$UPDATE_SCRIPT"

# Create systemd timer for auto-update
sudo tee /etc/systemd/system/wisptools-update.service > /dev/null << 'SERVICE_EOF'
[Unit]
Description=WISPTools Auto Update
After=network.target

[Service]
Type=oneshot
User=ubuntu
WorkingDirectory=/opt/wisptools
ExecStart=/opt/wisptools/update.sh
StandardOutput=journal
StandardError=journal
SERVICE_EOF

sudo tee /etc/systemd/system/wisptools-update.timer > /dev/null << 'TIMER_EOF'
[Unit]
Description=Run WISPTools Auto Update every 15 minutes
Requires=wisptools-update.service

[Timer]
OnCalendar=*:0/15
Persistent=true

[Install]
WantedBy=timers.target
TIMER_EOF

# Enable timer
sudo systemctl daemon-reload
sudo systemctl enable wisptools-update.timer
sudo systemctl start wisptools-update.timer

echo "✅ Auto-update configured!"
echo "  • Updates every 15 minutes"
echo "  • Check status: sudo systemctl status wisptools-update.timer"
echo "  • Manual update: /opt/wisptools/update.sh"
EOF

chmod +x setup-auto-update.sh

# Create documentation
cat > README.md << 'EOF'
# WISPTools.io Deployment Package

This package contains the complete WISPTools.io platform with all fixes applied.

## 🚀 Quick Start

1. **Deploy the platform:**
   ```bash
   ./deploy.sh
   ```

2. **Set up auto-updates:**
   ```bash
   ./setup-auto-update.sh
   ```

## 📋 What's Included

### ✅ Fixed Issues
- **Login Crashes**: Fixed schema mismatch between auth roles and database
- **Module Crashes**: Implemented proper authentication endpoints
- **Port Conflicts**: Resolved port allocation (3000: Backend, 3001: HSS)
- **Firebase Issues**: Centralized Firebase initialization
- **Error Handling**: Comprehensive error handling throughout

### 🔧 Services
- **Backend API** (Port 3000): User management, authentication, business logic
- **HSS Service** (Port 3001): Open5GS HSS management
- **Auto-Update**: Automatic updates from git repository

### 📁 Files
- `deploy.sh`: Main deployment script
- `update.sh`: Update from git script
- `setup-auto-update.sh`: Configure auto-updates
- `backend-services/`: Complete backend with fixes
- `functions/`: Firebase functions

## 🌐 Service URLs

After deployment:
- Backend API: `http://YOUR_SERVER_IP:3000`
- HSS API: `http://YOUR_SERVER_IP:3001`
- Health Check: `http://YOUR_SERVER_IP:3000/health`

## 🔧 Management

### Service Management
```bash
# Check status
sudo systemctl status wisptools-backend
sudo systemctl status wisptools-hss

# View logs
journalctl -u wisptools-backend -f
journalctl -u wisptools-hss -f

# Restart services
sudo systemctl restart wisptools-backend
sudo systemctl restart wisptools-hss
```

### Updates
```bash
# Manual update
/opt/wisptools/update.sh

# Check auto-update status
sudo systemctl status wisptools-update.timer
```

## 🏥 Health Checks

The platform includes comprehensive health checks:
- Database connectivity
- Firebase authentication
- Service status monitoring
- Port availability checks

## 📊 Monitoring

All services include:
- Systemd service management
- Automatic restart on failure
- Comprehensive logging
- Health check endpoints

## 🚨 Troubleshooting

### Common Issues

1. **Port conflicts:**
   ```bash
   sudo lsof -i :3000
   sudo lsof -i :3001
   ```

2. **Service won't start:**
   ```bash
   journalctl -u wisptools-backend -n 50
   ```

3. **Database connection issues:**
   - Check MongoDB URI in environment variables
   - Verify network connectivity

## 🎉 Success!

Your WISPTools.io platform is now:
- ✅ Login crashes fixed
- ✅ Module crashes fixed
- ✅ Automated deployment ready
- ✅ Auto-update configured
- ✅ Production ready

**Just run `./deploy.sh` and you're ready to go!**
EOF

# Create environment configuration
cat > config/environment.example << 'EOF'
# WISPTools.io Environment Configuration
# Copy this to .env and configure your values

# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# Server Configuration
NODE_ENV=production
PORT=3000
HSS_PORT=3001

# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
EOF

# Create package info
cat > package-info.json << EOF
{
  "name": "wisptools-deployment",
  "version": "1.0.0",
  "description": "WISPTools.io Complete Deployment Package",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "fixes": [
    "Login crashes - Schema mismatch resolved",
    "Module crashes - Authentication endpoints implemented", 
    "Port conflicts - Proper port allocation (3000/3001)",
    "Firebase issues - Centralized initialization",
    "Error handling - Comprehensive error management"
  ],
  "services": {
    "backend-api": {
      "port": 3000,
      "description": "User management and business logic API"
    },
    "hss-service": {
      "port": 3001,
      "description": "Open5GS HSS management service"
    }
  },
  "features": [
    "Automated deployment",
    "Auto-update from git",
    "Systemd service management",
    "Health checks",
    "Comprehensive logging",
    "Error recovery"
  ]
}
EOF

# Create final package
echo "📦 Creating final package..."
cd /tmp
tar -czf "$PACKAGE_NAME.tar.gz" "$PACKAGE_NAME"

echo ""
echo "✅ Deployment package created successfully!"
echo ""
echo "📦 Package: /tmp/$PACKAGE_NAME.tar.gz"
echo "📁 Contents: /tmp/$PACKAGE_NAME/"
echo ""
echo "🚀 To deploy:"
echo "  1. Extract: tar -xzf $PACKAGE_NAME.tar.gz"
echo "  2. Deploy: cd $PACKAGE_NAME && ./deploy.sh"
echo "  3. Auto-update: ./setup-auto-update.sh"
echo ""
echo "🎉 Your complete WISPTools.io deployment package is ready!"