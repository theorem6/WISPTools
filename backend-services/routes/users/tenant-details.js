/**
 * User Tenant Details API
 * Allows regular users to get details of their assigned tenants
 */

const express = require('express');
const { verifyAuth } = require('./role-auth-middleware');
const { Tenant } = require('../../models/tenant');
const { UserTenant } = require('./user-schema');

const router = express.Router();

/**
 * GET /api/tenants/:tenantId
 * Get tenant details (only if user is assigned to this tenant)
 */
router.get('/:tenantId', verifyAuth, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const userId = req.user.uid;
    
    // Check if user is assigned to this tenant
    const userTenant = await UserTenant.findOne({ 
      userId, 
      tenantId,
      status: 'active'
    });
    
    if (!userTenant) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not assigned to this tenant'
      });
    }
    
    // Get tenant details
    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tenant not found'
      });
    }
    
    // Return tenant with user's role
    res.json({
      ...tenant,
      id: tenant._id.toString(),
      userRole: userTenant.role
    });
    
  } catch (error) {
    console.error('Error getting tenant:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;
