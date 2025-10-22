/**
 * User Management System API Server
 * 
 * PORT ALLOCATION:
 * - Port 3000: User Management System API (THIS SERVICE)
 * - Port 3001: Open5GS HSS (DO NOT USE)
 * - Port 3002: GenieACS UI (DO NOT USE)
 * 
 * This server handles:
 * - User-tenant associations
 * - Role-based access control
 * - Tenant management (platform admin)
 * - Work orders, customers, inventory
 * - All business logic APIs
 */

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000; // User Management System

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
    service: 'user-management-system',
    port: PORT,
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    note: 'User Management System API - Port 3000'
  });
});

// API Routes - Only include files that actually exist
// ==================================================

// Core User Management APIs
const userManagementAPI = require('./user-management-api');
const userTenantApi = require('./user-tenant-api');
const tenantManagementAPI = require('./tenant-management-api');
const adminTenantAPI = require('./admin-tenant-api');

// Business Logic APIs
const workOrderAPI = require('./work-order-api');
const customerAPI = require('./customer-api');
const inventoryAPI = require('./inventory-api');
const unifiedNetworkAPI = require('./unified-network-api');

// System APIs
const monitoringAPI = require('./monitoring-api');
const distributedEpcAPI = require('./distributed-epc-api');

// Setup endpoint
const setupAdminEndpoint = require('./setup-admin-endpoint');

// Register Routes
app.use('/api/users', userManagementAPI);
app.use('/api/user-tenants', userTenantApi);
app.use('/api/work-orders', workOrderAPI);
app.use('/api/customers', customerAPI);
app.use('/api/inventory', inventoryAPI);
app.use('/api/network', unifiedNetworkAPI);
app.use('/api/monitoring', monitoringAPI);
app.use('/api/epc', distributedEpcAPI);

// Admin routes
app.use('/admin', adminTenantAPI);
app.use('/admin/tenants', tenantManagementAPI);
app.use('/setup-admin', setupAdminEndpoint);

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 User Management System API running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Service: User Management System (Port 3000)`);
  console.log(`⚠️  Note: Open5GS HSS uses port 3001, GenieACS UI uses port 3002`);
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