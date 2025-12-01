/**
 * User-Tenant API
 * Returns tenant memberships for users
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyAuth, isPlatformAdminUser } = require('./role-auth-middleware');
const { UserTenant } = require('./user-schema');

// Test endpoint to verify route loads
router.get('/test', (req, res) => {
  res.json({ status: 'ok', message: 'tenants.js route loaded successfully' });
});

/**
 * GET /api/user-tenants/:userId
 * Get all tenant memberships for a user
 * Used during login to determine which tenants the user has access to
 */
router.get('/:userId', verifyAuth, async (req, res) => {
  try {
    console.log('[UserTenantAPI] Route handler called:', {
      userId: req.params.userId,
      hasUser: !!req.user,
      userUid: req.user?.uid,
      mongooseReadyState: mongoose.connection.readyState, // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
      mongooseConnectionName: mongoose.connection.name
    });
    
    const { userId } = req.params;
    
    // Ensure user is authenticated
    if (!req.user || !req.user.uid) {
      console.error('[UserTenantAPI] req.user not set after verifyAuth middleware');
      return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
    }
    
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error('[UserTenantAPI] MongoDB not connected. ReadyState:', mongoose.connection.readyState);
      return res.status(503).json({ 
        error: 'Service unavailable', 
        message: 'Database connection not established',
        readyState: mongoose.connection.readyState
      });
    }
    
    // Security: Users can only query their own tenants (unless platform admin)
    const isPlatformAdmin = isPlatformAdminUser(req.user);
    if (!isPlatformAdmin && req.user.uid !== userId) {
      return res.status(403).json({ error: 'Forbidden: Cannot query other users tenants' });
    }
    
    console.log(`[UserTenantAPI] Getting tenants for user: ${userId}`);
    
    // Validate UserTenant model
    if (!UserTenant) {
      console.error('[UserTenantAPI] UserTenant model is not available');
      return res.status(500).json({ error: 'Service configuration error', message: 'UserTenant model not available' });
    }
    
    // Find all tenant memberships
    console.log('[UserTenantAPI] Querying MongoDB for UserTenant records...');
    const userTenants = await UserTenant.find({ userId }).lean();
    
    console.log(`[UserTenantAPI] Found ${userTenants.length} tenant memberships`);
    
    res.json(userTenants);
  } catch (error) {
    console.error('[UserTenantAPI] Error getting user tenants:', error);
    console.error('[UserTenantAPI] Error name:', error.name);
    console.error('[UserTenantAPI] Error message:', error.message);
    console.error('[UserTenantAPI] Error stack:', error.stack);
    console.error('[UserTenantAPI] MongoDB connection state:', mongoose.connection.readyState);
    res.status(500).json({ 
      error: 'Failed to get user tenants', 
      message: error.message || 'Internal server error',
      errorName: error.name,
      mongooseReadyState: mongoose.connection.readyState
    });
  }
});

module.exports = router;
