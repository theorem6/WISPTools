const { admin, auth, firestore } = require('../../config/firebase');

const verifyAuth = async (req, res, next) => {
  try {
    // Check both lowercase and capitalized versions (headers can be normalized)
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ Auth middleware: No authorization header. Available headers:', Object.keys(req.headers).filter(h => h.toLowerCase().includes('auth')));
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    console.log('🔐 Auth middleware: Verifying token...', {
      tokenLength: token.length,
      tokenStart: token.substring(0, 30) + '...',
      timestamp: new Date().toISOString()
    });
    
    try {
      const decodedToken = await auth.verifyIdToken(token, true); // Check revoked tokens
      console.log('✅ Auth middleware: Token verified successfully:', {
        uid: decodedToken.uid,
        email: decodedToken.email,
        projectId: decodedToken.firebase?.project_id || 'unknown',
        auth_time: decodedToken.auth_time,
        exp: decodedToken.exp,
        iat: decodedToken.iat
      });
      
      req.user = decodedToken;
      next();
    } catch (tokenError) {
      const errorDetails = {
        error: tokenError.message,
        code: tokenError.code,
        tokenLength: token.length,
        tokenStart: token.substring(0, 50) + '...',
        authAppProjectId: admin.apps.length > 0 ? admin.apps[0].options.projectId : 'unknown',
        authInitialized: admin.apps.length > 0,
        timestamp: new Date().toISOString()
      };
      
      // Add stack trace if available
      if (tokenError.stack) {
        errorDetails.stack = tokenError.stack.split('\n').slice(0, 10).join('\n');
      }
      
      console.error('❌ Auth middleware: Token verification failed:', errorDetails);
      
      // Return detailed error for debugging (always include code and message)
      return res.status(401).json({ 
        error: 'Invalid token',
        message: tokenError.message || 'Token verification failed',
        code: tokenError.code || 'unknown',
        details: process.env.NODE_ENV === 'development' ? errorDetails : {
          code: tokenError.code,
          message: tokenError.message,
          projectId: admin.apps.length > 0 ? admin.apps[0].options.projectId : 'unknown'
        }
      });
    }
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const extractTenantId = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID required' });
  }
  req.tenantId = tenantId;
  next();
};

const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userRole = req.user.role || 'user';
    if (userRole !== requiredRole && userRole !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

const VALID_ROLES = ['admin', 'user', 'tenant_admin'];

// Check if user is platform admin (by UID - preferred)
const isPlatformAdminByUid = (uid) => {
  const PLATFORM_ADMIN_UIDS = [
    '1tf7J4Df4jMuZlEfrRQZ3Kmj1Gy1', // david@david.com (expected UID)
    'RXxGyzxnIngJ3TWKyWmAgSimfwG2'  // david@david.com (actual UID)
  ];
  return uid && PLATFORM_ADMIN_UIDS.includes(uid);
};

// Check if user is platform admin (by email - legacy fallback)
const isPlatformAdmin = (email) => {
  return email === 'david@david.com' || email === 'david@4gengineer.com';
};

// Check if user is platform admin (checks both UID and email)
const isPlatformAdminUser = (user) => {
  if (!user) return false;
  
  // Check by UID first (most reliable)
  if (isPlatformAdminByUid(user.uid)) {
    return true;
  }
  
  // Fallback to email check
  return isPlatformAdmin(user.email);
};

module.exports = {
  verifyAuth,
  extractTenantId,
  requireRole,
  isPlatformAdmin,
  isPlatformAdminByUid,
  isPlatformAdminUser,
  VALID_ROLES
};
