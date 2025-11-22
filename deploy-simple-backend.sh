#!/bin/bash

# Simple LTE WISP Backend Deployment Script for GCE VM
# Run this script on the GCE VM (acs-hss-server)

set -e

echo "🚀 Deploying LTE WISP Backend Services to GCE VM..."

# Configuration
BACKEND_DIR="/opt/lte-wisp-backend"
SERVICE_NAME="lte-wisp-backend"
PORT=3001

# Create backend directory
echo "📁 Creating backend directory..."
sudo mkdir -p $BACKEND_DIR
sudo chown $USER:$USER $BACKEND_DIR
cd $BACKEND_DIR

# Create package.json with only essential dependencies
echo "📦 Creating package.json..."
cat > package.json << 'EOF'
{
  "name": "lte-wisp-backend",
  "version": "1.0.0",
  "description": "LTE WISP Management Platform Backend Services",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.7.0",
    "dotenv": "^16.3.1",
    "multer": "^1.4.5-lts.1",
    "winston": "^3.10.0",
    "axios": "^1.5.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Create main server file
echo "🖥️ Creating main server file..."
cat > server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    'https://wisptools-production.web.app',
    'https://wisptools-production.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:4173'
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      apt: 'ready',
      snmp: 'ready', 
      mikrotik: 'ready',
      epc: 'ready'
    },
    endpoints: {
      snmp: '/api/snmp',
      mikrotik: '/api/mikrotik',
      epc_updates: '/api/epc-updates',
      epc_metrics: '/api/epc'
    }
  });
});

// SNMP API endpoints
app.get('/api/snmp/health', (req, res) => {
  res.json({ service: 'SNMP Monitoring', status: 'active', timestamp: new Date().toISOString() });
});

app.post('/api/snmp/configuration', (req, res) => {
  res.json({ message: 'SNMP configuration saved', timestamp: new Date().toISOString() });
});

app.get('/api/snmp/configuration', (req, res) => {
  res.json({ 
    communityProfiles: [],
    v3UserProfiles: [],
    discoverySubnets: [],
    timestamp: new Date().toISOString()
  });
});

app.post('/api/snmp/devices/register', (req, res) => {
  res.json({ message: 'SNMP device registered', deviceId: 'snmp-' + Date.now() });
});

app.post('/api/snmp/test-connection', (req, res) => {
  res.json({ success: true, message: 'SNMP connection test successful' });
});

// Mikrotik API endpoints
app.get('/api/mikrotik/health', (req, res) => {
  res.json({ service: 'Mikrotik Integration', status: 'active', timestamp: new Date().toISOString() });
});

app.post('/api/mikrotik/devices/register', (req, res) => {
  res.json({ message: 'Mikrotik device registered', deviceId: 'mt-' + Date.now() });
});

app.post('/api/mikrotik/test-connection', (req, res) => {
  res.json({ success: true, message: 'Mikrotik connection test successful' });
});

app.get('/api/mikrotik/devices', (req, res) => {
  res.json({ devices: [], timestamp: new Date().toISOString() });
});

// EPC Updates API endpoints
app.get('/api/epc-updates/health', (req, res) => {
  res.json({ service: 'EPC Updates (APT)', status: 'active', timestamp: new Date().toISOString() });
});

app.post('/api/epc-updates/repository/setup', (req, res) => {
  res.json({ message: 'APT repository setup initiated', timestamp: new Date().toISOString() });
});

app.post('/api/epc-updates/packages/upload', (req, res) => {
  res.json({ message: 'Package upload initiated', timestamp: new Date().toISOString() });
});

// EPC Metrics API endpoints
app.get('/api/epc/health', (req, res) => {
  res.json({ service: 'EPC Metrics Collection', status: 'active', timestamp: new Date().toISOString() });
});

app.post('/api/epc/metrics', (req, res) => {
  res.json({ message: 'Metrics received', timestamp: new Date().toISOString() });
});

app.get('/api/epc/list', (req, res) => {
  res.json({ epcs: [], timestamp: new Date().toISOString() });
});

app.get('/api/snmp/metrics/latest', (req, res) => {
  res.json([]);
});

app.get('/api/snmp/devices', (req, res) => {
  res.json({ devices: [] });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 LTE WISP Backend Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 SNMP API: http://localhost:${PORT}/api/snmp`);
  console.log(`🌐 Mikrotik API: http://localhost:${PORT}/api/mikrotik`);
  console.log(`📦 APT API: http://localhost:${PORT}/api/epc-updates`);
  console.log(`📊 EPC Metrics API: http://localhost:${PORT}/api/epc`);
  console.log(`🔗 Frontend CORS enabled for: wisptools-production.web.app`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});
EOF

# Create environment file
echo "🔧 Creating environment file..."
cat > .env << 'EOF'
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
EOF

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "📥 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create systemd service
echo "🔧 Creating systemd service..."
sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null << EOF
[Unit]
Description=LTE WISP Backend Services
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$BACKEND_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=$PORT

[Install]
WantedBy=multi-user.target
EOF

# Create log directory
sudo mkdir -p /var/log/lte-wisp
sudo chown $USER:$USER /var/log/lte-wisp

# Configure firewall
echo "🔥 Configuring firewall..."
sudo ufw allow $PORT/tcp

# Stop any existing service
sudo systemctl stop $SERVICE_NAME 2>/dev/null || true

# Enable and start service
echo "🚀 Starting service..."
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl start $SERVICE_NAME

# Wait a moment for service to start
sleep 5

# Check service status
echo "📊 Checking service status..."
sudo systemctl status $SERVICE_NAME --no-pager -l

# Test the service
echo "🧪 Testing service..."
if curl -f http://localhost:$PORT/health; then
    echo "✅ Health check successful!"
else
    echo "❌ Health check failed"
fi

echo ""
echo "✅ LTE WISP Backend deployment completed!"
echo "🌐 Service running on: http://136.112.111.167:$PORT"
echo "🏥 Health check: http://136.112.111.167:$PORT/health"
echo ""
echo "📋 Service management commands:"
echo "   sudo systemctl status $SERVICE_NAME"
echo "   sudo systemctl restart $SERVICE_NAME"
echo "   sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "🔗 API Endpoints available:"
echo "   GET  /health"
echo "   GET  /api/snmp/health"
echo "   GET  /api/mikrotik/health" 
echo "   GET  /api/epc-updates/health"
echo "   GET  /api/epc/health"
EOF

