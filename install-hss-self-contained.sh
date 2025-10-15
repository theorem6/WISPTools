#!/bin/bash
# Self-Contained HSS Installation Script
# Creates all code inline, no downloads needed
# Copy and paste this entire script into your server terminal

set -e

echo "🚀 Self-Contained HSS Installation"
echo ""

# Configuration
MONGODB_URI="${MONGODB_URI:-mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0}"
HSS_KEY="${HSS_ENCRYPTION_KEY:-$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")}"

echo "📋 Config:"
echo "  MongoDB: ${MONGODB_URI:0:30}..."
echo "  Encryption Key: ${HSS_KEY:0:16}..."
echo ""

# Create directory
sudo mkdir -p /opt/hss-server
sudo chown $USER:$USER /opt/hss-server
cd /opt/hss-server

# Create package.json
cat > package.json << 'EOF'
{
  "name": "cloud-hss",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "mongodb": "^6.3.0"
  }
}
EOF

# Create server.js
cat > server.js << 'EOF'
const express = require('express');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(require('cors')({ origin: true }));

const MONGODB_URI = process.env.MONGODB_URI;
const ENCRYPTION_KEY = Buffer.from(process.env.HSS_ENCRYPTION_KEY || '', 'hex');
let db, subscribers, inactiveSubscribers;

// Connect to MongoDB
MongoClient.connect(MONGODB_URI).then(client => {
  db = client.db('hss');
  subscribers = db.collection('active_subscribers');
  inactiveSubscribers = db.collection('inactive_subscribers');
  
  // Create indexes
  subscribers.createIndex({ imsi: 1 }, { unique: true });
  subscribers.createIndex({ tenantId: 1 });
  subscribers.createIndex({ status: 1 });
  
  console.log('✅ MongoDB connected');
}).catch(err => console.error('MongoDB error:', err));

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'Cloud HSS', timestamp: new Date() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', service: 'Cloud HSS API', timestamp: new Date() });
});

// Create subscriber
app.post('/api/subscribers', async (req, res) => {
  try {
    const { tenantId, imsi, ki, opc, user_info, group_membership } = req.body;
    
    if (!/^\d{15}$/.test(imsi)) {
      return res.status(400).json({ error: 'Invalid IMSI format' });
    }
    
    const subscriber = {
      tenantId: tenantId || req.headers['x-tenant-id'],
      imsi,
      ki: encrypt(ki),
      opc: encrypt(opc),
      sqn: 0,
      status: 'active',
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
      subscribers: subs.map(s => ({ ...s, ki: '***', opc: '***' }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get subscriber
app.get('/api/subscribers/:imsi', async (req, res) => {
  try {
    const sub = await subscribers.findOne({ imsi: req.params.imsi });
    if (!sub) return res.status(404).json({ error: 'Not found' });
    res.json({ subscriber: { ...sub, ki: '***', opc: '***' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enable subscriber
app.post('/api/subscribers/:imsi/enable', async (req, res) => {
  try {
    const inactive = await inactiveSubscribers.findOne({ imsi: req.params.imsi });
    if (inactive) {
      await subscribers.insertOne({ ...inactive, status: 'active' });
      await inactiveSubscribers.deleteOne({ imsi: req.params.imsi });
    } else {
      await subscribers.updateOne({ imsi: req.params.imsi }, { $set: { status: 'active' } });
    }
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
      await inactiveSubscribers.insertOne({ ...sub, deactivation: { deactivated_at: new Date(), reason: req.body.reason } });
      await subscribers.deleteOne({ imsi: req.params.imsi });
    }
    res.json({ success: true, message: 'Subscriber disabled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard stats
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const total_active = await subscribers.countDocuments({ tenantId, status: 'active' });
    const total_inactive = await inactiveSubscribers.countDocuments({ tenantId });
    const total_suspended = await subscribers.countDocuments({ tenantId, status: 'suspended' });
    
    res.json({
      subscribers: { total_active, total_inactive, total_suspended },
      cpe_correlation: {},
      health: {}
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bandwidth plans
app.post('/api/bandwidth-plans', async (req, res) => {
  try {
    await db.collection('bandwidth_plans').insertOne(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bandwidth-plans', async (req, res) => {
  try {
    const plans = await db.collection('bandwidth_plans').find({ tenantId: req.headers['x-tenant-id'] }).toArray();
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Groups
app.post('/api/groups', async (req, res) => {
  try {
    await db.collection('subscriber_groups').insertOne(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/groups', async (req, res) => {
  try {
    const groups = await db.collection('subscriber_groups').find({ tenantId: req.headers['x-tenant-id'] }).toArray();
    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(\`✅ HSS API on port \${PORT}\`);
});
EOF

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create systemd service
echo "⚙️ Creating service..."
sudo tee /etc/systemd/system/hss.service > /dev/null << EOF
[Unit]
Description=HSS Server
After=network.target
[Service]
WorkingDirectory=/opt/hss-server
Environment="HSS_ENCRYPTION_KEY=$HSS_KEY"
Environment="MONGODB_URI=$MONGODB_URI"
ExecStart=/usr/bin/node server.js
Restart=always
[Install]
WantedBy=multi-user.target
EOF

# Start service
echo "🚀 Starting HSS..."
sudo systemctl daemon-reload
sudo systemctl enable hss
sudo systemctl start hss
sleep 2

# Test
echo ""
echo "✅ Installation complete!"
echo ""
sudo systemctl status hss --no-pager | head -10
echo ""
curl -s http://localhost:3000/health
echo ""
echo "🔑 Your encryption key: $HSS_KEY"
echo "⚠️  SAVE THIS KEY!"
echo ""

