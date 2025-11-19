// Bundle Service - Frontend API interaction for hardware bundles
// Communicates with backend bundle API

import { authService } from './authService';
import { isPlatformAdmin } from './adminService';
import { getApiUrl } from '$lib/config/api';

// API Configuration
const API_URL = getApiUrl('BUNDLES');

export interface BundleItem {
  _id?: string;
  category: string;
  equipmentType: string;
  quantity: number;
  manufacturer?: string;
  model?: string;
  notes?: string;
  inventoryTemplateId?: string;
  estimatedCost?: number;
  specifications?: any;
}

export interface HardwareBundle {
  _id?: string;
  tenantId: string;
  name: string;
  description?: string;
  bundleType: 'standard' | 'custom' | 'site-deployment' | 'cpe-installation' | 'maintenance-kit' | 'emergency-kit';
  items: BundleItem[];
  estimatedTotalCost?: number;
  tags?: string[];
  status: 'active' | 'archived' | 'draft';
  usageCount?: number;
  lastUsedAt?: Date | string;
  images?: Array<{
    url: string;
    caption?: string;
    uploadedAt?: Date | string;
  }>;
  notes?: string;
  createdBy?: string;
  createdById?: string;
  updatedBy?: string;
  updatedById?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface BundleFilters {
  bundleType?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class BundleService {
  private async getAuthToken(): Promise<string> {
    const { auth } = await import('$lib/firebase');
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }
    return await currentUser.getIdToken();
  }
  
  private async apiCall(endpoint: string, options: RequestInit = {}, tenantId?: string): Promise<any> {
    const token = await this.getAuthToken();
    
    const resolvedTenantId = tenantId || (typeof window !== 'undefined' ? localStorage.getItem('selectedTenantId') : null);
    
    const currentUser = await authService.getCurrentUser();
    const isAdmin = isPlatformAdmin(currentUser?.email ?? null);
    
    if (!resolvedTenantId && !isAdmin) {
      throw new Error('No tenant selected');
    }
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>
    };
    
    if (resolvedTenantId) {
      headers['X-Tenant-ID'] = resolvedTenantId;
    }
    
    const apiPath = API_URL;
    const response = await fetch(`${apiPath}${endpoint}`, {
      ...options,
      headers
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || 'Request failed');
    }
    
    return await response.json();
  }
  
  // ============================================================================
  // CRUD Operations
  // ============================================================================
  
  async getBundles(filters: BundleFilters = {}): Promise<{ bundles: HardwareBundle[]; pagination: any }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    
    const queryString = params.toString();
    return await this.apiCall(queryString ? `?${queryString}` : '');
  }
  
  async getBundle(id: string): Promise<HardwareBundle> {
    return await this.apiCall(`/${id}`);
  }
  
  async createBundle(bundle: Partial<HardwareBundle>): Promise<HardwareBundle> {
    return await this.apiCall('', {
      method: 'POST',
      body: JSON.stringify(bundle)
    });
  }
  
  async updateBundle(id: string, updates: Partial<HardwareBundle>): Promise<HardwareBundle> {
    return await this.apiCall(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }
  
  async deleteBundle(id: string): Promise<void> {
    await this.apiCall(`/${id}`, {
      method: 'DELETE'
    });
  }
  
  // ============================================================================
  // Bundle Items Operations
  // ============================================================================
  
  async addItemToBundle(bundleId: string, item: BundleItem): Promise<HardwareBundle> {
    const result = await this.apiCall(`/${bundleId}/items`, {
      method: 'POST',
      body: JSON.stringify(item)
    });
    return result.bundle;
  }
  
  async updateBundleItem(bundleId: string, itemId: string, updates: Partial<BundleItem>): Promise<HardwareBundle> {
    const result = await this.apiCall(`/${bundleId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return result.bundle;
  }
  
  async removeBundleItem(bundleId: string, itemId: string): Promise<HardwareBundle> {
    const result = await this.apiCall(`/${bundleId}/items/${itemId}`, {
      method: 'DELETE'
    });
    return result.bundle;
  }
  
  // ============================================================================
  // Usage Tracking
  // ============================================================================
  
  async useBundle(bundleId: string): Promise<HardwareBundle> {
    const result = await this.apiCall(`/${bundleId}/use`, {
      method: 'POST'
    });
    return result.bundle;
  }
  
  // ============================================================================
  // Queries
  // ============================================================================
  
  async getBundlesByType(bundleType: string): Promise<HardwareBundle[]> {
    return await this.apiCall(`/type/${bundleType}`);
  }
  
  async searchBundles(query: string): Promise<HardwareBundle[]> {
    return await this.apiCall(`/search/${encodeURIComponent(query)}`);
  }
}

export const bundleService = new BundleService();

