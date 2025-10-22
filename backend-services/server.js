/**
 * HSS Management API Server
 * Unified backend for WISP Multitool platform
 * 
 * Port: 3001 (GenieACS UI uses 3000)
 * MongoDB: Atlas cluster
 * Firebase: Auth + Cloud Functions
 */

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'distributed-epc-api',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// API Routes
// ==========

// Core APIs
const distributedEpcAPI = require('./distributed-epc-api');
const monitoringAPI = require('./monitoring-api');
const userManagementAPI = require('./user-management-api');
const userTenantApi = require('./user-tenant-api');
const workOrderAPI = require('./work-order-api');
const customerAPI = require('./customer-api');

// Admin APIs
const adminTenantAPI = require('./admin-tenant-api');
const tenantManagementAPI = require('./tenant-management-api');

// Setup endpoint
const setupAdminEndpoint = require('./setup-admin-endpoint');

// Register Routes
app.use('/api/epc', distributedEpcAPI);
app.use('/api/monitoring', monitoringAPI);
app.use('/api/users', userManagementAPI);
app.use('/api/user-tenants', userTenantApi);
app.use('/api/work-orders', workOrderAPI);
app.use('/api/customers', customerAPI);

// Admin routes
app.use('/admin', adminTenantAPI);
app.use('/admin/tenants', tenantManagementAPI);
app.use('/setup-admin', setupAdminEndpoint);

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 HSS Management API running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Monitoring enabled with auto-refresh`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});
