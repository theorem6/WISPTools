/**
 * FCAPS Permission Service
 * 
 * Provides functions to check and manage FCAPS-based permissions
 * FCAPS: Fault, Configuration, Accounting, Performance, Security
 * Operations: read, write, delete
 */

const { UserPermission, RolePermission, FCAPS_CATEGORIES, FCAPS_OPERATIONS } = require('../models/permission');
const { UserTenant } = require('../models/user');

/**
 * Check if user has permission for a specific FCAPS operation
 * @param {string} userId - User ID
 * @param {string} tenantId - Tenant ID
 * @param {string} module - Module/System identifier (e.g., 'inventory', 'customers')
 * @param {string} fcapsCategory - FCAPS category ('fault', 'configuration', 'accounting', 'performance', 'security')
 * @param {string} operation - Operation ('read', 'write', 'delete')
 * @returns {Promise<boolean>} - True if user has permission
 */
async function hasPermission(userId, tenantId, module, fcapsCategory, operation) {
  try {
    // Validate inputs
    if (!FCAPS_CATEGORIES.includes(fcapsCategory)) {
      throw new Error(`Invalid FCAPS category: ${fcapsCategory}. Must be one of: ${FCAPS_CATEGORIES.join(', ')}`);
    }
    if (!FCAPS_OPERATIONS.includes(operation)) {
      throw new Error(`Invalid operation: ${operation}. Must be one of: ${FCAPS_OPERATIONS.join(', ')}`);
    }
    
    // Get user's role in tenant
    const userTenant = await UserTenant.findOne({ userId, tenantId }).lean();
    if (!userTenant || userTenant.status !== 'active') {
      return false; // User not active in tenant
    }
    
    const role = userTenant.role;
    
    // Platform admin and owner have full access
    if (role === 'platform_admin' || role === 'owner') {
      return true;
    }
    
    // Check user-specific permissions first (if exists and doesn't inherit from role)
    const userPerm = await UserPermission.findOne({ userId, tenantId }).lean();
    if (userPerm && !userPerm.inheritFromRole) {
      return checkModulePermission(userPerm.permissions, module, fcapsCategory, operation);
    }
    
    // Check role-based permissions
    const rolePerm = await RolePermission.findOne({ role, tenantId }).lean();
    if (rolePerm) {
      const roleHasPermission = checkModulePermission(rolePerm.permissions, module, fcapsCategory, operation);
      
      // If user has custom permissions, merge with role permissions
      if (userPerm && userPerm.inheritFromRole) {
        const userHasPermission = checkModulePermission(userPerm.permissions, module, fcapsCategory, operation);
        // User permissions override role permissions (if explicitly set)
        if (userPerm.permissions.some(p => p.module === module)) {
          return userHasPermission;
        }
        return roleHasPermission;
      }
      
      return roleHasPermission;
    }
    
    // Default: no permission
    return false;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false; // Fail closed - deny permission on error
  }
}

/**
 * Check permission in a permissions array
 * @param {Array} permissions - Array of ModulePermissionSchema objects
 * @param {string} module - Module identifier
 * @param {string} fcapsCategory - FCAPS category
 * @param {string} operation - Operation
 * @returns {boolean}
 */
function checkModulePermission(permissions, module, fcapsCategory, operation) {
  if (!permissions || !Array.isArray(permissions)) {
    return false;
  }
  
  const modulePerm = permissions.find(p => p.module === module.toLowerCase());
  if (!modulePerm) {
    return false; // Module not in permissions list = no access
  }
  
  // Check the specific FCAPS category and operation
  return modulePerm[fcapsCategory]?.[operation] === true;
}

/**
 * Get all permissions for a user in a tenant
 * @param {string} userId - User ID
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} - Combined permissions (user + role)
 */
async function getUserPermissions(userId, tenantId) {
  try {
    const userTenant = await UserTenant.findOne({ userId, tenantId }).lean();
    if (!userTenant || userTenant.status !== 'active') {
      return { permissions: [], role: null };
    }
    
    const role = userTenant.role;
    
    // Platform admin and owner have full access
    if (role === 'platform_admin' || role === 'owner') {
      return {
        role,
        permissions: [],
        hasFullAccess: true
      };
    }
    
    // Get role permissions
    const rolePerm = await RolePermission.findOne({ role, tenantId }).lean();
    const rolePermissions = rolePerm?.permissions || [];
    
    // Get user permissions
    const userPerm = await UserPermission.findOne({ userId, tenantId }).lean();
    
    if (!userPerm || userPerm.inheritFromRole) {
      // Return role permissions only
      return {
        role,
        permissions: rolePermissions,
        inheritFromRole: true
      };
    }
    
    // Merge user and role permissions (user overrides role for specific modules)
    const mergedPermissions = mergePermissions(rolePermissions, userPerm.permissions);
    
    return {
      role,
      permissions: mergedPermissions,
      inheritFromRole: false,
      userPermissions: userPerm.permissions
    };
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return { permissions: [], role: null, error: error.message };
  }
}

/**
 * Merge role and user permissions (user permissions override role for same module)
 * @param {Array} rolePermissions - Role permissions
 * @param {Array} userPermissions - User-specific permissions
 * @returns {Array} - Merged permissions
 */
function mergePermissions(rolePermissions, userPermissions) {
  const merged = [...rolePermissions];
  
  if (userPermissions && Array.isArray(userPermissions)) {
    userPermissions.forEach(userPerm => {
      const index = merged.findIndex(p => p.module === userPerm.module);
      if (index >= 0) {
        // Override role permission with user permission
        merged[index] = userPerm;
      } else {
        // Add new user-specific permission
        merged.push(userPerm);
      }
    });
  }
  
  return merged;
}

/**
 * Get role permissions for a tenant
 * @param {string} role - Role name
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} - Role permissions
 */
async function getRolePermissions(role, tenantId) {
  try {
    const rolePerm = await RolePermission.findOne({ role, tenantId }).lean();
    return {
      role,
      tenantId,
      permissions: rolePerm?.permissions || []
    };
  } catch (error) {
    console.error('Error getting role permissions:', error);
    return { role, tenantId, permissions: [], error: error.message };
  }
}

/**
 * Set user permissions
 * @param {string} userId - User ID
 * @param {string} tenantId - Tenant ID
 * @param {Array} permissions - Array of module permissions
 * @param {boolean} inheritFromRole - Whether to inherit from role
 * @param {string} updatedBy - User ID who made the change
 * @returns {Promise<Object>} - Updated permissions
 */
async function setUserPermissions(userId, tenantId, permissions, inheritFromRole = true, updatedBy) {
  try {
    const userPerm = await UserPermission.findOneAndUpdate(
      { userId, tenantId },
      {
        userId,
        tenantId,
        permissions,
        inheritFromRole,
        updatedBy,
        updatedAt: new Date()
      },
      { upsert: true, new: true, runValidators: true }
    );
    
    return userPerm.toObject();
  } catch (error) {
    console.error('Error setting user permissions:', error);
    throw error;
  }
}

/**
 * Set role permissions
 * @param {string} role - Role name
 * @param {string} tenantId - Tenant ID
 * @param {Array} permissions - Array of module permissions
 * @param {string} updatedBy - User ID who made the change
 * @returns {Promise<Object>} - Updated permissions
 */
async function setRolePermissions(role, tenantId, permissions, updatedBy) {
  try {
    const rolePerm = await RolePermission.findOneAndUpdate(
      { role, tenantId },
      {
        role,
        tenantId,
        permissions,
        updatedBy,
        updatedAt: new Date()
      },
      { upsert: true, new: true, runValidators: true }
    );
    
    return rolePerm.toObject();
  } catch (error) {
    console.error('Error setting role permissions:', error);
    throw error;
  }
}

/**
 * Get default permissions for a role (used when no tenant-specific permissions exist)
 * @param {string} role - Role name
 * @returns {Object} - Default permissions structure
 */
function getDefaultRolePermissions(role) {
  // Default: viewer has no permissions, others get read-only for most modules
  const defaults = {
    platform_admin: {}, // Full access - no specific permissions needed
    owner: {}, // Full access - no specific permissions needed
    admin: {},
    engineer: {},
    installer: {},
    helpdesk: {},
    sales: {},
    viewer: {}
  };
  
  // Define default permissions per role (can be expanded)
  // For now, return empty - permissions must be explicitly set by tenant admin
  return defaults[role] || {};
}

module.exports = {
  hasPermission,
  getUserPermissions,
  getRolePermissions,
  setUserPermissions,
  setRolePermissions,
  getDefaultRolePermissions,
  checkModulePermission,
  FCAPS_CATEGORIES,
  FCAPS_OPERATIONS
};

