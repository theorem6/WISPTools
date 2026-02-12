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

// Body parser
app.use(express.json({ limit: appConfig.limits.jsonBodySize, strict: false }));
app.use(express.urlencoded({ extended: true, limit: appConfig.limits.urlEncodedBodySize }));

// Middleware
app.use(require('./middleware/error-handler'));
app.use(require('./middleware/request-logger'));
app.use(require('./middleware/debug-header'));

// MongoDB Connection - Atlas
const MONGODB_URI = appConfig.mongodb.uri;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is required. Set it in .env (see .env.example).');
  process.exit(1);
}

console.log('🔗 Connecting to MongoDB...');
// Redact credentials in logs (user:pass@)
const safeUri = MONGODB_URI.replace(/(\/\/)([^:@]+):([^@]+)(@)/, '$1***:***$4');
console.log('📍 MongoDB URI:', safeUri);

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// Health Check (both /health and /api/health for nginx proxy path preservation)
const healthHandler = (req, res) => {
  res.json({
    status: 'healthy',
    service: 'user-management-system',
    port: PORT,
    timestamp: new Date().toISOString()
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

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


// Path rewrite: when LB/nginx strips path to /, use X-Original-Path or X-Request-Uri from proxy
app.use((req, res, next) => {
  if (req.path !== '/' && req.path !== '') return next();
  let originalPath = req.headers['x-original-path'] || req.headers['x-request-uri'] || req.headers['x-original-url'];
  if (typeof originalPath === 'string' && originalPath.startsWith('http')) {
    try {
      originalPath = new URL(originalPath).pathname;
    } catch {
      originalPath = null;
    }
  }
  if (!originalPath || typeof originalPath !== 'string' || !originalPath.startsWith('/')) return next();
  const pathOnly = originalPath.split('?')[0];
  if (!pathOnly || pathOnly === '/') return next();
  req.url = originalPath;
  req.originalUrl = originalPath;
  next();
});

// Internal API (Cloud Function calls with INTERNAL_API_KEY - no Firebase token verification)
try {
  app.use('/api/internal', require('./routes/internal'));
  console.log('[Server] ✅ Internal API route loaded');
} catch (error) {
  console.error('[Server] ❌ Failed to load internal route:', error.message);
}

// Use existing route files - ALL MODULES
app.use('/api/auth', require('./routes/auth')); // Authentication routes
app.use('/api/users', require('./routes/users')); // Includes auto-assign routes
app.use('/api/tenants', require('./routes/tenants')); // User tenant creation (first tenant only)
// User tenant details route (wrapped in try-catch to prevent server crash on load error)
try {
  const userTenantsRoute = require('./routes/users/tenant-details');
  app.use('/api/user-tenants', userTenantsRoute);
  console.log('[Server] ✅ User tenant details route loaded successfully');
} catch (error) {
  console.error('[Server] ❌ Failed to load user tenant details route:', error);
  console.error('[Server] Error details:', error.message, error.stack);
  // Don't crash - create a fallback route
  app.use('/api/user-tenants', (req, res) => {
    res.status(500).json({
      error: 'Route configuration error',
      message: 'The /api/user-tenants route failed to load during server startup. Check server logs for details.',
      details: process.env.NODE_ENV === 'development' ? {
        errorMessage: error.message,
        errorStack: error.stack
      } : undefined
    });
  });
}
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/tenant-settings', require('./routes/tenant-settings'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/customer-billing', require('./routes/customer-billing'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/bundles', require('./routes/hardwareBundles'));
app.use('/api/work-orders', require('./routes/work-orders'));
app.use('/api/maintain', require('./routes/maintain'));
app.use('/api/incidents', require('./routes/incidents')); // Incident management
app.use('/api/network', require('./routes/network'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/hss', require('./routes/hss-management'));
app.use('/api/monitoring', require('./routes/monitoring'));
app.use('/api/monitoring/graphs', require('./routes/monitoring-graphs'));
app.use('/api/device-assignment', require('./routes/device-assignment'));

// Agent routes (public - no auth required)
app.use('/api/agent', require('./routes/agent'));

// EPC Check-in routes - MUST be defined BEFORE /api/epc routes (no tenant ID required)
app.use('/api/epc', require('./routes/epc-checkin'));
app.use('/api/epc', require('./routes/epcMetrics'));

// EPC routes with tenant requirement
app.use('/api/epc', require('./routes/epc'));
app.use('/api/epc', require('./routes/epc-commands')); // Remote command management
app.use('/api/epc', require('./routes/epc-logs')); // EPC logs
app.use('/api/epc/snmp', require('./routes/epc-snmp')); // EPC SNMP discovery

// MikroTik routes (optional - graceful failure if node-routeros not installed)
try {
  app.use('/api/mikrotik', require('./routes/mikrotik'));
  console.log('✅ MikroTik routes enabled');
} catch (error) {
  console.warn('⚠️ MikroTik routes disabled:', error.message);
  console.warn('   → Install node-routeros package to enable MikroTik management');
}

app.use('/api/tr069', require('./routes/tr069'));
app.use('/api/snmp', require('./routes/snmp'));
app.use('/api/mme', require('./routes/mme-status')); // MME subscriber status reporting

// NOTE: SNMP polling and Ping monitoring are DISABLED on cloud backend
// These services should ONLY run on remote EPC agents, not on the cloud GCE server.
// The cloud backend cannot reach devices on private IP addresses and should not perform network discovery.

// SNMP polling service - DISABLED (should only run on remote EPC agents)
console.log('⚠️ SNMP polling service DISABLED - cloud backend should not perform SNMP polling');
console.log('   → SNMP polling runs ONLY on remote EPC/SNMP agents');

// Ping monitoring service - DISABLED (should only run on remote EPC agents)
// IMPORTANT: Backend should NEVER run ping or SNMP sweeps - only remote agents do this
console.log('⚠️ Ping monitoring service DISABLED - cloud backend should not perform ping sweeps');
console.log('   → Ping monitoring runs ONLY on remote EPC/SNMP agents');
console.log('   → Backend only receives and stores metrics from remote agents');

// Start ACS Alert Service
try {
  const acsAlertService = require('./services/acs-alert-service');
  acsAlertService.start(60000); // Check every minute
  console.log('✅ ACS Alert Service started');
} catch (error) {
  console.error('❌ Failed to start ACS Alert Service:', error);
}

// EPC management routes (includes delete endpoint)
app.use('/api/epc-management', require('./routes/epc-management'));
app.use('/api/deploy', require('./routes/epc-deployment'));
app.use('/api/deploy', require('./routes/deployment/epc-management')); // EPC deployment management
app.use('/api/remote-agents', require('./routes/remote-agents-status')); // Remote agents status
app.use('/api/system', require('./routes/system'));
app.use('/api/permissions', require('./routes/permissions'));
app.use('/api/mobile', require('./routes/mobile-tasks')); // FCAPS permission management
// Branding API for customer portal
try {
  const registerBrandingRoutes = require('./routes/branding-api');
  registerBrandingRoutes(app);
  console.log('✅ Branding API registered directly on /api/branding routes');
} catch (error) {
  console.error('❌ Failed to load Branding API:', error);
  console.error('   Error stack:', error.stack);
}
app.use('/api/customer-portal', require('./routes/customer-portal-api')); // Customer portal API
app.use('/api/portal', require('./routes/portal-domain')); // Portal domain routing
app.use('/api/portal-content', require('./routes/portal-content')); // Portal content management (alerts, FAQ, KB, chat)
console.log('✅ Portal Content API enabled');
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

// 404 handler for unmatched routes (must be last, after all routes)
app.use('*', (req, res) => {
  console.log('[404 Handler] Unmatched route:', {
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl
  });
  res.status(404).json({ 
    error: 'Route not found',
    method: req.method,
    path: req.path,
    url: req.url
  });
});

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