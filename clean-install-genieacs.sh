#!/bin/bash
# Clean GenieACS installation from scratch

set -e

MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

echo "═══════════════════════════════════════════════════════════"
echo "  🧹 Clean GenieACS Installation"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Stop and remove existing services
echo "🛑 Stopping and removing existing services..."
systemctl stop genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui 2>/dev/null || true
systemctl disable genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui 2>/dev/null || true
rm -f /etc/systemd/system/genieacs-*.service
systemctl daemon-reload

# Remove existing installation
echo "🗑️  Removing old installation..."
npm uninstall -g genieacs 2>/dev/null || true
rm -rf /opt/genieacs
rm -rf /var/log/genieacs

# Create user if needed
echo "👤 Creating genieacs user..."
id -u genieacs &>/dev/null || useradd --system --no-create-home --user-group genieacs

# Install GenieACS
echo ""
echo "📦 Installing GenieACS v1.2.14..."
npm install -g genieacs@1.2.14

# Verify installation
echo ""
echo "✅ Verifying installation..."
GENIEACS_PATH=$(npm root -g)/genieacs
echo "GenieACS installed at: $GENIEACS_PATH"

if [ ! -f "$GENIEACS_PATH/bin/genieacs-cwmp" ]; then
  echo "❌ ERROR: GenieACS binaries not found!"
  exit 1
fi

ls -la $GENIEACS_PATH/bin/

# Create directories
echo ""
echo "📂 Creating directories..."
mkdir -p /opt/genieacs/ext
mkdir -p /var/log/genieacs
chown -R genieacs:genieacs /opt/genieacs /var/log/genieacs

# Create config
echo "⚙️  Creating configuration..."
JWT_SECRET=$(openssl rand -base64 32)

cat > /opt/genieacs/genieacs.env << EOF
GENIEACS_CWMP_ACCESS_LOG_FILE=/var/log/genieacs/genieacs-cwmp-access.log
GENIEACS_NBI_ACCESS_LOG_FILE=/var/log/genieacs/genieacs-nbi-access.log
GENIEACS_FS_ACCESS_LOG_FILE=/var/log/genieacs/genieacs-fs-access.log
GENIEACS_UI_ACCESS_LOG_FILE=/var/log/genieacs/genieacs-ui-access.log
GENIEACS_EXT_DIR=/opt/genieacs/ext
GENIEACS_UI_JWT_SECRET=$JWT_SECRET
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

# Get node and genieacs paths
NODE_BIN=$(which node)
GENIEACS_BIN="$GENIEACS_PATH/bin"

echo ""
echo "📍 Paths:"
echo "   Node: $NODE_BIN"
echo "   GenieACS: $GENIEACS_BIN"

# Create systemd services
echo ""
echo "⚙️  Creating systemd services..."

cat > /etc/systemd/system/genieacs-cwmp.service << EOF
[Unit]
Description=GenieACS CWMP
After=network.target

[Service]
User=genieacs
EnvironmentFile=/opt/genieacs/genieacs.env
ExecStart=$NODE_BIN $GENIEACS_BIN/genieacs-cwmp
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/genieacs-nbi.service << EOF
[Unit]
Description=GenieACS NBI
After=network.target

[Service]
User=genieacs
EnvironmentFile=/opt/genieacs/genieacs.env
ExecStart=$NODE_BIN $GENIEACS_BIN/genieacs-nbi
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/genieacs-fs.service << EOF
[Unit]
Description=GenieACS FS
After=network.target

[Service]
User=genieacs
EnvironmentFile=/opt/genieacs/genieacs.env
ExecStart=$NODE_BIN $GENIEACS_BIN/genieacs-fs
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/genieacs-ui.service << EOF
[Unit]
Description=GenieACS UI
After=network.target

[Service]
User=genieacs
EnvironmentFile=/opt/genieacs/genieacs.env
ExecStart=$NODE_BIN $GENIEACS_BIN/genieacs-ui
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start services
echo "🚀 Starting services..."
systemctl daemon-reload
systemctl enable genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui
systemctl start genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui

# Wait for startup
echo "⏳ Waiting for services to start..."
sleep 5

# Check status
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  📊 SERVICE STATUS"
echo "═══════════════════════════════════════════════════════════"
echo ""

for service in cwmp nbi fs ui; do
  if systemctl is-active --quiet genieacs-$service; then
    echo "✅ genieacs-$service: RUNNING"
  else
    echo "❌ genieacs-$service: FAILED"
    journalctl -u genieacs-$service -n 10 --no-pager
  fi
done

echo ""
echo "🔌 Port Status:"
netstat -tulpn 2>/dev/null | grep -E ":(7547|7557|7567|3333)" || ss -tulpn | grep -E ":(7547|7557|7567|3333)"

# Get external IP
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ INSTALLATION COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🌐 GenieACS Services:"
echo "   CWMP (TR-069): http://$EXTERNAL_IP:7547"
echo "   API (NBI):     http://$EXTERNAL_IP:7557"
echo "   File Server:   http://$EXTERNAL_IP:7567"
echo "   Web UI:        http://$EXTERNAL_IP:3333"
echo ""
echo "🧪 Test Commands:"
echo "   curl http://localhost:7557/devices"
echo "   curl http://localhost:3333"
echo ""
echo "🔧 Manage Services:"
echo "   systemctl status genieacs-cwmp"
echo "   journalctl -u genieacs-cwmp -f"
echo ""
echo "═══════════════════════════════════════════════════════════"

