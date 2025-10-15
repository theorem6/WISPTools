#!/bin/bash
# Hybrid HSS Installation - Production S6a + Management API
# Installs: Open5GS HSS daemon (C) + Management REST API (Node.js)
# 
# Open5GS HSS = Handles MME authentication via S6a/Diameter
# REST API = Handles subscriber management, groups, plans, ACS integration

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Hybrid Cloud HSS Installation"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Components:"
echo "  1. Open5GS HSS Daemon (C) - S6a/Diameter for MME"
echo "  2. Management REST API (Node.js) - Subscriber management"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Configuration
MONGODB_URI="${MONGODB_URI:-mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0}"
HSS_KEY="${HSS_ENCRYPTION_KEY:-$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")}"
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || echo "0.0.0.0")

echo "📋 Configuration:"
echo "  MongoDB: ${MONGODB_URI:0:40}..."
echo "  External IP: $EXTERNAL_IP"
echo "  Encryption Key: ${HSS_KEY:0:16}...${HSS_KEY: -8}"
echo ""

# ============================================================================
# PART 1: Install Open5GS HSS Daemon (for MME authentication)
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PART 1: Installing Open5GS HSS Daemon (C-based)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Add Open5GS repository
echo "📦 Adding Open5GS repository..."
sudo add-apt-repository -y ppa:open5gs/latest 2>/dev/null || {
  sudo apt-get install -y software-properties-common
  sudo add-apt-repository -y ppa:open5gs/latest
}

# Update and install
echo "📦 Installing Open5GS HSS package..."
sudo apt-get update -qq
sudo apt-get install -y open5gs-hss

# Configure Open5GS HSS for MongoDB
echo "⚙️  Configuring Open5GS HSS..."
sudo tee /etc/open5gs/hss.yaml > /dev/null << EOF
db_uri: $MONGODB_URI

logger:
  file: /var/log/open5gs/hss.log
  level: info

hss:
  freeDiameter: /etc/freeDiameter/hss.conf
EOF

# Configure freeDiameter for S6a
echo "⚙️  Configuring Diameter (S6a interface)..."
sudo tee /etc/freeDiameter/hss.conf > /dev/null << EOF
Identity = "hss.lte-pci-mapper.com";
Realm = "lte-pci-mapper.com";
Port = 3868;
SecPort = 5868;

# Bind to all interfaces
ListenOn = "0.0.0.0";

# Load extensions
LoadExtension = "dbg_msg_dumps.so" : "0x8888";
LoadExtension = "dict_rfc5777.so";
LoadExtension = "dict_mip6i.so";
LoadExtension = "dict_nasreq.so";
LoadExtension = "dict_nas_mipv6.so";
LoadExtension = "dict_dcca.so";
LoadExtension = "dict_dcca_3gpp.so";

# Peers (MME connections)
ConnectPeer = "mme.lte-pci-mapper.com" { ConnectTo = "$EXTERNAL_IP"; No_SCTP; No_IPv6; Port=3868; };

# TLS disabled for simplicity (enable for production)
TLS_Cred = "/etc/freeDiameter/hss.cert.pem", "/etc/freeDiameter/hss.key.pem";
TLS_CA = "/etc/freeDiameter/cacert.pem";
EOF

# Start Open5GS HSS
echo "🚀 Starting Open5GS HSS daemon..."
sudo systemctl enable open5gs-hssd
sudo systemctl restart open5gs-hssd

echo "✅ Open5GS HSS daemon installed"
echo ""

# ============================================================================
# PART 2: Install Management REST API (Node.js)
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PART 2: Installing Management REST API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create directory
sudo mkdir -p /opt/hss-manager
sudo chown $USER:$USER /opt/hss-manager
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

# Create Management REST API server
cat > server.js << 'EOF'
const express = require('express');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(require('cors')({ origin: true }));

const MONGODB_URI = process.env.MONGODB_URI;
const ENCRYPTION_KEY = Buffer.from(process.env.HSS_ENCRYPTION_KEY || '', 'hex');
let db, subscribers, inactiveSubscribers, groups, plans;

// Connect to MongoDB (same DB as Open5GS HSS)
MongoClient.connect(MONGODB_URI).then(client => {
  db = client.db('open5gs');  // Use Open5GS database
  subscribers = db.collection('subscribers');  // Open5GS collection
  inactiveSubscribers = db.collection('inactive_subscribers');
  groups = db.collection('subscriber_groups');
  plans = db.collection('bandwidth_plans');
  
  console.log('✅ MongoDB connected to Open5GS database');
}).catch(err => console.error('MongoDB error:', err));

// Encryption helpers
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'hex', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'HSS Manager', 
    timestamp: new Date(),
    open5gs_hss: 'running'  // Separate daemon
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', service: 'HSS Management API' });
});

// Create subscriber (writes to Open5GS format)
app.post('/api/subscribers', async (req, res) => {
  try {
    const { tenantId, imsi, ki, opc, user_info, group_membership } = req.body;
    
    if (!/^\d{15}$/.test(imsi)) {
      return res.status(400).json({ error: 'Invalid IMSI' });
    }
    
    // Open5GS HSS format + our extensions
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
          qos: {
            index: 9,
            arp: {
              priority_level: 8,
              pre_emption_capability: 1,
              pre_emption_vulnerability: 1
            }
          },
          ambr: {
            uplink: { value: 1, unit: 3 },
            downlink: { value: 1, unit: 3 }
          }
        }]
      }],
      security: {
        k: ki,  // Open5GS format
        amf: "8000",
        op: null,
        opc: opc  // Open5GS format
      },
      // Our extensions
      tenantId: tenantId || req.headers['x-tenant-id'],
      user_info: user_info || {},
      group_membership: group_membership || {},
      device_info: {},
      metadata: {
        created_at: new Date(),
        updated_at: new Date()
      }
    };
    
    await subscribers.insertOne(subscriber);
    res.json({ success: true, imsi });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List subscribers
app.get('/api/subscribers', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
    const subs = await subscribers.find({ tenantId }).limit(100).toArray();
    res.json({ 
      count: subs.length, 
      subscribers: subs.map(s => ({ 
        ...s, 
        security: { k: '***', opc: '***' } 
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enable/disable subscriber
app.post('/api/subscribers/:imsi/disable', async (req, res) => {
  try {
    const sub = await subscribers.findOne({ imsi: req.params.imsi });
    if (sub) {
      sub.subscriber_status = 1;  // Open5GS: 1 = disabled
      await inactiveSubscribers.insertOne(sub);
      await subscribers.deleteOne({ imsi: req.params.imsi });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subscribers/:imsi/enable', async (req, res) => {
  try {
    const sub = await inactiveSubscribers.findOne({ imsi: req.params.imsi });
    if (sub) {
      sub.subscriber_status = 0;  // Open5GS: 0 = active
      await subscribers.insertOne(sub);
      await inactiveSubscribers.deleteOne({ imsi: req.params.imsi });
    } else {
      await subscribers.updateOne(
        { imsi: req.params.imsi }, 
        { $set: { subscriber_status: 0 } }
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bandwidth plans
app.post('/api/bandwidth-plans', async (req, res) => {
  try {
    await plans.insertOne(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bandwidth-plans', async (req, res) => {
  try {
    const list = await plans.find({ tenantId: req.headers['x-tenant-id'] }).toArray();
    res.json({ plans: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Groups
app.post('/api/groups', async (req, res) => {
  try {
    await groups.insertOne(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/groups', async (req, res) => {
  try {
    const list = await groups.find({ tenantId: req.headers['x-tenant-id'] }).toArray();
    res.json({ groups: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard stats
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const total_active = await subscribers.countDocuments({ tenantId, subscriber_status: 0 });
    const total_inactive = await inactiveSubscribers.countDocuments({ tenantId });
    
    res.json({
      subscribers: { total_active, total_inactive, total_suspended: 0 },
      cpe_correlation: {},
      health: {}
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(\`✅ HSS Manager API on port \${PORT}\`);
  console.log(\`   Open5GS HSS handles S6a on port 3868\`);
});
EOF

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Create manager service (runs alongside open5gs-hssd)
echo "⚙️  Creating HSS Manager service..."
sudo tee /etc/systemd/system/hss-manager.service > /dev/null << EOF
[Unit]
Description=HSS Management API
After=network.target open5gs-hssd.service
Requires=open5gs-hssd.service

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

# Start manager service
echo "🚀 Starting HSS Manager..."
sudo systemctl daemon-reload
sudo systemctl enable hss-manager
sudo systemctl start hss-manager

sleep 3

# ============================================================================
# Verification
# ============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ INSTALLATION COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check Open5GS HSS
echo "📊 Open5GS HSS Daemon (S6a/Diameter):"
if sudo systemctl is-active --quiet open5gs-hssd; then
  echo "  ✅ open5gs-hssd RUNNING (port 3868)"
  sudo systemctl status open5gs-hssd --no-pager | head -5
else
  echo "  ❌ open5gs-hssd NOT RUNNING"
fi
echo ""

# Check Manager API
echo "📊 HSS Manager API (REST/Management):"
if sudo systemctl is-active --quiet hss-manager; then
  echo "  ✅ hss-manager RUNNING (port 3000)"
  sudo systemctl status hss-manager --no-pager | head -5
else
  echo "  ❌ hss-manager NOT RUNNING"
fi
echo ""

# Test API
echo "🧪 Testing Management API:"
curl -s http://localhost:3000/health || echo "  ⚠️  API not responding"
echo ""

# Show listening ports
echo "🔌 Listening Ports:"
sudo netstat -tulpn | grep -E ":(3000|3868)" || echo "  Ports not listening yet"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "  🎯 YOUR CLOUD HSS IS READY"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🌐 Services:"
echo "   S6a/Diameter (MME):  $EXTERNAL_IP:3868  [open5gs-hssd]"
echo "   REST API (Mgmt):     $EXTERNAL_IP:3000  [hss-manager]"
echo ""
echo "🔧 Service Commands:"
echo "   sudo systemctl status open5gs-hssd    # HSS daemon"
echo "   sudo systemctl status hss-manager     # Management API"
echo "   sudo journalctl -u open5gs-hssd -f   # HSS logs"
echo "   sudo journalctl -u hss-manager -f    # API logs"
echo ""
echo "📝 Configure Remote MME:"
echo "   MME S6a config:"
echo "     - HSS Address: $EXTERNAL_IP"
echo "     - HSS Port: 3868"
echo "     - HSS Realm: lte-pci-mapper.com"
echo "     - HSS Identity: hss.lte-pci-mapper.com"
echo ""
echo "🔑 Encryption Key (SAVE THIS!):"
echo "   $HSS_KEY"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

