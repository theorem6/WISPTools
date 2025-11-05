// Inventory Service - Frontend API interaction
// Communicates with backend inventory API

import { authService } from './authService';

// Use relative URL to leverage Firebase Hosting rewrites
// This goes through Firebase Hosting rewrite to apiProxy function
// DO NOT use VITE_HSS_API_URL as it may point to deprecated hssProxy
const API_URL = '';

export interface InventoryItem {
  _id?: string;
  assetTag?: string;
  barcode?: string;
  qrCode?: string;
  
  // Classification
  category: string;
  subcategory?: string;
  equipmentType: string;
  
  // Manufacturer
  manufacturer?: string;
  model?: string;
  partNumber?: string;
  serialNumber: string;
  macAddress?: string;
  
  // Software/Firmware
  firmwareVersion?: string;
  softwareVersion?: string;
  hardwareVersion?: string;
  
  // Status
  status: 'available' | 'deployed' | 'reserved' | 'in-transit' | 'maintenance' | 'rma' | 'retired' | 'lost' | 'sold';
  condition: 'new' | 'excellent' | 'good' | 'fair' | 'poor' | 'damaged' | 'refurbished';
  
  // Current Location
  currentLocation: {
    type: 'warehouse' | 'tower' | 'noc' | 'vehicle' | 'customer' | 'rma' | 'vendor' | 'other';
    siteId?: string;
    siteName?: string;
    warehouse?: {
      name?: string;
      section?: string;
      aisle?: string;
      shelf?: string;
      bin?: string;
    };
    tower?: {
      rack?: string;
      rackUnit?: string;
      cabinet?: string;
      position?: string;
    };
  };
  
  // Purchase Info
  purchaseInfo?: {
    vendor?: string;
    purchaseDate?: Date | string;
    purchasePrice?: number;
    purchaseOrderNumber?: string;
  };
  
  // Warranty
  warranty?: {
    provider?: string;
    startDate?: Date | string;
    endDate?: Date | string;
    type?: string;
  };
  
  // Technical Specs
  technicalSpecs?: {
    powerRequirements?: string;
    ipAddress?: string;
    managementUrl?: string;
  };
  
  // Module Integration (tracks which module manages this item)
  modules?: {
    acs?: {
      deviceId: string;
      lastSync?: Date | string;
      managedByACS?: boolean;
    };
    cbrs?: {
      cbsdId: string;
      lastSync?: Date | string;
    };
    coverageMap?: {
      siteId: string;
      lastSync?: Date | string;
    };
  };
  
  // Metadata
  notes?: string;
  tenantId: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface InventoryFilters {
  category?: string;
  status?: string;
  locationType?: string;
  locationId?: string;
  manufacturer?: string;
  model?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface InventoryStats {
  totalItems: number;
  byStatus: Array<{ _id: string; count: number }>;
  byCategory: Array<{ _id: string; count: number }>;
  byLocation: Array<{ _id: string; count: number }>;
  totalValue: number;
}

class InventoryService {
  private async getCurrentUser() {
    return await authService.getCurrentUser();
  }
  
  private async getAuthToken(): Promise<string> {
    const { auth } = await import('$lib/firebase');
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }
    return await currentUser.getIdToken();
  }
  
  private async apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAuthToken();
    const tenantId = localStorage.getItem('selectedTenantId');
    
    // Check if user is admin - if so, tenant is optional
    const currentUser = await this.getCurrentUser();
    const isAdmin = currentUser?.email === 'david@david.com' || currentUser?.email?.includes('admin');
    
    if (!tenantId && !isAdmin) {
      throw new Error('No tenant selected');
    }
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>
    };
    
    // Only add X-Tenant-ID header if we have a tenant or if user is not admin
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    } else if (!isAdmin) {
      throw new Error('No tenant selected');
    }
    
    // Use relative URL (goes through Firebase Hosting rewrite to apiProxy)
    const apiPath = API_URL || '/api';
    const response = await fetch(`${apiPath}/inventory${endpoint}`, {
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
  
  async getInventory(filters: InventoryFilters = {}): Promise<{ items: InventoryItem[]; pagination: any }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    
    const queryString = params.toString();
    return await this.apiCall(queryString ? `?${queryString}` : '');
  }
  
  async getItem(id: string): Promise<InventoryItem> {
    return await this.apiCall(`/${id}`);
  }
  
  async searchInventory(tenantId: string, serialNumber: string): Promise<InventoryItem[]> {
    const result = await this.getInventory({ search: serialNumber });
    return result.items.filter(item => 
      item.serialNumber?.toLowerCase() === serialNumber.toLowerCase()
    );
  }
  
  async createItem(item: Partial<InventoryItem>): Promise<InventoryItem> {
    return await this.apiCall('', {
      method: 'POST',
      body: JSON.stringify(item)
    });
  }
  
  async updateItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> {
    return await this.apiCall(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }
  
  async deleteItem(id: string): Promise<void> {
    await this.apiCall(`/${id}`, {
      method: 'DELETE'
    });
  }
  
  // ============================================================================
  // Special Operations
  // ============================================================================
  
  async transferItem(id: string, newLocation: any, reason?: string, movedBy?: string, notes?: string): Promise<InventoryItem> {
    return await this.apiCall(`/${id}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ newLocation, reason, movedBy, notes })
    });
  }
  
  async deployItem(id: string, deploymentInfo: any): Promise<InventoryItem> {
    return await this.apiCall(`/${id}/deploy`, {
      method: 'POST',
      body: JSON.stringify(deploymentInfo)
    });
  }
  
  async returnItem(id: string, returnLocation: any, reason?: string, notes?: string): Promise<InventoryItem> {
    return await this.apiCall(`/${id}/return`, {
      method: 'POST',
      body: JSON.stringify({ returnLocation, reason, notes })
    });
  }
  
  async addMaintenance(id: string, maintenanceData: any): Promise<InventoryItem> {
    return await this.apiCall(`/${id}/maintenance`, {
      method: 'POST',
      body: JSON.stringify(maintenanceData)
    });
  }
  
  async bulkImport(items: Partial<InventoryItem>[]): Promise<{ imported: number; total: number }> {
    return await this.apiCall('/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ items })
    });
  }
  
  async bulkUpdate(itemIds: string[], updates: Partial<InventoryItem>): Promise<{ matched: number; modified: number }> {
    return await this.apiCall('/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ itemIds, updates })
    });
  }
  
  // ============================================================================
  // Stats & Alerts
  // ============================================================================
  
  async getStats(): Promise<InventoryStats> {
    return await this.apiCall('/stats');
  }
  
  async getLowStockItems(threshold: number = 5): Promise<any[]> {
    return await this.apiCall(`/alerts/low-stock?threshold=${threshold}`);
  }
  
  async getExpiringWarranties(days: number = 30): Promise<InventoryItem[]> {
    return await this.apiCall(`/alerts/warranty-expiring?days=${days}`);
  }
  
  async getMaintenanceDue(days: number = 7): Promise<InventoryItem[]> {
    return await this.apiCall(`/alerts/maintenance-due?days=${days}`);
  }
  
  // ============================================================================
  // Location-based Queries
  // ============================================================================
  
  async getByLocation(locationType: string, locationId?: string): Promise<InventoryItem[]> {
    const endpoint = `/by-location/${locationType}${locationId ? `?locationId=${locationId}` : ''}`;
    return await this.apiCall(endpoint);
  }
  
  async getBySite(siteId: string): Promise<InventoryItem[]> {
    return await this.apiCall(`/by-site/${siteId}`);
  }
  
  // ============================================================================
  // Convenience Aliases
  // ============================================================================
  
  async createInventory(tenantId: string, item: Partial<InventoryItem>): Promise<InventoryItem> {
    return await this.createItem(item);
  }
  
  async updateInventory(tenantId: string, id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> {
    return await this.updateItem(id, updates);
  }
  
  async getInventoryByLocation(tenantId: string, locationType: string, locationId?: string): Promise<InventoryItem[]> {
    return await this.getByLocation(locationType, locationId);
  }
  
  // ============================================================================
  // Export
  // ============================================================================
  
  async exportCSV(): Promise<Blob> {
    const token = await this.getAuthToken();
    const tenantId = localStorage.getItem('selectedTenantId');
    
    // Use relative URL (goes through Firebase Hosting rewrite to apiProxy)
    const apiPath = API_URL || '/api';
    const response = await fetch(`${apiPath}/inventory/export/csv`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId!
      }
    });
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    return await response.blob();
  }
  
  downloadCSV(blob: Blob, filename: string = `inventory-${Date.now()}.csv`) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}

export const inventoryService = new InventoryService();

