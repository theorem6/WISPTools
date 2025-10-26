/**
 * Database Configuration
 * Centralized MongoDB connection and configuration
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 
  'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';

console.log('🔗 Database Config: Connecting to MongoDB Atlas...');
console.log('📍 MongoDB URI:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@')); // Hide credentials in logs

/**
 * Connect to MongoDB
 * @returns {Promise<void>}
 */
async function connectDatabase() {
  try {
    // Set connection options for better error handling
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferMaxEntries: 0,
      retryWrites: true,
      w: 'majority'
    };

    await mongoose.connect(MONGODB_URI, options);
    console.log('✅ MongoDB connected successfully');
    
    // Handle connection events
    mongoose.connection.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
      // Don't exit process, let the app handle it gracefully
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected - attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully');
    });

    mongoose.connection.on('close', () => {
      console.log('🔌 MongoDB connection closed');
    });
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    console.error('💡 Check your MongoDB URI and network connectivity');
    // Don't exit immediately, let the app start and show health check errors
    throw error;
  }
}

/**
 * Get database connection status
 * @returns {Object} Connection status information
 */
function getConnectionStatus() {
  return {
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
    isConnected: mongoose.connection.readyState === 1
  };
}

/**
 * Gracefully close database connection
 * @returns {Promise<void>}
 */
async function closeDatabase() {
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error);
  }
}

module.exports = {
  connectDatabase,
  getConnectionStatus,
  closeDatabase,
  mongoose
};
