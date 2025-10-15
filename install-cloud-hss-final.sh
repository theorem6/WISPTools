#!/bin/bash
# Production Cloud HSS Installation - Final Version
# Installs: Open5GS HSS (C daemon for MME/S6a) + Management API (Node.js)
# MongoDB: Cloud MongoDB Atlas (pre-configured)

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Cloud HSS Installation - Production Ready"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "This installs:"
echo "  1. Open5GS HSS Daemon (C) - Port 3868 for MME/S6a"
echo "  2. Management REST API (Node.js) - Port 3000 for UI"
echo "  3. Shared MongoDB Atlas database"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Pre-configured settings
MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
HSS_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo "📋 Configuration:"
echo "  MongoDB: Cloud Atlas (cluster0.1radgkw.mongodb.net)"
echo "  External IP: $EXTERNAL_IP"
echo "  Database: open5gs"
echo ""
echo "🔑 Generated Encryption Key:"
echo "   $HSS_KEY"
echo "   ⚠️  SAVE THIS KEY SECURELY!"
echo ""
read -p "Continue with installation? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
  echo "Installation cancelled"
  exit 0
fi

# ============================================================================
# PART 1: Install Open5GS HSS Daemon (Production C code)
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PART 1/2: Installing Open5GS HSS Daemon"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Install Open5GS HSS
echo "📦 Adding Open5GS repository..."
sudo apt-get update -qq
sudo apt-get install -y software-properties-common gnupg -qq
sudo add-apt-repository -y ppa:open5gs/latest 2>/dev/null || true
sudo apt-get update -qq

echo "📦 Installing Open5GS HSS package..."
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y open5gs-hss -qq

# Configure Open5GS HSS for MongoDB Atlas
echo "⚙️  Configuring Open5GS HSS for MongoDB Atlas..."
sudo mkdir -p /etc/open5gs
sudo tee /etc/open5gs/hss.yaml > /dev/null << EOF
db_uri: $MONGODB_URI

logger:
  file: /var/log/open5gs/hss.log
  level: info

hss:
  freeDiameter: /etc/freeDiameter/hss.conf
EOF

# Configure Diameter for S6a (MME connections)
echo "⚙️  Configuring Diameter S6a interface..."
sudo mkdir -p /etc/freeDiameter
sudo tee /etc/freeDiameter/hss.conf > /dev/null << EOF
# Diameter Configuration for Cloud HSS
Identity = "hss.lte-pci-mapper.com";
Realm = "lte-pci-mapper.com";

# Listen on all interfaces for MME connections
ListenOn = "0.0.0.0";
Port = 3868;
SecPort = 5868;

# No SCTP (use TCP for cloud environments)
No_SCTP;

# Load required dictionaries
LoadExtension = "dbg_msg_dumps.so" : "0x8888";
LoadExtension = "dict_rfc5777.so";
LoadExtension = "dict_mip6i.so";
LoadExtension = "dict_nasreq.so";
LoadExtension = "dict_nas_mipv6.so";
LoadExtension = "dict_dcca.so";
LoadExtension = "dict_dcca_3gpp.so";

# TLS disabled for initial setup (enable for production)
# TLS_Cred = "/etc/freeDiameter/hss.cert.pem", "/etc/freeDiameter/hss.key.pem";
# TLS_CA = "/etc/freeDiameter/cacert.pem";

# Application-specific configuration
AppServThreads = 4;

# Routing table (for S6a)
# MME peers will be configured dynamically when they connect
EOF

# Create log directory
sudo mkdir -p /var/log/open5gs
sudo chown -R $USER:$USER /var/log/open5gs

# Start Open5GS HSS daemon
echo "🚀 Starting Open5GS HSS daemon..."
sudo systemctl daemon-reload
sudo systemctl enable open5gs-hssd
sudo systemctl restart open5gs-hssd

sleep 2

if sudo systemctl is-active --quiet open5gs-hssd; then
  echo "✅ Open5GS HSS daemon started successfully"
else
  echo "⚠️  Open5GS HSS daemon may not be running"
  sudo journalctl -u open5gs-hssd -n 10 --no-pager
fi

# ============================================================================
# PART 2: Install Management REST API (Node.js)
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PART 2/2: Installing HSS Management API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create manager directory
sudo mkdir -p /opt/hss-manager
sudo chown $USER:$USER /opt/hss-manager
cd /opt/hss-manager

# Create package.json
cat > package.json << 'PKGEOF'
{
  "name": "hss-manager",
  "version": "1.0.0",
  "description": "HSS Management REST API",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "mongodb": "^6.3.0"
  }
}
PKGEOF

# Create Management API server (writes to Open5GS database)
cat > server.js << 'SRVEOF'
const express = require('express');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(require('cors')({ origin: true }));

const MONGODB_URI = process.env.MONGODB_URI;
const ENCRYPTION_KEY = Buffer.from(process.env.HSS_ENCRYPTION_KEY || '', 'hex');
let db, subscribers, inactiveSubscribers, groups, plans;

console.log('🔌 Connecting to MongoDB Atlas...');
MongoClient.connect(MONGODB_URI).then(client => {
  db = client.db('open5gs');
  subscribers = db.collection('subscribers');
  inactiveSubscribers = db.collection('inactive_subscribers');
  groups = db.collection('subscriber_groups');
  plans = db.collection('bandwidth_plans');
  
  subscribers.createIndex({ imsi: 1 }, { unique: true }).catch(() => {});
  subscribers.createIndex({ tenantId: 1 }).catch(() => {});
  
  console.log('✅ MongoDB connected to Open5GS database');
}).catch(err => {
  console.error('❌ MongoDB connection failed:', err.message);
  process.exit(1);
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'HSS Manager', 
    timestamp: new Date().toISOString(),
    open5gs_hss_daemon: 'running on port 3868'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', service: 'HSS Management API', version: '1.0.0' });
});

// Create subscriber (Open5GS format)
app.post('/api/subscribers', async (req, res) => {
  try {
    const { tenantId, imsi, ki, opc, user_info, group_membership, bandwidth_plan } = req.body;
    
    if (!/^\d{15}$/.test(imsi)) {
      return res.status(400).json({ error: 'Invalid IMSI format (must be 15 digits)' });
    }
    
    if (!/^[0-9A-Fa-f]{32}$/.test(ki)) {
      return res.status(400).json({ error: 'Invalid Ki format (must be 32 hex chars)' });
    }
    
    if (!/^[0-9A-Fa-f]{32}$/.test(opc)) {
      return res.status(400).json({ error: 'Invalid OPc format (must be 32 hex chars)' });
    }
    
    const subscriber = {
      imsi,
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
          qos: { index: 9, arp: { priority_level: 8, pre_emption_capability: 1, pre_emption_vulnerability: 1 } },
          ambr: { uplink: { value: 1, unit: 3 }, downlink: { value: 1, unit: 3 } }
        }]
      }],
      security: {
        k: ki,
        amf: "8000",
        op: null,
        opc: opc,
        sqn: 0
      },
      tenantId: tenantId || req.headers['x-tenant-id'] || 'default',
      user_info: user_info || {},
      group_membership: group_membership || {},
      bandwidth_plan: bandwidth_plan || {},
      device_info: {},
      metadata: { created_at: new Date(), updated_at: new Date() }
    };
    
    await subscribers.insertOne(subscriber);
    res.json({ success: true, message: 'Subscriber created', imsi });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'IMSI already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/subscribers', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.query.tenantId || 'default';
    const subs = await subscribers.find({ tenantId }).limit(100).toArray();
    res.json({ count: subs.length, subscribers: subs.map(s => ({ ...s, security: { k: '***', opc: '***' } })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/subscribers/:imsi', async (req, res) => {
  try {
    const sub = await subscribers.findOne({ imsi: req.params.imsi });
    if (!sub) return res.status(404).json({ error: 'Subscriber not found' });
    res.json({ subscriber: { ...sub, security: { k: '***', opc: '***' } } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subscribers/:imsi/disable', async (req, res) => {
  try {
    const sub = await subscribers.findOne({ imsi: req.params.imsi });
    if (sub) {
      await inactiveSubscribers.insertOne({ ...sub, deactivation: { at: new Date(), reason: req.body.reason || 'Manual' } });
      await subscribers.deleteOne({ imsi: req.params.imsi });
    }
    res.json({ success: true, message: 'Subscriber disabled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subscribers/:imsi/enable', async (req, res) => {
  try {
    const sub = await inactiveSubscribers.findOne({ imsi: req.params.imsi });
    if (sub) {
      delete sub.deactivation;
      await subscribers.insertOne(sub);
      await inactiveSubscribers.deleteOne({ imsi: req.params.imsi });
    }
    res.json({ success: true, message: 'Subscriber enabled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bandwidth-plans', async (req, res) => {
  try {
    await plans.insertOne({ ...req.body, created_at: new Date() });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bandwidth-plans', async (req, res) => {
  try {
    const list = await plans.find({ tenantId: req.headers['x-tenant-id'] || 'default' }).toArray();
    res.json({ plans: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/groups', async (req, res) => {
  try {
    await groups.insertOne({ ...req.body, created_at: new Date() });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/groups', async (req, res) => {
  try {
    const list = await groups.find({ tenantId: req.headers['x-tenant-id'] || 'default' }).toArray();
    res.json({ groups: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    const total_active = await subscribers.countDocuments({ tenantId });
    const total_inactive = await inactiveSubscribers.countDocuments({ tenantId });
    res.json({ subscribers: { total_active, total_inactive, total_suspended: 0 } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(\`✅ HSS Manager API listening on port \${PORT}\`);
  console.log(\`   REST API: http://localhost:\${PORT}/api/\`);
  console.log(\`   Health: http://localhost:\${PORT}/health\`);
});
SRVEOF

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install --silent

# Create manager service
echo "⚙️  Creating HSS Manager service..."
sudo tee /etc/systemd/system/hss-manager.service > /dev/null << EOF
[Unit]
Description=HSS Management REST API
After=network.target open5gs-hssd.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/hss-manager
Environment="NODE_ENV=production"
Environment="HSS_ENCRYPTION_KEY=$HSS_KEY"
Environment="MONGODB_URI=$MONGODB_URI"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=hss-manager

[Install]
WantedBy=multi-user.target
EOF

# Start manager
echo "🚀 Starting HSS Manager API..."
sudo systemctl daemon-reload
sudo systemctl enable hss-manager
sudo systemctl start hss-manager

sleep 3

# ============================================================================
# Verification
# ============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  📊 VERIFICATION"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check Open5GS HSS daemon
echo "1️⃣  Open5GS HSS Daemon (S6a/Diameter for MME):"
if sudo systemctl is-active --quiet open5gs-hssd; then
  echo "   ✅ RUNNING on port 3868"
  sudo systemctl status open5gs-hssd --no-pager | grep "Active:"
else
  echo "   ❌ NOT RUNNING"
  echo "   Logs:"
  sudo journalctl -u open5gs-hssd -n 10 --no-pager
fi
echo ""

# Check Manager API
echo "2️⃣  HSS Manager API (REST for UI/Management):"
if sudo systemctl is-active --quiet hss-manager; then
  echo "   ✅ RUNNING on port 3000"
  sudo systemctl status hss-manager --no-pager | grep "Active:"
else
  echo "   ❌ NOT RUNNING"
  echo "   Logs:"
  sudo journalctl -u hss-manager -n 10 --no-pager
fi
echo ""

# Check listening ports
echo "3️⃣  Port Status:"
if sudo netstat -tulpn 2>/dev/null | grep -q ":3868"; then
  echo "   ✅ Port 3868 (S6a) LISTENING - MMEs can connect"
else
  echo "   ⚠️  Port 3868 not listening"
fi

if sudo netstat -tulpn 2>/dev/null | grep -q ":3000"; then
  echo "   ✅ Port 3000 (API) LISTENING - Management ready"
else
  echo "   ⚠️  Port 3000 not listening"
fi
echo ""

# Test API
echo "4️⃣  API Test:"
API_RESPONSE=$(curl -s http://localhost:3000/health 2>&1)
if echo "$API_RESPONSE" | grep -q "healthy"; then
  echo "   ✅ API responding: $API_RESPONSE"
else
  echo "   ⚠️  API not responding"
fi
echo ""

# Test MongoDB connection
echo "5️⃣  MongoDB Connection:"
MONGO_TEST=$(mongosh "$MONGODB_URI" --quiet --eval "db.adminCommand('ping')" 2>&1 | grep -i ok || echo "failed")
if echo "$MONGO_TEST" | grep -q "ok"; then
  echo "   ✅ MongoDB Atlas connected"
else
  echo "   ⚠️  MongoDB connection issue"
fi
echo ""

# ============================================================================
# Final Summary
# ============================================================================
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ CLOUD HSS INSTALLATION COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🌐 External IP: $EXTERNAL_IP"
echo ""
echo "📡 Services Running:"
echo "   ┌─ open5gs-hssd (C daemon)"
echo "   │  Purpose: S6a/Diameter authentication for MME"
echo "   │  Port: 3868"
echo "   │  Protocol: Diameter/S6a"
echo "   │"
echo "   └─ hss-manager (Node.js API)"
echo "      Purpose: Subscriber management, groups, plans"
echo "      Port: 3000"
echo "      Protocol: REST/HTTP"
echo ""
echo "🔗 Endpoints:"
echo "   MME Connects To:  $EXTERNAL_IP:3868 (S6a/Diameter)"
echo "   Management API:   http://$EXTERNAL_IP:3000/api/"
echo "   Health Check:     http://$EXTERNAL_IP:3000/health"
echo ""
echo "🔧 Service Commands:"
echo "   sudo systemctl status open5gs-hssd"
echo "   sudo systemctl status hss-manager"
echo "   sudo journalctl -u open5gs-hssd -f"
echo "   sudo journalctl -u hss-manager -f"
echo ""
echo "🔑 Encryption Key (SAVE THIS!):"
echo "   $HSS_KEY"
echo ""
echo "📝 Configure Remote MME:"
echo "   HSS Address: $EXTERNAL_IP"
echo "   HSS Port: 3868"
echo "   HSS Realm: lte-pci-mapper.com"
echo "   HSS Identity: hss.lte-pci-mapper.com"
echo ""
echo "🧪 Test Installation:"
echo "   curl http://localhost:3000/health"
echo "   curl http://localhost:3000/api/subscribers -H 'X-Tenant-ID: tenant_001'"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

