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

export interface CustomerBillingSLA {
  responseTimeHours?: number;
  uptimePercent?: number;
  notes?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity?: number;
  unitPrice: number;
  total: number;
}

export interface CustomerBillingInvoice {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string | Date;
  paidDate?: string | Date;
  lineItems?: InvoiceLineItem[];
  payments?: { amount: number; method?: string; paidAt?: string | Date }[];
}

export interface CustomerBillingPayment {
  paymentId?: string;
  amount: number;
  method?: string;
  transactionId?: string;
  paidAt?: string | Date;
  invoiceId?: string;
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
  sla?: CustomerBillingSLA;
  invoices?: CustomerBillingInvoice[];
  paymentHistory?: { paymentId?: string; amount: number; method?: string; invoiceId?: string; paidAt?: string | Date }[];
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

  async createOrUpdate(customerId: string, data: { servicePlan?: CustomerBillingServicePlan; billingCycle?: CustomerBillingCycle; sla?: CustomerBillingSLA }): Promise<CustomerBilling> {
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
  },

  async addInvoice(
    customerId: string,
    data: { invoiceNumber: string; amount: number; dueDate: string | Date; lineItems?: InvoiceLineItem[]; status?: string }
  ): Promise<CustomerBilling> {
    return apiCall(`/${encodeURIComponent(customerId)}/invoices`, {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        dueDate: typeof data.dueDate === 'string' ? data.dueDate : (data.dueDate as Date).toISOString().slice(0, 10)
      })
    });
  },

  async recordPayment(
    customerId: string,
    data: { amount: number; method?: string; invoiceId?: string; transactionId?: string }
  ): Promise<CustomerBilling> {
    return apiCall(`/${encodeURIComponent(customerId)}/payments`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
};
