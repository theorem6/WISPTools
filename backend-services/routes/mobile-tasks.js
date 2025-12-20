/**
 * Mobile Tasks API
 * Returns allowed tasks for mobile app users based on their permissions
 */

const express = require('express');
const router = express.Router();
const { verifyAuth, extractTenantId } = require('../middleware/auth');
const { getUserPermissions, hasPermission } = require('../services/permissionService');
const { UserTenant } = require('../models/user');

// All routes require authentication
router.use(verifyAuth);
router.use(extractTenantId);

/**
 * Task definitions - map to FCAPS permissions
 */
const TASK_PERMISSIONS = {
  'inventory-checkin': {
    module: 'inventory',
    fcapsCategory: 'accounting',
    operation: 'write',
    name: 'Inventory Checkin',
    icon: '📥',
    description: 'Check in equipment from field'
  },
  'inventory-checkout': {
    module: 'inventory',
    fcapsCategory: 'accounting',
    operation: 'write',
    name: 'Inventory Checkout',
    icon: '📤',
    description: 'Check out equipment to vehicle'
  },
  'deploy-network': {
    module: 'network',
    fcapsCategory: 'configuration',
    operation: 'write',
    name: 'Deploy Network',
    icon: '🌐',
    description: 'Deploy network equipment'
  },
  'deploy-tower': {
    module: 'network',
    fcapsCategory: 'configuration',
    operation: 'write',
    name: 'Deploy Tower',
    icon: '📡',
    description: 'Deploy tower equipment'
  },
  'receive-trouble-tickets': {
    module: 'work-orders',
    fcapsCategory: 'fault',
    operation: 'read',
    name: 'Receive Trouble Tickets',
    icon: '📋',
    description: 'View and accept assigned tickets'
  },
  'resolve-trouble-tickets': {
    module: 'work-orders',
    fcapsCategory: 'fault',
    operation: 'write',
    name: 'Resolve Trouble Tickets',
    icon: '✅',
    description: 'Resolve and close tickets'
  },
  'log-trouble-tickets': {
    module: 'work-orders',
    fcapsCategory: 'fault',
    operation: 'write',
    name: 'Log Trouble Tickets',
    icon: '📝',
    description: 'Create new trouble tickets'
  },
  'aiming-cpe': {
    module: 'network',
    fcapsCategory: 'configuration',
    operation: 'write',
    name: 'Aiming CPE',
    icon: '🎯',
    description: 'Aim and configure CPE devices'
  }
};

/**
 * GET /api/mobile/tasks
 * Get allowed tasks for current user
 */
router.get('/tasks', async (req, res) => {
  try {
    const userId = req.user.uid;
    const tenantId = req.tenantId;
    
    // Get user's role
    const userTenant = await UserTenant.findOne({ userId, tenantId }).lean();
    if (!userTenant || userTenant.status !== 'active') {
      return res.json({ tasks: [] });
    }
    
    // Check permissions for each task
    const allowedTasks = [];
    
    for (const [taskId, taskConfig] of Object.entries(TASK_PERMISSIONS)) {
      const hasAccess = await hasPermission(
        userId,
        tenantId,
        taskConfig.module,
        taskConfig.fcapsCategory,
        taskConfig.operation
      );
      
      if (hasAccess) {
        allowedTasks.push({
          id: taskId,
          ...taskConfig
        });
      }
    }
    
    // Always allow QR scanning (it's a tool, not a task)
    // But we'll include it as a special task that everyone can access
    
    res.json({
      tasks: allowedTasks,
      userId,
      tenantId,
      role: userTenant.role
    });
  } catch (error) {
    console.error('Error getting mobile tasks:', error);
    res.status(500).json({ 
      error: 'Failed to get tasks', 
      message: error.message,
      tasks: [] // Return empty array on error
    });
  }
});

module.exports = router;
