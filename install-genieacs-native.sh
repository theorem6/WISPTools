#!/bin/bash
# Install GenieACS natively (no Docker) on Ubuntu server
# For servers with Open5GS HSS already installed

set -e

MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

echo "═══════════════════════════════════════════════════════════"
echo "  📡 Installing GenieACS (Native Installation)"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Install Node.js if needed
if ! command -v node &> /dev/null; then
  echo "📦 Installing Node.js 18..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt-get install -y nodejs
  echo "✅ Node.js installed: $(node --version)"
else
  echo "✅ Node.js already installed: $(node --version)"
fi

# Install GenieACS globally
echo ""
echo "📦 Installing GenieACS..."
npm install -g genieacs@1.2.14

# Create GenieACS user
if ! id -u genieacs &> /dev/null; then
  echo "👤 Creating genieacs user..."
  useradd --system --no-create-home --user-group genieacs
fi

# Create necessary directories
echo "📂 Creating directories..."
mkdir -p /opt/genieacs
mkdir -p /opt/genieacs/ext
chown -R genieacs:genieacs /opt/genieacs

# Create configuration file
echo "⚙️  Creating configuration..."
cat > /opt/genieacs/genieacs.env << EOF
GENIEACS_CWMP_ACCESS_LOG_FILE=/var/log/genieacs/genieacs-cwmp-access.log
GENIEACS_NBI_ACCESS_LOG_FILE=/var/log/genieacs/genieacs-nbi-access.log
GENIEACS_FS_ACCESS_LOG_FILE=/var/log/genieacs/genieacs-fs-access.log
GENIEACS_UI_ACCESS_LOG_FILE=/var/log/genieacs/genieacs-ui-access.log
GENIEACS_DEBUG_FILE=/var/log/genieacs/genieacs-debug.yaml
GENIEACS_EXT_DIR=/opt/genieacs/ext
GENIEACS_UI_JWT_SECRET=$(openssl rand -base64 32)
GENIEACS_MONGODB_CONNECTION_URL=$MONGODB_URI
GENIEACS_CWMP_INTERFACE=0.0.0.0
GENIEACS_CWMP_PORT=7547
GENIEACS_NBI_INTERFACE=0.0.0.0
GENIEACS_NBI_PORT=7557
GENIEACS_FS_INTERFACE=0.0.0.0
GENIEACS_FS_PORT=7567
GENIEACS_UI_INTERFACE=0.0.0.0
GENIEACS_UI_PORT=3333
EOF

# Create log directory
mkdir -p /var/log/genieacs
chown -R genieacs:genieacs /var/log/genieacs

# Create systemd services
echo "⚙️  Creating systemd services..."

# CWMP Service
cat > /etc/systemd/system/genieacs-cwmp.service << 'EOF'
[Unit]
Description=GenieACS CWMP
After=network.target

[Service]
User=genieacs
EnvironmentFile=/opt/genieacs/genieacs.env
ExecStart=/usr/bin/node /usr/lib/node_modules/genieacs/bin/genieacs-cwmp
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# NBI Service
cat > /etc/systemd/system/genieacs-nbi.service << 'EOF'
[Unit]
Description=GenieACS NBI
After=network.target

[Service]
User=genieacs
EnvironmentFile=/opt/genieacs/genieacs.env
ExecStart=/usr/bin/node /usr/lib/node_modules/genieacs/bin/genieacs-nbi
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# FS Service
cat > /etc/systemd/system/genieacs-fs.service << 'EOF'
[Unit]
Description=GenieACS FS
After=network.target

[Service]
User=genieacs
EnvironmentFile=/opt/genieacs/genieacs.env
ExecStart=/usr/bin/node /usr/lib/node_modules/genieacs/bin/genieacs-fs
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# UI Service
cat > /etc/systemd/system/genieacs-ui.service << 'EOF'
[Unit]
Description=GenieACS UI
After=network.target

[Service]
User=genieacs
EnvironmentFile=/opt/genieacs/genieacs.env
ExecStart=/usr/bin/node /usr/lib/node_modules/genieacs/bin/genieacs-ui
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
echo "🔄 Reloading systemd..."
systemctl daemon-reload

# Enable and start services
echo "🚀 Starting GenieACS services..."
systemctl enable genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui
systemctl start genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui

# Wait for services to start
echo "⏳ Waiting for services to start (5 seconds)..."
sleep 5

# Get external IP
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  📊 SERVICE STATUS"
echo "═══════════════════════════════════════════════════════════"
echo ""
systemctl status genieacs-cwmp --no-pager -l || true
echo ""
systemctl status genieacs-nbi --no-pager -l || true
echo ""
systemctl status genieacs-fs --no-pager -l || true
echo ""
systemctl status genieacs-ui --no-pager -l || true

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ GENIEACS INSTALLATION COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🌐 External IP: $EXTERNAL_IP"
echo ""
echo "📡 Your Services:"
echo "   GenieACS CWMP: http://$EXTERNAL_IP:7547 (TR-069 for CPE)"
echo "   GenieACS NBI:  http://$EXTERNAL_IP:7557 (REST API)"
echo "   GenieACS FS:   http://$EXTERNAL_IP:7567 (Firmware server)"
echo "   GenieACS UI:   http://$EXTERNAL_IP:3333 (Admin dashboard)"
echo ""
echo "🧪 Test GenieACS:"
echo "   curl http://localhost:7557/devices"
echo "   Open browser: http://$EXTERNAL_IP:3333"
echo ""
echo "🔧 Manage Services:"
echo "   systemctl status genieacs-cwmp"
echo "   systemctl restart genieacs-cwmp"
echo "   journalctl -u genieacs-cwmp -f"
echo ""
echo "📋 View all services:"
echo "   systemctl list-units 'genieacs-*'"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

