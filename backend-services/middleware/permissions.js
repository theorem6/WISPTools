/**
 * FCAPS Permission Middleware
 * 
 * Middleware to check FCAPS-based permissions for API routes
 * FCAPS: Fault, Configuration, Accounting, Performance, Security
 * Operations: read, write, delete
 */

const { hasPermission } = require('../services/permissionService');
const { isPlatformAdminUser } = require('./auth');

/**
 * Check if user has permission for a specific FCAPS operation
 * @param {string} module - Module/System identifier
 * @param {string} fcapsCategory - FCAPS category ('fault', 'configuration', 'accounting', 'performance', 'security')
 * @param {string} operation - Operation ('read', 'write', 'delete')
 * @returns {Function} - Express middleware function
 */
function requirePermission(module, fcapsCategory, operation) {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      const userId = req.user.uid;
      const tenantId = req.tenantId || req.headers['x-tenant-id'];
      
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }
      
      // Platform admin and owner bypass permission checks
      const isPlatformAdmin = await isPlatformAdminUser(req.user);
      if (isPlatformAdmin) {
        return next(); // Platform admin has full access
      }
      
      // Check tenant ownership (owner has full access in their tenant)
      // This is handled in the permission service
      
      // Check permission
      const hasAccess = await hasPermission(userId, tenantId, module, fcapsCategory, operation);
      
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: `Permission denied: ${fcapsCategory}.${operation} on ${module}`,
          required: {
            module,
            fcapsCategory,
            operation
          }
        });
      }
      
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        error: 'Permission check failed',
        message: error.message
      });
    }
  };
}

/**
 * Check if user has permission for HTTP method-based operations
 * GET = read, POST/PUT = write, DELETE = delete
 * @param {string} module - Module/System identifier
 * @param {string} fcapsCategory - FCAPS category
 * @returns {Function} - Express middleware function
 */
function requireFcapsPermission(module, fcapsCategory) {
  return async (req, res, next) => {
    try {
      // Determine operation from HTTP method
      let operation;
      if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        operation = 'read';
      } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        operation = 'write';
      } else if (req.method === 'DELETE') {
        operation = 'delete';
      } else {
        return res.status(405).json({ error: 'Method not allowed' });
      }
      
      // Use the permission check middleware
      return requirePermission(module, fcapsCategory, operation)(req, res, next);
    } catch (error) {
      console.error('Fcaps permission check error:', error);
      return res.status(500).json({
        error: 'Permission check failed',
        message: error.message
      });
    }
  };
}

/**
 * Check multiple permissions (user must have ALL permissions)
 * @param {Array} permissionChecks - Array of {module, fcapsCategory, operation} objects
 * @returns {Function} - Express middleware function
 */
function requireAllPermissions(permissionChecks) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      const userId = req.user.uid;
      const tenantId = req.tenantId || req.headers['x-tenant-id'];
      
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }
      
      // Platform admin bypass
      const isPlatformAdmin = await isPlatformAdminUser(req.user);
      if (isPlatformAdmin) {
        return next();
      }
      
      // Check all permissions
      const checks = await Promise.all(
        permissionChecks.map(check =>
          hasPermission(userId, tenantId, check.module, check.fcapsCategory, check.operation)
        )
      );
      
      if (checks.every(Boolean)) {
        return next();
      }
      
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'User does not have all required permissions',
        required: permissionChecks
      });
    } catch (error) {
      console.error('Multi-permission check error:', error);
      return res.status(500).json({
        error: 'Permission check failed',
        message: error.message
      });
    }
  };
}

/**
 * Check multiple permissions (user must have ANY permission)
 * @param {Array} permissionChecks - Array of {module, fcapsCategory, operation} objects
 * @returns {Function} - Express middleware function
 */
function requireAnyPermission(permissionChecks) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      const userId = req.user.uid;
      const tenantId = req.tenantId || req.headers['x-tenant-id'];
      
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }
      
      // Platform admin bypass
      const isPlatformAdmin = await isPlatformAdminUser(req.user);
      if (isPlatformAdmin) {
        return next();
      }
      
      // Check any permission
      const checks = await Promise.all(
        permissionChecks.map(check =>
          hasPermission(userId, tenantId, check.module, check.fcapsCategory, check.operation)
        )
      );
      
      if (checks.some(Boolean)) {
        return next();
      }
      
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'User does not have any required permission',
        required: permissionChecks
      });
    } catch (error) {
      console.error('Multi-permission check error:', error);
      return res.status(500).json({
        error: 'Permission check failed',
        message: error.message
      });
    }
  };
}

module.exports = {
  requirePermission,
  requireFcapsPermission,
  requireAllPermissions,
  requireAnyPermission
};

