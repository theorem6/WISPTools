/**
 * FCAPS Permission Management API
 * 
 * API endpoints for managing FCAPS-based permissions
 * FCAPS: Fault, Configuration, Accounting, Performance, Security
 * Operations: read, write, delete
 */

const express = require('express');
const router = express.Router();
const {
  verifyAuth,
  extractTenantId,
  isPlatformAdminUser,
  requireRole
} = require('../middleware/auth');
const {
  getUserPermissions,
  getRolePermissions,
  setUserPermissions,
  setRolePermissions,
  hasPermission
} = require('../services/permissionService');
const { UserTenant } = require('../models/user');

// All routes require authentication
router.use(verifyAuth);
router.use(extractTenantId);

/**
 * Check if user has permission
 * GET /api/permissions/check
 * Query params: module, fcapsCategory, operation
 */
router.get('/check', async (req, res) => {
  try {
    const userId = req.user.uid;
    const tenantId = req.tenantId;
    const { module, fcapsCategory, operation } = req.query;
    
    if (!module || !fcapsCategory || !operation) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['module', 'fcapsCategory', 'operation']
      });
    }
    
    const hasAccess = await hasPermission(userId, tenantId, module, fcapsCategory, operation);
    
    res.json({
      hasPermission: hasAccess,
      module,
      fcapsCategory,
      operation
    });
  } catch (error) {
    console.error('Error checking permission:', error);
    res.status(500).json({ error: 'Failed to check permission', message: error.message });
  }
});

/**
 * Get user permissions
 * GET /api/permissions/user/:userId
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const tenantId = req.tenantId;
    const currentUserId = req.user.uid;
    
    // Check if user can view permissions (must be admin, owner, or viewing own permissions)
    const isPlatformAdmin = await isPlatformAdminUser(req.user);
    const userTenant = await UserTenant.findOne({ userId: currentUserId, tenantId }).lean();
    const isOwnerOrAdmin = userTenant && (userTenant.role === 'owner' || userTenant.role === 'admin');
    const isViewingSelf = userId === currentUserId;
    
    if (!isPlatformAdmin && !isOwnerOrAdmin && !isViewingSelf) {
      return res.status(403).json({ error: 'Insufficient permissions to view user permissions' });
    }
    
    const permissions = await getUserPermissions(userId, tenantId);
    res.json(permissions);
  } catch (error) {
    console.error('Error getting user permissions:', error);
    res.status(500).json({ error: 'Failed to get user permissions', message: error.message });
  }
});

/**
 * Get current user's permissions
 * GET /api/permissions/me
 */
router.get('/me', async (req, res) => {
  try {
    const userId = req.user.uid;
    const tenantId = req.tenantId;
    
    const permissions = await getUserPermissions(userId, tenantId);
    res.json(permissions);
  } catch (error) {
    console.error('Error getting current user permissions:', error);
    res.status(500).json({ error: 'Failed to get permissions', message: error.message });
  }
});

/**
 * Set user permissions
 * PUT /api/permissions/user/:userId
 * Body: { permissions: Array, inheritFromRole: boolean }
 */
router.put('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const tenantId = req.tenantId;
    const currentUserId = req.user.uid;
    const { permissions, inheritFromRole = true } = req.body;
    
    // Only tenant admin, owner, or platform admin can set permissions
    const isPlatformAdmin = await isPlatformAdminUser(req.user);
    const userTenant = await UserTenant.findOne({ userId: currentUserId, tenantId }).lean();
    const isOwnerOrAdmin = userTenant && (userTenant.role === 'owner' || userTenant.role === 'admin');
    
    if (!isPlatformAdmin && !isOwnerOrAdmin) {
      return res.status(403).json({ error: 'Insufficient permissions to set user permissions' });
    }
    
    // Validate permissions structure
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions must be an array' });
    }
    
    const updated = await setUserPermissions(userId, tenantId, permissions, inheritFromRole, currentUserId);
    res.json({
      message: 'User permissions updated successfully',
      permissions: updated
    });
  } catch (error) {
    console.error('Error setting user permissions:', error);
    res.status(500).json({ error: 'Failed to set user permissions', message: error.message });
  }
});

/**
 * Get role permissions
 * GET /api/permissions/role/:role
 */
router.get('/role/:role', async (req, res) => {
  try {
    const { role } = req.params;
    const tenantId = req.tenantId;
    const currentUserId = req.user.uid;
    
    // Only tenant admin, owner, or platform admin can view role permissions
    const isPlatformAdmin = await isPlatformAdminUser(req.user);
    const userTenant = await UserTenant.findOne({ userId: currentUserId, tenantId }).lean();
    const isOwnerOrAdmin = userTenant && (userTenant.role === 'owner' || userTenant.role === 'admin');
    
    if (!isPlatformAdmin && !isOwnerOrAdmin) {
      return res.status(403).json({ error: 'Insufficient permissions to view role permissions' });
    }
    
    const permissions = await getRolePermissions(role, tenantId);
    res.json(permissions);
  } catch (error) {
    console.error('Error getting role permissions:', error);
    res.status(500).json({ error: 'Failed to get role permissions', message: error.message });
  }
});

/**
 * Set role permissions
 * PUT /api/permissions/role/:role
 * Body: { permissions: Array }
 */
router.put('/role/:role', async (req, res) => {
  try {
    const { role } = req.params;
    const tenantId = req.tenantId;
    const currentUserId = req.user.uid;
    const { permissions } = req.body;
    
    // Only tenant admin, owner, or platform admin can set role permissions
    const isPlatformAdmin = await isPlatformAdminUser(req.user);
    const userTenant = await UserTenant.findOne({ userId: currentUserId, tenantId }).lean();
    const isOwnerOrAdmin = userTenant && (userTenant.role === 'owner' || userTenant.role === 'admin');
    
    if (!isPlatformAdmin && !isOwnerOrAdmin) {
      return res.status(403).json({ error: 'Insufficient permissions to set role permissions' });
    }
    
    // Validate permissions structure
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions must be an array' });
    }
    
    const updated = await setRolePermissions(role, tenantId, permissions, currentUserId);
    res.json({
      message: 'Role permissions updated successfully',
      permissions: updated
    });
  } catch (error) {
    console.error('Error setting role permissions:', error);
    res.status(500).json({ error: 'Failed to set role permissions', message: error.message });
  }
});

/**
 * Get all roles permissions for tenant
 * GET /api/permissions/roles
 */
router.get('/roles', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const currentUserId = req.user.uid;
    
    // Only tenant admin, owner, or platform admin can view role permissions
    const isPlatformAdmin = await isPlatformAdminUser(req.user);
    const userTenant = await UserTenant.findOne({ userId: currentUserId, tenantId }).lean();
    const isOwnerOrAdmin = userTenant && (userTenant.role === 'owner' || userTenant.role === 'admin');
    
    if (!isPlatformAdmin && !isOwnerOrAdmin) {
      return res.status(403).json({ error: 'Insufficient permissions to view role permissions' });
    }
    
    const roles = ['admin', 'engineer', 'installer', 'helpdesk', 'sales', 'viewer'];
    const rolePermissions = await Promise.all(
      roles.map(role => getRolePermissions(role, tenantId))
    );
    
    res.json({ rolePermissions });
  } catch (error) {
    console.error('Error getting role permissions:', error);
    res.status(500).json({ error: 'Failed to get role permissions', message: error.message });
  }
});

module.exports = router;

