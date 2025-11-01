/**
 * Authentication Routes
 * Handles user authentication and authorization
 */

const express = require('express');
const { admin, auth, firestore } = require('../../config/firebase');
const { UserTenant } = require('../../models/user');
const { verifyAuth, extractTenantId, getUserTenantRole, isPlatformAdmin } = require('../../middleware/auth');
const { determineRoleFromEmail } = require('../../config/user-hierarchy');

const router = express.Router();

/**
 * POST /api/auth/login
 * Authenticate user and return user info with tenant data
 */
router.post('/login', async (req, res) => {
  try {
    const { idToken, tenantId } = req.body;

    if (!idToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'ID token is required'
      });
    }

    // Verify Firebase ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const email = decodedToken.email;

    // Get user's tenant information
    let userRole = null;
    let userTenant = null;

    if (tenantId) {
      // Get user's role in specific tenant
      userRole = await getUserTenantRole(uid, tenantId);
      if (userRole) {
        userTenant = await UserTenant.findOne({ userId: uid, tenantId }).lean();
      }
    } else {
      // Get all tenants for this user
      const userTenants = await UserTenant.find({ userId: uid, status: 'active' }).lean();
      if (userTenants.length > 0) {
        userTenant = userTenants[0]; // Use first tenant as default
        userRole = userTenant.role;
        tenantId = userTenant.tenantId;
      }
    }

    // If no tenant found, check if user is platform admin
    if (!userRole && isPlatformAdmin(email)) {
      userRole = 'platform_admin';
    }

    if (!userRole) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'User not found in any tenant or account suspended'
      });
    }

    // Get user record from Firebase Auth
    const userRecord = await auth.getUser(uid);

    // Update last access time
    if (userTenant) {
      await UserTenant.updateOne(
        { userId: uid, tenantId },
        { lastAccessAt: new Date() }
      );
    }

    res.json({
      success: true,
      user: {
        uid: uid,
        email: email,
        displayName: userRecord.displayName || '',
        photoURL: userRecord.photoURL || '',
        role: userRole,
        tenantId: tenantId,
        isPlatformAdmin: isPlatformAdmin(email),
        emailVerified: userRecord.emailVerified || false,
        lastLoginAt: userRecord.metadata?.lastSignInTime || null
      },
      tenant: userTenant ? {
        tenantId: userTenant.tenantId,
        role: userTenant.role,
        status: userTenant.status,
        moduleAccess: userTenant.moduleAccess || {},
        workOrderPermissions: userTenant.workOrderPermissions || {}
      } : null
    });

  } catch (error) {
    console.error('Login error:', error);
    
    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (client-side token invalidation)
 */
router.post('/logout', (req, res) => {
  // Firebase tokens are stateless, so logout is handled client-side
  // This endpoint is for logging purposes
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', verifyAuth, extractTenantId, async (req, res) => {
  try {
    const uid = req.user.uid;
    const tenantId = req.tenantId;

    // Get user's role in tenant
    const userRole = await getUserTenantRole(uid, tenantId);
    
    if (!userRole && !isPlatformAdmin(req.user.email)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Not a member of this tenant'
      });
    }

    // Get user record from Firebase Auth
    const userRecord = await auth.getUser(uid);

    // Get tenant information
    const userTenant = await UserTenant.findOne({ userId: uid, tenantId }).lean();

    res.json({
      success: true,
      user: {
        uid: uid,
        email: req.user.email,
        displayName: userRecord.displayName || '',
        photoURL: userRecord.photoURL || '',
        role: userRole || 'platform_admin',
        tenantId: tenantId,
        isPlatformAdmin: isPlatformAdmin(req.user.email),
        emailVerified: userRecord.emailVerified || false,
        lastLoginAt: userRecord.metadata?.lastSignInTime || null
      },
      tenant: userTenant ? {
        tenantId: userTenant.tenantId,
        role: userTenant.role,
        status: userTenant.status,
        moduleAccess: userTenant.moduleAccess || {},
        workOrderPermissions: userTenant.workOrderPermissions || {}
      } : null
    });

  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user information'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh user session (validate token and return updated info)
 */
router.post('/refresh', verifyAuth, extractTenantId, async (req, res) => {
  try {
    const uid = req.user.uid;
    const tenantId = req.tenantId;

    // Get user's role in tenant
    const userRole = await getUserTenantRole(uid, tenantId);
    
    if (!userRole && !isPlatformAdmin(req.user.email)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Not a member of this tenant'
      });
    }

    // Update last access time
    if (tenantId) {
      await UserTenant.updateOne(
        { userId: uid, tenantId },
        { lastAccessAt: new Date() }
      );
    }

    res.json({
      success: true,
      message: 'Session refreshed successfully',
      user: {
        uid: uid,
        email: req.user.email,
        role: userRole || 'platform_admin',
        tenantId: tenantId,
        isPlatformAdmin: isPlatformAdmin(req.user.email)
      }
    });

  } catch (error) {
    console.error('Refresh session error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to refresh session'
    });
  }
});

/**
 * GET /api/auth/status
 * Check authentication service status
 */
router.get('/status', (req, res) => {
  res.json({
    message: 'Authentication service is running',
    timestamp: new Date().toISOString(),
    status: 'healthy'
  });
});

module.exports = router;
