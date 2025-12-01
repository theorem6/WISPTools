/**
 * User Tenant Details API
 * Returns tenant memberships for users with full tenant details
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyAuth, isPlatformAdminUser } = require('./role-auth-middleware');
const { UserTenant } = require('./user-schema');
const { Tenant } = require('../../models/tenant');

/**
 * GET /api/user-tenants/:userId
 * Get all tenant memberships for a user with full tenant details
 * Used during login to determine which tenants the user has access to
 */
router.get('/:userId', verifyAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Ensure user is authenticated (verifyAuth should set req.user, but check anyway)
    if (!req.user || !req.user.uid) {
      console.error('[tenant-details] req.user not set after verifyAuth middleware');
      return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
    }
    
    // Security: Users can only query their own tenants (unless platform admin)
    const isPlatformAdmin = isPlatformAdminUser(req.user);
    if (!isPlatformAdmin && req.user.uid !== userId) {
      return res.status(403).json({ error: 'Forbidden: Cannot query other users tenants' });
    }
    
    console.log(`[tenant-details] Getting tenants for user: ${userId}`);
    
    // Find all active tenant memberships
    const userTenants = await UserTenant.find({ 
      userId,
      status: 'active'
    }).lean();
    
    if (!userTenants || userTenants.length === 0) {
      console.log(`[tenant-details] No active tenant associations found for user: ${userId}`);
      return res.json([]);
    }
    
    console.log(`[tenant-details] Found ${userTenants.length} tenant associations`);
    
    // Get full tenant details for each association
    const tenantsWithDetails = [];
    for (const ut of userTenants) {
      try {
        if (!ut.tenantId) {
          console.warn(`[tenant-details] UserTenant record missing tenantId:`, ut);
          continue;
        }
        
        // Convert string tenantId to ObjectId
        if (!mongoose.Types.ObjectId.isValid(ut.tenantId)) {
          console.warn(`[tenant-details] Invalid tenantId format: ${ut.tenantId}`);
          continue;
        }
        
        const tenantObjectId = new mongoose.Types.ObjectId(ut.tenantId);
        const tenant = await Tenant.findById(tenantObjectId).lean();
        
        if (tenant) {
          tenantsWithDetails.push({
            ...tenant,
            id: tenant._id ? tenant._id.toString() : tenant.id,
            userRole: ut.role || 'viewer'
          });
        }
      } catch (err) {
        console.error(`[tenant-details] Error fetching tenant ${ut.tenantId}:`, err.message);
        // Continue with other tenants
      }
    }
    
    console.log(`[tenant-details] Returning ${tenantsWithDetails.length} tenants with details`);
    res.json(tenantsWithDetails);
  } catch (error) {
    console.error('[tenant-details] Error getting user tenants:', error);
    console.error('[tenant-details] Error stack:', error.stack);
    console.error('[tenant-details] Error name:', error.name);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to get user tenants', 
        message: error.message || 'Internal server error',
        errorName: error.name
      });
    }
  }
});

module.exports = router;
