// CPE Device Data Model for TR-069 Integration
// Represents Customer Premises Equipment managed via TR-069 protocol

export interface CPEDeviceId {
  manufacturer: string;           // Device manufacturer (e.g., "Nokia", "Huawei")
  oui: string;                   // Organizationally Unique Identifier (6 hex digits)
  productClass: string;          // Product class identifier
  serialNumber: string;          // Device serial number
}

export interface CPELocation {
  latitude: number;              // GPS latitude in decimal degrees
  longitude: number;             // GPS longitude in decimal degrees
  accuracy?: number;             // GPS accuracy in meters
  altitude?: number;             // Altitude above sea level in meters
  lastUpdate: Date;              // Last GPS update timestamp
  source: 'gps' | 'network' | 'manual'; // How location was determined
}

export interface CPENetworkInfo {
  ipAddress: string;             // Primary IP address
  macAddress: string;            // MAC address
  connectionType: 'wifi' | 'ethernet' | 'cellular' | 'unknown';
  wifiSSID?: string;             // WiFi network name
  wifiChannel?: number;          // WiFi channel number
  wifiFrequency?: number;        // WiFi frequency in MHz
  signalStrength?: number;       // Signal strength in dBm
}

export interface CPEPerformanceMetrics {
  signalStrength: number;        // RSSI/dBm
  bandwidth: number;             // Throughput in Mbps
  latency: number;               // Round-trip time in ms
  packetLoss: number;            // Packet loss percentage (0-100)
  uptime: number;                // Device uptime in seconds
  cpuUsage?: number;             // CPU usage percentage
  memoryUsage?: number;          // Memory usage percentage
  temperature?: number;          // Device temperature in Celsius
  lastUpdate: Date;              // Last metrics update
}

export interface CPEDevice {
  id: string;                    // Unique device identifier (derived from deviceId)
  deviceId: CPEDeviceId;         // TR-069 device identification
  location: CPELocation;         // GPS and location information
  networkInfo: CPENetworkInfo;   // Network connectivity information
  performanceMetrics: CPEPerformanceMetrics; // Performance data
  
  // Device status and management
  lastContact: Date;             // Last successful TR-069 contact
  status: 'online' | 'offline' | 'unknown' | 'error';
  connectionRequestURL?: string; // ACS connection URL
  softwareVersion?: string;      // Device firmware version
  hardwareVersion?: string;      // Device hardware version
  
  // TR-069 specific data
  parameters: TR069Parameter[];  // Current parameter values
  tasks: CPETask[];              // Pending TR-069 tasks
  faults: CPEFault[];            // Active device faults
  
  // Metadata
  createdAt: Date;               // Device discovery timestamp
  updatedAt: Date;               // Last update timestamp
  tags: string[];                // Device categorization tags
  notes?: string;                // User notes
}

export interface TR069Parameter {
  name: string;                  // Parameter path (e.g., "Device.GPS.Latitude")
  value: string | number | boolean;
  type: 'string' | 'int' | 'unsignedInt' | 'boolean' | 'dateTime' | 'base64';
  timestamp: Date;               // When parameter was last updated
  writable: boolean;             // Whether parameter can be written
  category: 'location' | 'performance' | 'configuration' | 'status' | 'network' | 'security';
  description?: string;          // Human-readable parameter description
  units?: string;                // Parameter units (e.g., "dBm", "MHz", "meters")
}

export interface CPETask {
  id: string;                    // Task identifier
  name: string;                  // Task name/type
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;               // Task creation time
  startedAt?: Date;              // Task start time
  completedAt?: Date;            // Task completion time
  parameters: TR069Parameter[];  // Task parameters
  result?: any;                  // Task result data
  error?: string;                // Error message if failed
}

export interface CPEFault {
  id: string;                    // Fault identifier
  code: string;                  // Fault code
  message: string;               // Fault description
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;               // Fault occurrence time
  acknowledged: boolean;         // Whether fault has been acknowledged
  resolved: boolean;             // Whether fault has been resolved
  details?: any;                 // Additional fault details
}

// Utility functions for CPE device management
export class CPEDeviceUtils {
  /**
   * Generate unique device ID from TR-069 device identification
   */
  static generateDeviceId(deviceId: CPEDeviceId): string {
    return `${deviceId.oui}-${deviceId.serialNumber}`;
  }

  /**
   * Check if device is currently online based on last contact time
   */
  static isOnline(device: CPEDevice, timeoutMinutes: number = 5): boolean {
    const timeoutMs = timeoutMinutes * 60 * 1000;
    return (Date.now() - device.lastContact.getTime()) < timeoutMs;
  }

  /**
   * Calculate distance between device and a point
   */
  static calculateDistance(
    device: CPEDevice, 
    latitude: number, 
    longitude: number
  ): number {
    return this.calculateDistanceBetweenPoints(
      device.location.latitude,
      device.location.longitude,
      latitude,
      longitude
    );
  }

  /**
   * Calculate distance between two GPS coordinates (Haversine formula)
   */
  static calculateDistanceBetweenPoints(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }

  /**
   * Convert degrees to radians
   */
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Validate GPS coordinates
   */
  static validateGPS(latitude: number, longitude: number): boolean {
    return latitude >= -90 && latitude <= 90 && 
           longitude >= -180 && longitude <= 180 &&
           !isNaN(latitude) && !isNaN(longitude);
  }

  /**
   * Get device display name
   */
  static getDisplayName(device: CPEDevice): string {
    return `${device.deviceId.manufacturer} ${device.deviceId.productClass} (${device.deviceId.serialNumber.slice(-6)})`;
  }

  /**
   * Get device status color for UI
   */
  static getStatusColor(device: CPEDevice): string {
    switch (device.status) {
      case 'online': return '#22c55e';  // green
      case 'offline': return '#ef4444'; // red
      case 'error': return '#f59e0b';   // yellow
      default: return '#6b7280';        // gray
    }
  }

  /**
   * Get signal strength indicator
   */
  static getSignalStrengthIndicator(signalStrength: number): string {
    if (signalStrength >= -50) return 'excellent';
    if (signalStrength >= -60) return 'good';
    if (signalStrength >= -70) return 'fair';
    if (signalStrength >= -80) return 'poor';
    return 'very-poor';
  }
}

// Key TR-069 parameter paths for CPE mapping
export const TR069_PARAMETER_PATHS = {
  // Location parameters
  GPS_LATITUDE: 'Device.GPS.Latitude',
  GPS_LONGITUDE: 'Device.GPS.Longitude',
  GPS_ACCURACY: 'Device.GPS.Accuracy',
  GPS_LAST_UPDATE: 'Device.GPS.LastUpdate',
  
  // Network parameters
  IP_ADDRESS: 'Device.IP.Interface.1.IPAddress',
  MAC_ADDRESS: 'Device.Ethernet.Interface.1.MACAddress',
  WIFI_SSID: 'Device.WiFi.Radio.1.SSID',
  WIFI_CHANNEL: 'Device.WiFi.Radio.1.Channel',
  WIFI_FREQUENCY: 'Device.WiFi.Radio.1.Frequency',
  
  // Performance parameters
  SIGNAL_STRENGTH: 'Device.WiFi.Radio.1.SignalStrength',
  BANDWIDTH_RX: 'Device.Ethernet.Interface.1.Stats.BytesReceived',
  BANDWIDTH_TX: 'Device.Ethernet.Interface.1.Stats.BytesSent',
  UPTIME: 'Device.DeviceInfo.Uptime',
  
  // Device information
  SOFTWARE_VERSION: 'Device.DeviceInfo.SoftwareVersion',
  HARDWARE_VERSION: 'Device.DeviceInfo.HardwareVersion',
  MANUFACTURER: 'Device.DeviceInfo.Manufacturer',
  PRODUCT_CLASS: 'Device.DeviceInfo.ProductClass',
  SERIAL_NUMBER: 'Device.DeviceInfo.SerialNumber',
  
  // Management parameters
  CONNECTION_REQUEST_URL: 'Device.ManagementServer.ConnectionRequestURL',
  PERIODIC_INFORM_INTERVAL: 'Device.ManagementServer.PeriodicInformInterval',
  INFORM_INTERVAL: 'Device.ManagementServer.InformInterval'
} as const;

// Parameter categories for organization
export const PARAMETER_CATEGORIES = {
  LOCATION: 'location',
  PERFORMANCE: 'performance', 
  CONFIGURATION: 'configuration',
  STATUS: 'status',
  NETWORK: 'network',
  SECURITY: 'security'
} as const;
