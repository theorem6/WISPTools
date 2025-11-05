// GenieACS Northbound Interface (NBI) Client
// Provides REST API access to GenieACS services

export interface GenieACSConfig {
  baseUrl: string;                // GenieACS NBI base URL (e.g., "http://localhost:7557" or Firebase Functions URL)
  username?: string;              // Authentication username
  password?: string;              // Authentication password
  timeout?: number;               // Request timeout in milliseconds
  useFirebaseFunctions?: boolean; // Use Firebase Functions instead of direct NBI
  firebaseProjectId?: string;     // Firebase project ID for Functions
}

export interface DeviceQuery {
  filter?: any;                   // MongoDB query filter
  projection?: any;               // MongoDB projection
  skip?: number;                  // Number of documents to skip
  limit?: number;                 // Maximum number of documents to return
  sort?: Record<string, 1 | -1>;  // Sort specification
}

export interface DeviceParameter {
  path: string;                   // Parameter path
  value: any;                     // Parameter value
  type?: string;                  // Parameter type
  timestamp?: Date;               // Parameter timestamp
}

export interface DeviceTask {
  name: string;                   // Task name
  parameterNames?: string[];      // Parameters to get
  parameterValues?: Array<[string, any, string?]>; // Parameters to set
  objectName?: string;            // Object name for object operations
  fileType?: string;              // File type for file operations
  fileName?: string;              // File name
  targetFileName?: string;        // Target file name
  expiry?: number;                // Task expiry timestamp
}

export interface GenieACSDevice {
  _id: string;                    // Device ID
  _lastInform?: Date;             // Last inform timestamp
  _lastBootstrap?: Date;          // Last bootstrap timestamp
  _registered?: Date;             // Registration timestamp
  _tags?: string[];               // Device tags
  _deviceId?: {                   // TR-069 device ID
    Manufacturer?: string;
    OUI?: string;
    ProductClass?: string;
    SerialNumber?: string;
  };
  [parameterPath: string]: any;   // Device parameters
}

export class GenieACSNBIClient {
  private config: GenieACSConfig;
  private authHeader?: string;

  constructor(config: GenieACSConfig) {
    this.config = {
      timeout: 30000,
      useFirebaseFunctions: false,
      ...config
    };

    // Set up authentication if credentials provided
    if (this.config.username && this.config.password) {
      this.authHeader = `Basic ${btoa(`${this.config.username}:${this.config.password}`)}`;
    }

    // Override base URL for Firebase Functions
    if (this.config.useFirebaseFunctions && this.config.firebaseProjectId) {
      this.config.baseUrl = `https://us-central1-${this.config.firebaseProjectId}.cloudfunctions.net`;
    }
  }

  /**
   * Make HTTP request to GenieACS NBI
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.authHeader && { 'Authorization': this.authHeader }),
        ...options.headers
      }
    };

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    requestOptions.signal = controller.signal;

    try {
      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text() as any;
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * Get all devices with optional filtering
   */
  async getDevices(query: DeviceQuery = {}): Promise<GenieACSDevice[]> {
    const params = new URLSearchParams();
    
    if (query.filter) {
      params.append('filter', JSON.stringify(query.filter));
    }
    if (query.projection) {
      params.append('projection', JSON.stringify(query.projection));
    }
    if (query.skip !== undefined) {
      params.append('skip', query.skip.toString());
    }
    if (query.limit !== undefined) {
      params.append('limit', query.limit.toString());
    }
    if (query.sort) {
      params.append('sort', JSON.stringify(query.sort));
    }

    const endpoint = `/devices${params.toString() ? `?${params.toString()}` : ''}`;
    return this.request<GenieACSDevice[]>(endpoint);
  }

  /**
   * Get a specific device by ID
   */
  async getDevice(deviceId: string): Promise<GenieACSDevice> {
    return this.request<GenieACSDevice>(`/devices/${encodeURIComponent(deviceId)}`);
  }

  /**
   * Get device parameters
   */
  async getDeviceParameters(deviceId: string): Promise<DeviceParameter[]> {
    const device = await this.getDevice(deviceId);
    
    // Convert device parameters to standardized format
    const parameters: DeviceParameter[] = [];
    
    for (const [path, value] of Object.entries(device)) {
      // Skip metadata fields
      if (path.startsWith('_')) continue;
      
      parameters.push({
        path,
        value,
        type: this.inferParameterType(value),
        timestamp: device._lastInform
      });
    }
    
    return parameters;
  }

  /**
   * Get specific device parameters by path
   */
  async getDeviceParametersByPath(
    deviceId: string, 
    parameterPaths: string[]
  ): Promise<DeviceParameter[]> {
    const projection: Record<string, 1> = {};
    parameterPaths.forEach(path => {
      projection[path] = 1;
    });

    const device = await this.getDevices({
      filter: { _id: deviceId },
      projection
    });

    if (device.length === 0) {
      throw new Error(`Device ${deviceId} not found`);
    }

    const parameters: DeviceParameter[] = [];
    const deviceData = device[0];

    parameterPaths.forEach(path => {
      if (deviceData[path] !== undefined) {
        parameters.push({
          path,
          value: deviceData[path],
          type: this.inferParameterType(deviceData[path]),
          timestamp: deviceData._lastInform
        });
      }
    });

    return parameters;
  }

  /**
   * Create a task for a device
   */
  async createDeviceTask(deviceId: string, task: DeviceTask): Promise<void> {
    return this.request<void>(`/devices/${encodeURIComponent(deviceId)}/tasks`, {
      method: 'POST',
      body: JSON.stringify(task)
    });
  }

  /**
   * Get device tasks
   */
  async getDeviceTasks(deviceId: string): Promise<any[]> {
    return this.request<any[]>(`/devices/${encodeURIComponent(deviceId)}/tasks`);
  }

  /**
   * Delete a device task
   */
  async deleteDeviceTask(deviceId: string, taskId: string): Promise<void> {
    return this.request<void>(`/devices/${encodeURIComponent(deviceId)}/tasks/${encodeURIComponent(taskId)}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get device tags
   */
  async getDeviceTags(deviceId: string): Promise<string[]> {
    const device = await this.getDevice(deviceId);
    return device._tags || [];
  }

  /**
   * Add tag to device
   */
  async addDeviceTag(deviceId: string, tag: string): Promise<void> {
    return this.request<void>(`/devices/${encodeURIComponent(deviceId)}/tags/${encodeURIComponent(tag)}`, {
      method: 'POST'
    });
  }

  /**
   * Remove tag from device
   */
  async removeDeviceTag(deviceId: string, tag: string): Promise<void> {
    return this.request<void>(`/devices/${encodeURIComponent(deviceId)}/tags/${encodeURIComponent(tag)}`, {
      method: 'DELETE'
    });
  }

  /**
   * Delete a device
   */
  async deleteDevice(deviceId: string): Promise<void> {
    return this.request<void>(`/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get device faults
   */
  async getDeviceFaults(deviceId: string): Promise<any[]> {
    return this.request<any[]>(`/faults?query=${encodeURIComponent(JSON.stringify({ device: deviceId }))}`);
  }

  /**
   * Get all faults
   */
  async getAllFaults(filter?: any): Promise<any[]> {
    const params = filter ? `?query=${encodeURIComponent(JSON.stringify(filter))}` : '';
    return this.request<any[]>(`/faults${params}`);
  }

  /**
   * Get presets
   */
  async getPresets(): Promise<any[]> {
    return this.request<any[]>('/presets');
  }

  /**
   * Create or update preset
   */
  async setPreset(presetName: string, preset: any): Promise<void> {
    return this.request<void>(`/presets/${encodeURIComponent(presetName)}`, {
      method: 'PUT',
      body: JSON.stringify(preset)
    });
  }

  /**
   * Delete preset
   */
  async deletePreset(presetName: string): Promise<void> {
    return this.request<void>(`/presets/${encodeURIComponent(presetName)}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get virtual parameters
   */
  async getVirtualParameters(): Promise<any[]> {
    return this.request<any[]>('/virtual_parameters');
  }

  /**
   * Create or update virtual parameter
   */
  async setVirtualParameter(paramName: string, param: any): Promise<void> {
    return this.request<void>(`/virtual_parameters/${encodeURIComponent(paramName)}`, {
      method: 'PUT',
      body: JSON.stringify(param)
    });
  }

  /**
   * Delete virtual parameter
   */
  async deleteVirtualParameter(paramName: string): Promise<void> {
    return this.request<void>(`/virtual_parameters/${encodeURIComponent(paramName)}`, {
      method: 'DELETE'
    });
  }

  /**
   * Ping a device
   */
  async pingDevice(deviceId: string): Promise<{ success: boolean; latency?: number }> {
    try {
      const startTime = Date.now();
      await this.request(`/ping/${encodeURIComponent(deviceId)}`, {
        method: 'POST'
      });
      const latency = Date.now() - startTime;
      return { success: true, latency };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Get system overview/statistics
   */
  async getOverview(): Promise<any> {
    return this.request<any>('/overview');
  }

  /**
   * Get files
   */
  async getFiles(): Promise<any[]> {
    return this.request<any[]>('/files');
  }

  /**
   * Upload file
   */
  async uploadFile(filename: string, content: string | Blob): Promise<void> {
    const formData = new FormData();
    // Convert string to Blob if needed
    const blob = typeof content === 'string' ? new Blob([content], { type: 'text/plain' }) : content;
    formData.append('file', blob, filename);

    const url = `${this.config.baseUrl}/files/${encodeURIComponent(filename)}`;
    
    const requestOptions: RequestInit = {
      method: 'PUT',
      headers: {
        ...(this.authHeader && { 'Authorization': this.authHeader })
      },
      body: formData
    };

    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Delete file
   */
  async deleteFile(filename: string): Promise<void> {
    return this.request<void>(`/files/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
  }

  /**
   * Infer parameter type from value
   */
  private inferParameterType(value: any): string {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'int';
    if (typeof value === 'string') {
      // Try to parse as date
      if (!isNaN(Date.parse(value))) return 'dateTime';
      return 'string';
    }
    return 'string';
  }

  /**
   * Get devices with GPS coordinates
   */
  async getDevicesWithGPS(): Promise<GenieACSDevice[]> {
    return this.getDevices({
      filter: {
        $and: [
          { 'Device.GPS.Latitude': { $exists: true, $ne: null } },
          { 'Device.GPS.Longitude': { $exists: true, $ne: null } }
        ]
      }
    });
  }

  /**
   * Get devices by manufacturer
   */
  async getDevicesByManufacturer(manufacturer: string): Promise<GenieACSDevice[]> {
    return this.getDevices({
      filter: {
        'Device.DeviceInfo.Manufacturer': manufacturer
      }
    });
  }

  /**
   * Get online devices (devices that contacted ACS recently)
   */
  async getOnlineDevices(timeoutMinutes: number = 5): Promise<GenieACSDevice[]> {
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const cutoffTime = new Date(Date.now() - timeoutMs);
    
    return this.getDevices({
      filter: {
        '_lastInform': { $gte: cutoffTime }
      }
    });
  }

  /**
   * Search devices by text
   */
  async searchDevices(searchText: string): Promise<GenieACSDevice[]> {
    return this.getDevices({
      filter: {
        $or: [
          { '_id': { $regex: searchText, $options: 'i' } },
          { 'Device.DeviceInfo.SerialNumber': { $regex: searchText, $options: 'i' } },
          { 'Device.DeviceInfo.Manufacturer': { $regex: searchText, $options: 'i' } },
          { 'Device.DeviceInfo.ProductClass': { $regex: searchText, $options: 'i' } }
        ]
      }
    });
  }
}
