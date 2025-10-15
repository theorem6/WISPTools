#!/bin/bash
# Working Cloud HSS Installation
# Solution: Install minimal local MongoDB (for Open5GS dependency) but use cloud MongoDB for data
# This satisfies package dependencies while using cloud database

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Cloud HSS Installation (Working Solution)"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Solution:"
echo "  - Install minimal MongoDB locally (satisfies Open5GS dependency)"
echo "  - Configure Open5GS HSS to use cloud MongoDB Atlas"
echo "  - Local MongoDB won't be used, just needed for package install"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Configuration
MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
HSS_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || openssl rand -hex 32)
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo "📋 Configuration:"
echo "  MongoDB: Cloud Atlas (no local data storage)"
echo "  External IP: $EXTERNAL_IP"
echo "  Encryption Key: ${HSS_KEY:0:16}..."
echo ""

# ============================================================================
# STEP 1: Install minimal MongoDB (just to satisfy package dependency)
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1: Installing minimal MongoDB (package dependency only)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Install MongoDB from Ubuntu repos (minimal version)
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y mongodb -qq 2>/dev/null || {
  echo "Installing MongoDB from official repo..."
  wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -
  echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-6.0.list
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y mongodb-org -qq
}

# Stop MongoDB (we won't use it, just needed for package dependency)
systemctl stop mongodb 2>/dev/null || systemctl stop mongod 2>/dev/null || true
systemctl disable mongodb 2>/dev/null || systemctl disable mongod 2>/dev/null || true

echo "✅ MongoDB package installed (but not used - only for dependency)"
echo ""

# ============================================================================
# STEP 2: Install Open5GS HSS
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2: Installing Open5GS HSS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Add Open5GS repository
add-apt-repository -y ppa:open5gs/latest
apt-get update -qq

# Install Open5GS HSS
DEBIAN_FRONTEND=noninteractive apt-get install -y open5gs-hss

# Configure for cloud MongoDB Atlas
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
EOF

mkdir -p /var/log/open5gs

# Start Open5GS HSS
systemctl daemon-reload
systemctl enable open5gs-hssd
systemctl restart open5gs-hssd

sleep 3

if systemctl is-active --quiet open5gs-hssd; then
  echo "✅ Open5GS HSS daemon running"
else
  echo "⚠️  Checking logs..."
  journalctl -u open5gs-hssd -n 20 --no-pager
fi
echo ""

# ============================================================================
# STEP 3: Install Management API
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3: Installing Management API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

mkdir -p /opt/hss-manager
cd /opt/hss-manager

cat > package.json << 'EOF'
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
EOF

cat > server.js << 'EOF'
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
  console.log('✅ Manager connected to MongoDB Atlas');
}).catch(err => console.error('Error:', err));

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
      tenantId: req.headers['x-tenant-id'] || 'default'
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

app.listen(3000, '0.0.0.0', () => console.log('✅ Manager API on port 3000'));
EOF

npm install

tee /etc/systemd/system/hss-manager.service > /dev/null << EOF
[Unit]
Description=HSS Manager
After=open5gs-hssd.service

[Service]
WorkingDirectory=/opt/hss-manager
Environment="MONGODB_URI=$MONGODB_URI"
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF

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
echo "📡 Daemons Running:"
echo ""

# Check Open5GS HSS
if systemctl is-active --quiet open5gs-hssd; then
  echo "  ✅ open5gs-hssd (S6a/MME) - Port 3868"
else
  echo "  ❌ open5gs-hssd NOT RUNNING"
fi

# Check Manager
if systemctl is-active --quiet hss-manager; then
  echo "  ✅ hss-manager (API) - Port 3000"
else
  echo "  ❌ hss-manager NOT RUNNING"
fi

echo ""
echo "🔌 Ports:"
netstat -tulpn 2>/dev/null | grep -E ":(3000|3868)" || ss -tulpn | grep -E ":(3000|3868)"
echo ""
echo "🧪 Test:"
curl -s http://localhost:3000/health
echo ""
echo "🌐 MME Config:"
echo "   HSS: $EXTERNAL_IP:3868"
echo "   Realm: lte-pci-mapper.com"
echo ""
echo "🔑 Key: $HSS_KEY"
echo ""
echo "═══════════════════════════════════════════════════════════"

