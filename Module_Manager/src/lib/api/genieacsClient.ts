// GenieACS Client
// Direct client for GenieACS NBI API

import { backendConfig, buildGenieacsNbiUrl } from '$lib/config/backendConfig';

export interface GenieACSDevice {
  _id: string;
  _deviceId: {
    _Manufacturer?: string;
    _ProductClass?: string;
    _SerialNumber?: string;
  };
  _lastInform?: number;
  _registered?: number;
  _tags?: string[];
  [key: string]: any;
}

export interface GenieACSTask {
  _id: string;
  device: string;
  name: string;
  timestamp: number;
  [key: string]: any;
}

export class GenieACSClient {
  private baseUrl: string;
  private timeout: number;
  
  constructor() {
    this.baseUrl = backendConfig.genieacs.nbiUrl;
    this.timeout = backendConfig.timeout;
  }
  
  /**
   * Make a request to GenieACS NBI
   */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = buildGenieacsNbiUrl(path);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
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
        throw new Error(`GenieACS NBI error: ${response.status} ${response.statusText}`);
      }
      
      // Handle empty responses
      const text = await response.text();
      if (!text) {
        return null as T;
      }
      
      return JSON.parse(text);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  /**
   * Get all devices
   */
  async getDevices(query?: Record<string, any>): Promise<GenieACSDevice[]> {
    let path = '/devices';
    
    if (query) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        params.append(key, JSON.stringify(value));
      });
      path += `?${params.toString()}`;
    }
    
    return this.request<GenieACSDevice[]>(path);
  }
  
  /**
   * Get a specific device
   */
  async getDevice(deviceId: string): Promise<GenieACSDevice> {
    return this.request<GenieACSDevice>(`/devices/${encodeURIComponent(deviceId)}`);
  }
  
  /**
   * Delete a device
   */
  async deleteDevice(deviceId: string): Promise<void> {
    await this.request<void>(`/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE'
    });
  }
  
  /**
   * Get device tasks
   */
  async getTasks(deviceId?: string): Promise<GenieACSTask[]> {
    let path = '/tasks';
    
    if (deviceId) {
      path += `?query=${JSON.stringify({ device: deviceId })}`;
    }
    
    return this.request<GenieACSTask[]>(path);
  }
  
  /**
   * Create a task
   */
  async createTask(deviceId: string, task: {
    name: string;
    [key: string]: any;
  }): Promise<GenieACSTask> {
    return this.request<GenieACSTask>('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        device: deviceId,
        ...task
      })
    });
  }
  
  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<void> {
    await this.request<void>(`/tasks/${taskId}`, {
      method: 'DELETE'
    });
  }
  
  /**
   * Get presets
   */
  async getPresets(): Promise<any[]> {
    return this.request<any[]>('/presets');
  }
  
  /**
   * Create a preset
   */
  async createPreset(preset: any): Promise<any> {
    return this.request<any>('/presets', {
      method: 'POST',
      body: JSON.stringify(preset)
    });
  }
  
  /**
   * Update a preset
   */
  async updatePreset(presetId: string, preset: any): Promise<void> {
    await this.request<void>(`/presets/${presetId}`, {
      method: 'PUT',
      body: JSON.stringify(preset)
    });
  }
  
  /**
   * Delete a preset
   */
  async deletePreset(presetId: string): Promise<void> {
    await this.request<void>(`/presets/${presetId}`, {
      method: 'DELETE'
    });
  }
  
  /**
   * Get provisions
   */
  async getProvisions(): Promise<any[]> {
    return this.request<any[]>('/provisions');
  }
  
  /**
   * Create a provision
   */
  async createProvision(provision: any): Promise<any> {
    return this.request<any>('/provisions', {
      method: 'POST',
      body: JSON.stringify(provision)
    });
  }
  
  /**
   * Update a provision
   */
  async updateProvision(provisionId: string, provision: any): Promise<void> {
    await this.request<void>(`/provisions/${provisionId}`, {
      method: 'PUT',
      body: JSON.stringify(provision)
    });
  }
  
  /**
   * Delete a provision
   */
  async deleteProvision(provisionId: string): Promise<void> {
    await this.request<void>(`/provisions/${provisionId}`, {
      method: 'DELETE'
    });
  }
  
  /**
   * Get faults
   */
  async getFaults(deviceId?: string): Promise<any[]> {
    let path = '/faults';
    
    if (deviceId) {
      path += `?query=${JSON.stringify({ device: deviceId })}`;
    }
    
    return this.request<any[]>(path);
  }
  
  /**
   * Delete a fault
   */
  async deleteFault(faultId: string): Promise<void> {
    await this.request<void>(`/faults/${faultId}`, {
      method: 'DELETE'
    });
  }
  
  /**
   * Get files
   */
  async getFiles(): Promise<any[]> {
    return this.request<any[]>('/files');
  }
  
  /**
   * Upload a file
   */
  async uploadFile(file: File, metadata: any): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(metadata).forEach(([key, value]) => {
      formData.append(key, String(value));
    });
    
    const url = buildGenieacsNbiUrl('/files');
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.request<void>(`/files/${fileId}`, {
      method: 'DELETE'
    });
  }
  
  /**
   * Refresh device (trigger inform)
   */
  async refreshDevice(deviceId: string): Promise<void> {
    await this.createTask(deviceId, {
      name: 'refreshObject',
      objectName: ''
    });
  }
  
  /**
   * Reboot device
   */
  async rebootDevice(deviceId: string): Promise<void> {
    await this.createTask(deviceId, {
      name: 'reboot'
    });
  }
  
  /**
   * Factory reset device
   */
  async factoryResetDevice(deviceId: string): Promise<void> {
    await this.createTask(deviceId, {
      name: 'factoryReset'
    });
  }
  
  /**
   * Download firmware to device
   */
  async downloadFirmware(
    deviceId: string,
    fileType: string,
    fileName: string,
    targetFileName?: string
  ): Promise<void> {
    await this.createTask(deviceId, {
      name: 'download',
      fileType,
      fileName,
      targetFileName
    });
  }
}

// Export singleton instance
export const genieacsClient = new GenieACSClient();

