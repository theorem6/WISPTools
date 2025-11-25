/**
 * Admin Authentication Middleware
 * Reusable middleware for protecting admin-only endpoints
 */

const { admin, firestore: firestoreDB } = require('../config/firebase');
const { User, UserTenant } = require('../models/user');
const { Tenant } = require('../models/tenant');

/**
 * Auto-provision a user record when missing from Firestore/Mongo.
 * This ensures tenant owners (contact email) are treated as owners/admins.
 */
async function autoProvisionUser(decodedToken) {
  try {
    const uid = decodedToken.uid;
    const email = (decodedToken.email || '').toLowerCase();
    let fallbackTenantId = null;
    let fallbackRole = 'viewer';
    let userTenantRecord = await UserTenant.findOne({ userId: uid }).lean();

    // If no tenant association exists, attempt to link via tenant contact email
    if (!userTenantRecord && email) {
      const tenant = await Tenant.findOne({ contactEmail: email }).lean();
      if (tenant) {
        const tenantId = tenant._id.toString();
        const now = new Date();
        userTenantRecord = await UserTenant.create({
          userId: uid,
          tenantId,
          role: 'owner',
          status: 'active',
          invitedBy: uid,
          invitedAt: now,
          acceptedAt: now,
          addedAt: now
        });
        fallbackTenantId = tenantId;
        fallbackRole = 'owner';
      }
    }

    if (userTenantRecord) {
      fallbackTenantId = userTenantRecord.tenantId;
      fallbackRole = userTenantRecord.role || fallbackRole;
    }

    const userData = {
      uid,
      email,
      displayName: decodedToken.name || decodedToken.email || '',
      role: fallbackRole,
      tenantId: fallbackTenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await firestoreDB.collection('users').doc(uid).set(userData, { merge: true });

    await User.findOneAndUpdate(
      { uid },
      {
        email: userData.email,
        displayName: userData.displayName,
        role: fallbackRole,
        tenantId: fallbackTenantId,
        updatedAt: new Date()
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    return userData;
  } catch (error) {
    console.error('[AdminAuth] Failed to auto-provision user record:', error);
    return null;
  }
}

/**
 * Middleware to require authentication
 * Verifies Firebase ID token and loads user data
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify Firebase ID token
    if (!admin || !admin.apps.length) {
      console.error('Firebase Admin not initialized');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Get user data from Firestore
    let userDoc = await firestoreDB.collection('users').doc(decodedToken.uid).get();
    let userData;
    
    if (!userDoc.exists) {
      console.warn(`[AdminAuth] User ${decodedToken.email} missing from Firestore. Attempting auto-provision...`);
      userData = await autoProvisionUser(decodedToken);
      if (!userData) {
        return res.status(401).json({ error: 'User not found in database' });
      }
    } else {
      userData = userDoc.data();
    }
    
    // Add user info to request object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      tenantId: userData.tenantId,
      role: userData.role,
      ...userData
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Your session has expired. Please sign in again.'
      });
    }
    
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({ 
        error: 'Token revoked',
        message: 'Your session has been revoked. Please sign in again.'
      });
    }
    
    if (error.code === 'auth/argument-error') {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'The provided token is invalid.'
      });
    }
    
    res.status(401).json({ 
      error: 'Authentication failed',
      message: error.message || 'Failed to verify authentication token'
    });
  }
};

/**
 * Middleware to require admin role
 * Options can specify which roles are allowed
 */
const requireAdmin = (options = {}) => {
  const allowedRoles = options.allowedRoles || ['platform_admin', 'owner', 'admin'];
  
  return async (req, res, next) => {
    try {
      // User must be authenticated first (requireAuth middleware)
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      let effectiveRole = req.user.role;
      
      if (!allowedRoles.includes(effectiveRole)) {
        const tenantId = req.headers['x-tenant-id'] || req.tenantId || req.user.tenantId;
        if (tenantId) {
          const tenantRoleRecord = await UserTenant.findOne({ userId: req.user.uid, tenantId }).lean();
          if (tenantRoleRecord && allowedRoles.includes(tenantRoleRecord.role)) {
            effectiveRole = tenantRoleRecord.role;
            req.user.role = effectiveRole;
            req.user.tenantId = tenantId;
          }
        }
      }
      
      if (!allowedRoles.includes(effectiveRole)) {
        console.warn(`Unauthorized admin access attempt by ${req.user.email} (role: ${req.user.role})`);
        return res.status(403).json({ 
          error: 'Admin access required',
          message: `Only ${allowedRoles.join(', ')} can access this resource`,
          required: allowedRoles,
          current: req.user.role
        });
      }
      
      next();
    } catch (error) {
      console.error('Admin check error:', error);
      res.status(403).json({ error: 'Admin access verification failed' });
    }
  };
};

/**
 * Middleware to require owner or platform admin only
 */
const requireOwner = requireAdmin({ allowedRoles: ['platform_admin', 'owner'] });

/**
 * Audit log middleware
 * Logs admin actions for security and compliance
 */
const auditLog = async (req, action, resourceType, resourceId, status, details = {}) => {
  try {
    await firestoreDB.collection('audit_logs').add({
      user_id: req.user?.uid,
      user_email: req.user?.email,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      status, // 'success' or 'failure'
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      user_agent: req.get('user-agent'),
      details,
      module: 'admin'
    });
  } catch (error) {
    console.error('Audit log error:', error);
    // Don't fail request if audit logging fails
  }
};

module.exports = {
  requireAuth,
  requireAdmin,
  requireOwner,
  auditLog
};
