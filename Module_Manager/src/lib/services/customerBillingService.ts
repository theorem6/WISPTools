/**
 * Customer Billing Service
 * Per-customer billing records (service plan, balance, invoices).
 * @see backend-services/routes/customer-billing.js
 */

import { browser } from '$app/environment';
import { authService } from './authService';
import { API_CONFIG } from '$lib/config/api';

const BASE = API_CONFIG.PATHS.CUSTOMER_BILLING || '/api/customer-billing';

export interface CustomerBillingServicePlan {
  planName?: string;
  monthlyFee?: number;
  setupFee?: number;
  prorationEnabled?: boolean;
}

export interface CustomerBillingCycle {
  type?: 'monthly' | 'annual';
  dayOfMonth?: number;
  nextBillingDate?: string | Date | null;
}

export interface CustomerBilling {
  _id?: string;
  customerId: string;
  tenantId: string;
  servicePlan?: CustomerBillingServicePlan;
  billingCycle?: CustomerBillingCycle;
  paymentMethod?: string;
  balance?: { current?: number; overdue?: number; lastPaymentDate?: string | Date | null };
  autoPay?: { enabled?: boolean; paymentMethodId?: string };
  invoices?: unknown[];
  paymentHistory?: unknown[];
  createdAt?: string;
  updatedAt?: string;
}

async function apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
  if (!browser) throw new Error('Customer billing service can only be used in browser');
  const token = await authService.getIdToken();
  if (!token) throw new Error('Not authenticated');
  const tenantId = localStorage.getItem('selectedTenantId');
  if (!tenantId) throw new Error('No tenant selected');

  const url = `${BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-ID': tenantId,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>)
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || 'Request failed');
  }
  return res.json();
}

export const customerBillingService = {
  async getByCustomer(customerId: string): Promise<CustomerBilling | null> {
    try {
      return await apiCall(`/${encodeURIComponent(customerId)}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('not found') || msg.includes('404')) return null;
      throw e;
    }
  },

  async list(customerId?: string): Promise<CustomerBilling[]> {
    const q = customerId ? `?customerId=${encodeURIComponent(customerId)}` : '';
    return apiCall(q);
  },

  async createOrUpdate(customerId: string, data: { servicePlan?: CustomerBillingServicePlan; billingCycle?: CustomerBillingCycle }): Promise<CustomerBilling> {
    return apiCall('', {
      method: 'POST',
      body: JSON.stringify({ customerId, ...data })
    });
  },

  async update(customerId: string, data: Partial<CustomerBilling>): Promise<CustomerBilling> {
    return apiCall(`/${encodeURIComponent(customerId)}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
};
