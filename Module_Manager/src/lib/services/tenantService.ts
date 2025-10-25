// Unified Tenant Management Service
// Uses backend API instead of direct Firestore for consistency with MongoDB user-tenant associations

import { browser } from '$app/environment';
import { auth } from '../firebase';
import type {
  Tenant,
  UserTenantAssociation,
  TenantRole,
  TenantInvitation,
  TenantSettings,
  TenantLimits
} from '../models/tenant';

export class TenantService {
  private baseUrl: string;
  private apiBaseUrl: string;

  constructor() {
    // Get base URL from environment or construct it
    this.baseUrl = browser ? window.location.origin : 
      process.env.VITE_CWMP_BASE_URL || 'https://your-domain.com';
    
    // Backend API URL - Direct connection to GCE backend
    this.apiBaseUrl = 'https://136.112.111.167:3000';
  }

  /**
   * Get authentication headers for API calls
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
    const user = auth().currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const token = await user.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Create a new tenant
   */
  async createTenant(
    name: string,
    displayName: string,
    contactEmail: string,
    createdBy: string,
    subdomain?: string,
    createOwnerAssociation: boolean = false,
    ownerEmail?: string
  ): Promise<{ success: boolean; tenantId?: string; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.apiBaseUrl}/admin/tenants`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name,
          displayName,
          contactEmail,
          subdomain,
          ownerEmail: createOwnerAssociation ? ownerEmail : undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to create tenant' };
      }

      const result = await response.json();
      return { success: true, tenantId: result.tenant.id };
    } catch (error) {
      console.error('Error creating tenant:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get tenant by ID (for regular users)
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.apiBaseUrl}/api/tenants/${tenantId}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to get tenant: ${response.statusText}`);
      }

      const tenant = await response.json();
      return this.mapApiTenantToTenant(tenant);
    } catch (error) {
      console.error('Error getting tenant:', error);
      return null;
    }
  }

  /**
   * Get tenant by ID (admin only)
   */
  async getTenantAdmin(tenantId: string): Promise<Tenant | null> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.apiBaseUrl}/admin/tenants/${tenantId}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to get tenant: ${response.statusText}`);
      }

      const tenant = await response.json();
      return this.mapApiTenantToTenant(tenant);
    } catch (error) {
      console.error('Error getting tenant:', error);
      return null;
    }
  }

  /**
   * Get all tenants (admin only)
   */
  async getAllTenants(): Promise<Tenant[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.apiBaseUrl}/admin/tenants`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to get tenants: ${response.statusText}`);
      }

      const tenants = await response.json();
      return tenants.map((tenant: any) => this.mapApiTenantToTenant(tenant));
    } catch (error) {
      console.error('Error getting all tenants:', error);
      return [];
    }
  }

  /**
   * Update a tenant (admin only)
   */
  async updateTenant(
    tenantId: string, 
    updates: Partial<Tenant>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.apiBaseUrl}/admin/tenants/${tenantId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to update tenant' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating tenant:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Delete a tenant (admin only)
   */
  async deleteTenant(tenantId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.apiBaseUrl}/admin/tenants/${tenantId}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to delete tenant' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting tenant:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Assign owner to a tenant
   */
  async assignOwner(tenantId: string, email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.apiBaseUrl}/admin/tenants/${tenantId}/assign-owner`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to assign owner' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error assigning owner:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get users in a tenant
   */
  async getTenantUsers(tenantId: string): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.apiBaseUrl}/admin/tenants/${tenantId}/users`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to get tenant users: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting tenant users:', error);
      return [];
    }
  }

  /**
   * Get user tenants (for regular users)
   */
  async getUserTenants(userId: string): Promise<Tenant[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.apiBaseUrl}/api/user-tenants/${userId}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to get user tenants: ${response.statusText}`);
      }

      const userTenants = await response.json();
      
      // Get tenant details for each user-tenant association
      const tenants: Tenant[] = [];
      for (const userTenant of userTenants) {
        const tenant = await this.getTenant(userTenant.tenantId);
        if (tenant) {
          tenants.push(tenant);
        }
      }
      
      return tenants;
    } catch (error) {
      console.error('Error getting user tenants:', error);
      return [];
    }
  }

  /**
   * Map API tenant response to Tenant model
   */
  private mapApiTenantToTenant(apiTenant: any): Tenant {
    return {
      id: apiTenant.id,
      name: apiTenant.name,
      displayName: apiTenant.displayName,
      subdomain: apiTenant.subdomain,
      cwmpUrl: apiTenant.cwmpUrl,
      contactEmail: apiTenant.contactEmail,
      settings: apiTenant.settings || {
        allowSelfRegistration: false,
        requireEmailVerification: true,
        maxUsers: 50,
        maxDevices: 1000,
        features: {
          acs: true,
          hss: true,
          pci: true,
          helpDesk: true,
          userManagement: true,
          customerManagement: true
        }
      },
      limits: apiTenant.limits || {
        maxUsers: 50,
        maxDevices: 1000,
        maxNetworks: 10,
        maxTowerSites: 100
      },
      createdAt: new Date(apiTenant.createdAt),
      updatedAt: new Date(apiTenant.updatedAt),
      createdBy: apiTenant.createdBy,
      status: apiTenant.status || 'active'
    };
  }

  /**
   * Generate subdomain from name
   */
  private generateSubdomain(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Get tenant by subdomain
   */
  async getTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
    try {
      const tenants = await this.getAllTenants();
      return tenants.find(t => t.subdomain === subdomain) || null;
    } catch (error) {
      console.error('Error getting tenant by subdomain:', error);
      return null;
    }
  }

  /**
   * Add user to tenant (legacy method - now handled by user management API)
   */
  async addUserToTenant(
    userId: string, 
    tenantId: string, 
    role: TenantRole
  ): Promise<{ success: boolean; error?: string }> {
    console.warn('addUserToTenant is deprecated - use user management API instead');
    return { success: false, error: 'Use user management API instead' };
  }

  /**
   * Remove user from tenant (legacy method - now handled by user management API)
   */
  async removeUserFromTenant(
    userId: string, 
    tenantId: string
  ): Promise<{ success: boolean; error?: string }> {
    console.warn('removeUserFromTenant is deprecated - use user management API instead');
    return { success: false, error: 'Use user management API instead' };
  }

  /**
   * Check if user has permission in tenant (legacy method)
   */
  async checkPermission(
    userId: string,
    tenantId: string,
    permission: keyof import('../models/tenant').TenantPermissions
  ): Promise<boolean> {
    console.warn('checkPermission is deprecated - use role-based access control instead');
    return false;
  }
}

// Export singleton instance
export const tenantService = new TenantService();