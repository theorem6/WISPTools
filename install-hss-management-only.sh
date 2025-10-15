#!/bin/bash
# HSS Management API Installation (No complex dependencies)
# Provides: Subscriber management, groups, plans, REST API
# Note: For production MME/S6a, you'll need Open5GS HSS separately

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 HSS Management API Installation"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "✅ No MongoDB installation (uses cloud Atlas)"
echo "✅ No complex dependencies"  
echo "✅ Just works!"
echo ""
echo "⚠️  Note: This provides management API only"
echo "   For production S6a/MME: Install Open5GS HSS separately"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Configuration
MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
HSS_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || openssl rand -hex 32)
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo "📋 Configuration:"
echo "  MongoDB: Cloud Atlas ✅"
echo "  External IP: $EXTERNAL_IP"
echo "  API Port: 3000"
echo ""
echo "🔑 Encryption Key: $HSS_KEY"
echo "   ⚠️  SAVE THIS!"
echo ""

# Create directory
mkdir -p /opt/hss-api
cd /opt/hss-api

# Package.json
cat > package.json << 'EOF'
{
  "name": "hss-api",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "mongodb": "^6.3.0"
  }
}
EOF

# Complete HSS Management Server
cat > server.js << 'EOF'
const express = require('express');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(require('cors')({ origin: true }));

const MONGODB_URI = process.env.MONGODB_URI;
const ENCRYPTION_KEY = Buffer.from(process.env.HSS_ENCRYPTION_KEY || '', 'hex');
let db, subscribers, inactiveSubscribers, groups, plans;

console.log('═══════════════════════════════════════════════════════════');
console.log('  🚀 HSS Management API Starting');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('🔌 Connecting to MongoDB Atlas...');

MongoClient.connect(MONGODB_URI).then(async client => {
  db = client.db('open5gs');
  subscribers = db.collection('subscribers');
  inactiveSubscribers = db.collection('inactive_subscribers');
  groups = db.collection('subscriber_groups');
  plans = db.collection('bandwidth_plans');
  
  await subscribers.createIndex({ imsi: 1 }, { unique: true }).catch(() => {});
  await subscribers.createIndex({ tenantId: 1 }).catch(() => {});
  
  console.log('✅ MongoDB Atlas connected');
}).catch(err => {
  console.error('❌ MongoDB error:', err.message);
  process.exit(1);
});

// Encryption
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'hex', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'HSS Management API', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', version: '1.0.0' });
});

// Create subscriber
app.post('/api/subscribers', async (req, res) => {
  try {
    const { imsi, ki, opc, user_info, group_membership } = req.body;
    
    if (!/^\d{15}$/.test(imsi)) return res.status(400).json({ error: 'Invalid IMSI' });
    if (!/^[0-9A-Fa-f]{32}$/.test(ki)) return res.status(400).json({ error: 'Invalid Ki' });
    if (!/^[0-9A-Fa-f]{32}$/.test(opc)) return res.status(400).json({ error: 'Invalid OPc' });
    
    const sub = {
      imsi,
      security: { k: ki, opc: opc, amf: "8000", op: null, sqn: 0 },
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
      user_info: user_info || {},
      group_membership: group_membership || {},
      device_info: {},
      tenantId: req.headers['x-tenant-id'] || 'default',
      metadata: { created_at: new Date(), updated_at: new Date(), created_by: req.headers['x-user-email'] || 'api' }
    };
    
    await subscribers.insertOne(sub);
    console.log(\`✅ Created subscriber: \${imsi}\`);
    res.json({ success: true, message: 'Subscriber created successfully', imsi });
  } catch (err) {
    console.error('Create error:', err.message);
    if (err.code === 11000) return res.status(400).json({ error: 'IMSI already exists' });
    res.status(500).json({ error: err.message });
  }
});

// List subscribers
app.get('/api/subscribers', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.query.tenantId || 'default';
    const query = { tenantId };
    if (req.query.status) query.subscriber_status = req.query.status === 'active' ? 0 : 1;
    
    const subs = await subscribers.find(query).limit(parseInt(req.query.limit) || 100).toArray();
    res.json({ count: subs.length, subscribers: subs.map(s => ({ ...s, security: { k: '***', opc: '***', sqn: s.security.sqn } })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get subscriber
app.get('/api/subscribers/:imsi', async (req, res) => {
  try {
    const sub = await subscribers.findOne({ imsi: req.params.imsi });
    if (!sub) return res.status(404).json({ error: 'Subscriber not found' });
    res.json({ subscriber: { ...sub, security: { k: '***', opc: '***', sqn: sub.security.sqn } } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enable subscriber
app.post('/api/subscribers/:imsi/enable', async (req, res) => {
  try {
    const inactive = await inactiveSubscribers.findOne({ imsi: req.params.imsi });
    if (inactive) {
      delete inactive.deactivation;
      inactive.subscriber_status = 0;
      await subscribers.insertOne(inactive);
      await inactiveSubscribers.deleteOne({ imsi: req.params.imsi });
    } else {
      await subscribers.updateOne({ imsi: req.params.imsi }, { $set: { subscriber_status: 0 } });
    }
    console.log(\`✅ Enabled: \${req.params.imsi}\`);
    res.json({ success: true, message: 'Subscriber enabled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Disable subscriber
app.post('/api/subscribers/:imsi/disable', async (req, res) => {
  try {
    const sub = await subscribers.findOne({ imsi: req.params.imsi });
    if (sub) {
      sub.deactivation = { at: new Date(), reason: req.body.reason || 'Manual', by: req.headers['x-user-email'] || 'api' };
      await inactiveSubscribers.insertOne(sub);
      await subscribers.deleteOne({ imsi: req.params.imsi });
    }
    console.log(\`❌ Disabled: \${req.params.imsi}\`);
    res.json({ success: true, message: 'Subscriber disabled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bandwidth plans
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

// Groups
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

// Dashboard
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'] || 'default';
    const total_active = await subscribers.countDocuments({ tenantId, subscriber_status: 0 });
    const total_inactive = await inactiveSubscribers.countDocuments({ tenantId });
    res.json({ subscribers: { total_active, total_inactive, total_suspended: 0 } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk import
app.post('/api/subscribers/bulk-import', async (req, res) => {
  try {
    const { subscribers: subs, default_group_id } = req.body;
    const results = { success: 0, failed: 0, errors: [] };
    
    for (const sub of subs) {
      try {
        const subscriber = {
          imsi: sub.imsi,
          security: { k: sub.ki, opc: sub.opc, amf: "8000", sqn: 0 },
          subscribed_rau_tau_timer: 12,
          network_access_mode: 0,
          subscriber_status: 0,
          slice: [{ sst: 1, default_indicator: true, session: [{ name: "internet", type: 3 }] }],
          user_info: { full_name: sub.full_name, email: sub.email },
          group_membership: { group_id: sub.group_id || default_group_id },
          tenantId: req.headers['x-tenant-id'] || 'default'
        };
        await subscribers.insertOne(subscriber);
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({ imsi: sub.imsi, error: err.message });
      }
    }
    
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ✅ HSS Management API Ready');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(\`📡 REST API: http://0.0.0.0:\${PORT}/api/\`);
  console.log(\`   Health: http://0.0.0.0:\${PORT}/health\`);
  console.log('');
  console.log('⚠️  Note: This is management API only');
  console.log('   For MME/S6a: Install Open5GS HSS separately');
  console.log('');
});
EOF

# Install
echo "📦 Installing dependencies..."
npm install

# Create service
tee /etc/systemd/system/hss-api.service > /dev/null << EOF
[Unit]
Description=HSS Management API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/hss-api
Environment="NODE_ENV=production"
Environment="HSS_ENCRYPTION_KEY=$HSS_KEY"
Environment="MONGODB_URI=$MONGODB_URI"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Start
systemctl daemon-reload
systemctl enable hss-api
systemctl start hss-api

sleep 3

# Verify
echo ""
echo "═══════════════════════════════════════════════════════════"
if systemctl is-active --quiet hss-api; then
  echo "  ✅ HSS API SERVICE RUNNING"
else
  echo "  ❌ SERVICE NOT RUNNING"
  journalctl -u hss-api -n 20 --no-pager
  exit 1
fi
echo "═══════════════════════════════════════════════════════════"
echo ""

systemctl status hss-api --no-pager | head -10
echo ""

if netstat -tulpn 2>/dev/null | grep -q ":3000"; then
  echo "✅ Port 3000 listening"
else
  echo "⚠️  Port 3000 not listening"
fi

echo ""
echo "🧪 Test:"
curl -s http://localhost:3000/health
echo ""
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ INSTALLATION COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📡 Your HSS Management API:"
echo "   http://$EXTERNAL_IP:3000/api/"
echo ""
echo "🔧 Commands:"
echo "   systemctl status hss-api"
echo "   systemctl restart hss-api"
echo "   journalctl -u hss-api -f"
echo ""
echo "🔑 Encryption Key: $HSS_KEY"
echo ""
echo "📝 Next Steps:"
echo "   1. Test: curl http://localhost:3000/health"
echo "   2. Create plans and groups via API"
echo "   3. Add subscribers"
echo "   4. For MME/S6a: Install Open5GS HSS on separate server"
echo ""
echo "═══════════════════════════════════════════════════════════"

