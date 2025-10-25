/**
 * User Management Service
 * 
 * Handles all user management operations including:
 * - Inviting users
 * - Updating roles
 * - Managing permissions
 * - Suspending/activating users
 */

import { auth } from '$lib/firebase';
import type { UserRole, ModuleAccess } from '$lib/models/userRole';

const API_BASE_URL = import.meta.env.VITE_BACKEND_API_URL || 'https://136.112.111.167:3000';

/**
 * User in tenant
 */
export interface TenantUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  phoneNumber: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'pending_invitation';
  invitedBy: string;
  invitedAt: string | null;
  acceptedAt: string | null;
  addedAt: string;
  lastAccessAt: string | null;
  lastLoginAt: string | null;
  moduleAccess: ModuleAccess | null;
  workOrderPermissions: any | null;
}

/**
 * Get auth headers with Firebase token
 */
async function getAuthHeaders(tenantId: string): Promise<HeadersInit> {
  const user = auth().currentUser;
  if (!user) {
    throw new Error('Not authenticated');
  }

  const token = await user.getIdToken();
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': tenantId
  };
}

/**
 * Get all users in a tenant
 */
export async function getTenantUsers(tenantId: string): Promise<TenantUser[]> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    const response = await fetch(`${API_BASE_URL}/users/tenant/${tenantId}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch users');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching tenant users:', error);
    throw error;
  }
}

/**
 * Get all users across all tenants (admin only)
 */
export async function getAllUsers(): Promise<TenantUser[]> {
  try {
    const user = auth().currentUser;
    if (!user) {
      throw new Error('Not authenticated');
    }

    const token = await user.getIdToken();
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
      // Note: No X-Tenant-ID header for admin requests
    };
    
    const response = await fetch(`${API_BASE_URL}/users/all`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch all users');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching all users:', error);
    throw error;
  }
}

/**
 * Invite a new user to the tenant
 */
export async function inviteUser(
  tenantId: string,
  email: string,
  role: UserRole,
  customModuleAccess?: ModuleAccess
): Promise<{ invitationId: string; userId: string | null; status: string }> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    const response = await fetch(`${API_BASE_URL}/users/invite`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        role,
        tenantId,
        customModuleAccess
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to invite user');
    }

    return await response.json();
  } catch (error) {
    console.error('Error inviting user:', error);
    throw error;
  }
}

/**
 * Update user's role
 */
export async function updateUserRole(
  tenantId: string,
  userId: string,
  role: UserRole
): Promise<void> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    const response = await fetch(`${API_BASE_URL}/users/${userId}/role`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        role,
        tenantId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update role');
    }
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
}

/**
 * Update user's module access
 */
export async function updateUserModuleAccess(
  tenantId: string,
  userId: string,
  moduleAccess: ModuleAccess
): Promise<void> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    const response = await fetch(`${API_BASE_URL}/users/${userId}/modules`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        moduleAccess,
        tenantId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update module access');
    }
  } catch (error) {
    console.error('Error updating module access:', error);
    throw error;
  }
}

/**
 * Suspend a user
 */
export async function suspendUser(tenantId: string, userId: string): Promise<void> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    const response = await fetch(`${API_BASE_URL}/users/${userId}/suspend`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tenantId })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to suspend user');
    }
  } catch (error) {
    console.error('Error suspending user:', error);
    throw error;
  }
}

/**
 * Activate a suspended user
 */
export async function activateUser(tenantId: string, userId: string): Promise<void> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    const response = await fetch(`${API_BASE_URL}/users/${userId}/activate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tenantId })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to activate user');
    }
  } catch (error) {
    console.error('Error activating user:', error);
    throw error;
  }
}

/**
 * Remove user from tenant
 */
export async function removeUserFromTenant(tenantId: string, userId: string): Promise<void> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    const response = await fetch(`${API_BASE_URL}/users/${userId}/tenant/${tenantId}`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to remove user');
    }
  } catch (error) {
    console.error('Error removing user:', error);
    throw error;
  }
}

/**
 * Get user activity log
 */
export async function getUserActivity(tenantId: string, userId: string): Promise<any[]> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    const response = await fetch(`${API_BASE_URL}/users/${userId}/activity?tenantId=${tenantId}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch activity');
    }

    const data = await response.json();
    return data.activities || [];
  } catch (error) {
    console.error('Error fetching user activity:', error);
    throw error;
  }
}

