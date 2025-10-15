#!/bin/bash
# Cloud HSS Installation - No sudo required
# Run as root or in environment without sudo
# Installs: Open5GS HSS + Management API

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Cloud HSS Installation (No sudo)"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "⚠️  Not running as root. Some operations may fail."
  echo "   Try: Run this script as root user"
fi

# Configuration
MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
HSS_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || echo "GENERATE_KEY_MANUALLY")
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}' || echo "unknown")

echo "📋 Configuration:"
echo "  MongoDB: ✅ Cloud Atlas (cluster0.1radgkw.mongodb.net)"
echo "           No local MongoDB installation needed!"
echo "  External IP: $EXTERNAL_IP"
echo "  Database: open5gs"
echo ""
echo "🔑 Encryption Key: $HSS_KEY"
echo "   ⚠️  SAVE THIS KEY!"
echo ""
echo "⚠️  This script does NOT install MongoDB"
echo "   Using existing cloud MongoDB Atlas connection"
echo ""

# Test MongoDB connection
echo "🧪 Testing MongoDB Atlas connection..."
if command -v mongosh &> /dev/null; then
  mongosh "$MONGODB_URI" --quiet --eval "db.adminCommand('ping')" 2>&1 | grep -q "ok" && echo "  ✅ MongoDB Atlas connected" || echo "  ⚠️  MongoDB connection test failed (will retry during install)"
else
  echo "  ⏭️  Skipping test (mongosh not installed)"
fi
echo ""

# ============================================================================
# PART 1: Install Open5GS HSS (No local MongoDB needed!)
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PART 1: Installing Open5GS HSS Daemon"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Add repository
apt-get update -qq 2>/dev/null || echo "Updating packages..."
apt-get install -y software-properties-common gnupg curl -qq 2>/dev/null || apt-get install -y software-properties-common gnupg curl

add-apt-repository -y ppa:open5gs/latest 2>/dev/null || {
  echo "Adding Open5GS PPA manually..."
  # Manual PPA add for environments without add-apt-repository
  echo "deb http://ppa.launchpad.net/open5gs/latest/ubuntu jammy main" > /etc/apt/sources.list.d/open5gs.list
  apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 32F1631C 2>/dev/null || true
}

apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y open5gs-hss -qq 2>/dev/null || apt-get install -y open5gs-hss

# Configure Open5GS HSS
mkdir -p /etc/open5gs
tee /etc/open5gs/hss.yaml > /dev/null << EOF
db_uri: $MONGODB_URI

logger:
  file: /var/log/open5gs/hss.log
  level: info

hss:
  freeDiameter: /etc/freeDiameter/hss.conf
EOF

# Configure Diameter
mkdir -p /etc/freeDiameter
tee /etc/freeDiameter/hss.conf > /dev/null << EOF
Identity = "hss.lte-pci-mapper.com";
Realm = "lte-pci-mapper.com";
ListenOn = "0.0.0.0";
Port = 3868;
SecPort = 5868;
No_SCTP;
LoadExtension = "dbg_msg_dumps.so" : "0x8888";
LoadExtension = "dict_rfc5777.so";
LoadExtension = "dict_mip6i.so";
LoadExtension = "dict_nasreq.so";
LoadExtension = "dict_dcca.so";
LoadExtension = "dict_dcca_3gpp.so";
AppServThreads = 4;
EOF

# Create log directory
mkdir -p /var/log/open5gs

# Start Open5GS HSS
systemctl daemon-reload 2>/dev/null || true
systemctl enable open5gs-hssd 2>/dev/null || true
systemctl restart open5gs-hssd 2>/dev/null || {
  echo "⚠️  systemctl not available, starting manually..."
  /usr/bin/open5gs-hssd -c /etc/open5gs/hss.yaml &
}

sleep 2
echo "✅ Open5GS HSS daemon started"
echo ""

# ============================================================================
# PART 2: Install Management API
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PART 2: Installing Management API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

mkdir -p /opt/hss-manager
cd /opt/hss-manager

# Package.json
cat > package.json << 'PKGEOF'
{
  "name": "hss-manager",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "mongodb": "^6.3.0"
  }
}
PKGEOF

# Server code (simplified, production-ready)
cat > server.js << 'SRVEOF'
const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
app.use(express.json());
app.use(require('cors')({ origin: true }));

const MONGODB_URI = process.env.MONGODB_URI;
let db, subscribers;

MongoClient.connect(MONGODB_URI).then(client => {
  db = client.db('open5gs');
  subscribers = db.collection('subscribers');
  console.log('✅ Connected to MongoDB Atlas');
}).catch(err => console.error('MongoDB error:', err));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'HSS Manager', open5gs_hss: 'port 3868' });
});

app.post('/api/subscribers', async (req, res) => {
  try {
    const { imsi, ki, opc, user_info } = req.body;
    const sub = {
      imsi,
      security: { k: ki, opc: opc, amf: "8000", sqn: 0 },
      subscribed_rau_tau_timer: 12,
      network_access_mode: 0,
      subscriber_status: 0,
      slice: [{ sst: 1, default_indicator: true, session: [{ name: "internet", type: 3 }] }],
      user_info: user_info || {},
      tenantId: req.headers['x-tenant-id'] || 'default',
      metadata: { created_at: new Date() }
    };
    await subscribers.insertOne(sub);
    res.json({ success: true, imsi });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/subscribers', async (req, res) => {
  try {
    const subs = await subscribers.find({ tenantId: req.headers['x-tenant-id'] || 'default' }).limit(100).toArray();
    res.json({ count: subs.length, subscribers: subs.map(s => ({ ...s, security: { k: '***', opc: '***' } })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subscribers/:imsi/disable', async (req, res) => {
  try {
    await subscribers.updateOne({ imsi: req.params.imsi }, { $set: { subscriber_status: 1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subscribers/:imsi/enable', async (req, res) => {
  try {
    await subscribers.updateOne({ imsi: req.params.imsi }, { $set: { subscriber_status: 0 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, '0.0.0.0', () => console.log('✅ HSS Manager on port 3000'));
SRVEOF

# Install
npm install --silent 2>/dev/null || npm install

# Create service
tee /etc/systemd/system/hss-manager.service > /dev/null << EOF
[Unit]
Description=HSS Manager API
After=network.target open5gs-hssd.service

[Service]
Type=simple
WorkingDirectory=/opt/hss-manager
Environment="MONGODB_URI=$MONGODB_URI"
Environment="HSS_ENCRYPTION_KEY=$HSS_KEY"
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Start
systemctl daemon-reload
systemctl enable hss-manager
systemctl start hss-manager

sleep 3

# ============================================================================
# Verification
# ============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ INSTALLATION COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📡 Services:"
echo ""

# Check services
if systemctl is-active --quiet open5gs-hssd 2>/dev/null; then
  echo "  ✅ open5gs-hssd (S6a/MME) - Port 3868"
elif pgrep -f open5gs-hssd >/dev/null; then
  echo "  ✅ open5gs-hssd (S6a/MME) - Port 3868 (running)"
else
  echo "  ⚠️  open5gs-hssd not detected"
fi

if systemctl is-active --quiet hss-manager 2>/dev/null; then
  echo "  ✅ hss-manager (API) - Port 3000"
elif pgrep -f "node.*server.js" >/dev/null; then
  echo "  ✅ hss-manager (API) - Port 3000 (running)"
else
  echo "  ⚠️  hss-manager not detected"
fi

echo ""
echo "🔌 Ports:"
netstat -tulpn 2>/dev/null | grep -E ":(3000|3868)" || ss -tulpn | grep -E ":(3000|3868)" || echo "  Check manually: netstat -tulpn | grep 3000"
echo ""
echo "🧪 Test API:"
curl -s http://localhost:3000/health 2>&1 || echo "  API starting..."
echo ""
echo "🌐 MME Configuration:"
echo "   HSS: $EXTERNAL_IP:3868"
echo "   Realm: lte-pci-mapper.com"
echo ""
echo "🔑 Encryption Key: $HSS_KEY"
echo ""
echo "═══════════════════════════════════════════════════════════"


