/**
 * Route Configuration
 * Centralized route registration and organization
 */

const express = require('express');

/**
 * Register all API routes
 * @param {Express} app - Express application instance
 */
function registerRoutes(app) {
  // Health check route
  app.get('/health', (req, res) => {
    const { getConnectionStatus } = require('../config/database');
    const status = getConnectionStatus();
    
    res.json({
      status: 'healthy',
      service: 'user-management-system',
      port: process.env.PORT || 3000,
      timestamp: new Date().toISOString(),
      mongodb: status.isConnected ? 'connected' : 'disconnected',
      note: 'User Management System API - Port 3000'
    });
  });
  
  // API Routes
  const apiRouter = express.Router();
  
  // Authentication routes
  apiRouter.use('/auth', require('../routes/auth'));
  
  // User management routes
  apiRouter.use('/users', require('../routes/users'));
  apiRouter.use('/user-tenants', require('../routes/users/tenant-details'));
  apiRouter.use('/tenants', require('../routes/users/tenants'));
  
  // Business logic routes
  apiRouter.use('/work-orders', require('../routes/work-orders'));
  apiRouter.use('/customers', require('../routes/customers'));
  apiRouter.use('/inventory', require('../routes/inventory'));
  apiRouter.use('/network', require('../routes/network'));
  apiRouter.use('/monitoring', require('../routes/monitoring'));
  apiRouter.use('/epc', require('../routes/epc'));
  
  // System management routes
  apiRouter.use('/system', require('../routes/system'));
  
  // Mount API router
  app.use('/api', apiRouter);
  
  // Admin routes
  const adminRouter = express.Router();
  adminRouter.use('/tenants', require('../routes/admin/tenants'));
  adminRouter.use('/', require('../routes/admin/general'));
  
  app.use('/admin', adminRouter);
  
  // Setup routes
  app.use('/setup-admin', require('../routes/setup'));
  
  console.log('✅ All routes registered successfully');
}

/**
 * Get route information for documentation
 * @returns {Array} Array of route information objects
 */
function getRouteInfo() {
  return [
    {
      method: 'GET',
      path: '/health',
      description: 'Health check endpoint',
      auth: false
    },
    {
      method: 'GET',
      path: '/api/auth/*',
      description: 'Authentication endpoints',
      auth: false
    },
    {
      method: 'GET',
      path: '/api/users/*',
      description: 'User management endpoints',
      auth: true
    },
    {
      method: 'GET',
      path: '/api/tenants/*',
      description: 'Tenant management endpoints',
      auth: true
    },
    {
      method: 'GET',
      path: '/api/work-orders/*',
      description: 'Work order management endpoints',
      auth: true
    },
    {
      method: 'GET',
      path: '/api/inventory/*',
      description: 'Inventory management endpoints',
      auth: true
    },
    {
      method: 'GET',
      path: '/api/monitoring/*',
      description: 'System monitoring endpoints',
      auth: true
    },
    {
      method: 'GET',
      path: '/admin/tenants/*',
      description: 'Admin tenant management endpoints',
      auth: true,
      admin: true
    },
    {
      method: 'GET',
      path: '/setup-admin/*',
      description: 'Admin setup endpoints',
      auth: false
    }
  ];
}

module.exports = {
  registerRoutes,
  getRouteInfo
};
