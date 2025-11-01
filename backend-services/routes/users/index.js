/**
 * User Management API
 * 
 * Endpoints for managing users within tenants:
 * - Invite users
 * - Update user roles
 * - Update module access
 * - Suspend/activate users
 * - Remove users from tenant
 * 
 * Uses Firebase Auth for authentication, MongoDB Atlas for data storage
 */

const express = require('express');
const { admin, auth, firestore } = require('../../config/firebase');
const { UserTenant } = require('../../models/user');
const { 
  verifyAuth, 
  extractTenantId, 
  requireRole,
  VALID_ROLES 
} = require('../../middleware/auth');
const { getCreatableRoles, canManageRole, determineRoleFromEmail } = require('../../config/user-hierarchy');

const router = express.Router();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// All routes require authentication and tenant context
router.use(verifyAuth);
router.use(extractTenantId);

// Most routes require admin privileges
const requireAdmin = requireRole(['owner', 'admin']);

// ============================================================================
// ENDPOINTS
// ============================================================================

/**
 * GET /api/users
 * Get all users across all tenants (platform admin only)
 */
router.get('/', async (req, res) => {
  try {
    // Check if user is platform admin
    const userEmail = req.user?.email;
    if (userEmail !== 'david@david.com') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Platform admin access required'
      });
    }
    
    // Get all user-tenant records from MongoDB
    const userTenants = await UserTenant.find().lean();
    
    // Get unique user IDs
    const uniqueUserIds = [...new Set(userTenants.map(ut => ut.userId))];
    
    // Get full user profiles from Firebase Auth
    const users = [];
    for (const userId of uniqueUserIds) {
      try {
        const userRecord = await auth.getUser(userId);
        
        // Get all tenants for this user
        const userTenantsForUser = userTenants.filter(ut => ut.userId === userId);
        
        users.push({
          uid: userId,
          email: userRecord.email || '',
          displayName: userRecord.displayName || '',
          photoURL: userRecord.photoURL || '',
          phoneNumber: userRecord.phoneNumber || '',
          disabled: userRecord.disabled || false,
          emailVerified: userRecord.emailVerified || false,
          createdAt: userRecord.metadata?.creationTime || null,
          lastLoginAt: userRecord.metadata?.lastSignInTime || null,
          tenants: userTenantsForUser.map(ut => ({
            tenantId: ut.tenantId,
            role: ut.role,
            status: ut.status
          }))
        });
      } catch (authError) {
        console.error(`User ${userId} not found in Firebase Auth:`, authError.message);
        // Skip users that don't exist in Firebase Auth
      }
    }
    
    res.json(users);
  } catch (error) {
    console.error('Error listing all users:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to list users'
    });
  }
});

/**
 * GET /api/users/tenant/:tenantId
 * List all users in a tenant
 */
router.get('/tenant/:tenantId', requireAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Query UserTenant collection from MongoDB
    let userTenants = await UserTenant.find({ tenantId }).lean();
    
    // AUTO-FIX: If this tenant has NO users in MongoDB, check Firestore and migrate owner
    if (!userTenants || userTenants.length === 0) {
      console.log(`⚠️ Tenant ${tenantId} has no users in MongoDB. Checking Firestore...`);
      
      try {
        // Use centralized firestore
        const tenantDoc = await firestore.collection('tenants').doc(tenantId).get();
        
        if (tenantDoc.exists()) {
          const tenantData = tenantDoc.data();
          const createdBy = tenantData.createdBy;
          
          if (createdBy) {
            console.log(`✅ Found tenant creator: ${createdBy}. Creating owner record in MongoDB...`);
            
            // Create owner record in MongoDB
            const ownerRecord = new UserTenant({
              userId: createdBy,
              tenantId,
              role: 'owner',
              status: 'active',
              invitedBy: createdBy,
              invitedAt: new Date(),
              acceptedAt: new Date(),
              addedAt: new Date()
            });
            
            await ownerRecord.save();
            userTenants = [ownerRecord.toObject()]; // Return the new owner
            
            console.log(`✅ Auto-created owner record for ${createdBy} in tenant ${tenantId}`);
          }
        }
      } catch (firestoreError) {
        console.error('Error auto-creating owner from Firestore:', firestoreError);
      }
      
      // If still no users, return empty array
      if (!userTenants || userTenants.length === 0) {
        return res.json([]);
      }
    }
    
    // Get full user profiles from Firebase Auth
    const users = [];
    for (const userTenant of userTenants) {
      try {
        // Get user from Firebase Auth
        const userRecord = await auth.getUser(userTenant.userId);
        
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
        // Skip users that don't exist in Firebase Auth
      }
    }
    
    res.json(users);
  } catch (error) {
    console.error('Error listing tenant users:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to list users'
    });
  }
});

/**
 * POST /api/users/invite
 * Invite a new user to the tenant
 */
router.post('/invite', requireAdmin, async (req, res) => {
  try {
    const { email, role, tenantId, customModuleAccess } = req.body;
    
    // Validate input
    if (!email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email is required'
      });
    }
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant ID is required'
      });
    }
    
    // Auto-assign role based on email if requested
    let role = requestedRole;
    if (autoAssign && !role) {
      role = determineRoleFromEmail(email);
      if (!role) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Could not auto-assign role from email pattern. Please specify role manually.'
        });
      }
    }
    
    if (!role) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Role is required (or use autoAssign: true)'
      });
    }
    
    // Validate role
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`
      });
    }
    
    // Cannot create platform_admin
    if (role === 'platform_admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot create platform admin users'
      });
    }
    
    // Check if requester can create this role
    if (!canManageRole(req.userRole, role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `You cannot create users with role: ${role}. Your role can only create: ${getCreatableRoles(req.userRole).join(', ')}`
      });
    }
    
    // Check if user already exists in Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // User doesn't exist - they'll need to sign up
        // Create a placeholder user record
        userRecord = null;
      } else {
        throw error;
      }
    }
    
    const userId = userRecord ? userRecord.uid : null;
    
    // Check if user already exists in MongoDB
    if (userId) {
      const existing = await UserTenant.findOne({ userId, tenantId });
      if (existing) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'User is already a member of this tenant'
        });
      }
    }
    
    // If user exists in Firebase, create active record immediately in MongoDB
    if (userId) {
      const userTenant = new UserTenant({
        userId,
        tenantId,
        role,
        moduleAccess: customModuleAccess || null,
        status: 'active', // Active immediately since user exists
        invitedBy: req.user.uid,
        invitedAt: new Date(),
        acceptedAt: new Date(),
        addedAt: new Date()
      });
      
      await userTenant.save();
      console.log(`✅ Created active user-tenant record for ${email} (${userId})`);
    } else {
      // User doesn't exist - store invitation in Firestore for now
      // When they sign up, we'll create the MongoDB record
      const invitationId = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const invitation = {
        id: invitationId,
        tenantId,
        email,
        role,
        customModuleAccess: customModuleAccess || null,
        invitedBy: req.user.uid,
        invitedAt: firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        expiresAt: firestore.Timestamp.fromDate(
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        )
      };
      
      await firestore.collection('tenant_invitations').doc(invitationId).set(invitation);
      console.log(`📧 Created invitation for ${email} (user doesn't exist yet)`);
    }
    
    // TODO: Send invitation email
    // This would typically use SendGrid, AWS SES, or Firebase Extensions
    
    res.status(201).json({
      message: 'User invited successfully',
      invitationId,
      userId,
      email,
      role,
      status: userId ? 'pending_invitation' : 'pending_signup'
    });
  } catch (error) {
    console.error('Error inviting user:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to invite user'
    });
  }
});

/**
 * PUT /api/users/:userId/role
 * Update user's role in the tenant
 */
router.put('/:userId/role', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, tenantId } = req.body;
    
    if (!role || !tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Role and tenantId are required'
      });
    }
    
    // Validate role
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`
      });
    }
    
    // Cannot change to platform_admin
    if (role === 'platform_admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot assign platform admin role'
      });
    }
    
    // Get user_tenant record from MongoDB
    const userTenant = await UserTenant.findOne({ userId, tenantId });
    
    if (!userTenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found in tenant'
      });
    }
    
    // Cannot change owner role
    if (userTenant.role === 'owner') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot change owner role'
      });
    }
    
    // Update role in MongoDB
    userTenant.role = role;
    userTenant.updatedAt = new Date();
    userTenant.updatedBy = req.user.uid;
    await userTenant.save();
    
    res.json({
      message: 'User role updated successfully',
      userId,
      role
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update user role'
    });
  }
});

/**
 * PUT /api/users/:userId/modules
 * Update user's custom module access
 */
router.put('/:userId/modules', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { moduleAccess, tenantId } = req.body;
    
    if (!moduleAccess || !tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'moduleAccess and tenantId are required'
      });
    }
    
    // Get user_tenant record
    const userTenantId = `${userId}_${tenantId}`;
    const userTenantDoc = await db.collection('user_tenants').doc(userTenantId).get();
    
    if (!userTenantDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found in tenant'
      });
    }
    
    // Update module access
    await db.collection('user_tenants').doc(userTenantId).update({
      moduleAccess,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user.uid
    });
    
    res.json({
      message: 'User module access updated successfully',
      userId,
      moduleAccess
    });
  } catch (error) {
    console.error('Error updating module access:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update module access'
    });
  }
});

/**
 * POST /api/users/:userId/suspend
 * Suspend a user in the tenant
 */
router.post('/:userId/suspend', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { tenantId } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'tenantId is required'
      });
    }
    
    // Get user_tenant record
    const userTenantId = `${userId}_${tenantId}`;
    const userTenantDoc = await db.collection('user_tenants').doc(userTenantId).get();
    
    if (!userTenantDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found in tenant'
      });
    }
    
    const userTenant = userTenantDoc.data();
    
    // Cannot suspend owner
    if (userTenant.role === 'owner') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot suspend tenant owner'
      });
    }
    
    // Update status
    await db.collection('user_tenants').doc(userTenantId).update({
      status: 'suspended',
      suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
      suspendedBy: req.user.uid
    });
    
    res.json({
      message: 'User suspended successfully',
      userId
    });
  } catch (error) {
    console.error('Error suspending user:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to suspend user'
    });
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
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'tenantId is required'
      });
    }
    
    // Get user_tenant record
    const userTenantId = `${userId}_${tenantId}`;
    const userTenantDoc = await db.collection('user_tenants').doc(userTenantId).get();
    
    if (!userTenantDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found in tenant'
      });
    }
    
    // Update status
    await db.collection('user_tenants').doc(userTenantId).update({
      status: 'active',
      activatedAt: admin.firestore.FieldValue.serverTimestamp(),
      activatedBy: req.user.uid
    });
    
    res.json({
      message: 'User activated successfully',
      userId
    });
  } catch (error) {
    console.error('Error activating user:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to activate user'
    });
  }
});

/**
 * DELETE /api/users/:userId/tenant/:tenantId
 * Remove user from tenant
 */
router.delete('/:userId/tenant/:tenantId', requireAdmin, async (req, res) => {
  try {
    const { userId, tenantId } = req.params;
    
    // Get user_tenant record
    const userTenantId = `${userId}_${tenantId}`;
    const userTenantDoc = await db.collection('user_tenants').doc(userTenantId).get();
    
    if (!userTenantDoc.exists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found in tenant'
      });
    }
    
    const userTenant = userTenantDoc.data();
    
    // Cannot remove owner
    if (userTenant.role === 'owner') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot remove tenant owner'
      });
    }
    
    // Delete user_tenant record
    await db.collection('user_tenants').doc(userTenantId).delete();
    
    res.json({
      message: 'User removed from tenant successfully',
      userId,
      tenantId
    });
  } catch (error) {
    console.error('Error removing user from tenant:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to remove user from tenant'
    });
  }
});

/**
 * GET /api/users/:userId/activity
 * Get user activity log
 */
router.get('/:userId/activity', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { tenantId } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'tenantId is required'
      });
    }
    
    // Query activity logs (if implemented)
    // For now, return placeholder
    res.json({
      userId,
      tenantId,
      activities: [],
      message: 'Activity logging not yet implemented'
    });
  } catch (error) {
    console.error('Error getting user activity:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user activity'
    });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = router;

