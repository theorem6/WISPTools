// GenieACS Integration Service
// Main service for managing TR-069 CPE devices and integrating with PCI Mapper

import { GenieACSNBIClient, type GenieACSConfig, type GenieACSDevice } from '../api/nbiClient';
import { type CPEDevice, CPEDeviceUtils, TR069_PARAMETER_PATHS } from '../models/cpeDevice';
import { TR069ParameterUtils } from '../models/tr069Parameters';
import type { TR069Parameter } from '../models/cpeDevice';

export interface GenieACSServiceConfig extends GenieACSConfig {
  enableAutoDiscovery?: boolean;    // Automatically discover new devices
  updateInterval?: number;          // Update interval in milliseconds
  locationUpdateInterval?: number;  // Location update interval in milliseconds
}

export interface DeviceUpdateEvent {
  type: 'device_added' | 'device_updated' | 'device_removed' | 'location_updated';
  device: CPEDevice;
  timestamp: Date;
}

export interface PerformanceMetricsUpdate {
  deviceId: string;
  metrics: any;
  timestamp: Date;
}

export class GenieACSService {
  private client: GenieACSNBIClient;
  private config: GenieACSServiceConfig;
  private devices: Map<string, CPEDevice> = new Map();
  private updateTimer?: NodeJS.Timeout;
  private locationUpdateTimer?: NodeJS.Timeout;
  private eventListeners: Map<string, (event: DeviceUpdateEvent) => void> = new Map();
  private isRunning = false;

  constructor(config: GenieACSServiceConfig) {
    this.config = {
      enableAutoDiscovery: true,
      updateInterval: 30000, // 30 seconds
      locationUpdateInterval: 60000, // 1 minute
      ...config
    };
    
    this.client = new GenieACSNBIClient(config);
  }

  /**
   * Initialize the GenieACS service
   */
  async initialize(): Promise<void> {
    try {
      console.log('GenieACS Service: Initializing...');
      
      // Test connection to GenieACS
      await this.client.getOverview();
      
      // Load existing devices
      await this.loadDevices();
      
      // Start automatic updates if enabled
      if (this.config.enableAutoDiscovery) {
        this.startAutoDiscovery();
      }
      
      this.isRunning = true;
      console.log('GenieACS Service: Initialized successfully');
      
    } catch (error) {
      console.error('GenieACS Service: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start automatic device discovery and updates
   */
  private startAutoDiscovery(): void {
    // General device updates
    this.updateTimer = setInterval(async () => {
      try {
        await this.updateDevices();
      } catch (error) {
        console.error('GenieACS Service: Auto update failed:', error);
      }
    }, this.config.updateInterval);

    // Location-specific updates
    this.locationUpdateTimer = setInterval(async () => {
      try {
        await this.updateDeviceLocations();
      } catch (error) {
        console.error('GenieACS Service: Location update failed:', error);
      }
    }, this.config.locationUpdateInterval);

    console.log('GenieACS Service: Auto discovery started');
  }

  /**
   * Stop automatic updates
   */
  stopAutoDiscovery(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }
    
    if (this.locationUpdateTimer) {
      clearInterval(this.locationUpdateTimer);
      this.locationUpdateTimer = undefined;
    }
    
    this.isRunning = false;
    console.log('GenieACS Service: Auto discovery stopped');
  }

  /**
   * Load all devices from GenieACS
   */
  async loadDevices(): Promise<CPEDevice[]> {
    try {
      console.log('GenieACS Service: Loading devices...');
      
      const genieDevices = await this.client.getDevices();
      const cpeDevices: CPEDevice[] = [];
      
      for (const genieDevice of genieDevices) {
        try {
          const cpeDevice = await this.convertGenieDeviceToCPE(genieDevice);
          this.devices.set(cpeDevice.id, cpeDevice);
          cpeDevices.push(cpeDevice);
        } catch (error) {
          console.warn(`GenieACS Service: Failed to convert device ${genieDevice._id}:`, error);
        }
      }
      
      console.log(`GenieACS Service: Loaded ${cpeDevices.length} devices`);
      return cpeDevices;
      
    } catch (error) {
      console.error('GenieACS Service: Failed to load devices:', error);
      throw error;
    }
  }

  /**
   * Update devices from GenieACS
   */
  async updateDevices(): Promise<void> {
    try {
      const genieDevices = await this.client.getDevices();
      const updatedDevices: CPEDevice[] = [];
      const newDevices: CPEDevice[] = [];
      
      for (const genieDevice of genieDevices) {
        try {
          const cpeDevice = await this.convertGenieDeviceToCPE(genieDevice);
          const existingDevice = this.devices.get(cpeDevice.id);
          
          if (existingDevice) {
            // Update existing device
            this.devices.set(cpeDevice.id, cpeDevice);
            updatedDevices.push(cpeDevice);
            
            // Emit update event
            this.emitEvent('device_updated', cpeDevice);
          } else {
            // New device
            this.devices.set(cpeDevice.id, cpeDevice);
            newDevices.push(cpeDevice);
            
            // Emit new device event
            this.emitEvent('device_added', cpeDevice);
          }
        } catch (error) {
          console.warn(`GenieACS Service: Failed to process device ${genieDevice._id}:`, error);
        }
      }
      
      // Check for removed devices
      const currentDeviceIds = new Set(genieDevices.map(d => d._id));
      for (const [deviceId, device] of this.devices) {
        if (!currentDeviceIds.has(deviceId)) {
          this.devices.delete(deviceId);
          this.emitEvent('device_removed', device);
        }
      }
      
      if (newDevices.length > 0 || updatedDevices.length > 0) {
        console.log(`GenieACS Service: Updated ${updatedDevices.length} devices, added ${newDevices.length} devices`);
      }
      
    } catch (error) {
      console.error('GenieACS Service: Failed to update devices:', error);
      throw error;
    }
  }

  /**
   * Update device locations specifically
   */
  async updateDeviceLocations(): Promise<void> {
    try {
      const devicesWithGPS = await this.client.getDevicesWithGPS();
      
      for (const genieDevice of devicesWithGPS) {
        const existingDevice = this.devices.get(genieDevice._id);
        if (existingDevice) {
          const locationParams = TR069ParameterUtils.getLocationParameters();
          const locationData = await this.client.getDeviceParametersByPath(genieDevice._id, locationParams);
          
          const newLocation = this.extractLocationFromParameters(locationData);
          if (newLocation && this.hasLocationChanged(existingDevice.location, newLocation)) {
            existingDevice.location = newLocation;
            existingDevice.updatedAt = new Date();
            
            this.emitEvent('location_updated', existingDevice);
          }
        }
      }
      
    } catch (error) {
      console.error('GenieACS Service: Failed to update device locations:', error);
    }
  }

  /**
   * Convert GenieACS device to CPE device
   */
  private async convertGenieDeviceToCPE(genieDevice: GenieACSDevice): Promise<CPEDevice> {
    // Extract device ID information
    const deviceId = genieDevice._deviceId || {};
    
    // Get device parameters
    const parameters = await this.client.getDeviceParameters(genieDevice._id);
    
    // Extract location information
    const location = this.extractLocationFromParameters(parameters);
    
    // Extract network information
    const networkInfo = this.extractNetworkInfoFromParameters(parameters);
    
    // Extract performance metrics
    const performanceMetrics = this.extractPerformanceMetricsFromParameters(parameters);
    
    // Extract device information
    const softwareVersion = this.getParameterValue(parameters, TR069_PARAMETER_PATHS.SOFTWARE_VERSION);
    const hardwareVersion = this.getParameterValue(parameters, TR069_PARAMETER_PATHS.HARDWARE_VERSION);
    const connectionRequestURL = this.getParameterValue(parameters, TR069_PARAMETER_PATHS.CONNECTION_REQUEST_URL);
    
    // Determine device status
    const status = this.determineDeviceStatus(genieDevice);
    
    const cpeDevice: CPEDevice = {
      id: CPEDeviceUtils.generateDeviceId(deviceId),
      deviceId: {
        manufacturer: deviceId.Manufacturer || 'Unknown',
        oui: deviceId.OUI || '000000',
        productClass: deviceId.ProductClass || 'Unknown',
        serialNumber: deviceId.SerialNumber || genieDevice._id
      },
      location,
      networkInfo,
      performanceMetrics,
      lastContact: genieDevice._lastInform || new Date(),
      status,
      connectionRequestURL: connectionRequestURL as string,
      softwareVersion: softwareVersion as string,
      hardwareVersion: hardwareVersion as string,
      parameters,
      tasks: [], // TODO: Load tasks
      faults: [], // TODO: Load faults
      createdAt: genieDevice._registered || new Date(),
      updatedAt: new Date(),
      tags: genieDevice._tags || []
    };
    
    return cpeDevice;
  }

  /**
   * Extract location information from parameters
   */
  private extractLocationFromParameters(parameters: TR069Parameter[]): any {
    const latitude = this.getParameterValue(parameters, TR069_PARAMETER_PATHS.GPS_LATITUDE);
    const longitude = this.getParameterValue(parameters, TR069_PARAMETER_PATHS.GPS_LONGITUDE);
    const accuracy = this.getParameterValue(parameters, TR069_PARAMETER_PATHS.GPS_ACCURACY);
    const lastUpdate = this.getParameterValue(parameters, TR069_PARAMETER_PATHS.GPS_LAST_UPDATE);
    
    if (latitude && longitude && CPEDeviceUtils.validateGPS(Number(latitude), Number(longitude))) {
      return {
        latitude: Number(latitude),
        longitude: Number(longitude),
        accuracy: accuracy ? Number(accuracy) : undefined,
        lastUpdate: lastUpdate ? new Date(Number(lastUpdate)) : new Date(),
        source: 'gps' as const
      };
    }
    
    // Return default location if GPS not available
    return {
      latitude: 0,
      longitude: 0,
      accuracy: undefined,
      lastUpdate: new Date(),
      source: 'unknown' as const
    };
  }

  /**
   * Extract network information from parameters
   */
  private extractNetworkInfoFromParameters(parameters: TR069Parameter[]): any {
    const ipAddress = this.getParameterValue(parameters, TR069_PARAMETER_PATHS.IP_ADDRESS);
    const macAddress = this.getParameterValue(parameters, TR069_PARAMETER_PATHS.MAC_ADDRESS);
    const wifiSSID = this.getParameterValue(parameters, TR069_PARAMETER_PATHS.WIFI_SSID);
    const wifiChannel = this.getParameterValue(parameters, TR069_PARAMETER_PATHS.WIFI_CHANNEL);
    const wifiFrequency = this.getParameterValue(parameters, TR069_PARAMETER_PATHS.WIFI_FREQUENCY);
    const signalStrength = this.getParameterValue(parameters, TR069_PARAMETER_PATHS.SIGNAL_STRENGTH);
    
    return {
      ipAddress: ipAddress as string || '0.0.0.0',
      macAddress: macAddress as string || '00:00:00:00:00:00',
      connectionType: wifiSSID ? 'wifi' : 'ethernet',
      wifiSSID: wifiSSID as string,
      wifiChannel: wifiChannel ? Number(wifiChannel) : undefined,
      wifiFrequency: wifiFrequency ? Number(wifiFrequency) : undefined,
      signalStrength: signalStrength ? Number(signalStrength) : undefined
    };
  }

  /**
   * Extract performance metrics from parameters
   */
  private extractPerformanceMetricsFromParameters(parameters: TR069Parameter[]): any {
    const signalStrength = this.getParameterValue(parameters, TR069_PARAMETER_PATHS.SIGNAL_STRENGTH);
    const uptime = this.getParameterValue(parameters, TR069_PARAMETER_PATHS.UPTIME);
    
    return {
      signalStrength: signalStrength ? Number(signalStrength) : -100,
      bandwidth: 0, // TODO: Calculate from traffic stats
      latency: 0, // TODO: Implement ping-based latency measurement
      packetLoss: 0, // TODO: Calculate from error stats
      uptime: uptime ? Number(uptime) : 0,
      lastUpdate: new Date()
    };
  }

  /**
   * Get parameter value by path
   */
  private getParameterValue(parameters: TR069Parameter[], path: string): any {
    const parameter = parameters.find(p => p.name === path);
    return parameter ? parameter.value : null;
  }

  /**
   * Determine device status based on last contact
   */
  private determineDeviceStatus(genieDevice: GenieACSDevice): 'online' | 'offline' | 'unknown' | 'error' {
    if (!genieDevice._lastInform) return 'unknown';
    
    const timeSinceLastInform = Date.now() - genieDevice._lastInform.getTime();
    const timeoutMs = 5 * 60 * 1000; // 5 minutes
    
    if (timeSinceLastInform < timeoutMs) {
      return 'online';
    } else {
      return 'offline';
    }
  }

  /**
   * Check if location has changed
   */
  private hasLocationChanged(oldLocation: any, newLocation: any): boolean {
    const threshold = 0.0001; // ~10 meters
    return Math.abs(oldLocation.latitude - newLocation.latitude) > threshold ||
           Math.abs(oldLocation.longitude - newLocation.longitude) > threshold;
  }

  /**
   * Emit device update event
   */
  private emitEvent(type: DeviceUpdateEvent['type'], device: CPEDevice): void {
    const event: DeviceUpdateEvent = {
      type,
      device,
      timestamp: new Date()
    };
    
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('GenieACS Service: Event listener error:', error);
      }
    });
  }

  /**
   * Add event listener
   */
  addEventListener(id: string, listener: (event: DeviceUpdateEvent) => void): void {
    this.eventListeners.set(id, listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(id: string): void {
    this.eventListeners.delete(id);
  }

  /**
   * Get all CPE devices
   */
  getAllDevices(): CPEDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get device by ID
   */
  getDevice(deviceId: string): CPEDevice | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * Get devices with GPS coordinates
   */
  getDevicesWithGPS(): CPEDevice[] {
    return this.getAllDevices().filter(device => 
      CPEDeviceUtils.validateGPS(device.location.latitude, device.location.longitude) &&
      device.location.latitude !== 0 && device.location.longitude !== 0
    );
  }

  /**
   * Get online devices
   */
  getOnlineDevices(): CPEDevice[] {
    return this.getAllDevices().filter(device => device.status === 'online');
  }

  /**
   * Get devices by manufacturer
   */
  getDevicesByManufacturer(manufacturer: string): CPEDevice[] {
    return this.getAllDevices().filter(device => 
      device.deviceId.manufacturer.toLowerCase().includes(manufacturer.toLowerCase())
    );
  }

  /**
   * Search devices
   */
  searchDevices(searchText: string): CPEDevice[] {
    const searchLower = searchText.toLowerCase();
    return this.getAllDevices().filter(device =>
      device.deviceId.serialNumber.toLowerCase().includes(searchLower) ||
      device.deviceId.manufacturer.toLowerCase().includes(searchLower) ||
      device.deviceId.productClass.toLowerCase().includes(searchLower) ||
      device.networkInfo.ipAddress.includes(searchText)
    );
  }

  /**
   * Get device performance metrics
   */
  async getDevicePerformanceMetrics(deviceId: string): Promise<any> {
    const device = this.getDevice(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }
    
    // Get latest performance parameters
    const performanceParams = TR069ParameterUtils.getPerformanceParameters();
    const parameters = await this.client.getDeviceParametersByPath(deviceId, performanceParams);
    
    return this.extractPerformanceMetricsFromParameters(parameters);
  }

  /**
   * Ping device
   */
  async pingDevice(deviceId: string): Promise<{ success: boolean; latency?: number }> {
    return this.client.pingDevice(deviceId);
  }

  /**
   * Get service status
   */
  getStatus(): { isRunning: boolean; deviceCount: number; onlineCount: number } {
    return {
      isRunning: this.isRunning,
      deviceCount: this.devices.size,
      onlineCount: this.getOnlineDevices().length
    };
  }

  /**
   * Dispose of the service
   */
  dispose(): void {
    this.stopAutoDiscovery();
    this.eventListeners.clear();
    this.devices.clear();
  }
}
