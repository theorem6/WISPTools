const { admin, auth, firestore } = require('../../config/firebase');

const verifyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
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

// Check if user is platform admin
const isPlatformAdmin = (email) => {
  return email === 'david@david.com' || email === 'david@4gengineer.com';
};

module.exports = {
  verifyAuth,
  extractTenantId,
  requireRole,
  isPlatformAdmin,
  VALID_ROLES
};
