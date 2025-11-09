/**
 * User-Tenant API
 * Returns tenant memberships for users
 */

const express = require('express');
const router = express.Router();
const { verifyAuth, isPlatformAdminUser } = require('./role-auth-middleware');
const { UserTenant } = require('./user-schema');

/**
 * GET /api/user-tenants/:userId
 * Get all tenant memberships for a user
 * Used during login to determine which tenants the user has access to
 */
router.get('/:userId', verifyAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Security: Users can only query their own tenants (unless platform admin)
    const isPlatformAdmin = isPlatformAdminUser(req.user);
    if (!isPlatformAdmin && req.user.uid !== userId) {
      return res.status(403).json({ error: 'Forbidden: Cannot query other users tenants' });
    }
    
    console.log(`[UserTenantAPI] Getting tenants for user: ${userId}`);
    
    // Find all tenant memberships
    const userTenants = await UserTenant.find({ userId }).lean();
    
    console.log(`[UserTenantAPI] Found ${userTenants.length} tenant memberships`);
    
    res.json(userTenants);
  } catch (error) {
    console.error('[UserTenantAPI] Error getting user tenants:', error);
    res.status(500).json({ error: 'Failed to get user tenants' });
  }
});

module.exports = router;

