/**
 * Customer Service
 * Manages customer lookup and management
 */

import { browser } from '$app/environment';
import { authService } from './authService';
import { currentTenant } from '../stores/tenantStore';
import { get } from 'svelte/store';

const API_URL = import.meta.env.VITE_HSS_API_URL || 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy';

export interface Customer {
  _id?: string;
  customerId: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  primaryPhone: string;
  alternatePhone?: string;
  email?: string;
  serviceAddress: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  serviceStatus: 'pending' | 'active' | 'suspended' | 'cancelled' | 'trial';
  servicePlan?: {
    planName?: string;
    downloadMbps?: number;
    uploadMbps?: number;
  };
  networkInfo?: {
    imsi?: string;
    msisdn?: string;
    ipAddress?: string;
    cpeSerialNumber?: string;
  };
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CustomerSearchFilters {
  search?: string;
  status?: string;
  limit?: number;
}

class CustomerService {
  private async apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!browser) {
      throw new Error('Customer service can only be used in browser');
    }

    const token = await authService.getIdToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const tenantId = get(currentTenant)?.id;
    if (!tenantId) {
      throw new Error('No tenant selected');
    }

    const response = await fetch(`${API_URL}/api/customers${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `Request failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Search customers by name, phone, or email
   */
  async searchCustomers(filters: CustomerSearchFilters = {}): Promise<Customer[]> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.limit) params.append('limit', String(filters.limit));

    const queryString = params.toString();
    return await this.apiCall(queryString ? `?${queryString}` : '');
  }

  /**
   * Get customer by ID
   */
  async getCustomer(id: string): Promise<Customer> {
    return await this.apiCall(`/${id}`);
  }

  /**
   * Get customer by customer ID
   */
  async getCustomerById(customerId: string): Promise<Customer> {
    const customers = await this.searchCustomers({ search: customerId, limit: 1 });
    if (customers.length === 0) {
      throw new Error('Customer not found');
    }
    return customers[0];
  }

  /**
   * Create new customer
   */
  async createCustomer(customer: Partial<Customer>): Promise<Customer> {
    return await this.apiCall('', {
      method: 'POST',
      body: JSON.stringify(customer)
    });
  }

  /**
   * Update customer
   */
  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    return await this.apiCall(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  /**
   * Delete customer (soft delete - sets isActive to false)
   */
  async deleteCustomer(id: string): Promise<void> {
    return await this.apiCall(`/${id}`, {
      method: 'DELETE'
    });
  }
}

export const customerService = new CustomerService();

