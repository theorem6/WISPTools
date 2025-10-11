// Authenticated API Service with Multi-Tenant Support
// Automatically adds Firebase JWT token and tenant context to all requests

import { browser } from '$app/environment';
import { authService } from './authService';

export class ApiService {
  private baseUrl: string;

  constructor() {
    // Use Firebase Functions URL or local dev
    this.baseUrl = browser ? 
      (import.meta.env.VITE_FUNCTIONS_URL || 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net') : 
      '';
  }

  /**
   * Get Firebase ID token for authenticated requests
   */
  private async getAuthToken(): Promise<string | null> {
    if (!browser) return null;

    const user = authService.getCurrentUser();
    if (!user) {
      console.warn('No authenticated user found');
      return null;
    }

    try {
      const token = await user.getIdToken();
      return token;
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  }

  /**
   * Get current tenant ID from localStorage
   */
  private getTenantId(): string | null {
    if (!browser) return null;
    return localStorage.getItem('selectedTenantId');
  }

  /**
   * Make authenticated API request with tenant context
   */
  private async makeRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.getAuthToken();
    const tenantId = this.getTenantId();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add auth token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add tenant ID to body or query params
    let url = `${this.baseUrl}${endpoint}`;
    let body = options.body;

    if (tenantId) {
      if (options.method === 'GET' || !options.method) {
        // Add to query params for GET requests
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}tenantId=${tenantId}`;
      } else {
        // Add to body for POST/PUT requests
        if (body) {
          const bodyObj = typeof body === 'string' ? JSON.parse(body) : body;
          body = JSON.stringify({ ...bodyObj, tenantId });
        } else {
          body = JSON.stringify({ tenantId });
        }
      }
    }

    return fetch(url, {
      ...options,
      headers,
      body,
    });
  }

  /**
   * GET request with authentication
   */
  async get<T = any>(endpoint: string): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await this.makeRequest(endpoint, { method: 'GET' });
      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Request failed' };
      }

      return { success: true, data };
    } catch (error) {
      console.error(`API GET ${endpoint} failed:`, error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * POST request with authentication
   */
  async post<T = any>(endpoint: string, payload?: any): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: payload ? JSON.stringify(payload) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Request failed' };
      }

      return { success: true, data };
    } catch (error) {
      console.error(`API POST ${endpoint} failed:`, error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * PUT request with authentication
   */
  async put<T = any>(endpoint: string, payload: any): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await this.makeRequest(endpoint, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Request failed' };
      }

      return { success: true, data };
    } catch (error) {
      console.error(`API PUT ${endpoint} failed:`, error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * DELETE request with authentication
   */
  async delete<T = any>(endpoint: string): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await this.makeRequest(endpoint, { method: 'DELETE' });
      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Request failed' };
      }

      return { success: true, data };
    } catch (error) {
      console.error(`API DELETE ${endpoint} failed:`, error);
      return { success: false, error: String(error) };
    }
  }

  // ============================================================================
  // Multi-Tenant GenieACS Endpoints
  // ============================================================================

  /**
   * Sync devices from GenieACS (tenant-specific)
   */
  async syncGenieACSDevices() {
    return this.post('/syncGenieACSDevicesMultitenant');
  }

  /**
   * Get device parameters (tenant-specific)
   */
  async getDeviceParameters(deviceId: string) {
    return this.get(`/getDeviceParametersMultitenant?deviceId=${deviceId}`);
  }

  /**
   * Execute device task (tenant-specific with permission check)
   */
  async executeDeviceTask(deviceId: string, taskName: string, parameter?: string, value?: any) {
    return this.post('/executeDeviceTaskMultitenant', {
      deviceId,
      name: taskName,
      parameter,
      value,
    });
  }

  /**
   * Get devices (tenant-filtered)
   */
  async getDevices() {
    return this.get('/genieacsNBIMultitenant/devices');
  }

  /**
   * Get faults (tenant-filtered)
   */
  async getFaults() {
    return this.get('/genieacsNBIMultitenant/faults');
  }

  /**
   * Get presets (tenant-filtered)
   */
  async getPresets() {
    return this.get('/genieacsNBIMultitenant/presets');
  }

  /**
   * Create preset (permission-checked)
   */
  async createPreset(presetName: string, config: any) {
    return this.put(`/genieacsNBIMultitenant/presets/${presetName}`, config);
  }

  /**
   * Delete preset (permission-checked)
   */
  async deletePreset(presetName: string) {
    return this.delete(`/genieacsNBIMultitenant/presets/${presetName}`);
  }
}

// Singleton instance
export const apiService = new ApiService();

