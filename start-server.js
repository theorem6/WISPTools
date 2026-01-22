#!/usr/bin/env node

/**
 * Server Startup Script
 * Handles proper startup sequence and error recovery
 */

const { connectDatabase, getConnectionStatus } = require('./config/database');
const { isInitialized } = require('./config/firebase');

async function startServer() {
  console.log('🚀 Starting User Management System API...');
  
  try {
    // Check Firebase initialization
    if (!isInitialized) {
      console.error('❌ Firebase not initialized. Check your credentials.');
      process.exit(1);
    }
    console.log('✅ Firebase initialized');

    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected');

    // Start the server
    require('./server-modular.js');
    
    console.log('🎉 Server started successfully!');
    console.log('📡 Health check: http://localhost:3000/health');
    console.log('🔐 Auth endpoints: http://localhost:3000/api/auth/*');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();