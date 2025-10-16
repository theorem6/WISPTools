#!/bin/bash
# Install Open5GS HSS (C-based, production-grade) on Ubuntu
# This provides the S6a/Diameter interface for MME authentication

set -e

echo "🔐 Installing Open5GS HSS..."

# MongoDB connection string
MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/open5gs?retryWrites=true&w=majority&appName=Cluster0"

# Install dependencies
apt-get update
apt-get install -y software-properties-common gnupg

# Add Open5GS repository
add-apt-repository -y ppa:open5gs/latest
apt-get update

# Install ONLY the HSS component (not the full Open5GS suite)
apt-get install -y open5gs-hss

# Backup original config
cp /etc/open5gs/hss.yaml /etc/open5gs/hss.yaml.backup

# Configure HSS to use MongoDB Atlas
cat > /etc/open5gs/hss.yaml << 'EOF'
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

# MongoDB connection (using Atlas)
db_uri: MONGODB_URI_PLACEHOLDER

EOF

# Replace MongoDB URI in config
sed -i "s|MONGODB_URI_PLACEHOLDER|$MONGODB_URI|g" /etc/open5gs/hss.yaml

# Create log directory
mkdir -p /var/log/open5gs
chown open5gs:open5gs /var/log/open5gs

# Open firewall for Diameter (S6a interface)
ufw allow 3868/tcp
ufw allow 3868/sctp
ufw allow 5868/tcp  # Secure diameter

# Start and enable HSS
systemctl daemon-reload
systemctl enable open5gs-hssd
systemctl start open5gs-hssd

# Wait for service to start
sleep 3

# Check status
echo ""
echo "✅ Open5GS HSS Installation Complete!"
echo ""
echo "📊 Service Status:"
systemctl status open5gs-hssd --no-pager | head -15

echo ""
echo "🔍 Checking Diameter port (3868):"
netstat -tlnp | grep 3868 || echo "⚠️  HSS not yet listening on 3868"

echo ""
echo "📋 Configuration:"
echo "   Config file: /etc/open5gs/hss.yaml"
echo "   Log file: /var/log/open5gs/hss.log"
echo "   MongoDB: MongoDB Atlas"
echo "   Diameter port: 3868 (S6a interface)"
echo ""
echo "📡 MME Configuration:"
echo "   Point your MME to: $(hostname -I | awk '{print $1}'):3868"
echo "   Realm: open5gs.org"
echo "   Identity: hss.open5gs.org"
echo ""
echo "🔧 Useful Commands:"
echo "   systemctl status open5gs-hssd"
echo "   journalctl -u open5gs-hssd -f"
echo "   tail -f /var/log/open5gs/hss.log"
echo ""
echo "⚠️  IMPORTANT: Add subscriber data to MongoDB using the web UI"
echo "   The HSS will query MongoDB for authentication credentials"

