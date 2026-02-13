/**
 * LTE WISP Monitoring Backend Server
 * 
 * PORT: 3003
 * 
 * This server handles:
 * - Network monitoring and device status
 * - EPC metrics and SNMP data collection
 * - Mikrotik device management
 * - Network equipment API (sites, sectors, CPE, equipment)
 * - EPC deployment ISO generation
 * 
 * Deployed on GCE VM: acs-hss-server (136.112.111.167:3003)
 */

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
      mongodb: mongoose.connection.readyState === 1 ? 'ready' : 'disconnected',
      monitoring: 'ready',
      epc: 'ready',
      mikrotik: 'ready',
      snmp: 'ready',
      network: 'ready',
      deploy: 'ready'
    }
  });
});

// Load models
const models = require('./models/network');

// Load routes
const monitoringRoutes = require('./routes/monitoring');
const epcRoutes = require('./routes/epc');
const mikrotikRoutes = require('./routes/mikrotik');
const snmpRoutes = require('./routes/snmp');
const networkRoutes = require('./routes/network');
const deployRoutes = require('./routes/epc-deployment');

// API Routes
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/epc', epcRoutes);
app.use('/api/mikrotik', mikrotikRoutes);
app.use('/api/snmp', snmpRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/deploy', deployRoutes);

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ LTE WISP Monitoring Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
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

