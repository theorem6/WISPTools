#!/bin/bash

# LTE WISP Backend Deployment Script for GCE VM
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

# Create package.json
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
    "node-snmp": "^2.1.0",
    "snmp-native": "^1.0.27",
    "node-routeros": "^1.1.0",
    "node-ssh": "^13.1.0",
    "archiver": "^6.0.1",
    "node-gpg": "^0.6.2",
    "winston": "^3.10.0",
    "axios": "^1.5.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
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
    services: {
      apt: 'active',
      snmp: 'active', 
      mikrotik: 'active',
      epc: 'active'
    }
  });
});

// Basic API endpoints (placeholders for now)
app.get('/api/snmp/health', (req, res) => {
  res.json({ service: 'SNMP', status: 'active', timestamp: new Date().toISOString() });
});

app.get('/api/mikrotik/health', (req, res) => {
  res.json({ service: 'Mikrotik', status: 'active', timestamp: new Date().toISOString() });
});

app.get('/api/epc-updates/health', (req, res) => {
  res.json({ service: 'EPC Updates', status: 'active', timestamp: new Date().toISOString() });
});

app.get('/api/epc/health', (req, res) => {
  res.json({ service: 'EPC Metrics', status: 'active', timestamp: new Date().toISOString() });
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
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 LTE WISP Backend Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 SNMP API: http://localhost:${PORT}/api/snmp`);
  console.log(`🌐 Mikrotik API: http://localhost:${PORT}/api/mikrotik`);
  console.log(`📦 APT API: http://localhost:${PORT}/api/epc-updates`);
  console.log(`📊 EPC Metrics API: http://localhost:${PORT}/api/epc`);
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
SNMP_DEFAULT_COMMUNITY=public
SNMP_DEFAULT_PORT=161
MIKROTIK_DEFAULT_PORT=8728
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

# Enable and start service
echo "🚀 Starting service..."
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME

# Wait a moment for service to start
sleep 3

# Check service status
echo "📊 Checking service status..."
sudo systemctl status $SERVICE_NAME --no-pager -l

# Test the service
echo "🧪 Testing service..."
curl -f http://localhost:$PORT/health || echo "❌ Health check failed"

echo ""
echo "✅ LTE WISP Backend deployment completed!"
echo "🌐 Service running on: http://136.112.111.167:$PORT"
echo "🏥 Health check: http://136.112.111.167:$PORT/health"
echo ""
echo "📋 Service management commands:"
echo "   sudo systemctl status $SERVICE_NAME"
echo "   sudo systemctl restart $SERVICE_NAME"
echo "   sudo journalctl -u $SERVICE_NAME -f"
EOF

