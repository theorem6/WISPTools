#!/bin/bash
# Fix GenieACS installation paths

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  🔧 Fixing GenieACS Installation"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Stop services first
echo "⏸️  Stopping services..."
systemctl stop genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui 2>/dev/null || true

# Find where GenieACS is actually installed
echo "🔍 Finding GenieACS installation..."
GENIEACS_PATH=$(npm root -g)/genieacs

if [ ! -d "$GENIEACS_PATH" ]; then
  echo "❌ GenieACS not found. Installing now..."
  npm install -g genieacs@1.2.14
  GENIEACS_PATH=$(npm root -g)/genieacs
fi

echo "✅ Found GenieACS at: $GENIEACS_PATH"
ls -la $GENIEACS_PATH/bin/

# Find the correct node path
NODE_PATH=$(which node)
echo "✅ Node.js at: $NODE_PATH"

# Update systemd service files with correct paths
echo ""
echo "⚙️  Updating systemd services..."

for service in cwmp nbi fs ui; do
  cat > /etc/systemd/system/genieacs-$service.service << EOF
[Unit]
Description=GenieACS ${service^^}
After=network.target

[Service]
User=genieacs
EnvironmentFile=/opt/genieacs/genieacs.env
ExecStart=$NODE_PATH $GENIEACS_PATH/bin/genieacs-$service
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
  echo "  ✅ Updated genieacs-$service.service"
done

# Reload systemd
echo ""
echo "🔄 Reloading systemd..."
systemctl daemon-reload

# Start services
echo "🚀 Starting services..."
systemctl start genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui

# Wait and check
sleep 3

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  📊 SERVICE STATUS"
echo "═══════════════════════════════════════════════════════════"
echo ""

for service in cwmp nbi fs ui; do
  echo "--- genieacs-$service ---"
  systemctl status genieacs-$service --no-pager -l | head -15
  echo ""
done

echo "═══════════════════════════════════════════════════════════"
echo "  ✅ FIX COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🧪 Test GenieACS:"
echo "   curl http://localhost:7557/devices"
echo "   curl http://localhost:3333"
echo ""

