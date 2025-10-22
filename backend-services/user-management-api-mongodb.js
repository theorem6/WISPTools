/**
 * User Management API - MongoDB Version
 * 
 * All user-tenant data stored in MongoDB
 * Firebase Auth used ONLY for authentication
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

const requireAdmin = requireRole(['owner', 'admin']);

/**
 * GET /api/users/tenant/:tenantId
 * List all users in a tenant
 */
router.get('/tenant/:tenantId', requireAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Query MongoDB for user-tenant records
    const userTenants = await UserTenant.find({ tenantId }).lean();
    
    if (!userTenants || userTenants.length === 0) {
      return res.json([]);
    }
    
    // Get full user profiles from Firebase Auth
    const users = [];
    for (const userTenant of userTenants) {
      try {
        const userRecord = await admin.auth().getUser(userTenant.userId);
        
        users.push({
          uid: userTenant.userId,
          email: userRecord.email || '',
          displayName: userRecord.displayName || '',
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
          moduleAccess: userTenant.moduleAccess || null,
          workOrderPermissions: userTenant.workOrderPermissions || null
        });
      } catch (authError) {
        console.error(`User ${userTenant.userId} not found in Firebase Auth:`, authError.message);
      }
    }
    
    res.json(users);
  } catch (error) {
    console.error('Error listing tenant users:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

/**
 * POST /api/users/invite
 * Invite a user to the tenant (creates active MongoDB record if user exists in Firebase)
 */
router.post('/invite', requireAdmin, async (req, res) => {
  try {
    const { email, role, tenantId } = req.body;
    
    if (!email || !role || !tenantId) {
      return res.status(400).json({ error: 'Email, role, and tenantId are required' });
    }
    
    if (!VALID_ROLES.includes(role) || role === 'platform_admin') {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Get user from Firebase Auth
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return res.status(404).json({ 
          error: 'User not found in Firebase Auth. They must create an account first.' 
        });
      }
      throw error;
    }
    
    const userId = userRecord.uid;
    
    // Check if already exists in MongoDB
    const existing = await UserTenant.findOne({ userId, tenantId });
    if (existing) {
      return res.status(409).json({ error: 'User is already a member of this tenant' });
    }
    
    // Create active record in MongoDB
    const userTenant = new UserTenant({
      userId,
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
      message: 'User added successfully',
      userId,
      email,
      role
    });
  } catch (error) {
    console.error('Error inviting user:', error);
    res.status(500).json({ error: 'Failed to invite user' });
  }
});

/**
 * PUT /api/users/:userId/role
 * Update user's role
 */
router.put('/:userId/role', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, tenantId } = req.body;
    
    if (!role || !tenantId || !VALID_ROLES.includes(role)) {
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
    await userTenant.save();
    
    res.json({ message: 'Role updated', userId, role });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

/**
 * POST /api/users/:userId/suspend
 * Suspend a user
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
    
    res.json({ message: 'User suspended' });
  } catch (error) {
    console.error('Error suspending user:', error);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});

/**
 * POST /api/users/:userId/activate
 * Activate a suspended user
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
    
    res.json({ message: 'User activated' });
  } catch (error) {
    console.error('Error activating user:', error);
    res.status(500).json({ error: 'Failed to activate user' });
  }
});

/**
 * DELETE /api/users/:userId
 * Remove user from tenant
 */
router.delete('/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { tenantId } = req.body;
    
    const userTenant = await UserTenant.findOne({ userId, tenantId });
    if (!userTenant) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (userTenant.role === 'owner') {
      return res.status(403).json({ error: 'Cannot remove tenant owner' });
    }
    
    await UserTenant.deleteOne({ userId, tenantId });
    
    res.json({ message: 'User removed from tenant' });
  } catch (error) {
    console.error('Error removing user:', error);
    res.status(500).json({ error: 'Failed to remove user' });
  }
});

// Helper function
function getCreatableRoles(userRole) {
  const roleHierarchy = {
    'owner': ['admin', 'engineer', 'installer', 'helpdesk', 'viewer'],
    'admin': ['engineer', 'installer', 'helpdesk', 'viewer'],
    'engineer': [],
    'installer': [],
    'helpdesk': [],
    'viewer': []
  };
  return roleHierarchy[userRole] || [];
}

module.exports = router;

