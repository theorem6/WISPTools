// Backend API Client
// Handles communication with the GCE backend

import { backendConfig, buildApiUrl } from '$lib/config/backendConfig';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  services: {
    genieacs_cwmp: string;
    genieacs_nbi: string;
    genieacs_fs: string;
    genieacs_ui: string;
    mongodb: string;
  };
}

export interface FirmwareFile {
  _id?: string;
  filename: string;
  originalName?: string;
  filepath: string;
  size: number;
  version: string;
  model: string;
  description: string;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface DeviceStats {
  total: number;
  online: number;
  offline: number;
}

export class BackendClient {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  
  constructor() {
    this.baseUrl = backendConfig.backendApiUrl;
    this.timeout = backendConfig.timeout;
    this.maxRetries = backendConfig.maxRetries;
  }
  
  /**
   * Make a request to the backend API with retries
   */
  private async request<T>(
    path: string,
    options: RequestInit = {},
    retries: number = 0
  ): Promise<T> {
    const url = buildApiUrl(path);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      // Retry on network errors
      if (retries < this.maxRetries && this.isRetryableError(error)) {
        console.warn(`Request failed, retrying... (${retries + 1}/${this.maxRetries})`);
        await this.delay(Math.pow(2, retries) * 1000); // Exponential backoff
        return this.request<T>(path, options, retries + 1);
      }
      
      throw error;
    }
  }
  
  private isRetryableError(error: any): boolean {
    return (
      error.name === 'AbortError' ||
      error.message.includes('network') ||
      error.message.includes('fetch') ||
      error.message.includes('ECONNREFUSED')
    );
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Health check
   */
  async getHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health');
  }
  
  /**
   * Firmware Management
   */
  async uploadFirmware(
    file: File,
    metadata: {
      version: string;
      model: string;
      description?: string;
      userId?: string;
    }
  ): Promise<ApiResponse<FirmwareFile>> {
    const formData = new FormData();
    formData.append('firmware', file);
    formData.append('version', metadata.version);
    formData.append('model', metadata.model);
    if (metadata.description) {
      formData.append('description', metadata.description);
    }
    
    const url = buildApiUrl('/firmware/upload');
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        ...(metadata.userId && { 'X-User-Id': metadata.userId })
      }
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async listFirmware(): Promise<FirmwareFile[]> {
    return this.request<FirmwareFile[]>('/firmware/list');
  }
  
  getFirmwareDownloadUrl(filename: string): string {
    return buildApiUrl(`/firmware/download/${filename}`);
  }
  
  async deleteFirmware(filename: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/firmware/${filename}`, {
      method: 'DELETE'
    });
  }
  
  /**
   * STUN/TURN Configuration
   */
  async getStunConfig(): Promise<{
    stunServers: Array<{ urls: string }>;
    turnServers: Array<any>;
  }> {
    return this.request('/stun/config');
  }
  
  /**
   * Device Statistics
   */
  async getDeviceStats(): Promise<DeviceStats> {
    return this.request<DeviceStats>('/devices/stats');
  }
  
  /**
   * GenieACS NBI Proxy
   */
  async genieacsNbiRequest<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    return this.request<T>(`/genieacs/nbi/${path}`, options);
  }
}

// Export singleton instance
export const backendClient = new BackendClient();

