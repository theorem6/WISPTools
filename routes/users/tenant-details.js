/**
 * User Tenant Details API
 * Allows regular users to get details of their assigned tenants
 * Uses isolated TenantService for robust operations
 */

const express = require('express');
const { verifyAuth, isPlatformAdminUser } = require('./role-auth-middleware');
const tenantService = require('../../services/tenant-service');

const router = express.Router();

/**
 * GET /api/user-tenants/:userId
 * Get all tenants assigned to a user
 * Uses isolated TenantService for robust operations
 */
router.get('/:userId', verifyAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.uid;

    // Validate inputs
    if (!userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId is required'
      });
    }

    if (!requestingUserId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    // Authorization check - users can only query their own tenants (unless platform admin)
    if (userId !== requestingUserId && !isPlatformAdminUser(req.user)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only view your own tenants'
      });
    }

    // Use tenant service
    const tenants = await tenantService.getUserTenants(userId);
    res.json(tenants);

  } catch (error) {
    console.error('[tenant-details] Error getting user tenants:', error);
    
    // Map errors to appropriate status codes
    let statusCode = 500;
    if (error.message.includes('not ready') || error.message.includes('connection')) {
      statusCode = 503; // Service Unavailable
    } else if (error.message.includes('Invalid') || error.message.includes('required')) {
      statusCode = 400; // Bad Request
    }

    if (!res.headersSent) {
      res.status(statusCode).json({
        error: 'Internal Server Error',
        message: error.message || 'Failed to get user tenants'
      });
    }
  }
});

/**
 * GET /api/tenants/:tenantId
 * Get tenant details (only if user is assigned to this tenant)
 * Uses isolated TenantService for robust operations
 */
router.get('/tenant/:tenantId', verifyAuth, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    if (!tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'tenantId is required'
      });
    }

    // Use tenant service
    const tenant = await tenantService.getTenant(tenantId, userId);

    if (!tenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tenant not found or you are not authorized to access it'
      });
    }

    res.json(tenant);

  } catch (error) {
    console.error('[tenant-details] Error getting tenant:', error);
    
    let statusCode = 500;
    if (error.message.includes('not ready') || error.message.includes('connection')) {
      statusCode = 503;
    } else if (error.message.includes('Invalid') || error.message.includes('required')) {
      statusCode = 400;
    }

    if (!res.headersSent) {
      res.status(statusCode).json({
        error: 'Internal Server Error',
        message: error.message || 'Failed to get tenant'
      });
    }
  }
});

module.exports = router;
