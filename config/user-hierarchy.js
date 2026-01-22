/**
 * User Hierarchy Configuration
 * Industry-standard WISP/Telecom role hierarchy with email-based auto-assignment
 * 
 * Hierarchy Levels:
 * 1. Platform Admin - Full system access
 * 2. Owner/CEO - Full tenant access, billing, financial
 * 3. Operations Manager/Admin - Operations oversight, approvals, scheduling
 * 4. Network Engineer - Technical design, configuration, network operations
 * 5. Field Technician/Installer - Field installations, maintenance, equipment
 * 6. Customer Service/Helpdesk - Customer support, ticket management
 * 7. Sales/Account Manager - Customer-facing, limited technical
 * 8. Read-only/Viewer - View-only access for audits/compliance
 */

const { PLATFORM_ADMIN_EMAILS } = require('../utils/platformAdmin');

// Email domain/pattern mappings for auto-role assignment
const EMAIL_ROLE_MAPPINGS = {
  // Platform admin - specific emails
  platform_admin: PLATFORM_ADMIN_EMAILS,
  
  // Owner patterns - C-level executives
  owner: [
    /@.*\.(com|net|org)$/i, // Default for non-corporate domains
    /^(owner|ceo|president|founder)/i, // owner@company.com, ceo@company.com
    /@.*\b(owner|executive)\b/i // executive@company.com
  ],
  
  // Admin/Operations Manager patterns
  admin: [
    /^(admin|manager|operations|ops|director)/i, // admin@, manager@, operations@
    /@.*\b(admin|management|operations|ops)\b/i, // admin@company.com
    /\.(ops|admin|mgmt)@/i // ops.company.com
  ],
  
  // Engineer patterns - technical staff
  engineer: [
    /^(engineer|network|technical|tech|it|engineer\.|network\.)/i,
    /@.*\b(engineering|technical|network|it)\b/i,
    /\.(eng|tech|it|network)@/i,
    /engineer\d*@/i // engineer1@, engineer2@
  ],
  
  // Installer/Field Technician patterns
  installer: [
    /^(installer|technician|field|tech|install|fieldtech|tower|crew)/i,
    /@.*\b(installation|field|technician|tower|crew)\b/i,
    /\.(install|field|tech)@/i,
    /tech\d*@/i // tech1@, tech2@
  ],
  
  // Helpdesk/Customer Service patterns
  helpdesk: [
    /^(helpdesk|support|customer|service|help|ticket)/i,
    /@.*\b(support|customer|helpdesk|service)\b/i,
    /\.(support|help|service)@/i,
    /support\d*@/i // support1@, support2@
  ],
  
  // Sales patterns
  sales: [
    /^(sales|account|accountmanager|business)/i,
    /@.*\b(sales|account|business|marketing)\b/i,
    /\.(sales|account|biz)@/i
  ],
  
  // Viewer/Read-only patterns
  viewer: [
    /^(viewer|readonly|audit|compliance|report)/i,
    /@.*\b(audit|compliance|readonly|viewer)\b/i
  ]
};

/**
 * Determine user role based on email address
 * @param {string} email - User email address
 * @returns {string|null} Assigned role or null if no match
 */
function determineRoleFromEmail(email) {
  if (!email) return null;
  
  const lowerEmail = email.toLowerCase();
  
  // Check exact matches first (platform admin)
  for (const exactEmail of EMAIL_ROLE_MAPPINGS.platform_admin) {
    if (lowerEmail === exactEmail.toLowerCase()) {
      return 'platform_admin';
    }
  }
  
  // Check pattern matches in order of specificity
  const checkPatterns = (patterns) => {
    for (const pattern of patterns) {
      if (typeof pattern === 'string') {
        if (lowerEmail === pattern.toLowerCase()) {
          return true;
        }
      } else if (pattern instanceof RegExp) {
        if (pattern.test(email)) {
          return true;
        }
      }
    }
    return false;
  };
  
  // Check in order: owner, admin, engineer, installer, helpdesk, sales, viewer
  const roleOrder = ['owner', 'admin', 'engineer', 'installer', 'helpdesk', 'sales', 'viewer'];
  
  for (const role of roleOrder) {
    if (EMAIL_ROLE_MAPPINGS[role] && checkPatterns(EMAIL_ROLE_MAPPINGS[role])) {
      return role;
    }
  }
  
  // Default: if email contains company domain, assign 'engineer'
  // Otherwise, assign 'viewer' for safety
  if (email.includes('@')) {
    return 'engineer'; // Default technical role
  }
  
  return 'viewer'; // Safe default
}

/**
 * Role hierarchy - who can create/manage which roles
 */
const ROLE_HIERARCHY = {
  platform_admin: ['platform_admin', 'owner', 'admin', 'engineer', 'installer', 'helpdesk', 'support', 'sales', 'viewer'],
  owner: ['admin', 'engineer', 'installer', 'helpdesk', 'support', 'sales', 'viewer'],
  admin: ['engineer', 'installer', 'helpdesk', 'support', 'sales', 'viewer'],
  engineer: ['installer', 'viewer'], // Engineers can create installer accounts
  installer: [], // Cannot create other users
  helpdesk: [], // Cannot create other users
  support: [], // Cannot create other users
  sales: [], // Cannot create other users
  viewer: [] // Cannot create other users
};

/**
 * Get roles that a user can create/manage
 * @param {string} role - Current user role
 * @returns {string[]} Array of creatable roles
 */
function getCreatableRoles(role) {
  return ROLE_HIERARCHY[role] || [];
}

/**
 * Check if role1 can manage role2
 * @param {string} managerRole - Role of the manager
 * @param {string} targetRole - Role to be managed
 * @returns {boolean}
 */
function canManageRole(managerRole, targetRole) {
  const creatableRoles = ROLE_HIERARCHY[managerRole] || [];
  return creatableRoles.includes(targetRole) || managerRole === targetRole;
}

/**
 * Get role display name
 */
function getRoleDisplayName(role) {
  const names = {
    platform_admin: 'Platform Administrator',
    owner: 'Owner/CEO',
    admin: 'Operations Manager',
    engineer: 'Network Engineer',
    installer: 'Field Technician',
    helpdesk: 'Customer Service',
    support: 'Customer Support',
    sales: 'Sales/Account Manager',
    viewer: 'Read-only Viewer'
  };
  return names[role] || role;
}

/**
 * Get role description
 */
function getRoleDescription(role) {
  const descriptions = {
    platform_admin: 'Full system access across all tenants and platform management',
    owner: 'Full access to tenant operations, billing, and user management',
    admin: 'Operations oversight, approvals, scheduling, and team management',
    engineer: 'Technical design, network configuration, and system troubleshooting',
    installer: 'Field installations, equipment deployment, and on-site maintenance',
    helpdesk: 'Customer support, ticket management, and service inquiries',
    support: 'Customer portal management and support ticket handling',
    sales: 'Customer relationships, account management, and limited technical view',
    viewer: 'Read-only access for audits, reporting, and compliance'
  };
  return descriptions[role] || '';
}

module.exports = {
  EMAIL_ROLE_MAPPINGS,
  determineRoleFromEmail,
  ROLE_HIERARCHY,
  getCreatableRoles,
  canManageRole,
  getRoleDisplayName,
  getRoleDescription
};

