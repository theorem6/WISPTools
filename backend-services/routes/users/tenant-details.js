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
    const { userId } = req.params;
    const requestingUserId = req.user?.uid;
    
    // Security: Users can only query their own tenants (unless platform admin)
    if (!isPlatformAdminUser(req.user) && userId !== requestingUserId) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Cannot query other users tenants' 
      });
    }
    
    console.log(`[tenant-details] Getting tenants for user: ${userId}`);
    
    // Find all active tenant memberships for this user
    const userTenants = await UserTenant.find({ 
      userId,
      status: 'active'
    }).lean();
    
    if (!userTenants || userTenants.length === 0) {
      console.log(`[tenant-details] No active tenant associations found for user: ${userId}`);
      return res.json([]);
    }
    
    console.log(`[tenant-details] Found ${userTenants.length} tenant associations for user: ${userId}`);
    
    // Get full tenant details for each association
    const tenants = [];
    for (const ut of userTenants) {
      try {
        if (!ut.tenantId) {
          console.warn(`[tenant-details] UserTenant record missing tenantId:`, ut);
          continue;
        }
        
        // Convert string tenantId to ObjectId if valid
        if (!mongoose.Types.ObjectId.isValid(ut.tenantId)) {
          console.warn(`[tenant-details] Invalid tenantId format: ${ut.tenantId}`);
          continue;
        }
        
        const tenantObjectId = new mongoose.Types.ObjectId(ut.tenantId);
        const tenant = await Tenant.findById(tenantObjectId).lean();
        
        if (tenant) {
          tenants.push({
            ...tenant,
            id: tenant._id ? tenant._id.toString() : tenant.id,
            userRole: ut.role || 'viewer'
          });
        } else {
          console.warn(`[tenant-details] Tenant not found for tenantId: ${ut.tenantId}`);
        }
      } catch (error) {
        console.error(`[tenant-details] Error fetching tenant ${ut.tenantId}:`, error.message);
        // Continue with other tenants even if one fails
        continue;
      }
    }
    
    console.log(`[tenant-details] Returning ${tenants.length} tenants for user: ${userId}`);
    res.json(tenants);
    
  } catch (error) {
    console.error('[tenant-details] Error getting user tenants:', error);
    console.error('[tenant-details] Error stack:', error.stack);
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message || 'Failed to get user tenants'
      });
    }
  }
});

module.exports = router;
