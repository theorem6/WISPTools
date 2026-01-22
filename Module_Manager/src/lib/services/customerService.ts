/**
 * Customer Service
 * Manages customer lookup and management
 */

import { browser } from '$app/environment';
import { authService } from './authService';

// Use relative URL to leverage Firebase Hosting rewrites
// This goes through Firebase Hosting rewrite to apiProxy function
// Works for all domains: wisptools.io, wisptools-production.web.app, wisptools-production.firebaseapp.com
const getApiUrl = (): string => {
  // Always use relative URL - Firebase Hosting rewrites handle all domains
  return '';
};

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
  serviceType?: '4G/5G' | 'FWA' | 'WiFi' | 'Fiber';
  groupId?: string;
  servicePlan?: {
    planId?: string;
    planName?: string;
    downloadMbps?: number;
    uploadMbps?: number;
    monthlyFee?: number;
    currency?: string;
    qci?: number;
    maxBandwidthDl?: number;
    maxBandwidthUl?: number;
    dataQuota?: number;
    priorityLevel?: 'low' | 'medium' | 'high' | 'premium';
  };
  lteAuth?: {
    ki?: string;
    op?: string;
    opc?: string;
    sqn?: number;
  };
  macAddress?: string;
  networkInfo?: {
    imsi?: string;
    msisdn?: string;
    ipAddress?: string;
    cpeSerialNumber?: string;
    lastOnline?: Date | string;
  };
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    sameAsService?: boolean;
  };
  notes?: string;
  tags?: string[];
  isActive?: boolean;
  isLead?: boolean;
  leadSource?: string;
  associatedPlanId?: string | null;
  leadStatus?: 'new' | 'contacted' | 'qualified' | 'converted' | 'disqualified';
  leadMetadata?: Record<string, unknown>;
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

    // Use localStorage like all other working services (workOrderService, inventoryService, planService)
    const tenantId = localStorage.getItem('selectedTenantId');
    
    if (!tenantId) {
      throw new Error('No tenant selected');
    }

    // Get API URL - uses relative URL, works for all domains via Firebase Hosting rewrites
    const apiPath = getApiUrl() || '/api';
    const fullUrl = `${apiPath}/customers${endpoint}`;
    console.log('[CustomerService] API call:', { apiPath, fullUrl, hostname: typeof window !== 'undefined' ? window.location.hostname : 'server', tenantId, method: options.method || 'GET' });
    
    let response;
    try {
      response = await fetch(fullUrl, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      console.log('[CustomerService] Response received:', { status: response.status, statusText: response.statusText, ok: response.ok });
    } catch (fetchError: any) {
      console.error('[CustomerService] Fetch error:', fetchError);
      throw new Error(`Network error: ${fetchError.message || 'Failed to connect to server'}`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      
      // Handle duplicate customer error (409) with better messaging
      if (response.status === 409) {
        if (errorData.duplicateField) {
          const fieldName = errorData.duplicateField === 'customerId' 
            ? 'Customer ID' 
            : errorData.duplicateField === 'email'
            ? 'Email address'
            : errorData.duplicateField === 'primaryPhone'
            ? 'Phone number'
            : errorData.duplicateField === 'tenantId'
            ? 'Tenant'
            : errorData.duplicateField;
          throw new Error(`A customer with this ${fieldName.toLowerCase()} already exists.`);
        } else if (errorData.message) {
          // Use backend message if no duplicateField specified
          throw new Error(errorData.message);
        } else {
          throw new Error('A customer with this information already exists. Please check the customer ID, email, or phone number.');
        }
      }
      
      // Handle validation errors (400) with detailed messages
      if (response.status === 400 && errorData.errors) {
        const errorMessages = Object.values(errorData.errors).map((e: any) => e.message || e).join(', ');
        throw new Error(errorMessages || errorData.message || 'Validation failed');
      }
      
      throw new Error(errorData.error || errorData.message || `Request failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[CustomerService] Response data:', { dataLength: Array.isArray(data) ? data.length : 'not array', hasData: !!data });
    return data;
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

  /**
   * Create HSS subscriber from customer
   */
  async createHSSSubscriber(customerId: string, subscriberData: {
    imsi: string;
    msisdn?: string;
    ki?: string;
    opc?: string;
    group_id?: string;
    bandwidth_plan_id?: string;
    qci?: number;
  }): Promise<any> {
    return await this.apiCall(`/${customerId}/create-subscriber`, {
      method: 'POST',
      body: JSON.stringify(subscriberData)
    });
  }

  /**
   * Get HSS subscriber for customer
   */
  async getHSSSubscriber(customerId: string): Promise<any> {
    return await this.apiCall(`/${customerId}/subscriber`);
  }
}

export const customerService = new CustomerService();

