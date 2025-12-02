/**
 * User Tenant Details API
 * Allows regular users to get details of their assigned tenants
 */

const express = require('express');
const mongoose = require('mongoose');
const { verifyAuth, isPlatformAdminUser } = require('./role-auth-middleware');
const { Tenant } = require('../../models/tenant');
const { UserTenant } = require('./user-schema');

const router = express.Router();

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
    console.log('[tenant-details] userId type:', typeof userId);
    console.log('[tenant-details] userId value:', JSON.stringify(userId));

    // Get all tenant associations for this user
    // First try with status filter
    let userTenants;
    try {
      userTenants = await UserTenant.find({
        userId: userId.trim(),
        status: 'active'
      }).lean();
      console.log('[tenant-details] UserTenant query result (with status filter):', userTenants?.length || 0, 'records');
      
      // If no results with status filter, try without status filter to see all associations
      if (!userTenants || userTenants.length === 0) {
        console.log('[tenant-details] No active records found, checking all records...');
        const allRecords = await UserTenant.find({
          userId: userId.trim()
        }).lean();
        console.log('[tenant-details] Total UserTenant records found (any status):', allRecords?.length || 0);
        if (allRecords && allRecords.length > 0) {
          console.log('[tenant-details] Record statuses:', allRecords.map(r => ({ tenantId: r.tenantId, status: r.status })));
        }
      }
    } catch (queryError) {
      console.error('[tenant-details] Error querying UserTenant:', queryError);
      console.error('[tenant-details] Query error name:', queryError.name);
      console.error('[tenant-details] Query error message:', queryError.message);
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

module.exports = router;
