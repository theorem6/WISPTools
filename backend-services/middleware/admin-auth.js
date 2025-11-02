/**
 * Admin Authentication Middleware
 * Reusable middleware for protecting admin-only endpoints
 */

const { admin, firestore: firestoreDB } = require('../config/firebase');

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
    const userDoc = await firestoreDB.collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      return res.status(401).json({ error: 'User not found in database' });
    }
    
    const userData = userDoc.data();
    
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
      
      if (!allowedRoles.includes(req.user.role)) {
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
