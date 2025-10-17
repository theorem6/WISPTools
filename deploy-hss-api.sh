#!/bin/bash
# Deploy HSS Management API to backend server
# Run this on the server at 136.112.111.167

set -e

MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Deploying HSS Management API"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Stop existing service if running
systemctl stop hss-api 2>/dev/null || true

# Create directory
mkdir -p /opt/hss-api
cd /opt/hss-api

# Initialize npm project
cat > package.json << 'EOF'
{
  "name": "hss-management-api",
  "version": "1.0.0",
  "description": "HSS Management REST API",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.5.0",
    "cors": "^2.8.5",
    "body-parser": "^1.20.2",
    "dotenv": "^16.3.1"
  }
}
EOF

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create server file
echo "📝 Creating server..."
cat > server.js << 'EOFJS'
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Subscriber Schema
const subscriberSchema = new mongoose.Schema({
  imsi: { type: String, required: true, unique: true },
  msisdn: { type: String },
  full_name: { type: String },
  ki: { type: String, required: true },
  opc: { type: String, required: true },
  qci: { type: Number, default: 9 },
  imei: { type: String },
  enabled: { type: Boolean, default: true },
  group_id: { type: String },
  bandwidth_plan_id: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { collection: 'subscribers' });

const Subscriber = mongoose.model('Subscriber', subscriberSchema);

// Group Schema
const groupSchema = new mongoose.Schema({
  group_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  bandwidth_plan_id: { type: String },
  created_at: { type: Date, default: Date.now }
}, { collection: 'subscriber_groups' });

const Group = mongoose.model('Group', groupSchema);

// Bandwidth Plan Schema
const bandwidthPlanSchema = new mongoose.Schema({
  plan_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  download_mbps: { type: Number, required: true },
  upload_mbps: { type: Number, required: true },
  created_at: { type: Date, default: Date.now }
}, { collection: 'bandwidth_plans' });

const BandwidthPlan = mongoose.model('BandwidthPlan', bandwidthPlanSchema);

// ===== ROUTES =====

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Dashboard stats
app.get('/dashboard/stats', async (req, res) => {
  try {
    const totalSubscribers = await Subscriber.countDocuments();
    const activeSubscribers = await Subscriber.countDocuments({ enabled: true });
    const inactiveSubscribers = await Subscriber.countDocuments({ enabled: false });
    const totalGroups = await Group.countDocuments();
    
    // Recent activations (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentActivations = await Subscriber.countDocuments({ 
      created_at: { $gte: sevenDaysAgo }
    });

    res.json({
      totalSubscribers,
      activeSubscribers,
      inactiveSubscribers,
      totalGroups,
      recentActivations
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all subscribers
app.get('/subscribers', async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', group_id } = req.query;
    const query = {};
    
    if (search) {
      query.$or = [
        { imsi: { $regex: search, $options: 'i' } },
        { msisdn: { $regex: search, $options: 'i' } },
        { full_name: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (group_id) {
      query.group_id = group_id;
    }

    const subscribers = await Subscriber.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ created_at: -1 });
    
    const total = await Subscriber.countDocuments(query);

    res.json({
      subscribers,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error getting subscribers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get subscriber by IMSI
app.get('/subscribers/:imsi', async (req, res) => {
  try {
    const subscriber = await Subscriber.findOne({ imsi: req.params.imsi });
    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }
    res.json(subscriber);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new subscriber
app.post('/subscribers', async (req, res) => {
  try {
    const subscriber = new Subscriber(req.body);
    await subscriber.save();
    res.status(201).json(subscriber);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update subscriber
app.put('/subscribers/:imsi', async (req, res) => {
  try {
    req.body.updated_at = new Date();
    const subscriber = await Subscriber.findOneAndUpdate(
      { imsi: req.params.imsi },
      req.body,
      { new: true, runValidators: true }
    );
    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }
    res.json(subscriber);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete subscriber
app.delete('/subscribers/:imsi', async (req, res) => {
  try {
    const subscriber = await Subscriber.findOneAndDelete({ imsi: req.params.imsi });
    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }
    res.json({ message: 'Subscriber deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enable/Disable subscriber
app.post('/subscribers/:imsi/:action', async (req, res) => {
  try {
    const { imsi, action } = req.params;
    const enabled = action === 'enable';
    
    const subscriber = await Subscriber.findOneAndUpdate(
      { imsi },
      { enabled, updated_at: new Date() },
      { new: true }
    );
    
    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }
    
    res.json(subscriber);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all groups
app.get('/groups', async (req, res) => {
  try {
    const groups = await Group.find().sort({ name: 1 });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create group
app.post('/groups', async (req, res) => {
  try {
    const group = new Group(req.body);
    await group.save();
    res.status(201).json(group);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update group
app.put('/groups/:group_id', async (req, res) => {
  try {
    const group = await Group.findOneAndUpdate(
      { group_id: req.params.group_id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json(group);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete group
app.delete('/groups/:group_id', async (req, res) => {
  try {
    const group = await Group.findOneAndDelete({ group_id: req.params.group_id });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all bandwidth plans
app.get('/bandwidth-plans', async (req, res) => {
  try {
    const plans = await BandwidthPlan.find().sort({ name: 1 });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create bandwidth plan
app.post('/bandwidth-plans', async (req, res) => {
  try {
    const plan = new BandwidthPlan(req.body);
    await plan.save();
    res.status(201).json(plan);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update bandwidth plan
app.put('/bandwidth-plans/:plan_id', async (req, res) => {
  try {
    const plan = await BandwidthPlan.findOneAndUpdate(
      { plan_id: req.params.plan_id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!plan) {
      return res.status(404).json({ error: 'Bandwidth plan not found' });
    }
    res.json(plan);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete bandwidth plan
app.delete('/bandwidth-plans/:plan_id', async (req, res) => {
  try {
    const plan = await BandwidthPlan.findOneAndDelete({ plan_id: req.params.plan_id });
    if (!plan) {
      return res.status(404).json({ error: 'Bandwidth plan not found' });
    }
    res.json({ message: 'Bandwidth plan deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk import subscribers
app.post('/subscribers/bulk', async (req, res) => {
  try {
    const { subscribers } = req.body;
    if (!Array.isArray(subscribers) || subscribers.length === 0) {
      return res.status(400).json({ error: 'No subscribers provided' });
    }

    const results = {
      success: true,
      imported: 0,
      errors: []
    };

    for (const sub of subscribers) {
      try {
        const subscriber = new Subscriber(sub);
        await subscriber.save();
        results.imported++;
      } catch (error) {
        results.errors.push(\`IMSI \${sub.imsi}: \${error.message}\`);
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Monitoring endpoints
app.use('/monitoring', require('./monitoring-api'));

// Distributed EPC endpoints
app.use('/api', require('./distributed-epc-api'));

// Start monitoring service
const monitoringService = require('./monitoring-service');
monitoringService.startMonitoring();

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 HSS Management API running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Monitoring enabled with auto-refresh`);
  console.log(`🌐 Distributed EPC API enabled`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});
EOFJS

# Create .env file
cat > .env << EOFENV
MONGODB_URI=$MONGODB_URI
PORT=3000
NODE_ENV=production
EOFENV

# Copy distributed EPC files from /root
echo "📦 Copying distributed EPC files from /root..."

if [ -f "/root/distributed-epc-schema.js" ] && [ -f "/root/distributed-epc-api.js" ]; then
  cp /root/distributed-epc-schema.js ./
  cp /root/distributed-epc-api.js ./
  echo "✅ Distributed EPC files copied successfully"
else
  echo "❌ ERROR: Distributed EPC files not found in /root/"
  echo ""
  echo "   Please upload these files to /root/ first:"
  echo "   - distributed-epc-schema.js"
  echo "   - distributed-epc-api.js"
  echo ""
  echo "   You can use your web app to upload them."
  echo ""
  exit 1
fi

# Create systemd service
cat > /etc/systemd/system/hss-api.service << 'EOFSVC'
[Unit]
Description=HSS Management API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/hss-api
EnvironmentFile=/opt/hss-api/.env
ExecStart=/usr/bin/node /opt/hss-api/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOFSVC

# Enable and start service
echo "🚀 Starting service..."
systemctl daemon-reload
systemctl enable hss-api
systemctl start hss-api

# Wait for startup
sleep 3

# Check status
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  📊 SERVICE STATUS"
echo "═══════════════════════════════════════════════════════════"
systemctl status hss-api --no-pager | head -20

echo ""
echo "🧪 Testing API..."
curl -s http://localhost:3000/health | head -10

# Get external IP
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ HSS MANAGEMENT API DEPLOYED"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🌐 API Endpoints:"
echo "   Health:      http://$EXTERNAL_IP:3000/health"
echo "   Dashboard:   http://$EXTERNAL_IP:3000/dashboard/stats"
echo "   Subscribers: http://$EXTERNAL_IP:3000/subscribers"
echo "   Groups:      http://$EXTERNAL_IP:3000/groups"
echo ""
echo "🔧 Manage Service:"
echo "   systemctl status hss-api"
echo "   systemctl restart hss-api"
echo "   journalctl -u hss-api -f"
echo ""
echo "═══════════════════════════════════════════════════════════"

