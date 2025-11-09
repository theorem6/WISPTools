/**
 * Role-Based Authentication Middleware
 * 
 * Provides middleware functions to enforce role-based access control
 * for API endpoints and module access.
 * 
 * Architecture:
 * - Firebase Auth: User authentication (login, tokens, SSO)
 * - MongoDB Atlas: User-tenant relationships, roles, permissions
 */

const { admin, auth, firestore } = require('../config/firebase');
const { UserTenant } = require('../models/user');
const { 
  determineRoleFromEmail, 
  getCreatableRoles, 
  canManageRole,
  getRoleDisplayName,
  getRoleDescription
} = require('../config/user-hierarchy');
const { isPlatformAdminEmail } = require('../utils/platformAdmin');

// ============================================================================
// ROLE DEFINITIONS (must match frontend TypeScript)
// ============================================================================

const VALID_ROLES = [
  'platform_admin',
  'owner',
  'admin',
  'engineer',
  'installer',
  'helpdesk',
  'sales',
  'viewer'
];

// Module access configuration per role
const DEFAULT_MODULE_ACCESS = {
  platform_admin: {
    pciResolution: true,
    cbrsManagement: true,
    acsManagement: true,
    hssManagement: true,
    coverageMap: true,
    inventory: true,
    workOrders: true,
    helpDesk: true,
    distributedEpc: true,
    monitoring: true,
    userManagement: true,
    tenantSettings: true,
    backendManagement: true,
    billing: true,
    tenantManagement: true
  },
  owner: {
    pciResolution: true,
    cbrsManagement: true,
    acsManagement: true,
    hssManagement: true,
    coverageMap: true,
    inventory: true,
    workOrders: true,
    helpDesk: true,
    distributedEpc: true,
    monitoring: true,
    userManagement: true,
    tenantSettings: true,
    backendManagement: false,
    billing: true,
    tenantManagement: false
  },
  admin: {
    pciResolution: true,
    cbrsManagement: true,
    acsManagement: true,
    hssManagement: true,
    coverageMap: true,
    inventory: true,
    workOrders: true,
    helpDesk: true,
    distributedEpc: true,
    monitoring: true,
    userManagement: true,
    tenantSettings: true,
    backendManagement: false,
    billing: false,
    tenantManagement: false
  },
  engineer: {
    pciResolution: true,
    cbrsManagement: true,
    acsManagement: true,
    hssManagement: true,
    coverageMap: true,
    inventory: true,
    workOrders: true,
    helpDesk: false,
    distributedEpc: true,
    monitoring: true,
    userManagement: false,
    tenantSettings: false,
    backendManagement: false,
    billing: false,
    tenantManagement: false,
    planCreation: true,  // Can create deployment plans
    planApproval: false, // Cannot approve plans (admin/owner only)
    planView: true,      // Can view all plans
    siteManagement: true, // Full site management access
    deployment: true     // Can deploy equipment
  },
  installer: {
    pciResolution: false,
    cbrsManagement: false,
    acsManagement: false,
    hssManagement: false,
    coverageMap: true,    // Can view sites for installation
    inventory: true,      // Can check out/return equipment
    workOrders: true,     // Can view assigned work orders
    helpDesk: false,
    distributedEpc: false,
    monitoring: false,
    userManagement: false,
    tenantSettings: false,
    backendManagement: false,
    billing: false,
    tenantManagement: false,
    planCreation: false,  // Cannot create plans
    planApproval: false,  // Cannot approve plans
    planView: true,       // Can view assigned plans (mobile app)
    siteManagement: false, // Cannot create/edit sites
    deployment: true,     // Can deploy equipment in field
    mobileAccess: true    // Full mobile app access
  },
  helpdesk: {
    pciResolution: false,
    cbrsManagement: false,
    acsManagement: true,
    hssManagement: false,
    coverageMap: true,
    inventory: true,
    workOrders: true,
    helpDesk: true,
    distributedEpc: false,
    monitoring: true,
    userManagement: false,
    tenantSettings: false,
    backendManagement: false,
    billing: false,
    tenantManagement: false
  },
  viewer: {
    pciResolution: true,   // Read-only
    cbrsManagement: true,  // Read-only
    acsManagement: true,   // Read-only
    hssManagement: true,   // Read-only
    coverageMap: true,     // Read-only
    inventory: true,       // Read-only
    workOrders: true,      // Read-only
    helpDesk: true,        // Read-only
    distributedEpc: true,  // Read-only
    monitoring: true,      // Read-only
    userManagement: false,
    tenantSettings: false,
    backendManagement: false,
    billing: false,
    tenantManagement: false,
    planCreation: false,   // Cannot create plans
    planApproval: false,   // Cannot approve plans
    planView: true,        // Can view plans (read-only)
    siteManagement: false, // Cannot edit sites
    deployment: false,     // Cannot deploy
    mobileAccess: false    // No mobile app access
  },
  
  // Sales role (new)
  sales: {
    pciResolution: false,
    cbrsManagement: false,
    acsManagement: false,
    hssManagement: false,
    coverageMap: true,     // Can view coverage map for sales presentations
    inventory: true,       // Can view inventory availability
    workOrders: false,
    helpDesk: true,        // Can view customer tickets
    distributedEpc: false,
    monitoring: false,
    userManagement: false,
    tenantSettings: false,
    backendManagement: false,
    billing: true,         // Can view billing for customers
    tenantManagement: false,
    planCreation: false,   // Cannot create plans
    planApproval: false,   // Cannot approve plans
    planView: true,        // Can view plans for customer discussions
    siteManagement: false, // Cannot edit sites
    deployment: false,     // Cannot deploy
    mobileAccess: false    // Limited mobile access
  }
};

// Work order permissions per role
const WORK_ORDER_PERMISSIONS = {
  platform_admin: {
    canViewAll: true,
    canViewAssigned: true,
    canCreate: true,
    canAssign: true,
    canReassign: true,
    canClose: true,
    canDelete: true,
    canEscalate: true
  },
  owner: {
    canViewAll: true,
    canViewAssigned: true,
    canCreate: true,
    canAssign: true,
    canReassign: true,
    canClose: true,
    canDelete: true,
    canEscalate: true
  },
  admin: {
    canViewAll: true,
    canViewAssigned: true,
    canCreate: true,
    canAssign: true,
    canReassign: true,
    canClose: true,
    canDelete: true,
    canEscalate: true
  },
  engineer: {
    canViewAll: true,
    canViewAssigned: true,
    canCreate: true,
    canAssign: false,
    canReassign: false,
    canClose: true,
    canDelete: false,
    canEscalate: true
  },
  installer: {
    canViewAll: false,
    canViewAssigned: true,
    canCreate: false,
    canAssign: false,
    canReassign: false,
    canClose: true,
    canDelete: false,
    canEscalate: false
  },
  helpdesk: {
    canViewAll: true,
    canViewAssigned: true,
    canCreate: true,
    canAssign: true,
    canReassign: true,
    canClose: true,
    canDelete: false,
    canEscalate: true
  },
  viewer: {
    canViewAll: true,
    canViewAssigned: true,
    canCreate: false,
    canAssign: false,
    canReassign: false,
    canClose: false,
    canDelete: false,
    canEscalate: false
  },
  sales: {
    canViewAll: false,
    canViewAssigned: false,
    canCreate: false,
    canAssign: false,
    canReassign: false,
    canClose: false,
    canDelete: false,
    canEscalate: false
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get user's role in a specific tenant
 * @param {string} userId - Firebase Auth UID
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<string|null>} User role or null if not found
 */
async function getUserTenantRole(userId, tenantId) {
  try {
    const userTenant = await UserTenant.findOne({ userId, tenantId }).lean();
    
    if (!userTenant) {
      return null;
    }
    
    // Check if user is suspended
    if (userTenant.status === 'suspended') {
      return null;
    }
    
    return userTenant.role || null;
  } catch (error) {
    console.error('Error getting user tenant role:', error);
    return null;
  }
}

/**
 * Check if user is platform admin
 * @param {string} email - User email
 * @returns {boolean}
 */
function isPlatformAdmin(email) {
  return isPlatformAdminEmail(email);
}

/**
 * Get module access for a role with optional tenant overrides
 * @param {string} role - User role
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Module access object
 */
async function getModuleAccess(role, tenantId) {
  try {
    // For now, just return default access
    // TODO: Implement tenant-specific module config in MongoDB if needed
    return DEFAULT_MODULE_ACCESS[role] || {};
  } catch (error) {
    console.error('Error getting module access:', error);
    return DEFAULT_MODULE_ACCESS[role] || {};
  }
}

/**
 * Get work order permissions for a role
 * @param {string} role - User role
 * @returns {Object} Work order permissions
 */
function getWorkOrderPermissions(role) {
  return WORK_ORDER_PERMISSIONS[role] || WORK_ORDER_PERMISSIONS.viewer;
}

// ============================================================================
// MIDDLEWARE FUNCTIONS
// ============================================================================

/**
 * Verify Firebase authentication token
 * Attaches user info to req.user
 */
async function verifyAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decodedToken = await auth.verifyIdToken(token);
      
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        isPlatformAdmin: isPlatformAdmin(decodedToken.email)
      };
      
      next();
    } catch (tokenError) {
      console.error('Token verification failed:', tokenError);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
}

/**
 * Extract tenant ID from request
 * Checks X-Tenant-ID header or tenantId in body/params
 */
function extractTenantId(req, res, next) {
  const tenantId = req.headers['x-tenant-id'] || 
                   req.body?.tenantId || 
                   req.params?.tenantId ||
                   req.query?.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing tenant ID'
    });
  }
  
  req.tenantId = tenantId;
  next();
}

/**
 * Require specific role(s)
 * @param {string|string[]} roles - Required role(s)
 */
function requireRole(roles) {
  const requiredRoles = Array.isArray(roles) ? roles : [roles];
  
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }
      
      if (!req.tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Tenant ID required'
        });
      }
      
      // Platform admin bypasses ALL role checks
      if (isPlatformAdmin(req.user.email)) {
        req.userRole = 'platform_admin';
        req.user.isPlatformAdmin = true;
        console.log(`✅ Platform admin access granted: ${req.user.email}`);
        return next();
      }
      
      // Get user's role in tenant from MongoDB
      let userRole = await getUserTenantRole(req.user.uid, req.tenantId);
      
      // AUTO-FIX: If user not in MongoDB, check Firestore and migrate if they're the owner
      if (!userRole) {
        console.log(`⚠️ User ${req.user.email} not in MongoDB for tenant ${req.tenantId}. Checking Firestore...`);
        
        try {
          // Check Firestore for tenant creation data (legacy)
          const tenantDoc = await firestore.collection('tenants').doc(req.tenantId).get();
          
          if (tenantDoc.exists()) {
            const tenantData = tenantDoc.data();
            
            // Check if this user is the tenant creator
            if (tenantData.createdBy === req.user.uid) {
              console.log(`✅ User ${req.user.email} is tenant creator. Auto-creating owner record...`);
              
              // Create owner record in MongoDB
              const { UserTenant } = require('./user-schema');
              const ownerRecord = new UserTenant({
                userId: req.user.uid,
                tenantId: req.tenantId,
                role: 'owner',
                status: 'active',
                invitedBy: req.user.uid,
                invitedAt: new Date(),
                acceptedAt: new Date(),
                addedAt: new Date()
              });
              
              await ownerRecord.save();
              userRole = 'owner';
              
              console.log(`✅ Auto-created owner record for ${req.user.email}`);
            }
          }
        } catch (migrateError) {
          console.error('Error auto-migrating user:', migrateError);
        }
        
        // If still no role, they're not a member
        if (!userRole) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Not a member of this tenant or account suspended'
          });
        }
      }
      
      // Check if user has required role
      if (!requiredRoles.includes(userRole)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Requires one of: ${requiredRoles.join(', ')}. You have: ${userRole}`
        });
      }
      
      req.userRole = userRole;
      next();
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Role verification failed'
      });
    }
  };
}

/**
 * Require access to a specific module
 * @param {string} moduleName - Module name (e.g., 'pciResolution')
 */
function requireModule(moduleName) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }
      
      if (!req.tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Tenant ID required'
        });
      }
      
      // Platform admin bypasses module checks
      if (req.user.isPlatformAdmin) {
        req.userRole = 'platform_admin';
        return next();
      }
      
      // Get user's role
      const userRole = await getUserTenantRole(req.user.uid, req.tenantId);
      
      if (!userRole) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Not a member of this tenant'
        });
      }
      
      // Get module access for this role
      const moduleAccess = await getModuleAccess(userRole, req.tenantId);
      
      if (!moduleAccess[moduleName]) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Module '${moduleName}' not enabled for your role`
        });
      }
      
      req.userRole = userRole;
      req.moduleAccess = moduleAccess;
      next();
    } catch (error) {
      console.error('Module check error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Module access verification failed'
      });
    }
  };
}

/**
 * Require specific work order permission
 * @param {string} permission - Permission name (e.g., 'canAssign')
 */
function requireWorkOrderPermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }
      
      if (!req.tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Tenant ID required'
        });
      }
      
      // Platform admin bypasses permission checks
      if (req.user.isPlatformAdmin) {
        req.userRole = 'platform_admin';
        return next();
      }
      
      // Get user's role
      const userRole = await getUserTenantRole(req.user.uid, req.tenantId);
      
      if (!userRole) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Not a member of this tenant'
        });
      }
      
      // Get work order permissions for this role
      const permissions = getWorkOrderPermissions(userRole);
      
      if (!permissions[permission]) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Work order permission '${permission}' not granted for your role`
        });
      }
      
      req.userRole = userRole;
      req.workOrderPermissions = permissions;
      next();
    } catch (error) {
      console.error('Work order permission check error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Permission verification failed'
      });
    }
  };
}

/**
 * Filter work orders based on role
 * Installers should only see their assigned tickets
 */
function filterWorkOrdersByRole(req, res, next) {
  // If installer, add filter for assigned tickets only
  if (req.userRole === 'installer') {
    req.workOrderFilter = {
      assignedTo: req.user.uid
    };
  }
  
  next();
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Middleware
  verifyAuth,
  extractTenantId,
  requireRole,
  requireModule,
  requireWorkOrderPermission,
  filterWorkOrdersByRole,
  
  // Helper functions
  getUserTenantRole,
  isPlatformAdmin,
  getModuleAccess,
  getWorkOrderPermissions,
  
  // Constants
  VALID_ROLES,
  DEFAULT_MODULE_ACCESS,
  WORK_ORDER_PERMISSIONS
};

