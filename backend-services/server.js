const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001; // Open5GS HSS Service

// CORS configuration
app.use(cors({
  origin: ['https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app', 'https://wisptools.io'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection - Atlas
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';

console.log('🔗 Connecting to MongoDB Atlas...');
console.log('📍 MongoDB URI:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@'));

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
    timestamp: new Date().toISOString()
  });
});

// Use existing route files - ALL MODULES
app.use('/api/users', require('./routes/users')); // Includes auto-assign routes
app.use('/api/tenants', require('./routes/users/tenants'));
app.use('/api/user-tenants', require('./routes/users/tenant-details'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/work-orders', require('./routes/work-orders'));
app.use('/api/network', require('./routes/network'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/hss', require('./routes/hss-management'));
app.use('/api/monitoring', require('./routes/monitoring'));
app.use('/api/epc', require('./routes/epc'));
app.use('/api/deploy', require('./routes/epc-deployment'));
app.use('/api/system', require('./routes/system'));
app.use('/api/billing', require('./billing-api'));
app.use('/admin', require('./routes/admin/general'));
app.use('/admin/tenants', require('./routes/admin/tenants'));
app.use('/setup-admin', require('./routes/setup'));

// Start server with error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 User Management System API running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth/*`);
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please check for other running processes.`);
    console.error('💡 Try running: lsof -ti:' + PORT + ' | xargs kill -9');
    process.exit(1);
  } else {
    console.error('❌ Server error:', error);
    process.exit(1);
  }
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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});