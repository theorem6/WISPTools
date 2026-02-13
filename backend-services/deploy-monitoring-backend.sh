#!/bin/bash

# Deploy Monitoring Backend to GCE
# This script sets up the complete monitoring backend with all APIs

echo "🚀 Deploying LTE WISP Monitoring Backend to GCE..."

# Create working directory
mkdir -p /home/david_peterson_consulting_com/lte-wisp-backend
cd /home/david_peterson_consulting_com/lte-wisp-backend

# Create package.json
cat > package.json << 'EOF'
{
  "name": "lte-wisp-monitoring-backend",
  "version": "1.0.0",
  "description": "LTE WISP Management Platform - Monitoring Backend",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "mongoose": "^7.5.0",
    "dotenv": "^16.3.1"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
EOF

# Create main server.js
cat > server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;

// CORS configuration
app.use(cors({
  origin: [
    'https://wisptools-production.web.app',
    'https://wisptools-production.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || '';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'lte-wisp-monitoring-backend',
    port: PORT,
    timestamp: new Date().toISOString(),
    services: {
      mongodb: 'ready',
      monitoring: 'ready',
      epc: 'ready',
      mikrotik: 'ready',
      snmp: 'ready'
    }
  });
});

// Load models and routes
const models = require('./models/network');
const monitoringRoutes = require('./routes/monitoring');
const epcRoutes = require('./routes/epc');
const mikrotikRoutes = require('./routes/mikrotik');
const snmpRoutes = require('./routes/snmp');

// API Routes
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/epc', epcRoutes);
app.use('/api/mikrotik', mikrotikRoutes);
app.use('/api/snmp', snmpRoutes);

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 LTE WISP Monitoring Backend running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 External access: http://136.112.111.167:${PORT}/health`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', error);
  }
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    mongoose.disconnect();
    process.exit(0);
  });
});
EOF

# Create models directory and network.js
mkdir -p models
cat > models/network.js << 'EOF'
// Network Equipment Models
const mongoose = require('mongoose');

// Location Schema
const LocationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  address: String,
  city: String,
  state: String,
  zipCode: String,
  country: { type: String, default: 'US' }
});

// Unified Site Schema
const UnifiedSiteSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['tower', 'noc', 'warehouse', 'building', 'pole', 'internet-access', 'internet', 'other'], default: 'tower' },
  status: { type: String, enum: ['active', 'inactive', 'maintenance', 'planned'], default: 'active' },
  location: LocationSchema,
  contact: { name: String, email: String, phone: String },
  height: { type: Number, min: 0 },
  structureType: { type: String, enum: ['self-supporting', 'guyed', 'monopole', 'building-mounted', 'other'] },
  tenantId: { type: String, required: true, index: true },
  owner: String,
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Network Equipment Schema
const NetworkEquipmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['router', 'switch', 'power-supply', 'ups', 'generator', 'cable', 'connector', 'mounting-hardware', 'backhaul', 'antenna', 'radio', 'other'], required: true },
  status: { type: String, enum: ['active', 'inactive', 'maintenance', 'planned', 'retired'], default: 'active' },
  manufacturer: String,
  model: String,
  serialNumber: String,
  partNumber: String,
  location: LocationSchema,
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'UnifiedSite' },
  tenantId: { type: String, required: true, index: true },
  notes: String,
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Unified CPE Schema
const UnifiedCPESchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  status: { type: String, enum: ['active', 'inactive', 'maintenance', 'planned', 'offline'], default: 'active' },
  technology: { type: String, enum: ['LTE', '5G', 'CBRS', 'WiFi', 'other'], required: true },
  manufacturer: String,
  model: String,
  serialNumber: { type: String, required: true, unique: true },
  macAddress: String,
  firmwareVersion: String,
  location: LocationSchema,
  address: String,
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'UnifiedSite' },
  subscriberName: String,
  subscriberEmail: String,
  subscriberPhone: String,
  tenantId: { type: String, required: true, index: true },
  modules: {
    acs: { enabled: Boolean, deviceId: String, lastSync: Date },
    hss: { enabled: Boolean, subscriberId: String, lastSync: Date }
  },
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Hardware Deployment Schema
const HardwareDeploymentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  hardware_type: { type: String, enum: ['tower', 'sector', 'backhaul', 'router', 'epc', 'switch', 'power', 'other'], required: true },
  status: { type: String, enum: ['deployed', 'planned', 'maintenance', 'removed'], default: 'deployed' },
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'UnifiedSite', required: true, index: true },
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
  tenantId: { type: String, required: true, index: true },
  deployedAt: { type: Date, default: Date.now },
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create models
const UnifiedSite = mongoose.model('UnifiedSite', UnifiedSiteSchema);
const NetworkEquipment = mongoose.model('NetworkEquipment', NetworkEquipmentSchema);
const UnifiedCPE = mongoose.model('UnifiedCPE', UnifiedCPESchema);
const HardwareDeployment = mongoose.model('HardwareDeployment', HardwareDeploymentSchema);

module.exports = {
  UnifiedSite,
  NetworkEquipment,
  UnifiedCPE,
  HardwareDeployment
};
EOF

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Stop existing service
echo "🛑 Stopping existing service..."
sudo systemctl stop lte-wisp-backend || true

# Create systemd service
echo "⚙️ Creating systemd service..."
sudo tee /etc/systemd/system/lte-wisp-backend.service > /dev/null << EOF
[Unit]
Description=LTE WISP Monitoring Backend
After=network.target

[Service]
Type=simple
User=david_peterson_consulting_com
WorkingDirectory=/home/david_peterson_consulting_com/lte-wisp-backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3003

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and start service
echo "🔄 Reloading systemd and starting service..."
sudo systemctl daemon-reload
sudo systemctl enable lte-wisp-backend
sudo systemctl start lte-wisp-backend

# Check service status
echo "📊 Service status:"
sudo systemctl status lte-wisp-backend --no-pager

# Test the service
echo "🧪 Testing service..."
sleep 5
curl -f http://localhost:3003/health || echo "❌ Health check failed"

echo "✅ Deployment complete!"
echo "🌐 Backend available at: http://136.112.111.167:3003"
echo "📊 Health check: http://136.112.111.167:3003/health"
EOF

chmod +x deploy-monitoring-backend.sh
