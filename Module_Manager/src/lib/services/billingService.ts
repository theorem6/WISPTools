/**
 * Billing Service
 * 
 * Handles all billing operations including:
 * - PayPal subscription management
 * - Payment processing
 * - Invoice generation
 * - Subscription plan management
 */

import { auth } from '$lib/firebase';

// Use relative URL to leverage Firebase Hosting rewrites
// This goes through Firebase Hosting rewrite to apiProxy function
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Subscription Plan
 */
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: string[];
  maxUsers: number;
  maxTenants?: number;
  isPopular?: boolean;
}

/**
 * Subscription Status
 */
export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing' | 'incomplete';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  paypalSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Invoice
 */
export interface Invoice {
  id: string;
  tenantId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'cancelled';
  invoiceUrl?: string;
  paidAt?: string;
  dueDate: string;
  createdAt: string;
}

/**
 * Payment Method
 */
export interface PaymentMethod {
  id: string;
  tenantId: string;
  type: 'paypal';
  paypalEmail: string;
  isDefault: boolean;
  createdAt: string;
}

/**
 * Get auth headers with Firebase token
 */
async function getAuthHeaders(tenantId?: string): Promise<HeadersInit> {
  const user = auth().currentUser;
  if (!user) {
    throw new Error('Not authenticated');
  }

  const token = await user.getIdToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }

  return headers;
}

/**
 * Get all available subscription plans
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/billing/plans`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch subscription plans');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    throw error;
  }
}

/**
 * Get tenant's current subscription
 */
export async function getTenantSubscription(tenantId: string): Promise<Subscription | null> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    const response = await fetch(`${API_BASE_URL}/billing/subscription/${tenantId}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // No subscription found
      }
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch subscription');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching tenant subscription:', error);
    throw error;
  }
}

/**
 * Create PayPal subscription
 */
export async function createPayPalSubscription(
  tenantId: string,
  planId: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ approvalUrl: string; subscriptionId: string }> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    const response = await fetch(`${API_BASE_URL}/billing/subscription/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenantId,
        planId,
        successUrl,
        cancelUrl
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create subscription');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating PayPal subscription:', error);
    throw error;
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(tenantId: string, subscriptionId: string): Promise<void> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    const response = await fetch(`${API_BASE_URL}/billing/subscription/${subscriptionId}/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tenantId })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to cancel subscription');
    }
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    throw error;
  }
}

/**
 * Get tenant's invoices
 */
export async function getTenantInvoices(tenantId: string): Promise<Invoice[]> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    const response = await fetch(`${API_BASE_URL}/billing/invoices/${tenantId}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch invoices');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching tenant invoices:', error);
    throw error;
  }
}

/**
 * Get tenant's payment methods
 */
export async function getTenantPaymentMethods(tenantId: string): Promise<PaymentMethod[]> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    // Use relative URL (goes through Firebase Hosting rewrite to apiProxy)
    const apiPath = API_BASE_URL || '/api';
    const response = await fetch(`${apiPath}/billing/payment-methods/${tenantId}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch payment methods');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    throw error;
  }
}

/**
 * Update payment method
 */
export async function updatePaymentMethod(
  tenantId: string,
  paymentMethodId: string,
  paypalEmail: string
): Promise<void> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    const response = await fetch(`${API_BASE_URL}/api/billing/payment-methods/${paymentMethodId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        tenantId,
        paypalEmail
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update payment method');
    }
  } catch (error) {
    console.error('Error updating payment method:', error);
    throw error;
  }
}

/**
 * Get billing analytics (admin only)
 */
export async function getBillingAnalytics(): Promise<{
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  activeSubscriptions: number;
  churnRate: number;
  averageRevenuePerUser: number;
}> {
  try {
    const headers = await getAuthHeaders();
    
    // Use relative URL (goes through Firebase Hosting rewrite to apiProxy)
    const apiPath = API_BASE_URL || '/api';
    const response = await fetch(`${apiPath}/billing/analytics`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch billing analytics');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching billing analytics:', error);
    throw error;
  }
}

/**
 * Get all subscriptions (admin only)
 */
export async function getAllSubscriptions(): Promise<Subscription[]> {
  try {
    const headers = await getAuthHeaders();
    
    // Use relative URL (goes through Firebase Hosting rewrite to apiProxy)
    const apiPath = API_BASE_URL || '/api';
    const response = await fetch(`${apiPath}/billing/subscriptions`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch all subscriptions');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching all subscriptions:', error);
    throw error;
  }
}
