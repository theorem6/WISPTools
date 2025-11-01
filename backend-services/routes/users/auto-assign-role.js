/**
 * Auto-Assign User Roles Based on Email
 * API endpoint and utilities for automatic role assignment
 */

const express = require('express');
const router = express.Router();
const { auth, firestore } = require('../../config/firebase');
const { UserTenant } = require('../../models/user');
const { 
  determineRoleFromEmail, 
  canManageRole,
  getRoleDisplayName,
  getRoleDescription 
} = require('../../config/user-hierarchy');
const { verifyAuth, extractTenantId, requireAdmin } = require('../users/role-auth-middleware');

/**
 * POST /api/users/auto-assign
 * Auto-assign role to user based on email pattern
 * Requires admin/owner permission
 */
router.post('/auto-assign', verifyAuth, extractTenantId, requireAdmin, async (req, res) => {
  try {
    const { email, tenantId: targetTenantId } = req.body;
    
    if (!email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email is required'
      });
    }
    
    const tenantId = targetTenantId || req.tenantId;
    if (!tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant ID is required'
      });
    }
    
    // Determine role from email
    const suggestedRole = determineRoleFromEmail(email);
    
    if (!suggestedRole) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Could not determine role from email pattern'
      });
    }
    
    // Check if requester can assign this role
    if (!canManageRole(req.userRole, suggestedRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `You cannot assign role '${suggestedRole}'. Your role '${req.userRole}' can only assign: ${getCreatableRoles(req.userRole).join(', ')}`
      });
    }
    
    // Get user from Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found in Firebase Auth. User must sign up first.'
        });
      }
      throw error;
    }
    
    const userId = userRecord.uid;
    
    // Check if user already has a role in this tenant
    const existing = await UserTenant.findOne({ userId, tenantId });
    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: `User already has role '${existing.role}' in this tenant`,
        existingRole: existing.role,
        suggestedRole: suggestedRole
      });
    }
    
    // Create user-tenant association
    const userTenant = new UserTenant({
      userId,
      tenantId,
      role: suggestedRole,
      status: 'active',
      addedAt: new Date(),
      updatedAt: new Date(),
      invitedBy: req.user.uid
    });
    
    await userTenant.save();
    
    res.status(201).json({
      success: true,
      message: `Role '${getRoleDisplayName(suggestedRole)}' auto-assigned to ${email}`,
      userId,
      email,
      role: suggestedRole,
      roleDisplayName: getRoleDisplayName(suggestedRole),
      roleDescription: getRoleDescription(suggestedRole),
      tenantId
    });
  } catch (error) {
    console.error('Error auto-assigning role:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to auto-assign role',
      details: error.message
    });
  }
});

/**
 * GET /api/users/suggest-role
 * Suggest role for an email address (doesn't assign, just suggests)
 */
router.get('/suggest-role', verifyAuth, async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email parameter is required'
      });
    }
    
    const suggestedRole = determineRoleFromEmail(email);
    
    res.json({
      email,
      suggestedRole,
      roleDisplayName: suggestedRole ? getRoleDisplayName(suggestedRole) : null,
      roleDescription: suggestedRole ? getRoleDescription(suggestedRole) : null,
      canAssign: req.userRole ? canManageRole(req.userRole, suggestedRole || '') : false
    });
  } catch (error) {
    console.error('Error suggesting role:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to suggest role'
    });
  }
});

/**
 * POST /api/users/bulk-assign
 * Bulk assign roles to multiple users based on email patterns
 */
router.post('/bulk-assign', verifyAuth, extractTenantId, requireAdmin, async (req, res) => {
  try {
    const { emails, tenantId: targetTenantId } = req.body;
    
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'emails array is required'
      });
    }
    
    const tenantId = targetTenantId || req.tenantId;
    
    const results = [];
    
    for (const email of emails) {
      try {
        const suggestedRole = determineRoleFromEmail(email);
        
        if (!suggestedRole) {
          results.push({
            email,
            success: false,
            error: 'Could not determine role from email pattern'
          });
          continue;
        }
        
        // Check if requester can assign this role
        if (!canManageRole(req.userRole, suggestedRole)) {
          results.push({
            email,
            success: false,
            error: `Cannot assign role '${suggestedRole}'`
          });
          continue;
        }
        
        // Get user from Firebase
        let userRecord;
        try {
          userRecord = await auth.getUserByEmail(email);
        } catch (error) {
          if (error.code === 'auth/user-not-found') {
            results.push({
              email,
              success: false,
              error: 'User not found in Firebase Auth'
            });
            continue;
          }
          throw error;
        }
        
        const userId = userRecord.uid;
        
        // Check if already exists
        const existing = await UserTenant.findOne({ userId, tenantId });
        if (existing) {
          results.push({
            email,
            success: false,
            error: `Already has role '${existing.role}'`
          });
          continue;
        }
        
        // Create association
        const userTenant = new UserTenant({
          userId,
          tenantId,
          role: suggestedRole,
          status: 'active',
          addedAt: new Date(),
          updatedAt: new Date(),
          invitedBy: req.user.uid
        });
        
        await userTenant.save();
        
        results.push({
          email,
          success: true,
          role: suggestedRole,
          roleDisplayName: getRoleDisplayName(suggestedRole)
        });
      } catch (error) {
        results.push({
          email,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    res.json({
      message: `Processed ${results.length} emails: ${successCount} assigned, ${results.length - successCount} failed`,
      total: results.length,
      successful: successCount,
      failed: results.length - successCount,
      results
    });
  } catch (error) {
    console.error('Error bulk assigning roles:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to bulk assign roles'
    });
  }
});

module.exports = router;

