#!/bin/bash
# Install Open5GS HSS without local MongoDB (uses Atlas instead)
# Works around the MongoDB dependency issue

set -e

echo "🔐 Installing Open5GS HSS (cloud MongoDB version)..."

MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/open5gs?retryWrites=true&w=majority&appName=Cluster0"

# Install dependencies
apt-get update
apt-get install -y software-properties-common gnupg wget curl net-tools

# Add Open5GS repository
add-apt-repository -y ppa:open5gs/latest
apt-get update

# Create a dummy mongodb package to satisfy dependency
echo "📦 Creating dummy MongoDB package..."
apt-get install -y equivs
cat > /tmp/mongodb-dummy << 'EOF'
Section: database
Priority: optional
Standards-Version: 3.9.2
Package: mongodb-org
Version: 999.0.0
Provides: mongodb-org, mongodb
Description: Dummy MongoDB package (using Atlas cloud)
 This is a dummy package to satisfy Open5GS HSS dependency.
 Actual MongoDB is hosted on MongoDB Atlas.
EOF

equivs-build /tmp/mongodb-dummy
dpkg -i mongodb-org_999.0.0_all.deb

# Now install Open5GS HSS
echo "📥 Installing Open5GS HSS..."
apt-get install -y open5gs-hss

# Configure HSS
echo "⚙️  Configuring HSS..."
cp /etc/open5gs/hss.yaml /etc/open5gs/hss.yaml.backup 2>/dev/null || true

cat > /etc/open5gs/hss.yaml << EOF
logger:
  file: /var/log/open5gs/hss.log
  level: info

hss:
  freeDiameter:
    identity: hss.open5gs.org
    realm: open5gs.org
    listen_on: 0.0.0.0
    port: 3868
    sec_port: 5868
    
    no_fwd: true
    no_sctp: false
    
    load_extension:
      - module: /usr/lib/x86_64-linux-gnu/freeDiameter/dict_nas_mipv6.fdx
      - module: /usr/lib/x86_64-linux-gnu/freeDiameter/dict_nasreq.fdx
      - module: /usr/lib/x86_64-linux-gnu/freeDiameter/dict_s6a.fdx
    
    connect:
      - identity: mme.open5gs.org
        address: 0.0.0.0

db_uri: $MONGODB_URI
EOF

# Create log directory
mkdir -p /var/log/open5gs
chown -R $(whoami):$(whoami) /var/log/open5gs 2>/dev/null || chown -R root:root /var/log/open5gs

# Open firewall
ufw allow 3868/tcp 2>/dev/null || true
ufw allow 3868/sctp 2>/dev/null || true

# Start HSS
echo "🚀 Starting Open5GS HSS..."
systemctl daemon-reload
systemctl enable open5gs-hssd
systemctl restart open5gs-hssd

# Wait for startup
sleep 3

# Check status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Open5GS HSS Installation Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Service Status:"
systemctl status open5gs-hssd --no-pager -l | head -20

echo ""
echo "🔍 Network Ports:"
netstat -tlnp 2>/dev/null | grep 3868 || ss -tlnp | grep 3868 || echo "⚠️  Port check failed (install net-tools)"

echo ""
echo "📋 Configuration:"
echo "   • Config: /etc/open5gs/hss.yaml"
echo "   • Logs: /var/log/open5gs/hss.log"
echo "   • MongoDB: Atlas Cloud"
echo "   • S6a Port: 3868 (Diameter)"
echo ""
echo "📡 MME Configuration:"
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "   • HSS Address: $SERVER_IP:3868"
echo "   • Realm: open5gs.org"
echo "   • Identity: hss.open5gs.org"
echo ""
echo "🔧 Useful Commands:"
echo "   systemctl status open5gs-hssd"
echo "   journalctl -u open5gs-hssd -f"
echo "   tail -f /var/log/open5gs/hss.log"
echo ""
echo "📝 Next Steps:"
echo "   1. Add subscriber data via web UI"
echo "   2. Configure your MME to connect to this HSS"
echo "   3. Test UE attachment"
echo ""

