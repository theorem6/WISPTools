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

// Body parser with error handling
app.use(express.json({ limit: appConfig.limits.jsonBodySize, strict: false }));
app.use(express.urlencoded({ extended: true, limit: appConfig.limits.urlEncodedBodySize }));

// Log body parser errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('[Body Parser Error]', err.message);
    console.error('[Body Parser Error] Request:', req.method, req.path);
    return res.status(400).json({ error: 'Invalid JSON in request body', details: err.message });
  }
  next(err);
});

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

// EPC Check-in endpoints - MUST be defined BEFORE /api/epc routes (no tenant ID required)
const { RemoteEPC: RemoteEPCCheckin, EPCCommand, EPCServiceStatus, EPCAlert } = require('./models/distributed-epc-schema');

app.post('/api/epc/checkin', async (req, res) => {
  try {
    const { device_code, hardware_id, ip_address, services, system, network, versions } = req.body;
    
    if (!device_code) {
      return res.status(400).json({ error: 'device_code is required' });
    }
    
    console.log(`[EPC Check-in] Device ${device_code} checking in from ${ip_address}`);
    
    const epc = await RemoteEPCCheckin.findOne({ device_code: device_code.toUpperCase() });
    
    if (!epc) {
      return res.status(202).json({
        status: 'unregistered',
        message: `Device ${device_code} is not registered. Enter this code in the management portal.`,
        device_code: device_code.toUpperCase()
      });
    }
    
    await RemoteEPCCheckin.updateOne(
      { epc_id: epc.epc_id },
      {
        status: 'online',
        last_seen: new Date(),
        last_heartbeat: new Date(),
        ip_address,
        hardware_id: hardware_id || epc.hardware_id,
        'version.os': versions?.os,
        'version.open5gs': versions?.open5gs
      }
    );
    
    if (services) {
      await new EPCServiceStatus({
        epc_id: epc.epc_id,
        tenant_id: epc.tenant_id,
        services, system, network, versions
      }).save();
      
      const REQUIRED_SERVICES = ['open5gs-mmed', 'open5gs-sgwcd', 'open5gs-sgwud', 'open5gs-smfd', 'open5gs-upfd', 'snmpd'];
      for (const svc of REQUIRED_SERVICES) {
        const status = services[svc]?.status;
        if (status && status !== 'active' && status !== 'not-found') {
          const existingAlert = await EPCAlert.findOne({
            epc_id: epc.epc_id, alert_type: 'component_down', resolved: false, 'details.service': svc
          });
          if (!existingAlert) {
            await new EPCAlert({
              tenant_id: epc.tenant_id, epc_id: epc.epc_id,
              severity: svc.includes('mme') || svc.includes('upf') ? 'critical' : 'error',
              alert_type: 'component_down',
              message: `Service ${svc} is ${status} on ${epc.site_name}`,
              details: { service: svc, status }
            }).save();
          }
        } else if (status === 'active') {
          await EPCAlert.updateMany(
            { epc_id: epc.epc_id, alert_type: 'component_down', 'details.service': svc, resolved: false },
            { resolved: true, resolved_at: new Date(), resolved_by: 'auto' }
          );
        }
      }
    }
    
    const commands = await EPCCommand.find({
      epc_id: epc.epc_id, status: 'pending', expires_at: { $gt: new Date() }
    }).sort({ priority: 1, created_at: 1 }).lean();
    
    if (commands.length > 0) {
      await EPCCommand.updateMany(
        { _id: { $in: commands.map(c => c._id) } },
        { status: 'sent', sent_at: new Date() }
      );
    }
    
    res.json({
      status: 'ok',
      epc_id: epc.epc_id,
      site_name: epc.site_name,
      checkin_interval: epc.metrics_config?.update_interval_seconds || 60,
      commands: commands.map(c => ({
        id: c._id.toString(), type: c.command_type, action: c.action,
        target_services: c.target_services, script_content: c.script_content,
        script_url: c.script_url, config_data: c.config_data
      })),
      config: { central_hss: 'hss.wisptools.io', hss_port: 3868, snmp_enabled: epc.snmp_config?.enabled !== false }
    });
  } catch (error) {
    console.error('[EPC Check-in] Error:', error);
    res.status(500).json({ error: 'Check-in failed', message: error.message });
  }
});

app.post('/api/epc/checkin/commands/:command_id/result', async (req, res) => {
  try {
    const { command_id } = req.params;
    const { success, output, error, exit_code } = req.body;
    const command = await EPCCommand.findByIdAndUpdate(command_id,
      { status: success ? 'completed' : 'failed', completed_at: new Date(), result: { success, output, error, exit_code } },
      { new: true }
    );
    if (!command) return res.status(404).json({ error: 'Command not found' });
    console.log(`[EPC Command] Command ${command_id} completed: ${success ? 'SUCCESS' : 'FAILED'}`);
    res.json({ success: true, message: 'Command result recorded' });
  } catch (error) {
    console.error('[EPC Command Result] Error:', error);
    res.status(500).json({ error: 'Failed to record result', message: error.message });
  }
});

// EPC routes with tenant requirement
app.use('/api/epc', require('./routes/epc'));
app.use('/api/epc', require('./routes/epc-commands')); // Remote command management
app.use('/api/mikrotik', require('./routes/mikrotik'));
app.use('/api/snmp', require('./routes/snmp'));
// EPC delete route using POST (workaround for DELETE routing issues)
const { RemoteEPC: RemoteEPCModel } = require('./models/distributed-epc-schema');
const { InventoryItem: InventoryItemModel } = require('./models/inventory');
app.post('/api/epc-management/delete', async (req, res) => {
  try {
    console.log('[Delete EPC] Request body:', req.body);
    console.log('[Delete EPC] Request body type:', typeof req.body);
    const { epc_id } = req.body || {};
    const tenant_id = req.headers['x-tenant-id'] || 'unknown';
    
    if (!epc_id) {
      return res.status(400).json({ error: 'epc_id is required in body', received: req.body });
    }
    
    console.log(`[Delete EPC] Deleting EPC ${epc_id} for tenant ${tenant_id}`);
    
    // Try to find by epc_id first (string match)
    let epc = await RemoteEPCModel.findOneAndDelete({
      epc_id: epc_id,
      tenant_id: tenant_id
    });
    
    // If not found and epc_id looks like a valid ObjectId, try matching by _id
    if (!epc && /^[a-f\d]{24}$/i.test(epc_id)) {
      epc = await RemoteEPCModel.findOneAndDelete({
        _id: epc_id,
        tenant_id: tenant_id
      });
    }
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    await InventoryItemModel.deleteMany({
      $or: [
        { 'epcConfig.epc_id': epc_id },
        { 'epcConfig.device_code': epc.device_code },
        { serialNumber: epc_id }
      ],
      tenantId: tenant_id
    });
    
    console.log(`[Delete EPC] Successfully deleted EPC ${epc_id} (${epc.site_name})`);
    
    res.json({
      success: true,
      message: `EPC "${epc.site_name || epc_id}" deleted successfully`,
      deleted_epc_id: epc_id
    });
  } catch (error) {
    console.error('[Delete EPC] Error:', error);
    res.status(500).json({ error: 'Failed to delete EPC', message: error.message });
  }
});
app.use('/api/deploy', require('./routes/epc-deployment'));
app.use('/api/system', require('./routes/system'));
app.use('/api/permissions', require('./routes/permissions')); // FCAPS permission management
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