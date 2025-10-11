// Multi-Tenant Data Models
// Defines tenant structure and user-tenant associations

export interface Tenant {
  id: string;
  name: string;
  displayName: string;
  subdomain: string; // Unique subdomain for CWMP URLs
  cwmpUrl: string; // Full CWMP URL for this tenant
  
  // Contact Information
  contactEmail: string;
  contactPhone?: string;
  
  // Settings
  settings: TenantSettings;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // User ID who created this tenant
  status: 'active' | 'suspended' | 'trial';
  
  // Limits
  limits: TenantLimits;
}

export interface TenantSettings {
  // GenieACS Configuration
  cwmpPort?: number;
  informInterval: number; // Device inform interval in seconds (default 300)
  
  // Monitoring Settings
  enableAutoDiscovery: boolean;
  enablePCIMonitoring: boolean;
  enablePerformanceMonitoring: boolean;
  
  // Notification Settings
  emailNotifications: boolean;
  notificationEmails: string[];
  
  // Data Retention
  dataRetentionDays: number; // How long to keep historical data
  
  // Custom Fields
  customFields?: Record<string, any>;
}

export interface TenantLimits {
  maxDevices: number;
  maxUsers: number;
  maxNetworks: number;
  storageQuotaMB: number;
}

export interface UserTenantAssociation {
  userId: string;
  tenantId: string;
  role: TenantRole;
  permissions: TenantPermissions;
  createdAt: Date;
  invitedBy?: string; // User ID who invited this user
}

export type TenantRole = 'owner' | 'admin' | 'operator' | 'viewer';

export interface TenantPermissions {
  canManageDevices: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canViewReports: boolean;
  canExportData: boolean;
  canManageNetworks: boolean;
  canManagePresets: boolean;
  canManageProvisions: boolean;
}

// Default permissions for each role
export const DEFAULT_PERMISSIONS: Record<TenantRole, TenantPermissions> = {
  owner: {
    canManageDevices: true,
    canManageUsers: true,
    canManageSettings: true,
    canViewReports: true,
    canExportData: true,
    canManageNetworks: true,
    canManagePresets: true,
    canManageProvisions: true
  },
  admin: {
    canManageDevices: true,
    canManageUsers: true,
    canManageSettings: true,
    canViewReports: true,
    canExportData: true,
    canManageNetworks: true,
    canManagePresets: true,
    canManageProvisions: true
  },
  operator: {
    canManageDevices: true,
    canManageUsers: false,
    canManageSettings: false,
    canViewReports: true,
    canExportData: true,
    canManageNetworks: true,
    canManagePresets: false,
    canManageProvisions: false
  },
  viewer: {
    canManageDevices: false,
    canManageUsers: false,
    canManageSettings: false,
    canViewReports: true,
    canExportData: false,
    canManageNetworks: false,
    canManagePresets: false,
    canManageProvisions: false
  }
};

// Tenant invitation
export interface TenantInvitation {
  id: string;
  tenantId: string;
  email: string;
  role: TenantRole;
  invitedBy: string; // User ID
  invitedAt: Date;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  acceptedAt?: Date;
  acceptedBy?: string; // User ID
}

// Helper function to get CWMP URL for a tenant
export function getCWMPUrl(tenant: Tenant, baseUrl: string): string {
  // Generate unique CWMP URL using subdomain or tenant ID
  // Example: https://cwmp-{subdomain}.your-domain.com/cwmp
  // Or: https://your-domain.com/cwmp/{tenantId}
  return `${baseUrl}/cwmp/${tenant.subdomain}`;
}

// Helper function to extract tenant identifier from CWMP request
export function extractTenantFromCWMPUrl(url: string): string | null {
  // Extract subdomain or tenant ID from URL
  // Format: /cwmp/{subdomain} or /cwmp/{tenantId}
  const match = url.match(/\/cwmp\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Default tenant settings
export const DEFAULT_TENANT_SETTINGS: TenantSettings = {
  informInterval: 300, // 5 minutes
  enableAutoDiscovery: true,
  enablePCIMonitoring: true,
  enablePerformanceMonitoring: true,
  emailNotifications: true,
  notificationEmails: [],
  dataRetentionDays: 90
};

// Default tenant limits (can be adjusted based on plan)
export const DEFAULT_TENANT_LIMITS: TenantLimits = {
  maxDevices: 100,
  maxUsers: 5,
  maxNetworks: 10,
  storageQuotaMB: 1000
};

