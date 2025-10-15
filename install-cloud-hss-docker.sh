#!/bin/bash
# Cloud HSS Installation using Docker (No MongoDB dependency issues)
# Uses: Open5GS HSS in Docker + Management API
# MongoDB: Cloud Atlas only (no local MongoDB)

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Cloud HSS Installation (Docker-based)"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "✅ Uses Docker (no MongoDB dependency issues)"
echo "✅ Connects to cloud MongoDB Atlas only"
echo "✅ No local databases installed"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Configuration
MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
HSS_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || openssl rand -hex 32)
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}' || echo "0.0.0.0")

echo "📋 Configuration:"
echo "  MongoDB: Cloud Atlas (cluster0.1radgkw.mongodb.net)"
echo "  External IP: $EXTERNAL_IP"
echo "  Encryption Key: ${HSS_KEY:0:16}...${HSS_KEY: -8}"
echo ""
echo "🔑 Full Encryption Key: $HSS_KEY"
echo "   ⚠️  SAVE THIS KEY SECURELY!"
echo ""

# Install Docker if needed
if ! command -v docker &> /dev/null; then
  echo "📦 Installing Docker..."
  apt-get update -qq
  apt-get install -y docker.io docker-compose
  systemctl enable docker
  systemctl start docker
  echo "✅ Docker installed"
else
  echo "✅ Docker already installed"
fi
echo ""

# ============================================================================
# PART 1: Deploy Open5GS HSS via Docker
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PART 1: Deploying Open5GS HSS (Docker)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create HSS directory
mkdir -p /opt/open5gs-hss
cd /opt/open5gs-hss

# Create HSS config for MongoDB Atlas
cat > hss.yaml << EOF
db_uri: $MONGODB_URI

logger:
  file: /var/log/open5gs/hss.log
  level: info

hss:
  freeDiameter: /etc/freeDiameter/hss.conf
EOF

# Create Diameter config
cat > hss-diameter.conf << EOF
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

# Create docker-compose for Open5GS HSS
cat > docker-compose.yml << EOF
version: '3.8'

services:
  open5gs-hss:
    image: open5gs/open5gs:latest
    container_name: open5gs-hss
    command: open5gs-hssd -c /etc/open5gs/hss.yaml
    network_mode: host
    volumes:
      - ./hss.yaml:/etc/open5gs/hss.yaml
      - ./hss-diameter.conf:/etc/freeDiameter/hss.conf
      - /var/log/open5gs:/var/log/open5gs
    environment:
      - DB_URI=$MONGODB_URI
    restart: always
EOF

# Start Open5GS HSS
echo "🚀 Starting Open5GS HSS container..."
docker-compose up -d

sleep 5

if docker ps | grep -q open5gs-hss; then
  echo "✅ Open5GS HSS container running"
  docker ps | grep open5gs-hss
else
  echo "⚠️  HSS container may not be running"
  docker logs open5gs-hss 2>&1 | tail -20
fi
echo ""

# ============================================================================
# PART 2: Install Management API (Node.js)
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PART 2: Installing HSS Management API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

mkdir -p /opt/hss-manager
cd /opt/hss-manager

# Create package.json
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

# Create server (connects to same MongoDB Atlas)
cat > server.js << 'EOF'
const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
app.use(express.json());
app.use(require('cors')({ origin: true }));

const MONGODB_URI = process.env.MONGODB_URI;
let db, subscribers;

console.log('🔌 Connecting to MongoDB Atlas...');
MongoClient.connect(MONGODB_URI).then(client => {
  db = client.db('open5gs');
  subscribers = db.collection('subscribers');
  subscribers.createIndex({ imsi: 1 }, { unique: true }).catch(() => {});
  console.log('✅ Connected to cloud MongoDB');
}).catch(err => console.error('MongoDB error:', err));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'HSS Manager', open5gs_hss: 'docker container port 3868' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', service: 'HSS API' });
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
      access_restriction_data: 32,
      slice: [{
        sst: 1,
        default_indicator: true,
        session: [{
          name: "internet",
          type: 3,
          qos: { index: 9, arp: { priority_level: 8 } },
          ambr: { uplink: { value: 1, unit: 3 }, downlink: { value: 1, unit: 3 } }
        }]
      }],
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

app.listen(3000, '0.0.0.0', () => console.log('✅ HSS Manager API on port 3000'));
EOF

# Install
echo "📦 Installing dependencies..."
npm install --silent 2>/dev/null || npm install

# Create systemd service
tee /etc/systemd/system/hss-manager.service > /dev/null << EOF
[Unit]
Description=HSS Manager API
After=docker.service

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

# Check Docker HSS
if docker ps | grep -q open5gs-hss; then
  echo "  ✅ open5gs-hss (Docker) - Port 3868 for MME"
else
  echo "  ⚠️  open5gs-hss not running"
fi

# Check Manager
if systemctl is-active --quiet hss-manager 2>/dev/null || pgrep -f "node.*server.js" >/dev/null; then
  echo "  ✅ hss-manager (Node.js) - Port 3000 for API"
else
  echo "  ⚠️  hss-manager not running"
fi

echo ""
echo "🔌 Ports:"
netstat -tulpn 2>/dev/null | grep -E ":(3000|3868)" || ss -tulpn | grep -E ":(3000|3868)" || echo "  Check: docker ps and netstat -tulpn"
echo ""
echo "🧪 Test:"
curl -s http://localhost:3000/health 2>&1 || echo "  API starting..."
echo ""
echo "🌐 MME Connect To: $EXTERNAL_IP:3868"
echo "🔑 Encryption Key: $HSS_KEY"
echo ""
echo "═══════════════════════════════════════════════════════════"

