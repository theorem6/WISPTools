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
   * Get customer's tickets (filtered from work orders)
   */
  async getCustomerTickets(customerId?: string): Promise<WorkOrder[]> {
    try {
      const token = await this.getIdToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${API_URL}/customer-portal/tickets`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
   * Create ticket (customer)
   */
  async createCustomerTicket(ticketData: {
    title: string;
    description: string;
    category?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    attachments?: File[];
  }): Promise<WorkOrder> {
    try {
      const token = await this.getIdToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${API_URL}/customer-portal/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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
   * Get ticket (ensures customer owns it)
   */
  async getCustomerTicket(ticketId: string): Promise<WorkOrder> {
    try {
      const token = await this.getIdToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${API_URL}/customer-portal/tickets/${ticketId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
   * Add comment to ticket (customer can only comment, not change status)
   */
  async addTicketComment(ticketId: string, comment: string): Promise<void> {
    try {
      const token = await this.getIdToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${API_URL}/customer-portal/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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
   * Get customer service information
   */
  async getCustomerServiceInfo(): Promise<any> {
    try {
      const token = await this.getIdToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${API_URL}/customer-portal/service`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
   * Get ID token for API calls
   */
  private async getIdToken(): Promise<string | null> {
    try {
      const { authService } = await import('$lib/services/authService');
      return await authService.getIdToken();
    } catch (error) {
      console.error('Error getting ID token:', error);
      return null;
    }
  }
}

export const customerPortalService = new CustomerPortalService();

