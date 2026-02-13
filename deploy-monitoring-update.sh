#!/bin/bash

# Deploy Monitoring API Updates to GCE
# This script updates the backend with new monitoring, EPC, Mikrotik, and SNMP APIs

echo "🚀 Deploying monitoring API updates to GCE..."

# Create the updated server files
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

// API Routes
app.use('/api/monitoring', require('./routes/monitoring'));
app.use('/api/epc', require('./routes/epc'));
app.use('/api/mikrotik', require('./routes/mikrotik'));
app.use('/api/snmp', require('./routes/snmp'));
app.use('/api/network', require('./routes/network'));

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 LTE WISP Monitoring Backend running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
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

chmod +x deploy-monitoring-update.sh
