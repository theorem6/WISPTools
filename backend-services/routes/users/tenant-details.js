/**
 * User Tenant Details API
 * Returns tenant memberships for users with full tenant details
 */

const express = require('express');
const router = express.Router();
const { verifyAuth, isPlatformAdminUser } = require('./role-auth-middleware');
const { UserTenant } = require('./user-schema');

/**
 * GET /api/user-tenants/:userId
 * Get all tenant memberships for a user with full tenant details
 */
router.get('/:userId', verifyAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`[tenant-details] Getting tenants for user: ${userId}`);
    console.log(`[tenant-details] req.user:`, req.user ? { uid: req.user.uid, email: req.user.email } : 'null');
    
    // Security: Users can only query their own tenants (unless platform admin)
    if (req.user && req.user.uid) {
      const isPlatformAdmin = isPlatformAdminUser(req.user);
      if (!isPlatformAdmin && req.user.uid !== userId) {
        console.log(`[tenant-details] Forbidden: User ${req.user.uid} cannot query ${userId}`);
        return res.status(403).json({ error: 'Forbidden: Cannot query other users tenants' });
      }
    }
    
    console.log(`[tenant-details] Querying UserTenant.find({ userId: '${userId}' })`);
    
    // Find all tenant memberships
    const userTenants = await UserTenant.find({ userId }).lean();
    
    console.log(`[tenant-details] Query returned ${userTenants ? userTenants.length : 'null'} results`);
    
    if (!userTenants || userTenants.length === 0) {
      console.log(`[tenant-details] No tenant associations found for user: ${userId}`);
      return res.json([]);
    }
    
    console.log(`[tenant-details] Found ${userTenants.length} tenant associations`);
    
    // Return UserTenant records with tenantId mapped to id for frontend compatibility
    const formattedTenants = userTenants.map(ut => ({
      id: ut.tenantId,
      tenantId: ut.tenantId,
      userId: ut.userId,
      role: ut.role || 'viewer',
      userRole: ut.role || 'viewer',
      status: ut.status || 'active',
      createdAt: ut.createdAt || ut.addedAt || new Date(),
      updatedAt: ut.updatedAt || new Date()
    }));
    
    console.log(`[tenant-details] Returning ${formattedTenants.length} formatted tenants`);
    res.json(formattedTenants);
  } catch (error) {
    console.error('[tenant-details] Error getting user tenants:', error);
    console.error('[tenant-details] Error name:', error.name);
    console.error('[tenant-details] Error message:', error.message);
    console.error('[tenant-details] Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to get user tenants', 
      message: error.message || 'Internal server error'
    });
  }
});

module.exports = router;
