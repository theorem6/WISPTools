/**
 * User Management API (MongoDB Version)
 * 
 * Uses:
 * - Firebase Auth for user authentication (login/tokens)
 * - MongoDB Atlas for user-tenant relationships and roles
 * 
 * This keeps user management consistent with other modules (inventory, work orders, etc.)
 */

const express = require('express');
const admin = require('firebase-admin');
const { UserTenant } = require('./user-schema');
const { 
  verifyAuth, 
  extractTenantId, 
  requireRole,
  VALID_ROLES 
} = require('./role-auth-middleware');

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const router = express.Router();

// All routes require authentication and tenant context
router.use(verifyAuth);
router.use(extractTenantId);

// Most routes require admin privileges
const requireAdmin = requireRole(['owner', 'admin']);

// ============================================================================
// ENDPOINTS
// ============================================================================

/**
 * GET /api/users/tenant/:tenantId
 * List all users in a tenant
 */
router.get('/tenant/:tenantId', requireAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Query UserTenant from MongoDB
    const userTenants = await UserTenant.find({ tenantId }).lean();
    
    if (!userTenants || userTenants.length === 0) {
      return res.json([]);
    }
    
    // Get Firebase Auth info for each user
    const users = [];
    for (const userTenant of userTenants) {
      try {
        const userRecord = await admin.auth().getUser(userTenant.userId);
        
        users.push({
          uid: userTenant.userId,
          email: userRecord.email || '',
          displayName: userRecord.displayName || userRecord.email || '',
          photoURL: userRecord.photoURL || '',
          phoneNumber: userRecord.phoneNumber || '',
          role: userTenant.role,
          status: userTenant.status,
          invitedBy: userTenant.invitedBy || '',
          invitedAt: userTenant.invitedAt || null,
          acceptedAt: userTenant.acceptedAt || null,
          addedAt: userTenant.addedAt,
          lastAccessAt: userTenant.lastAccessAt || null,
          lastLoginAt: userRecord.metadata?.lastSignInTime || null,
          moduleAccess: userTenant.moduleAccess || null
        });
      } catch (authError) {
        console.log(`Skipping user ${userTenant.userId}: not in Firebase Auth`);
      }
    }
    
    res.json(users);
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Failed to list users', message: error.message });
  }
});

/**
 * POST /api/users/invite
 * Invite user to tenant (creates UserTenant record)
 */
router.post('/invite', requireAdmin, async (req, res) => {
  try {
    const { email, role, tenantId } = req.body;
    
    if (!email || !role || !tenantId) {
      return res.status(400).json({ error: 'Email, role, and tenantId required' });
    }
    
    if (!VALID_ROLES.includes(role) || role === 'platform_admin') {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Check if user exists in Firebase Auth
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return res.status(404).json({ 
          error: 'User not found',
          message: 'User must login to the platform first before being invited to a tenant'
        });
      }
      throw error;
    }
    
    // Check if already in tenant
    const existing = await UserTenant.findOne({ 
      userId: userRecord.uid, 
      tenantId 
    });
    
    if (existing) {
      return res.status(409).json({ error: 'User already in tenant' });
    }
    
    // Create UserTenant record
    const userTenant = new UserTenant({
      userId: userRecord.uid,
      tenantId,
      role,
      status: 'active',
      invitedBy: req.user.uid,
      invitedAt: new Date(),
      acceptedAt: new Date(),
      addedAt: new Date()
    });
    
    await userTenant.save();
    
    res.status(201).json({
      message: 'User added to tenant',
      userId: userRecord.uid,
      email,
      role
    });
  } catch (error) {
    console.error('Error inviting user:', error);
    res.status(500).json({ error: 'Failed to invite user', message: error.message });
  }
});

/**
 * PUT /api/users/:userId/role
 * Update user role
 */
router.put('/:userId/role', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, tenantId } = req.body;
    
    if (!role || !VALID_ROLES.includes(role) || role === 'platform_admin') {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const userTenant = await UserTenant.findOne({ userId, tenantId });
    
    if (!userTenant) {
      return res.status(404).json({ error: 'User not found in tenant' });
    }
    
    if (userTenant.role === 'owner') {
      return res.status(403).json({ error: 'Cannot change owner role' });
    }
    
    userTenant.role = role;
    userTenant.updatedAt = new Date();
    userTenant.updatedBy = req.user.uid;
    await userTenant.save();
    
    res.json({ message: 'Role updated', userId, role });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Failed to update role', message: error.message });
  }
});

/**
 * POST /api/users/:userId/suspend
 * Suspend user
 */
router.post('/:userId/suspend', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { tenantId } = req.body;
    
    const userTenant = await UserTenant.findOne({ userId, tenantId });
    
    if (!userTenant) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (userTenant.role === 'owner') {
      return res.status(403).json({ error: 'Cannot suspend owner' });
    }
    
    userTenant.status = 'suspended';
    userTenant.suspendedAt = new Date();
    userTenant.suspendedBy = req.user.uid;
    await userTenant.save();
    
    res.json({ message: 'User suspended', userId });
  } catch (error) {
    console.error('Error suspending user:', error);
    res.status(500).json({ error: 'Failed to suspend user', message: error.message });
  }
});

/**
 * POST /api/users/:userId/activate
 * Activate suspended user
 */
router.post('/:userId/activate', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { tenantId } = req.body;
    
    const userTenant = await UserTenant.findOne({ userId, tenantId });
    
    if (!userTenant) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    userTenant.status = 'active';
    userTenant.activatedAt = new Date();
    userTenant.activatedBy = req.user.uid;
    await userTenant.save();
    
    res.json({ message: 'User activated', userId });
  } catch (error) {
    console.error('Error activating user:', error);
    res.status(500).json({ error: 'Failed to activate user', message: error.message });
  }
});

/**
 * DELETE /api/users/:userId/tenant/:tenantId
 * Remove user from tenant
 */
router.delete('/:userId/tenant/:tenantId', requireAdmin, async (req, res) => {
  try {
    const { userId, tenantId } = req.params;
    
    const userTenant = await UserTenant.findOne({ userId, tenantId });
    
    if (!userTenant) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (userTenant.role === 'owner') {
      return res.status(403).json({ error: 'Cannot remove owner' });
    }
    
    await UserTenant.deleteOne({ userId, tenantId });
    
    res.json({ message: 'User removed from tenant', userId });
  } catch (error) {
    console.error('Error removing user:', error);
    res.status(500).json({ error: 'Failed to remove user', message: error.message });
  }
});

/**
 * PUT /api/users/:userId/modules
 * Update custom module access
 */
router.put('/:userId/modules', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { moduleAccess, tenantId } = req.body;
    
    const userTenant = await UserTenant.findOne({ userId, tenantId });
    
    if (!userTenant) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    userTenant.moduleAccess = moduleAccess;
    userTenant.updatedAt = new Date();
    userTenant.updatedBy = req.user.uid;
    await userTenant.save();
    
    res.json({ message: 'Module access updated', userId });
  } catch (error) {
    console.error('Error updating module access:', error);
    res.status(500).json({ error: 'Failed to update module access', message: error.message });
  }
});

module.exports = router;

