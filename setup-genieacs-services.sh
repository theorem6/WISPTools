#!/bin/bash
# GenieACS Services Setup Script
# Run this script to set up all GenieACS services

set -e

echo "🚀 Setting up GenieACS Services..."

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
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Update system
print_status "Updating system packages..."
apt-get update -y

# Install Node.js 18
print_status "Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install MongoDB
print_status "Installing MongoDB..."
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
apt-get update
apt-get install -y mongodb-org

# Start and enable MongoDB
print_status "Starting MongoDB..."
systemctl start mongod
systemctl enable mongod

# Create genieacs user
print_status "Creating genieacs user..."
if ! id "genieacs" &>/dev/null; then
    useradd -r -s /bin/false genieacs
else
    print_warning "User genieacs already exists"
fi

# Create directories
print_status "Creating directories..."
mkdir -p /opt/genieacs
mkdir -p /etc/genieacs
mkdir -p /var/lib/genieacs/{uploads,downloads,ui}
mkdir -p /var/log/genieacs

# Clone GenieACS if not exists
if [ ! -d "/opt/genieacs/.git" ]; then
    print_status "Cloning GenieACS repository..."
    cd /tmp
    git clone https://github.com/genieacs/genieacs.git
    cp -r genieacs/* /opt/genieacs/
    rm -rf genieacs
else
    print_warning "GenieACS already exists, updating..."
    cd /opt/genieacs
    git pull
fi

# Install dependencies
print_status "Installing GenieACS dependencies..."
cd /opt/genieacs
npm install
npm run build

# Set ownership
print_status "Setting file ownership..."
chown -R genieacs:genieacs /opt/genieacs
chown -R genieacs:genieacs /var/lib/genieacs
chown -R genieacs:genieacs /var/log/genieacs

# Create systemd service files
print_status "Creating systemd service files..."

# CWMP Service
cat > /etc/systemd/system/genieacs-cwmp.service << 'EOF'
[Unit]
Description=GenieACS CWMP Server
After=mongod.service
Wants=mongod.service

[Service]
Type=simple
User=genieacs
Group=genieacs
WorkingDirectory=/opt/genieacs
ExecStart=/usr/bin/node bin/genieacs-cwmp
Environment=NODE_ENV=production
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# NBI Service
cat > /etc/systemd/system/genieacs-nbi.service << 'EOF'
[Unit]
Description=GenieACS NBI Server
After=mongod.service
Wants=mongod.service

[Service]
Type=simple
User=genieacs
Group=genieacs
WorkingDirectory=/opt/genieacs
ExecStart=/usr/bin/node bin/genieacs-nbi
Environment=NODE_ENV=production
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# FS Service
cat > /etc/systemd/system/genieacs-fs.service << 'EOF'
[Unit]
Description=GenieACS File Server
After=mongod.service
Wants=mongod.service

[Service]
Type=simple
User=genieacs
Group=genieacs
WorkingDirectory=/opt/genieacs
ExecStart=/usr/bin/node bin/genieacs-fs
Environment=NODE_ENV=production
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# UI Service
cat > /etc/systemd/system/genieacs-ui.service << 'EOF'
[Unit]
Description=GenieACS Web UI
After=mongod.service
Wants=mongod.service

[Service]
Type=simple
User=genieacs
Group=genieacs
WorkingDirectory=/opt/genieacs
ExecStart=/usr/bin/node bin/genieacs-ui
Environment=NODE_ENV=production
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
print_status "Reloading systemd..."
systemctl daemon-reload

# Enable services
print_status "Enabling GenieACS services..."
systemctl enable genieacs-cwmp
systemctl enable genieacs-nbi
systemctl enable genieacs-fs
systemctl enable genieacs-ui

# Start services
print_status "Starting GenieACS services..."
systemctl start genieacs-cwmp
systemctl start genieacs-nbi
systemctl start genieacs-fs
systemctl start genieacs-ui

# Wait a moment for services to start
sleep 5

# Check service status
print_status "Checking service status..."
echo ""
echo "=== Service Status ==="
systemctl status genieacs-cwmp --no-pager -l
echo ""
systemctl status genieacs-nbi --no-pager -l
echo ""
systemctl status genieacs-fs --no-pager -l
echo ""
systemctl status genieacs-ui --no-pager -l

# Test services
print_status "Testing services..."
echo ""
echo "=== Service Tests ==="

# Test CWMP
if curl -s http://localhost:7547 > /dev/null; then
    print_status "✅ GenieACS CWMP (port 7547) is running"
else
    print_warning "❌ GenieACS CWMP (port 7547) is not responding"
fi

# Test NBI
if curl -s http://localhost:7557 > /dev/null; then
    print_status "✅ GenieACS NBI (port 7557) is running"
else
    print_warning "❌ GenieACS NBI (port 7557) is not responding"
fi

# Test FS
if curl -s http://localhost:7567 > /dev/null; then
    print_status "✅ GenieACS FS (port 7567) is running"
else
    print_warning "❌ GenieACS FS (port 7567) is not responding"
fi

# Test UI
if curl -s http://localhost:8080 > /dev/null; then
    print_status "✅ GenieACS UI (port 8080) is running"
else
    print_warning "❌ GenieACS UI (port 8080) is not responding"
fi

# Configure firewall
print_status "Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 7547/tcp comment "GenieACS CWMP"
    ufw allow 7557/tcp comment "GenieACS NBI"
    ufw allow 7567/tcp comment "GenieACS FS"
    ufw allow 8080/tcp comment "GenieACS UI"
    print_status "✅ Firewall rules added"
else
    print_warning "UFW not found, please configure firewall manually"
fi

echo ""
print_status "🎉 GenieACS setup complete!"
echo ""
echo "=== Service URLs ==="
echo "GenieACS CWMP: http://$(hostname -I | awk '{print $1}'):7547"
echo "GenieACS NBI:  http://$(hostname -I | awk '{print $1}'):7557"
echo "GenieACS FS:   http://$(hostname -I | awk '{print $1}'):7567"
echo "GenieACS UI:   http://$(hostname -I | awk '{print $1}'):8080"
echo ""
echo "=== Management Commands ==="
echo "Check status: sudo systemctl status genieacs-*"
echo "View logs:    sudo journalctl -u genieacs-cwmp -f"
echo "Restart:      sudo systemctl restart genieacs-*"
echo ""
echo "=== Next Steps ==="
echo "1. Configure CPE devices to point to your server:7547"
echo "2. Update Firebase Functions to connect to your server:7557"
echo "3. Test the complete integration"
echo ""
