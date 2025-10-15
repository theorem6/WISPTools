#!/bin/bash
# Simple Production HSS Installation
# Pure Node.js solution with Diameter library for MME/S6a
# No complex dependencies, just works with cloud MongoDB

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Production Cloud HSS Installation"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Components:"
echo "  - Node.js HSS with Diameter/S6a support"
echo "  - MongoDB Atlas (cloud)"
echo "  - Systemd service"
echo ""
echo "Ports:"
echo "  - 3868: S6a/Diameter (MME authentication)"
echo "  - 3000: REST API (management)"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Configuration
MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
HSS_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || openssl rand -hex 32)
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo "📋 Configuration:"
echo "  MongoDB: Cloud Atlas"
echo "  External IP: $EXTERNAL_IP"
echo "  Encryption Key: ${HSS_KEY:0:16}...${HSS_KEY: -8}"
echo ""

# Create directory
mkdir -p /opt/cloud-hss
cd /opt/cloud-hss

# Create package.json with Diameter library
cat > package.json << 'EOF'
{
  "name": "cloud-hss",
  "version": "1.0.0",
  "description": "Production Cloud HSS with S6a/Diameter support",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "mongodb": "^6.3.0",
    "diameter": "^0.4.9",
    "milenage": "^0.2.4"
  }
}
EOF

# Create production HSS server with real Diameter support
cat > server.js << 'EOF'
const express = require('express');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const diameter = require('diameter');
const milenage = require('milenage');

// Express API
const app = express();
app.use(express.json());
app.use(require('cors')({ origin: true }));

const MONGODB_URI = process.env.MONGODB_URI;
const ENCRYPTION_KEY = Buffer.from(process.env.HSS_ENCRYPTION_KEY || '', 'hex');
let db, subscribers;

console.log('═══════════════════════════════════════════════════════════');
console.log('  🚀 Cloud HSS Server Starting');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('🔌 Connecting to MongoDB Atlas...');

MongoClient.connect(MONGODB_URI).then(client => {
  db = client.db('open5gs');
  subscribers = db.collection('subscribers');
  subscribers.createIndex({ imsi: 1 }, { unique: true }).catch(() => {});
  console.log('✅ MongoDB Atlas connected');
}).catch(err => {
  console.error('❌ MongoDB error:', err.message);
  process.exit(1);
});

// Encryption helpers
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'hex', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(parts[1], 'hex', 'hex');
  decrypted += decipher.final('hex');
  return decrypted;
}

// ============================================================================
// Diameter S6a Server for MME Authentication
// ============================================================================
console.log('🌐 Starting Diameter S6a interface on port 3868...');

const diameterServer = diameter.createServer({
  port: 3868,
  host: '0.0.0.0',
  origin_host: 'hss.lte-pci-mapper.com',
  origin_realm: 'lte-pci-mapper.com',
  vendor_id: 10415,
  product_name: 'Cloud HSS'
}, async (request) => {
  const commandCode = request.header.commandCode;
  
  // Handle Authentication Information Request (AIR)
  if (commandCode === 318) {
    const imsi = request.body.find(avp => avp.code === 1)?.value || '';
    
    console.log(`📥 AIR from MME for IMSI: ${imsi}`);
    
    try {
      const sub = await subscribers.findOne({ imsi, subscriber_status: 0 });
      
      if (!sub) {
        console.log(`❌ User unknown: ${imsi}`);
        return { result_code: 5001 }; // USER_UNKNOWN
      }
      
      // Get Ki and OPc
      const ki = sub.security.k;
      const opc = sub.security.opc;
      
      // Generate authentication vector using Milenage
      const rand = crypto.randomBytes(16);
      const authVector = milenage(Buffer.from(ki, 'hex'), Buffer.from(opc, 'hex'), rand);
      
      console.log(`✅ Generated auth vector for ${imsi}`);
      
      // Update SQN
      await subscribers.updateOne({ imsi }, { $inc: { 'security.sqn': 1 } });
      
      // Return AIA with authentication vectors
      return {
        result_code: 2001, // DIAMETER_SUCCESS
        auth_session_state: 1,
        authentication_info: [{
          e_utran_vector: [{
            rand: rand.toString('hex'),
            xres: authVector.res.toString('hex'),
            autn: authVector.autn.toString('hex'),
            kasme: authVector.kasme.toString('hex')
          }]
        }]
      };
      
    } catch (err) {
      console.error('❌ AIR error:', err.message);
      return { result_code: 5012 }; // UNABLE_TO_COMPLY
    }
  }
  
  // Handle Update Location Request (ULR)
  if (commandCode === 316) {
    const imsi = request.body.find(avp => avp.code === 1)?.value || '';
    console.log(`📥 ULR from MME for IMSI: ${imsi}`);
    
    try {
      const sub = await subscribers.findOne({ imsi });
      if (!sub) {
        return { result_code: 5001 }; // USER_UNKNOWN
      }
      
      // Update location info
      await subscribers.updateOne(
        { imsi },
        { $set: { 
          last_location_update: new Date(),
          metadata: { ...sub.metadata, updated_at: new Date() }
        }}
      );
      
      console.log(`✅ Location updated for ${imsi}`);
      
      // Return subscription data
      return {
        result_code: 2001,
        auth_session_state: 1,
        subscription_data: {
          subscriber_status: sub.subscriber_status || 0,
          msisdn: sub.user_info?.msisdn || '',
          access_restriction_data: 32,
          ambr: {
            max_requested_bandwidth_ul: 100000000,
            max_requested_bandwidth_dl: 100000000
          }
        }
      };
      
    } catch (err) {
      console.error('❌ ULR error:', err.message);
      return { result_code: 5012 };
    }
  }
  
  // Unknown command
  console.log(`⚠️  Unknown Diameter command: ${commandCode}`);
  return { result_code: 3001 }; // COMMAND_UNSUPPORTED
});

diameterServer.on('listening', () => {
  console.log('✅ Diameter S6a interface listening on port 3868');
});

diameterServer.on('error', (err) => {
  console.error('❌ Diameter error:', err.message);
});

// ============================================================================
// REST API for Management
// ============================================================================
console.log('🌐 Starting REST API on port 3000...');

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Cloud HSS', 
    timestamp: new Date().toISOString(),
    services: {
      diameter_s6a: 'port 3868',
      rest_api: 'port 3000'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', service: 'HSS Management API' });
});

app.post('/api/subscribers', async (req, res) => {
  try {
    const { imsi, ki, opc, user_info } = req.body;
    
    if (!/^\d{15}$/.test(imsi)) {
      return res.status(400).json({ error: 'Invalid IMSI (15 digits required)' });
    }
    
    const sub = {
      imsi,
      security: { 
        k: ki,  // Store in Open5GS format
        opc: opc,
        amf: "8000",
        sqn: 0
      },
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
          qos: { index: 9 },
          ambr: { uplink: { value: 1, unit: 3 }, downlink: { value: 1, unit: 3 } }
        }]
      }],
      user_info: user_info || {},
      tenantId: req.headers['x-tenant-id'] || 'default',
      metadata: { created_at: new Date(), updated_at: new Date() }
    };
    
    await subscribers.insertOne(sub);
    console.log(`✅ Created subscriber: ${imsi}`);
    res.json({ success: true, message: 'Subscriber created', imsi });
  } catch (err) {
    console.error('❌ Create subscriber error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/subscribers', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    const subs = await subscribers.find({ tenantId }).limit(100).toArray();
    res.json({ 
      count: subs.length,
      subscribers: subs.map(s => ({ ...s, security: { k: '***', opc: '***' } }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/subscribers/:imsi', async (req, res) => {
  try {
    const sub = await subscribers.findOne({ imsi: req.params.imsi });
    if (!sub) return res.status(404).json({ error: 'Not found' });
    res.json({ subscriber: { ...sub, security: { k: '***', opc: '***' } } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subscribers/:imsi/enable', async (req, res) => {
  try {
    await subscribers.updateOne({ imsi: req.params.imsi }, { $set: { subscriber_status: 0 } });
    res.json({ success: true, message: 'Subscriber enabled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subscribers/:imsi/disable', async (req, res) => {
  try {
    await subscribers.updateOne({ imsi: req.params.imsi }, { $set: { subscriber_status: 1 } });
    res.json({ success: true, message: 'Subscriber disabled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    const total_active = await subscribers.countDocuments({ tenantId, subscriber_status: 0 });
    const total_inactive = await subscribers.countDocuments({ tenantId, subscriber_status: 1 });
    res.json({ subscribers: { total_active, total_inactive } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, '0.0.0.0', () => {
  console.log('✅ REST API listening on port 3000');
});

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  ✅ Cloud HSS Server Ready');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('📡 Services:');
console.log('   Diameter S6a: 0.0.0.0:3868');
console.log('   REST API: 0.0.0.0:3000');
console.log('');
console.log('🌐 MME Configuration:');
console.log('   HSS Address: ' + (process.env.EXTERNAL_IP || 'YOUR_IP'));
console.log('   HSS Port: 3868');
console.log('   HSS Realm: lte-pci-mapper.com');
console.log('');
EOF

# Install dependencies
echo "📦 Installing Node.js dependencies (including Diameter library)..."
npm install

echo "✅ Dependencies installed"
echo ""

# Create systemd service
echo "⚙️  Creating systemd service..."
tee /etc/systemd/system/cloud-hss.service > /dev/null << EOF
[Unit]
Description=Cloud HSS Server (S6a + Management)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/cloud-hss
Environment="NODE_ENV=production"
Environment="HSS_ENCRYPTION_KEY=$HSS_KEY"
Environment="MONGODB_URI=$MONGODB_URI"
Environment="EXTERNAL_IP=$EXTERNAL_IP"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cloud-hss

[Install]
WantedBy=multi-user.target
EOF

# Start service
echo "🚀 Starting Cloud HSS service..."
systemctl daemon-reload
systemctl enable cloud-hss
systemctl start cloud-hss

echo "⏳ Waiting for service to start (5 seconds)..."
sleep 5

# Verification
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  📊 VERIFICATION"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check service
if systemctl is-active --quiet cloud-hss 2>/dev/null; then
  echo "✅ cloud-hss service: RUNNING"
  systemctl status cloud-hss --no-pager | grep "Active:"
else
  echo "❌ cloud-hss service: NOT RUNNING"
  echo "Logs:"
  journalctl -u cloud-hss -n 20 --no-pager
  exit 1
fi
echo ""

# Check ports
echo "🔌 Port Status:"
if netstat -tulpn 2>/dev/null | grep -q ":3868"; then
  echo "  ✅ Port 3868 (S6a) - LISTENING"
else
  echo "  ⚠️  Port 3868 not listening yet"
fi

if netstat -tulpn 2>/dev/null | grep -q ":3000"; then
  echo "  ✅ Port 3000 (API) - LISTENING"
else
  echo "  ⚠️  Port 3000 not listening yet"
fi
echo ""

# Test API
echo "🧪 API Test:"
API_RESPONSE=$(curl -s http://localhost:3000/health 2>&1)
if echo "$API_RESPONSE" | grep -q "healthy"; then
  echo "  ✅ $API_RESPONSE"
else
  echo "  ⚠️  API not responding: $API_RESPONSE"
fi
echo ""

# ============================================================================
# Final Summary
# ============================================================================
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ CLOUD HSS INSTALLATION COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🌐 Your Cloud HSS:"
echo "   External IP: $EXTERNAL_IP"
echo ""
echo "📡 Services:"
echo "   S6a/Diameter: $EXTERNAL_IP:3868 (for MME connections)"
echo "   REST API:     http://$EXTERNAL_IP:3000/api/"
echo "   Health Check: http://$EXTERNAL_IP:3000/health"
echo ""
echo "🔧 Service Management:"
echo "   Status:  systemctl status cloud-hss"
echo "   Restart: systemctl restart cloud-hss"
echo "   Logs:    journalctl -u cloud-hss -f"
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

