// GCE Backend Server
// Handles ISO generation and EPC deployment

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;  // ISO Generation API port

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Environment variables
process.env.GCE_PUBLIC_IP = process.env.GCE_PUBLIC_IP || '136.112.111.167';
process.env.HSS_PORT = process.env.HSS_PORT || '3001';

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    gce_ip: process.env.GCE_PUBLIC_IP,
    hss_port: process.env.HSS_PORT
  });
});

// Load routes
try {
  const epcDeployment = require('./routes/epc-deployment');
  app.use('/api/epc', epcDeployment);
  console.log('[Server] EPC deployment routes loaded');
} catch (err) {
  console.error('[Server] Failed to load EPC deployment routes:', err);
}

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] GCE Backend running on port ${PORT}`);
  console.log(`[Server] GCE IP: ${process.env.GCE_PUBLIC_IP}`);
  console.log(`[Server] ISO downloads: http://${process.env.GCE_PUBLIC_IP}/downloads/isos/`);
});

