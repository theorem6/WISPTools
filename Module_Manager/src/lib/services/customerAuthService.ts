/**
 * Customer Authentication Service
 * Handles customer portal authentication
 */

import { getApiUrl } from '$lib/config/api';
import { authService } from './authService';
import type { Customer } from './customerService';

const API_URL = getApiUrl();

export interface CustomerAuthResult {
  success: boolean;
  customer?: Customer;
  error?: string;
  message?: string;
}

class CustomerAuthService {
  /**
   * Customer login
   */
  async login(identifier: string, password: string): Promise<CustomerAuthResult> {
    try {
      // First, sign in with Firebase Auth using the correct method name
      const authResult = await authService.signIn(identifier, password);
      
      if (!authResult.success || !authResult.data) {
        return {
          success: false,
          error: authResult.error || 'Login failed'
        };
      }
      
      // Get ID token from the current user
      const idToken = await authService.getIdToken();
      
      // Call customer portal API to link/verify customer
      const response = await fetch(`${API_URL}/customer-portal/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          identifier,
          password,
          idToken
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Login failed',
          message: data.message
        };
      }
      
      return {
        success: true,
        customer: data.customer
      };
    } catch (error: any) {
      console.error('Customer login error:', error);
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    }
  }

  /**
   * Customer sign-up (link customer to Firebase account)
   */
  async signUp(customerId: string, phone: string, email: string, password: string): Promise<CustomerAuthResult> {
    try {
      // Create Firebase Auth account using the correct method name
      const authResult = await authService.signUp(email, password);
      
      if (!authResult.success || !authResult.data) {
        return {
          success: false,
          error: authResult.error || 'Signup failed'
        };
      }
      
      // Get ID token from the current user
      const idToken = await authService.getIdToken();
      
      // Call customer portal API to link customer
      const response = await fetch(`${API_URL}/customer-portal/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerId,
          phone,
          email,
          password,
          idToken
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // If signup fails, delete Firebase account
        await authService.signOut();
        return {
          success: false,
          error: data.error || 'Signup failed',
          message: data.message
        };
      }
      
      return {
        success: true,
        customer: data.customer,
        message: data.message
      };
    } catch (error: any) {
      console.error('Customer signup error:', error);
      return {
        success: false,
        error: error.message || 'Signup failed'
      };
    }
  }

  /**
   * Get current customer
   */
  async getCurrentCustomer(): Promise<Customer | null> {
    try {
      const token = await authService.getIdToken();
      
      if (!token) {
        return null;
      }
      
      const response = await fetch(`${API_URL}/customer-portal/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching current customer:', error);
      return null;
    }
  }

  /**
   * Check if current user is a customer
   */
  async isCustomerUser(): Promise<boolean> {
    try {
      const customer = await this.getCurrentCustomer();
      return customer !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(identifier: string): Promise<void> {
    try {
      // Use Firebase Auth password reset
      await authService.sendPasswordResetEmail(identifier);
      
      // Also notify backend (optional)
      await fetch(`${API_URL}/customer-portal/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ identifier })
      });
    } catch (error: any) {
      console.error('Password reset error:', error);
      throw error;
    }
  }
}

export const customerAuthService = new CustomerAuthService();

