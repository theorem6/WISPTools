/**
 * Customer Portal Service
 * Wraps workOrderService for customer portal with customer filtering
 */

import { getApiUrl } from '$lib/config/api';
import { workOrderService, type WorkOrder, type CreateWorkOrderData } from './workOrderService';
import { customerAuthService } from './customerAuthService';

const API_URL = getApiUrl();

class CustomerPortalService {
  /**
   * Get customer's tickets (filtered from work orders).
   * Pass tenantId (e.g. from customer.tenantId) so the backend can scope the request.
   */
  async getCustomerTickets(tenantId?: string): Promise<WorkOrder[]> {
    try {
      const token = await this.getIdToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const headers: Record<string, string> = { 'Authorization': `Bearer ${token}` };
      if (tenantId) headers['X-Tenant-ID'] = tenantId;
      
      const response = await fetch(`${API_URL}/customer-portal/tickets`, {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tickets: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error: any) {
      console.error('Error fetching customer tickets:', error);
      throw error;
    }
  }

  /**
   * Create ticket (customer). Pass tenantId when available (e.g. from customer.tenantId).
   */
  async createCustomerTicket(ticketData: {
    title: string;
    description: string;
    category?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    attachments?: File[];
  }, tenantId?: string): Promise<WorkOrder> {
    try {
      const token = await this.getIdToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      if (tenantId) headers['X-Tenant-ID'] = tenantId;
      
      const response = await fetch(`${API_URL}/customer-portal/tickets`, {
        method: 'POST',
        headers,
        body: JSON.stringify(ticketData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create ticket');
      }
      
      const data = await response.json();
      return data.ticket;
    } catch (error: any) {
      console.error('Error creating ticket:', error);
      throw error;
    }
  }

  /**
   * Get ticket (ensures customer owns it). Pass tenantId when available.
   */
  async getCustomerTicket(ticketId: string, tenantId?: string): Promise<WorkOrder> {
    try {
      const token = await this.getIdToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const headers: Record<string, string> = { 'Authorization': `Bearer ${token}` };
      if (tenantId) headers['X-Tenant-ID'] = tenantId;
      
      const response = await fetch(`${API_URL}/customer-portal/tickets/${ticketId}`, {
        headers
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Ticket not found');
        }
        throw new Error(`Failed to fetch ticket: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error: any) {
      console.error('Error fetching ticket:', error);
      throw error;
    }
  }

  /**
   * Add comment to ticket (customer can only comment, not change status). Pass tenantId when available.
   */
  async addTicketComment(ticketId: string, comment: string, tenantId?: string): Promise<void> {
    try {
      const token = await this.getIdToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      if (tenantId) headers['X-Tenant-ID'] = tenantId;
      
      const response = await fetch(`${API_URL}/customer-portal/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ comment })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add comment');
      }
    } catch (error: any) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  /**
   * Get customer service information. Pass tenantId when available.
   */
  async getCustomerServiceInfo(tenantId?: string): Promise<any> {
    try {
      const token = await this.getIdToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const headers: Record<string, string> = { 'Authorization': `Bearer ${token}` };
      if (tenantId) headers['X-Tenant-ID'] = tenantId;
      
      const response = await fetch(`${API_URL}/customer-portal/service`, {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch service info: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error: any) {
      console.error('Error fetching service info:', error);
      throw error;
    }
  }

  /**
   * Get logged-in customer's billing (read-only). Pass tenantId when available.
   */
  async getCustomerBilling(tenantId?: string): Promise<{
    _id?: string;
    customerId: string;
    tenantId: string;
    servicePlan?: { planName?: string; monthlyFee?: number; setupFee?: number };
    billingCycle?: { type?: string; dayOfMonth?: number; nextBillingDate?: string };
    balance?: { current?: number; overdue?: number };
    autoPay?: { enabled?: boolean };
    invoices?: unknown[];
  } | null> {
    try {
      const token = await this.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (tenantId) headers['X-Tenant-ID'] = tenantId;

      const response = await fetch(`${API_URL}/customer-portal/billing`, { headers });
      if (!response.ok) throw new Error(`Failed to fetch billing: ${response.statusText}`);
      const data = await response.json();
      return data ?? null;
    } catch (error: any) {
      console.error('Error fetching customer billing:', error);
      throw error;
    }
  }

  /**
   * Get billing settings (paypalEmail, invoicePreferences, read-only invoiceFormat).
   */
  async getBillingSettings(tenantId?: string): Promise<{
    paypalEmail: string;
    paymentMethod: string;
    invoicePreferences: { delivery: string };
    invoiceFormat: { companyName: string; dueDays: number; currency: string };
  }> {
    const token = await this.getIdToken();
    if (!token) throw new Error('Not authenticated');
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (tenantId) headers['X-Tenant-ID'] = tenantId;
    const response = await fetch(`${API_URL}/customer-portal/billing/settings`, { headers });
    if (!response.ok) throw new Error('Failed to fetch billing settings');
    return await response.json();
  }

  /**
   * Update billing settings (paypalEmail, invoicePreferences.delivery).
   */
  async updateBillingSettings(
    payload: { paypalEmail?: string; invoicePreferences?: { delivery: string } },
    tenantId?: string
  ): Promise<void> {
    const token = await this.getIdToken();
    if (!token) throw new Error('Not authenticated');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
    if (tenantId) headers['X-Tenant-ID'] = tenantId;
    const response = await fetch(`${API_URL}/customer-portal/billing/settings`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Failed to update billing settings');
  }

  /**
   * Get a single invoice by id (for view/download).
   */
  async getInvoice(invoiceId: string, tenantId?: string): Promise<{
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    status: string;
    dueDate: string;
    lineItems?: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  }> {
    const token = await this.getIdToken();
    if (!token) throw new Error('Not authenticated');
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (tenantId) headers['X-Tenant-ID'] = tenantId;
    const response = await fetch(`${API_URL}/customer-portal/billing/invoices/${encodeURIComponent(invoiceId)}`, {
      headers
    });
    if (!response.ok) {
      if (response.status === 404) throw new Error('Invoice not found');
      throw new Error('Failed to fetch invoice');
    }
    return await response.json();
  }

  /**
   * Create Stripe payment intent for portal pay-now. Returns { configured, clientSecret?, message? }.
   */
  async createPaymentIntent(
    amount: number,
    invoiceId?: string,
    tenantId?: string
  ): Promise<{ configured: boolean; clientSecret?: string; message?: string }> {
    try {
      const token = await this.getIdToken();
      if (!token) throw new Error('Not authenticated');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };
      if (tenantId) headers['X-Tenant-ID'] = tenantId;
      const response = await fetch(`${API_URL}/customer-portal/billing/create-payment-intent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount, invoiceId })
      });
      const data = await response.json();
      return {
        configured: !!data.configured,
        clientSecret: data.clientSecret,
        message: data.message
      };
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      return { configured: false, message: error.message || 'Failed to create payment' };
    }
  }

  /**
   * Get ID token for API calls
   */
  private async getIdToken(): Promise<string | null> {
    try {
      const { authService } = await import('$lib/services/authService');
      return await authService.getAuthTokenForApi();
    } catch (error) {
      console.error('Error getting ID token:', error);
      return null;
    }
  }
}

export const customerPortalService = new CustomerPortalService();

