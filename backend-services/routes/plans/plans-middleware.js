/**
 * Plans Route Middleware
 * Shared middleware functions for plan routes
 */

/**
 * Require tenant ID middleware
 */
const requireTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'X-Tenant-ID header is required' });
  }
  req.tenantId = tenantId;
  next();
};

module.exports = {
  requireTenant
};

