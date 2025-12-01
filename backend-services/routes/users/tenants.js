/**
 * User-Tenant API
 * Returns tenant memberships for users
 */

const express = require('express');
const router = express.Router();

// Safely import mongoose and models
let mongoose;
let UserTenant;
let verifyAuth;
let isPlatformAdminUser;

try {
  mongoose = require('mongoose');
} catch (error) {
  console.error('[UserTenantAPI] Failed to require mongoose:', error);
}

try {
  const authMiddleware = require('./role-auth-middleware');
  verifyAuth = authMiddleware.verifyAuth;
  isPlatformAdminUser = authMiddleware.isPlatformAdminUser;
} catch (error) {
  console.error('[UserTenantAPI] Failed to require auth middleware:', error);
}

try {
  const userModel = require('../../models/user');
  UserTenant = userModel.UserTenant;
} catch (error) {
  console.error('[UserTenantAPI] Failed to require UserTenant model:', error);
}

// Test endpoint to verify route loads
router.get('/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'tenants.js route loaded successfully',
    mongooseAvailable: !!mongoose,
    mongooseReadyState: mongoose ? mongoose.connection.readyState : 'N/A',
    mongooseConnectionName: mongoose ? mongoose.connection.name : 'N/A',
    userTenantAvailable: !!UserTenant,
    verifyAuthAvailable: !!verifyAuth
  });
});

/**
 * GET /api/user-tenants/:userId
 * Get all tenant memberships for a user
 * Used during login to determine which tenants the user has access to
 */
if (verifyAuth && UserTenant) {
  router.get('/:userId', verifyAuth, async (req, res) => {
    try {
      console.log('[UserTenantAPI] Route handler called:', {
        userId: req.params.userId,
        hasUser: !!req.user,
        userUid: req.user?.uid,
        mongooseReadyState: mongoose ? mongoose.connection.readyState : 'N/A',
        mongooseConnectionName: mongoose ? mongoose.connection.name : 'N/A'
      });
      
      const { userId } = req.params;
      
      // Ensure user is authenticated
      if (!req.user || !req.user.uid) {
        console.error('[UserTenantAPI] req.user not set after verifyAuth middleware');
        return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      }
      
      // Check MongoDB connection
      if (!mongoose || mongoose.connection.readyState !== 1) {
        const stateNames = {
          0: 'disconnected',
          1: 'connected',
          2: 'connecting',
          3: 'disconnecting'
        };
        const state = mongoose ? mongoose.connection.readyState : 'mongoose-not-loaded';
        console.error('[UserTenantAPI] MongoDB not connected. ReadyState:', state);
        return res.status(503).json({ 
          error: 'Service unavailable', 
          message: `Database connection not established (state: ${stateNames[state] || state})`,
          readyState: state
        });
      }
      
      // Security: Users can only query their own tenants (unless platform admin)
      if (isPlatformAdminUser) {
        const isPlatformAdmin = isPlatformAdminUser(req.user);
        if (!isPlatformAdmin && req.user.uid !== userId) {
          return res.status(403).json({ error: 'Forbidden: Cannot query other users tenants' });
        }
      }
      
      console.log(`[UserTenantAPI] Getting tenants for user: ${userId}`);
      
      // Validate UserTenant model
      if (!UserTenant) {
        console.error('[UserTenantAPI] UserTenant model is not available');
        return res.status(500).json({ error: 'Service configuration error', message: 'UserTenant model not available' });
      }
      
      // Find all tenant memberships
      console.log('[UserTenantAPI] Querying MongoDB for UserTenant records with userId:', userId);
      const userTenants = await UserTenant.find({ userId }).lean();
      
      console.log(`[UserTenantAPI] Found ${userTenants.length} tenant memberships for user ${userId}`);
      
      res.json(userTenants);
    } catch (error) {
      console.error('[UserTenantAPI] Error getting user tenants:', error);
      console.error('[UserTenantAPI] Error name:', error.name);
      console.error('[UserTenantAPI] Error message:', error.message);
      console.error('[UserTenantAPI] Error stack:', error.stack);
      console.error('[UserTenantAPI] MongoDB connection state:', mongoose ? mongoose.connection.readyState : 'N/A');
      res.status(500).json({ 
        error: 'Failed to get user tenants', 
        message: error.message || 'Internal server error',
        errorName: error.name,
        mongooseReadyState: mongoose ? mongoose.connection.readyState : 'N/A'
      });
    }
  });
} else {
  // Route handler that shows configuration error
  router.get('/:userId', (req, res) => {
    res.status(500).json({
      error: 'Route configuration error',
      message: 'Required dependencies not loaded',
      verifyAuthAvailable: !!verifyAuth,
      userTenantAvailable: !!UserTenant,
      mongooseAvailable: !!mongoose
    });
  });
}

module.exports = router;
