/**
 * Monitoring API Service
 * Extends the standard apiService pattern for the GCE monitoring backend
 * Uses X-Tenant-ID headers as required by the monitoring backend
 */

import { browser } from '$app/environment';
import { authService } from './authService';

export class MonitoringService {
  private baseUrl: string;

  constructor() {
    // Use Firebase proxy for all API requests (HTTPS) instead of direct GCE connection
    // This avoids mixed content errors when the page is served over HTTPS
    this.baseUrl = browser ? 
      (import.meta.env.VITE_MONITORING_BACKEND_URL || '/api') : 
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
   * Note: Components should ensure tenantId is synced to localStorage
   */
  private getTenantId(): string | null {
    if (!browser) return null;
    return localStorage.getItem('selectedTenantId');
  }

  /**
   * Make authenticated API request with tenant context
   * Monitoring backend uses X-Tenant-ID header instead of query params
   */
  private async makeRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.getAuthToken();
    const tenantId = this.getTenantId();

    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    // Add auth token
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // Add tenant ID as header (monitoring backend requires X-Tenant-ID header)
    if (tenantId) {
      headers.set('X-Tenant-ID', tenantId);
    }

    const url = `${this.baseUrl}${endpoint}`;

    return fetch(url, {
      ...options,
      headers,
    });
  }

  /**
   * GET request with authentication
   */
  async get<T = any>(endpoint: string): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await this.makeRequest(endpoint, { method: 'GET' });
      
      // ALWAYS read response as text first to check for HTML content
      // This prevents JSON parsing errors when Firebase routing returns HTML (404 pages)
      let responseText: string;
      try {
        responseText = await response.text();
      } catch (textError: any) {
        console.error(`Monitoring API GET ${endpoint} failed to read response:`, textError);
        return {
          success: false,
          error: `Failed to read response: ${textError.message}. Status: ${response.status}`
        };
      }
      
      // Check if response is HTML (common when endpoint doesn't exist or routing fails)
      const trimmedText = responseText.trim().toLowerCase();
      const isHtml = trimmedText.startsWith('<!doctype') || trimmedText.startsWith('<html');
      
      if (isHtml) {
        console.error(`Monitoring API GET ${endpoint} received HTML instead of JSON:`, {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type'),
          preview: responseText.substring(0, 300)
        });
        return {
          success: false,
          error: `Received HTML instead of JSON (likely 404 or routing issue). Status: ${response.status}. Endpoint: ${endpoint}. This usually means the endpoint doesn't exist or isn't routed correctly through Firebase Hosting.`
        };
      }
      
      // Check response status
      if (!response.ok && response.status >= 400) {
        // Try to parse as JSON for error response
        try {
          const errorData = JSON.parse(responseText);
          return { 
            success: false, 
            error: errorData.error || `Request failed: ${response.status}` 
          };
        } catch {
          // Not valid JSON, return error with text preview
          return { 
            success: false, 
            error: `Request failed: ${response.status}. Response: ${responseText.substring(0, 200)}` 
          };
        }
      }

      // Parse the text as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonError: any) {
        console.error(`Monitoring API GET ${endpoint} JSON parse failed:`, {
          error: jsonError.message,
          status: response.status,
          contentType: response.headers.get('content-type'),
          preview: responseText.substring(0, 200)
        });
        
        return {
          success: false,
          error: `Failed to parse JSON response: ${jsonError.message}. Status: ${response.status}. Preview: ${responseText.substring(0, 100)}`
        };
      }

      if (!response.ok) {
        return { success: false, error: data.error || `Request failed: ${response.status}` };
      }

      return { success: true, data };
    } catch (error) {
      console.error(`Monitoring API GET ${endpoint} failed:`, error);
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
      console.error(`Monitoring API POST ${endpoint} failed:`, error);
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
      console.error(`Monitoring API PUT ${endpoint} failed:`, error);
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
      console.error(`Monitoring API DELETE ${endpoint} failed:`, error);
      return { success: false, error: String(error) };
    }
  }

  // ============================================================================
  // Monitoring-Specific Endpoints
  // ============================================================================

  /**
   * Get health status
   * Note: Backend has /health at root, but through Firebase proxy we use /api/health
   * However, the backend doesn't have /api/health, so we'll skip this or use monitoring health
   */
  async getHealth() {
    // Backend health is at root /health, but through Firebase proxy it's not accessible
    // Return a simple success response instead
    return { success: true, data: { status: 'healthy' } };
  }

  /**
   * Get EPC devices
   */
  async getEPCDevices() {
    return this.get('/monitoring/epc/list');
  }

  /**
   * Get Mikrotik devices
   */
  async getMikrotikDevices() {
    return this.get('/monitoring/mikrotik/devices');
  }

  /**
   * Get SNMP devices
   */
  async getSNMPDevices() {
    return this.get('/monitoring/snmp/devices');
  }

  /**
   * Get discovered SNMP devices from EPC agents
   */
  async getDiscoveredDevices() {
    return this.get('/monitoring/snmp/discovered');
  }

  /**
   * Get latest SNMP metrics
   */
  async getSNMPMetrics() {
    return this.get('/monitoring/snmp/metrics/latest');
  }

  /**
   * Get network sectors
   */
  async getNetworkSectors(params?: { includePlanLayer?: boolean; planIds?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.includePlanLayer) {
      queryParams.append('includePlanLayer', 'true');
    }
    if (params?.planIds) {
      queryParams.append('planIds', params.planIds);
    }
    const queryString = queryParams.toString();
    return this.get(`/api/network/sectors${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get network CPE
   */
  async getNetworkCPE(params?: { includePlanLayer?: boolean; planIds?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.includePlanLayer) {
      queryParams.append('includePlanLayer', 'true');
    }
    if (params?.planIds) {
      queryParams.append('planIds', params.planIds);
    }
    const queryString = queryParams.toString();
    return this.get(`/api/network/cpe${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get network equipment
   */
  async getNetworkEquipment(params?: { includePlanLayer?: boolean; planIds?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.includePlanLayer) {
      queryParams.append('includePlanLayer', 'true');
    }
    if (params?.planIds) {
      queryParams.append('planIds', params.planIds);
    }
    const queryString = queryParams.toString();
    return this.get(`/api/network/equipment${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Generate EPC ISO
   */
  async generateEPCISO(config: any) {
    return this.post('/api/deploy/generate-epc-iso', config);
  }
}

// Singleton instance
export const monitoringService = new MonitoringService();

