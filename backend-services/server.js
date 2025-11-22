const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const appConfig = require('./config/app');

const app = express();
const PORT = appConfig.server.port;

// CORS configuration - All authorized Firebase Hosting domains
app.use(cors({
  origin: appConfig.cors.origins,
  credentials: appConfig.cors.credentials
}));

app.use(express.json({ limit: appConfig.limits.jsonBodySize }));
app.use(express.urlencoded({ extended: true, limit: appConfig.limits.urlEncodedBodySize }));

// Request logging middleware - log ALL requests
app.use((req, res, next) => {
  console.log('[REQUEST]', {
    method: req.method,
    path: req.path,
    url: req.url,
    ip: req.ip,
    headers: Object.keys(req.headers),
    hasAuth: !!(req.headers.authorization || req.headers.Authorization),
    authLength: (req.headers.authorization || req.headers.Authorization || '').length,
    timestamp: new Date().toISOString()
  });
  next();
});

// MongoDB Connection - Atlas
const MONGODB_URI = appConfig.mongodb.uri;

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

// Debug endpoint to test token verification
app.get('/api/debug/token', async (req, res) => {
  const { auth } = require('./config/firebase');
  const authHeader = req.headers.authorization || req.headers.Authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ error: 'No token provided', hasHeader: !!authHeader });
  }
  
  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await auth.verifyIdToken(token, true); // Check revoked tokens
    res.json({
      success: true,
      decoded: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        projectId: decodedToken.firebase?.project_id || 'unknown'
      },
      authAppProjectId: auth.app?.options?.projectId || 'unknown',
      backendProjectId: process.env.FIREBASE_PROJECT_ID || 'wisptools-production'
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      code: error.code,
      tokenLength: token.length,
      tokenStart: token.substring(0, 50) + '...',
      authAppProjectId: auth.app?.options?.projectId || 'unknown',
      backendProjectId: process.env.FIREBASE_PROJECT_ID || 'wisptools-production',
      errorStack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
  }
});


// Use existing route files - ALL MODULES
app.use('/api/auth', require('./routes/auth')); // Authentication routes
app.use('/api/users', require('./routes/users')); // Includes auto-assign routes
app.use('/api/tenants', require('./routes/tenants')); // User tenant creation (first tenant only)
app.use('/api/user-tenants', require('./routes/users/tenant-details'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/bundles', require('./routes/hardwareBundles'));
app.use('/api/work-orders', require('./routes/work-orders'));
app.use('/api/maintain', require('./routes/maintain'));
app.use('/api/network', require('./routes/network'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/hss', require('./routes/hss-management'));
app.use('/api/monitoring', require('./routes/monitoring'));
app.use('/api/epc', require('./routes/epc'));
app.use('/api/mikrotik', require('./routes/mikrotik'));
app.use('/api/snmp', require('./routes/snmp'));
app.use('/api/deploy', require('./routes/epc-deployment'));
app.use('/api/system', require('./routes/system'));
app.use('/api/permissions', require('./routes/permissions')); // FCAPS permission management
// Enable billing API (with graceful handling if PayPal not configured)
try {
  app.use('/api/billing', require('./billing-api'));
  console.log('✅ Billing API enabled');
} catch (error) {
  console.warn('⚠️ Billing API disabled:', error.message);
}
// Enable equipment pricing API
try {
  app.use('/api/equipment-pricing', require('./routes/equipment-pricing'));
  console.log('✅ Equipment Pricing API enabled');
} catch (error) {
  console.warn('⚠️ Equipment Pricing API disabled:', error.message);
}
// Enable installation documentation API
try {
  app.use('/api/installation-documentation', require('./routes/installation-documentation'));
  console.log('✅ Installation Documentation API enabled');
} catch (error) {
  console.warn('⚠️ Installation Documentation API disabled:', error.message);
}
// Enable subcontractors API
try {
  app.use('/api/subcontractors', require('./routes/subcontractors'));
  console.log('✅ Subcontractors API enabled');
} catch (error) {
  console.warn('⚠️ Subcontractors API disabled:', error.message);
}
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