/**
 * User Tenant Details API
 * Allows regular users to get details of their assigned tenants
 */

const express = require('express');
const mongoose = require('mongoose');

// Wrap imports in try-catch to handle module load errors
let verifyAuth, isPlatformAdminUser, Tenant, UserTenant;

try {
  const roleAuthMiddleware = require('./role-auth-middleware');
  verifyAuth = roleAuthMiddleware.verifyAuth;
  isPlatformAdminUser = roleAuthMiddleware.isPlatformAdminUser;
} catch (err) {
  console.error('[tenant-details] Error loading role-auth-middleware:', err);
  throw err;
}

try {
  const tenantModel = require('../../models/tenant');
  Tenant = tenantModel.Tenant;
} catch (err) {
  console.error('[tenant-details] Error loading Tenant model:', err);
  throw err;
}

try {
  const userModel = require('../../models/user');
  UserTenant = userModel.UserTenant;
} catch (err) {
  console.error('[tenant-details] Error loading UserTenant model:', err);
  throw err;
}

const router = express.Router();

// Test endpoint to verify route file is loaded
router.get('/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'user-tenants route file loaded successfully',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/user-tenants/:userId
 * Get all tenants assigned to a user
 */
router.get('/:userId', verifyAuth, async (req, res) => {
  try {
    console.log('[tenant-details] GET /api/user-tenants/:userId called:', {
      userId: req.params.userId,
      requestingUserId: req.user?.uid,
      userEmail: req.user?.email,
      headers: Object.keys(req.headers).filter(h => h.toLowerCase().includes('auth'))
    });
    
    // Check if mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      console.error('[tenant-details] MongoDB not connected. ReadyState:', mongoose.connection.readyState);
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database connection not ready'
      });
    }
    
    // Check if UserTenant model is available
    if (!UserTenant) {
      console.error('[tenant-details] UserTenant model not available');
      console.error('[tenant-details] UserTenant import:', typeof UserTenant);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'UserTenant model not initialized'
      });
    }
    
    // Check if Tenant model is available
    if (!Tenant) {
      console.error('[tenant-details] Tenant model not available');
      console.error('[tenant-details] Tenant import:', typeof Tenant);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Tenant model not initialized'
      });
    }
    
    // Verify models are functions (Mongoose models)
    if (typeof UserTenant.find !== 'function') {
      console.error('[tenant-details] UserTenant is not a valid Mongoose model');
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'UserTenant model is not properly initialized'
      });
    }
    
    if (typeof Tenant.findById !== 'function') {
      console.error('[tenant-details] Tenant is not a valid Mongoose model');
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Tenant model is not properly initialized'
      });
    }
    
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId is required'
      });
    }
    
    const requestingUserId = req.user?.uid;
    
    if (!requestingUserId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }
    
    // Users can only query their own tenants (unless they're platform admin)
    if (userId !== requestingUserId && !isPlatformAdminUser(req.user)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only view your own tenants'
      });
    }
    
    console.log('[tenant-details] Querying UserTenant for userId:', userId);
    
    // Get all tenant associations for this user
    let userTenants;
    try {
      userTenants = await UserTenant.find({ 
        userId,
        status: 'active'
      }).lean();
      console.log('[tenant-details] UserTenant query result:', userTenants?.length || 0, 'records');
    } catch (queryError) {
      console.error('[tenant-details] Error querying UserTenant:', queryError);
      console.error('[tenant-details] Query error stack:', queryError.stack);
      throw queryError;
    }
    
    if (!userTenants || userTenants.length === 0) {
      console.log(`[tenant-details] No active tenant associations found for user: ${userId}`);
      return res.json([]);
    }
    
    console.log(`[tenant-details] Found ${userTenants.length} active tenant associations for user: ${userId}`);
    
    // Get full tenant details for each association
    const tenants = [];
    for (const ut of userTenants) {
      try {
        if (!ut.tenantId) {
          console.warn(`[tenant-details] UserTenant record missing tenantId:`, ut);
          continue;
        }
        
        // tenantId is stored as String in UserTenant, but Tenant._id is ObjectId
        // Convert string tenantId to ObjectId if valid
        let tenant;
        try {
          if (mongoose.Types.ObjectId.isValid(ut.tenantId)) {
            // Convert string to ObjectId for query
            const tenantObjectId = new mongoose.Types.ObjectId(ut.tenantId);
            tenant = await Tenant.findById(tenantObjectId).lean();
          } else {
            console.warn(`[tenant-details] Invalid tenantId format: ${ut.tenantId}`);
            continue;
          }
          
          if (tenant) {
            tenants.push({
              ...tenant,
              id: tenant._id ? tenant._id.toString() : tenant.id,
              userRole: ut.role || 'viewer'
            });
          } else {
            console.warn(`[tenant-details] Tenant not found for tenantId: ${ut.tenantId}`);
          }
        } catch (idError) {
          console.error(`[tenant-details] Error converting tenantId to ObjectId: ${ut.tenantId}`, idError.message);
          continue;
        }
      } catch (tenantError) {
        console.error(`[tenant-details] Error fetching tenant ${ut.tenantId}:`, tenantError.message);
        console.error(`[tenant-details] Error stack:`, tenantError.stack);
        // Continue with other tenants even if one fails
        continue;
      }
    }
    
    console.log(`[tenant-details] Returning ${tenants.length} tenants for user: ${userId}`);
    res.json(tenants);
    
  } catch (error) {
    console.error('[tenant-details] Error getting user tenants:', error);
    console.error('[tenant-details] Error name:', error.name);
    console.error('[tenant-details] Error message:', error.message);
    console.error('[tenant-details] Error stack:', error.stack);
    console.error('[tenant-details] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // Ensure response hasn't been sent
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message || 'Failed to get user tenants',
        errorName: error.name,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
});

/**
 * GET /api/tenants/:tenantId
 * Get tenant details (only if user is assigned to this tenant)
 */
router.get('/tenant/:tenantId', verifyAuth, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const userId = req.user.uid;
    
    // Check if user is assigned to this tenant
    const userTenant = await UserTenant.findOne({ 
      userId, 
      tenantId,
      status: 'active'
    });
    
    if (!userTenant) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not assigned to this tenant'
      });
    }
    
    // Get tenant details - tenantId may be string, convert to ObjectId
    let tenant;
    if (mongoose.Types.ObjectId.isValid(tenantId)) {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      tenant = await Tenant.findById(tenantObjectId).lean();
    } else {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid tenantId format'
      });
    }
    
    if (!tenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tenant not found'
      });
    }
    
    // Return tenant with user's role
    res.json({
      ...tenant,
      id: tenant._id.toString(),
      userRole: userTenant.role
    });
    
  } catch (error) {
    console.error('Error getting tenant:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Add error handler middleware for unhandled errors
router.use((err, req, res, next) => {
  console.error('[tenant-details] Unhandled error in router:', err);
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

module.exports = router;
