/**
 * FCAPS Permission Service (Frontend)
 * 
 * Service for managing FCAPS-based permissions
 * FCAPS: Fault, Configuration, Accounting, Performance, Security
 * Operations: read, write, delete
 */

import { getApiUrl } from '$lib/config/api';
import { authService } from './authService';
import { get } from 'svelte/store';
import { currentTenant } from '$lib/stores/tenantStore';

export interface FCAPSPermission {
  read: boolean;
  write: boolean;
  delete: boolean;
}

export interface ModulePermission {
  module: string;
  fault: FCAPSPermission;
  configuration: FCAPSPermission;
  accounting: FCAPSPermission;
  performance: FCAPSPermission;
  security: FCAPSPermission;
}

export interface UserPermissions {
  role: string;
  permissions: ModulePermission[];
  inheritFromRole?: boolean;
  hasFullAccess?: boolean;
  userPermissions?: ModulePermission[];
}

export interface RolePermissions {
  role: string;
  tenantId: string;
  permissions: ModulePermission[];
}

export const FCAPS_CATEGORIES = ['fault', 'configuration', 'accounting', 'performance', 'security'] as const;
export const FCAPS_OPERATIONS = ['read', 'write', 'delete'] as const;

export type FCAPSCategory = typeof FCAPS_CATEGORIES[number];
export type FCAPSOperation = typeof FCAPS_OPERATIONS[number];

/**
 * Permission Service
 */
class PermissionService {
  private async apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await authService.getAuthTokenForApi();
    if (!token) {
      throw new Error('Authentication token not available');
    }

    const tenantId = this.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant ID not available');
    }

    const apiUrl = getApiUrl('PERMISSIONS') || '/api/permissions';
    const url = `${apiUrl}${endpoint}`;

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantId,
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  private getTenantId(): string {
    // Get from tenant store (preferred method)
    if (typeof window !== 'undefined') {
      try {
        const tenant = get(currentTenant);
        if (tenant?.id) {
          return tenant.id;
        }
      } catch (error) {
        console.warn('[permissionService] Could not get tenant from store:', error);
      }
      
      // Fallback to localStorage
      return localStorage.getItem('selectedTenantId') || localStorage.getItem('tenantId') || '';
    }
    return '';
  }

  /**
   * Check if user has permission
   */
  async checkPermission(
    module: string,
    fcapsCategory: FCAPSCategory,
    operation: FCAPSOperation
  ): Promise<boolean> {
    const result = await this.apiCall(
      `/check?module=${encodeURIComponent(module)}&fcapsCategory=${fcapsCategory}&operation=${operation}`
    );
    return result.hasPermission || false;
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(userId: string): Promise<UserPermissions> {
    return await this.apiCall(`/user/${userId}`);
  }

  /**
   * Get current user's permissions
   */
  async getMyPermissions(): Promise<UserPermissions> {
    return await this.apiCall('/me');
  }

  /**
   * Set user permissions
   */
  async setUserPermissions(
    userId: string,
    permissions: ModulePermission[],
    inheritFromRole: boolean = true
  ): Promise<UserPermissions> {
    return await this.apiCall(`/user/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ permissions, inheritFromRole })
    });
  }

  /**
   * Get role permissions
   */
  async getRolePermissions(role: string): Promise<RolePermissions> {
    return await this.apiCall(`/role/${role}`);
  }

  /**
   * Set role permissions
   */
  async setRolePermissions(role: string, permissions: ModulePermission[]): Promise<RolePermissions> {
    return await this.apiCall(`/role/${role}`, {
      method: 'PUT',
      body: JSON.stringify({ permissions })
    });
  }

  /**
   * Get all role permissions for tenant
   */
  async getAllRolePermissions(): Promise<{ rolePermissions: RolePermissions[] }> {
    return await this.apiCall('/roles');
  }

  /**
   * Create empty module permission
   */
  createEmptyModulePermission(module: string): ModulePermission {
    const emptyFcaps: FCAPSPermission = {
      read: false,
      write: false,
      delete: false
    };

    return {
      module,
      fault: { ...emptyFcaps },
      configuration: { ...emptyFcaps },
      accounting: { ...emptyFcaps },
      performance: { ...emptyFcaps },
      security: { ...emptyFcaps }
    };
  }

  /**
   * Create full-access module permission
   */
  createFullAccessModulePermission(module: string): ModulePermission {
    const fullFcaps: FCAPSPermission = {
      read: true,
      write: true,
      delete: true
    };

    return {
      module,
      fault: { ...fullFcaps },
      configuration: { ...fullFcaps },
      accounting: { ...fullFcaps },
      performance: { ...fullFcaps },
      security: { ...fullFcaps }
    };
  }
}

export const permissionService = new PermissionService();

