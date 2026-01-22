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
require('dotenv').config();

// Import modularized configuration
const { connectDatabase, getConnectionStatus } = require('./config/database');
const { setupMiddleware, errorHandler, notFoundHandler } = require('./config/middleware');
const { registerRoutes } = require('./config/routes');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000; // User Management System

// Setup middleware
setupMiddleware(app);

// Connect to database with error handling
connectDatabase().catch((error) => {
  console.error('❌ Failed to connect to database:', error);
  console.log('⚠️ Server will start but database operations may fail');
});

// Register all routes
registerRoutes(app);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server with error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 User Management System API running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth/*`);
  console.log(`📊 MongoDB status: ${getConnectionStatus().isConnected ? 'Connected' : 'Disconnected'}`);
  console.log(`⚠️  Note: Open5GS HSS uses port 3001, GenieACS UI uses port 3002`);
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
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
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

module.exports = app;
