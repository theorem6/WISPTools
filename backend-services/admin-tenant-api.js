/**
 * Admin Tenant Management API
 * 
 * Platform admin endpoints for managing tenant owners
 * Only accessible by david@david.com
 */

const express = require('express');
const admin = require('firebase-admin');
const { UserTenant } = require('./user-schema');
const { verifyAuth, isPlatformAdmin } = require('./role-auth-middleware');

const router = express.Router();

// All routes require platform admin
router.use(verifyAuth);
router.use((req, res, next) => {
  if (!isPlatformAdmin(req.user.email)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Platform admin access required'
    });
  }
  next();
});

/**
 * POST /admin/assign-owner
 * Assign or change the owner of a tenant
 */
router.post('/assign-owner', async (req, res) => {
  try {
    const { tenantId, email } = req.body;
    
    if (!tenantId || !email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'tenantId and email are required'
      });
    }
    
    console.log(`[Admin] Assigning owner ${email} to tenant ${tenantId}`);
    
    // Get Firebase user by email
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().getUserByEmail(email);
    } catch (error) {
      return res.status(404).json({
        error: 'User Not Found',
        message: `No Firebase user found with email: ${email}`
      });
    }
    
    const userId = firebaseUser.uid;
    
    // Check if user already has a record for this tenant
    let userTenant = await UserTenant.findOne({ userId, tenantId });
    
    if (userTenant) {
      // Update existing record to owner
      const oldRole = userTenant.role;
      userTenant.role = 'owner';
      userTenant.status = 'active';
      await userTenant.save();
      
      console.log(`✅ Updated ${email} from ${oldRole} to owner in tenant ${tenantId}`);
      
      return res.json({
        success: true,
        message: `Updated ${email} from ${oldRole} to owner`,
        userId,
        previousRole: oldRole,
        newRole: 'owner'
      });
    } else {
      // Create new owner record
      userTenant = new UserTenant({
        userId,
        tenantId,
        role: 'owner',
        status: 'active',
        invitedBy: req.user.uid,
        invitedAt: new Date(),
        acceptedAt: new Date(),
        addedAt: new Date()
      });
      
      await userTenant.save();
      
      console.log(`✅ Created owner record for ${email} in tenant ${tenantId}`);
      
      return res.json({
        success: true,
        message: `Assigned ${email} as owner`,
        userId,
        newRole: 'owner'
      });
    }
  } catch (error) {
    console.error('Error assigning owner:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * DELETE /admin/remove-owner/:tenantId/:userId
 * Remove a user from a tenant (including owners)
 */
router.delete('/remove-owner/:tenantId/:userId', async (req, res) => {
  try {
    const { tenantId, userId } = req.params;
    
    const result = await UserTenant.deleteOne({ userId, tenantId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User-tenant relationship not found'
      });
    }
    
    console.log(`✅ Removed user ${userId} from tenant ${tenantId}`);
    
    res.json({
      success: true,
      message: 'User removed from tenant'
    });
  } catch (error) {
    console.error('Error removing owner:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * GET /admin/tenant/:tenantId/users
 * Get all users in a tenant (for admin view)
 */
router.get('/tenant/:tenantId/users', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const userTenants = await UserTenant.find({ tenantId }).lean();
    
    // Get Firebase user details
    const users = [];
    for (const ut of userTenants) {
      try {
        const firebaseUser = await admin.auth().getUser(ut.userId);
        users.push({
          uid: ut.userId,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || '',
          role: ut.role,
          status: ut.status,
          addedAt: ut.addedAt
        });
      } catch (error) {
        console.error(`Failed to get user ${ut.userId}:`, error);
      }
    }
    
    res.json(users);
  } catch (error) {
    console.error('Error getting tenant users:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;

