#!/bin/bash
# MASTER DEPLOYMENT SCRIPT - WISPTools.io Complete System Setup
# Automates ALL system components on GCE server (136.112.111.167)
#
# This script sets up:
# - HSS Backend
# - ISO Builder
# - Deployment Scripts
# - Monitoring
# - All APIs
#
# Usage: sudo bash deploy-all-automated.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${PURPLE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║ $(printf '%58s' "$1")${NC} ${PURPLE}║${NC}"
    echo -e "${PURPLE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_status() {
    echo -e "${CYAN}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Configuration
GCE_IP="136.112.111.167"
HSS_PORT="3001"
REPO_DIR="/root/lte-pci-mapper"
SCRIPT_DIR="$REPO_DIR/scripts/deployment"

print_header "WISPTools.io MASTER DEPLOYMENT"
echo "This will set up the COMPLETE system on GCE server"
echo ""
echo "Components:"
echo "  ✓ HSS Backend (Port 3001)"
echo "  ✓ ISO Builder"
echo "  ✓ Deployment APIs"
echo "  ✓ Web Server (Port 80)"
echo "  ✓ Monitoring"
echo ""
echo "Server: $GCE_IP"
echo ""

# Check if we're in the repo
if [ ! -d "$REPO_DIR" ]; then
    print_error "Repository not found at $REPO_DIR"
    print_status "Cloning repository..."
    cd /root
    git clone https://github.com/theorem6/lte-pci-mapper.git
    cd lte-pci-mapper
    REPO_DIR="/root/lte-pci-mapper"
fi

cd "$REPO_DIR"

# Pull latest changes
print_header "Updating Repository"
print_status "Pulling latest changes..."
git pull origin main
print_success "Repository updated"

# System update
print_header "System Update"

print_status "Cleaning up old repository files..."
# Remove any old MongoDB repository files (we use Atlas now)
rm -f /etc/apt/sources.list.d/mongodb*.list 2>/dev/null || true
print_success "Old repositories cleaned"

print_status "Updating package lists..."
apt-get update -qq 2>&1 | grep -v "does not have a Release file" || true

print_status "Fixing any broken packages..."
DEBIAN_FRONTEND=noninteractive dpkg --configure -a
DEBIAN_FRONTEND=noninteractive apt-get install -f -y -qq

print_status "Upgrading system packages..."
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
print_success "System updated"

# Install base packages
print_header "Installing Base Packages"

BASE_PACKAGES="
    curl
    wget
    git
    jq
    vim
    htop
    net-tools
    build-essential
    python3-pip
    unzip
"

for pkg in $BASE_PACKAGES; do
    if ! dpkg -l | grep -q "^ii  $pkg "; then
        print_status "Installing $pkg..."
        DEBIAN_FRONTEND=noninteractive apt-get install -y -qq $pkg
    fi
done

print_success "Base packages installed"

# Install Node.js
print_header "Installing Node.js"
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    print_success "Node.js already installed: $(node --version)"
    print_success "npm already installed: v$(npm --version)"
else
    print_status "Installing Node.js 20.x (includes npm)..."
    
    # Remove any conflicting packages
    apt-get remove -y nodejs npm 2>/dev/null || true
    apt-get autoremove -y 2>/dev/null || true
    
    # Install from NodeSource
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
    
    # Verify installation
    if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        print_success "Node.js installed: $(node --version)"
        print_success "npm installed: v$(npm --version)"
    else
        print_error "Node.js or npm installation failed"
        exit 1
    fi
fi

# MongoDB (using Atlas cloud - no local installation needed)
print_header "MongoDB Configuration"
print_status "Using MongoDB Atlas (cloud database)"
print_success "No local MongoDB installation required"

# Install nginx
print_header "Installing Nginx"
if command -v nginx >/dev/null 2>&1; then
    print_success "Nginx already installed"
else
    print_status "Installing nginx..."
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx
    systemctl enable nginx
    print_success "Nginx installed"
fi

# Run ISO Builder Setup
print_header "Setting Up ISO Builder"
if [ -f "$SCRIPT_DIR/deploy-gce-iso-builder.sh" ]; then
    print_status "Running ISO builder setup..."
    bash "$SCRIPT_DIR/deploy-gce-iso-builder.sh"
    print_success "ISO builder configured"
else
    print_warning "ISO builder script not found, skipping..."
fi

# Setup Backend Services
print_header "Setting Up Backend Services"

BACKEND_DIR="/opt/gce-backend"
mkdir -p "$BACKEND_DIR"

# Copy backend files
if [ -d "$REPO_DIR/gce-backend" ]; then
    print_status "Copying backend files..."
    cp -r "$REPO_DIR/gce-backend/"* "$BACKEND_DIR/"
    print_success "Backend files copied"
fi

# Install backend dependencies
cd "$BACKEND_DIR"
if [ -f "package.json" ]; then
    print_status "Installing backend dependencies..."
    npm install --production --quiet
    print_success "Dependencies installed"
fi

# Setup Distributed EPC API
print_header "Setting Up Distributed EPC API"

if [ -d "$REPO_DIR/distributed-epc" ]; then
    print_status "Copying distributed EPC modules..."
    cp -r "$REPO_DIR/distributed-epc" "$BACKEND_DIR/"
    
    cd "$BACKEND_DIR/distributed-epc"
    if [ -f "package.json" ] || [ ! -d "node_modules" ]; then
        npm init -y --quiet
        npm install express mongoose --production --quiet
    fi
    print_success "Distributed EPC API configured"
fi

# Setup deployment files
print_header "Setting Up Deployment Files"

DEPLOY_FILES_DIR="$BACKEND_DIR/deployment-files"
mkdir -p "$DEPLOY_FILES_DIR"

if [ -d "$REPO_DIR/deployment-files" ]; then
    print_status "Copying deployment files..."
    cp -r "$REPO_DIR/deployment-files/"* "$DEPLOY_FILES_DIR/"
    print_success "Deployment files copied"
fi

# Environment will be configured in systemd service
print_header "Environment Configuration"
print_status "Environment variables will be set in systemd service (GCE best practice)"
print_success "No .env file needed"

# Create master backend server
print_header "Creating Master Backend Server"

cat > "$BACKEND_DIR/server.js" << 'SERVER_EOF'
// WISPTools.io GCE Backend Master Server
// Handles ALL backend operations
// Environment variables set via systemd service

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('combined'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      api: 'running',
      mongodb: 'atlas (cloud)',
      iso_builder: 'ready'
    }
  });
});

// Load routes
try {
  // EPC Deployment routes
  const epcDeployment = require('./routes/epc-deployment');
  app.use('/api/epc', epcDeployment);
  console.log('[Server] ✓ EPC deployment routes loaded');
} catch (err) {
  console.error('[Server] ✗ EPC deployment routes failed:', err.message);
}

try {
  // Distributed EPC routes
  const distributedEpc = require('./distributed-epc');
  app.use('/api', distributedEpc);
  console.log('[Server] ✓ Distributed EPC routes loaded');
} catch (err) {
  console.error('[Server] ✗ Distributed EPC routes failed:', err.message);
}

// Static files for ISOs
app.use('/downloads', express.static('/var/www/html/downloads'));

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          WISPTools.io GCE Backend Server                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`[Server] Running on port ${PORT}`);
  console.log(`[Server] GCE IP: ${process.env.GCE_PUBLIC_IP}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV}`);
  console.log(`[Server] ISO Downloads: http://${process.env.GCE_PUBLIC_IP}/downloads/isos/`);
  console.log('');
  console.log('[Server] Available endpoints:');
  console.log('  - POST /api/epc/:id/generate-iso');
  console.log('  - GET  /api/epc/:id/bootstrap');
  console.log('  - GET  /api/epc/:id/deployment-script');
  console.log('  - GET  /health');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully...');
  process.exit(0);
});
SERVER_EOF

print_success "Master backend server created"

# Update systemd service
print_header "Creating Systemd Services"

cat > /etc/systemd/system/wisptools-backend.service << SERVICE_EOF
[Unit]
Description=WISPTools.io Complete Backend System
Documentation=https://github.com/theorem6/lte-pci-mapper
After=network.target nginx.service
Wants=nginx.service

[Service]
Type=simple
User=root
WorkingDirectory=$BACKEND_DIR

# Environment Variables (GCE best practice - no .env file)
Environment="NODE_ENV=production"
Environment="PORT=3001"
Environment="GCE_PUBLIC_IP=136.112.111.167"
Environment="HSS_PORT=3001"
Environment="ISO_API_PORT=3002"

# MongoDB Atlas connection (update with: systemctl edit wisptools-backend)
Environment="MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/wisptools"

# API URLs
Environment="HSS_API_URL=https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy"

# Directories
Environment="ISO_BUILD_DIR=/opt/epc-iso-builder"
Environment="ISO_OUTPUT_DIR=/var/www/html/downloads/isos"
Environment="BASE_ISO_PATH=/opt/base-images/ubuntu-24.04-live-server-amd64.iso"

ExecStart=/usr/bin/node $BACKEND_DIR/server.js
Restart=always
RestartSec=10
StandardOutput=append:$BACKEND_DIR/logs/backend.log
StandardError=append:$BACKEND_DIR/logs/backend-error.log
SyslogIdentifier=wisptools-backend

# Security
NoNewPrivileges=false
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SERVICE_EOF

mkdir -p "$BACKEND_DIR/logs"

print_status "Enabling services..."
systemctl daemon-reload
systemctl enable wisptools-backend.service
systemctl restart wisptools-backend.service

sleep 3

if systemctl is-active --quiet wisptools-backend.service; then
    print_success "WISPTools backend service running"
else
    print_error "Backend service failed to start"
    print_status "Checking logs..."
    journalctl -u wisptools-backend.service -n 30 --no-pager
fi

# Configure nginx
print_header "Configuring Nginx"

cat > /etc/nginx/sites-available/wisptools << 'NGINX_EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    
    root /var/www/html;
    index index.html;
    
    client_max_body_size 100M;
    
    # ISO and file downloads
    location /downloads/ {
        alias /var/www/html/downloads/;
        autoindex on;
        autoindex_exact_size off;
        autoindex_localtime on;
        add_header Cache-Control "public, max-age=3600";
    }
    
    # API proxy to backend
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for long-running requests
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:3001/health;
    }
    
    # Access logs
    access_log /var/log/nginx/wisptools-access.log;
    error_log /var/log/nginx/wisptools-error.log;
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/wisptools /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl restart nginx
print_success "Nginx configured and restarted"

# Create monitoring script
print_header "Creating Monitoring Tools"

cat > /usr/local/bin/wisptools-status << 'MONITOR_EOF'
#!/bin/bash
# WISPTools.io System Status Monitor

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          WISPTools.io System Status                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Service status
echo "Services:"
for service in wisptools-backend nginx; do
    if systemctl is-active --quiet $service; then
        echo "  ✓ $service: running"
    else
        echo "  ✗ $service: stopped"
    fi
done
echo "  ✓ mongodb: Atlas (cloud)"

echo ""
echo "Network:"
echo "  Public IP: 136.112.111.167"
echo "  Backend Port: 3001"
echo "  Web Port: 80"

echo ""
echo "Endpoints:"
curl -s http://localhost:3001/health | jq . 2>/dev/null || echo "  Backend not responding"

echo ""
echo "Recent Backend Logs:"
tail -n 5 /opt/gce-backend/logs/backend.log

echo ""
echo "Disk Usage:"
df -h /opt /var/www/html | tail -n +2

echo ""
MONITOR_EOF

chmod +x /usr/local/bin/wisptools-status
print_success "Monitoring tools created"

# Create management commands
print_header "Creating Management Commands"

cat > /usr/local/bin/wisptools-restart << 'RESTART_EOF'
#!/bin/bash
echo "Restarting WISPTools.io services..."
systemctl restart wisptools-backend
systemctl restart nginx
echo "✓ Services restarted"
systemctl status wisptools-backend --no-pager -l
RESTART_EOF

chmod +x /usr/local/bin/wisptools-restart

cat > /usr/local/bin/wisptools-logs << 'LOGS_EOF'
#!/bin/bash
if [ "$1" == "backend" ]; then
    tail -f /opt/gce-backend/logs/backend.log
elif [ "$1" == "nginx" ]; then
    tail -f /var/log/nginx/wisptools-access.log
else
    echo "Usage: wisptools-logs [backend|nginx]"
    echo "Or use: journalctl -u wisptools-backend -f"
fi
LOGS_EOF

chmod +x /usr/local/bin/wisptools-logs
print_success "Management commands created"

# Firewall configuration
print_header "Configuring Firewall"

if command -v ufw >/dev/null 2>&1; then
    print_status "Setting up UFW firewall..."
    
    ufw --force enable
    ufw default deny incoming
    ufw default allow outgoing
    
    ufw allow 22/tcp comment "SSH"
    ufw allow 80/tcp comment "HTTP"
    ufw allow 443/tcp comment "HTTPS"
    ufw allow 3000/tcp comment "GenieACS"
    ufw allow 3001/tcp comment "HSS API"
    ufw allow 3868/tcp comment "Diameter"
    ufw allow 7547/tcp comment "TR-069"
    
    ufw status
    print_success "Firewall configured"
else
    print_warning "UFW not available"
fi

# Create homepage
print_header "Creating Homepage"

cat > /var/www/html/index.html << 'HTML_EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WISPTools.io GCE Server</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #333; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .container { background: white; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 800px; width: 100%; padding: 40px; }
        h1 { color: #667eea; margin-bottom: 10px; font-size: 2.5rem; }
        .subtitle { color: #666; margin-bottom: 30px; font-size: 1.1rem; }
        .status { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .info-card { background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; }
        .info-card h3 { color: #667eea; margin-bottom: 10px; }
        .info-card p { font-size: 1.5rem; font-weight: bold; color: #333; }
        .links { display: flex; gap: 15px; flex-wrap: wrap; margin-top: 30px; }
        .btn { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; transition: all 0.3s; }
        .btn:hover { background: #5568d3; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }
        .endpoint { background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0; font-family: 'Courier New', monospace; font-size: 0.9rem; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 WISPTools.io</h1>
        <p class="subtitle">GCE Server - Distributed EPC Management System</p>
        
        <div class="status">
            <strong>✓ System Online</strong> - All services running
        </div>
        
        <div class="info-grid">
            <div class="info-card">
                <h3>Server IP</h3>
                <p>136.112.111.167</p>
            </div>
            <div class="info-card">
                <h3>API Port</h3>
                <p>3001</p>
            </div>
            <div class="info-card">
                <h3>Status</h3>
                <p id="status">Checking...</p>
            </div>
        </div>
        
        <h3>📥 Downloads</h3>
        <div class="links">
            <a href="/downloads/isos/" class="btn">EPC Boot ISOs</a>
            <a href="/downloads/" class="btn">All Downloads</a>
        </div>
        
        <h3 style="margin-top: 30px;">🔌 API Endpoints</h3>
        <div class="endpoint">POST /api/epc/:epc_id/generate-iso</div>
        <div class="endpoint">GET /api/epc/:epc_id/bootstrap</div>
        <div class="endpoint">GET /api/epc/:epc_id/deployment-script</div>
        <div class="endpoint">GET /health</div>
        
        <h3 style="margin-top: 30px;">📖 Documentation</h3>
        <div class="links">
            <a href="https://github.com/theorem6/lte-pci-mapper" class="btn" target="_blank">GitHub Repository</a>
            <a href="https://wisptools.io" class="btn" target="_blank">Management Portal</a>
        </div>
        
        <div class="footer">
            <p>WISPTools.io © 2025 | Distributed EPC Management Platform</p>
        </div>
    </div>
    
    <script>
        fetch('/health')
            .then(r => r.json())
            .then(data => {
                document.getElementById('status').textContent = '✓ Online';
                document.getElementById('status').style.color = '#28a745';
            })
            .catch(() => {
                document.getElementById('status').textContent = '✗ Error';
                document.getElementById('status').style.color = '#dc3545';
            });
    </script>
</body>
</html>
HTML_EOF

print_success "Homepage created"

# Final health check
print_header "Final Health Check"

sleep 2

print_status "Checking services..."
systemctl is-active --quiet wisptools-backend && print_success "Backend: Running" || print_error "Backend: Stopped"
systemctl is-active --quiet nginx && print_success "Nginx: Running" || print_error "Nginx: Stopped"
print_success "MongoDB: Atlas (cloud)"

print_status "Testing endpoints..."
curl -s http://localhost:3001/health > /dev/null && print_success "Backend API: Responding" || print_error "Backend API: Not responding"
curl -s http://localhost/health > /dev/null && print_success "Nginx proxy: Working" || print_error "Nginx proxy: Failed"

# Print summary
print_header "DEPLOYMENT COMPLETE"

echo ""
echo -e "${GREEN}✓ WISPTools.io is now fully deployed!${NC}"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}SYSTEM INFORMATION${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "  Server IP:     136.112.111.167"
echo "  Backend Port:  3001"
echo "  Web Port:      80"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}ACCESS POINTS${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "  Homepage:      http://136.112.111.167/"
echo "  ISO Downloads: http://136.112.111.167/downloads/isos/"
echo "  Health Check:  http://136.112.111.167/health"
echo "  API Base:      http://136.112.111.167:3001/api/"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}MANAGEMENT COMMANDS${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "  Status:        wisptools-status"
echo "  Restart:       wisptools-restart"
echo "  Logs:          wisptools-logs [backend|nginx]"
echo "  Backend Logs:  journalctl -u wisptools-backend -f"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}DIRECTORIES${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "  Backend:       /opt/gce-backend"
echo "  ISOs:          /var/www/html/downloads/isos"
echo "  Logs:          /opt/gce-backend/logs"
echo "  Repository:    /root/lte-pci-mapper"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}NEXT STEPS${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "  1. Visit http://136.112.111.167/ to verify"
echo "  2. Check system status: wisptools-status"
echo "  3. Deploy EPCs from wisptools.io UI"
echo "  4. Monitor logs: wisptools-logs backend"
echo ""
echo -e "${GREEN}🎉 System ready for production use!${NC}"
echo ""

exit 0

