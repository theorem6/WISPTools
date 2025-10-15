#!/bin/bash
# Direct HSS Installation Script - Run on GCE Instance via SSH
# Usage: Copy this entire hss-module directory to server, then run this script

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Installing HSS on ACS Server"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check if running in correct directory
if [ ! -f "server.js" ]; then
  echo "❌ Error: Must run from hss-module directory"
  echo "   Current directory: $(pwd)"
  echo "   Expected files: server.js, package.json, etc."
  exit 1
fi

# Get configuration
echo "📋 Configuration:"
echo ""
read -p "MongoDB URI [mongodb://localhost:27017/hss]: " MONGODB_URI
MONGODB_URI=${MONGODB_URI:-mongodb://localhost:27017/hss}

read -p "Generate new encryption key? (y/n) [y]: " GENERATE_KEY
GENERATE_KEY=${GENERATE_KEY:-y}

if [ "$GENERATE_KEY" = "y" ]; then
  HSS_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  echo "Generated encryption key: $HSS_ENCRYPTION_KEY"
  echo "⚠️  SAVE THIS KEY SECURELY!"
else
  read -p "Enter existing encryption key (64 hex chars): " HSS_ENCRYPTION_KEY
fi

echo ""
echo "Configuration:"
echo "  MongoDB URI: ${MONGODB_URI/\/\/.*@/\/\/***:***@}"
echo "  Encryption Key: ${HSS_ENCRYPTION_KEY:0:16}...${HSS_ENCRYPTION_KEY: -8}"
echo ""
read -p "Continue with installation? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
  echo "Installation cancelled"
  exit 0
fi

# Install to /opt/hss-server
echo ""
echo "📦 Installing HSS to /opt/hss-server..."
sudo mkdir -p /opt/hss-server
sudo cp -r . /opt/hss-server/
sudo chown -R $USER:$USER /opt/hss-server

# Install dependencies
echo "📦 Installing Node.js dependencies..."
cd /opt/hss-server
npm install --production
npm install milenage mongodb express cors

# Create config file
echo "⚙️  Creating configuration file..."
cat > /opt/hss-server/config.json << EOF
{
  "server": {
    "host": "0.0.0.0",
    "rest_api_port": 3000,
    "s6a_port": 3868
  },
  "diameter": {
    "realm": "lte-pci-mapper.com",
    "identity": "hss.lte-pci-mapper.com",
    "vendor_id": 10415,
    "product_name": "Cloud HSS"
  },
  "mongodb": {
    "uri": "$MONGODB_URI",
    "database": "hss"
  },
  "acs_integration": {
    "enabled": true,
    "sync_interval_minutes": 5,
    "genieacs_mongodb_uri": "$MONGODB_URI",
    "genieacs_database": "genieacs"
  },
  "features": {
    "capture_imei": true,
    "track_sessions": true,
    "audit_logging": true
  }
}
EOF

# Initialize database
echo "🗄️  Initializing HSS database..."
export MONGODB_URI="$MONGODB_URI"
export HSS_ENCRYPTION_KEY="$HSS_ENCRYPTION_KEY"

if [ -f "scripts/init-database.js" ]; then
  node scripts/init-database.js
else
  echo "⚠️  Database init script not found, skipping..."
fi

# Create systemd service
echo "⚙️  Creating systemd service..."
sudo tee /etc/systemd/system/hss.service > /dev/null << EOF
[Unit]
Description=Cloud HSS Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/hss-server
Environment="NODE_ENV=production"
Environment="HSS_ENCRYPTION_KEY=$HSS_ENCRYPTION_KEY"
Environment="MONGODB_URI=$MONGODB_URI"
ExecStart=/usr/bin/node /opt/hss-server/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Start service
echo "🚀 Starting HSS service..."
sudo systemctl daemon-reload
sudo systemctl enable hss
sudo systemctl start hss

# Wait and check status
echo "⏳ Waiting for HSS to start..."
sleep 3

echo ""
echo "═══════════════════════════════════════════════════════════"
if sudo systemctl is-active --quiet hss; then
  echo "  ✅ HSS SERVICE RUNNING"
else
  echo "  ⚠️  HSS SERVICE NOT RUNNING"
fi
echo "═══════════════════════════════════════════════════════════"
echo ""

# Show status
sudo systemctl status hss --no-pager | head -15

echo ""
echo "📊 Test HSS:"
echo "   curl http://localhost:3000/health"
curl -s http://localhost:3000/health 2>/dev/null || echo "  ⚠️  HSS not responding yet"

echo ""
echo "📝 View logs:"
echo "   sudo journalctl -u hss -f"
echo ""
echo "🔧 Manage service:"
echo "   sudo systemctl status hss"
echo "   sudo systemctl restart hss"
echo "   sudo systemctl stop hss"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

