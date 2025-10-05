// TR-069 Parameter Definitions and Management
// Comprehensive parameter mapping for CPE devices

export interface TR069ParameterDefinition {
  path: string;                   // Parameter path (e.g., "Device.GPS.Latitude")
  name: string;                   // Human-readable name
  description: string;            // Parameter description
  type: 'string' | 'int' | 'unsignedInt' | 'boolean' | 'dateTime' | 'base64';
  writable: boolean;              // Whether parameter can be written
  category: ParameterCategory;    // Parameter category
  units?: string;                 // Parameter units
  minValue?: number;              // Minimum value (for numeric types)
  maxValue?: number;              // Maximum value (for numeric types)
  enumValues?: string[];          // Allowed values (for enum types)
  defaultValue?: any;             // Default value
  required: boolean;              // Whether parameter is required
  deprecated?: boolean;           // Whether parameter is deprecated
}

export type ParameterCategory = 
  | 'location' 
  | 'performance' 
  | 'configuration' 
  | 'status' 
  | 'network' 
  | 'security'
  | 'system'
  | 'diagnostics';

// Comprehensive TR-069 parameter definitions
export const TR069_PARAMETER_DEFINITIONS: Record<string, TR069ParameterDefinition> = {
  // GPS/Location Parameters
  'Device.GPS.Latitude': {
    path: 'Device.GPS.Latitude',
    name: 'GPS Latitude',
    description: 'Current GPS latitude coordinate',
    type: 'string',
    writable: false,
    category: 'location',
    units: 'decimal degrees',
    minValue: -90,
    maxValue: 90,
    required: true
  },
  'Device.GPS.Longitude': {
    path: 'Device.GPS.Longitude',
    name: 'GPS Longitude',
    description: 'Current GPS longitude coordinate',
    type: 'string',
    writable: false,
    category: 'location',
    units: 'decimal degrees',
    minValue: -180,
    maxValue: 180,
    required: true
  },
  'Device.GPS.Accuracy': {
    path: 'Device.GPS.Accuracy',
    name: 'GPS Accuracy',
    description: 'GPS accuracy in meters',
    type: 'unsignedInt',
    writable: false,
    category: 'location',
    units: 'meters',
    required: false
  },
  'Device.GPS.LastUpdate': {
    path: 'Device.GPS.LastUpdate',
    name: 'GPS Last Update',
    description: 'Timestamp of last GPS update',
    type: 'dateTime',
    writable: false,
    category: 'location',
    required: false
  },

  // Network Interface Parameters
  'Device.IP.Interface.1.IPAddress': {
    path: 'Device.IP.Interface.1.IPAddress',
    name: 'Primary IP Address',
    description: 'Primary IP address of the device',
    type: 'string',
    writable: false,
    category: 'network',
    required: true
  },
  'Device.Ethernet.Interface.1.MACAddress': {
    path: 'Device.Ethernet.Interface.1.MACAddress',
    name: 'Ethernet MAC Address',
    description: 'MAC address of primary Ethernet interface',
    type: 'string',
    writable: false,
    category: 'network',
    required: true
  },
  'Device.WiFi.Radio.1.SSID': {
    path: 'Device.WiFi.Radio.1.SSID',
    name: 'WiFi SSID',
    description: 'WiFi network name (SSID)',
    type: 'string',
    writable: true,
    category: 'network',
    required: false
  },
  'Device.WiFi.Radio.1.Channel': {
    path: 'Device.WiFi.Radio.1.Channel',
    name: 'WiFi Channel',
    description: 'Current WiFi channel',
    type: 'unsignedInt',
    writable: true,
    category: 'network',
    minValue: 1,
    maxValue: 165,
    required: false
  },
  'Device.WiFi.Radio.1.Frequency': {
    path: 'Device.WiFi.Radio.1.Frequency',
    name: 'WiFi Frequency',
    description: 'Current WiFi frequency',
    type: 'unsignedInt',
    writable: false,
    category: 'network',
    units: 'MHz',
    required: false
  },

  // Performance Parameters
  'Device.WiFi.Radio.1.SignalStrength': {
    path: 'Device.WiFi.Radio.1.SignalStrength',
    name: 'WiFi Signal Strength',
    description: 'Current WiFi signal strength',
    type: 'int',
    writable: false,
    category: 'performance',
    units: 'dBm',
    minValue: -120,
    maxValue: 0,
    required: false
  },
  'Device.Ethernet.Interface.1.Stats.BytesReceived': {
    path: 'Device.Ethernet.Interface.1.Stats.BytesReceived',
    name: 'Bytes Received',
    description: 'Total bytes received on Ethernet interface',
    type: 'unsignedInt',
    writable: false,
    category: 'performance',
    units: 'bytes',
    required: false
  },
  'Device.Ethernet.Interface.1.Stats.BytesSent': {
    path: 'Device.Ethernet.Interface.1.Stats.BytesSent',
    name: 'Bytes Sent',
    description: 'Total bytes sent on Ethernet interface',
    type: 'unsignedInt',
    writable: false,
    category: 'performance',
    units: 'bytes',
    required: false
  },
  'Device.DeviceInfo.Uptime': {
    path: 'Device.DeviceInfo.Uptime',
    name: 'Device Uptime',
    description: 'Device uptime in seconds',
    type: 'unsignedInt',
    writable: false,
    category: 'performance',
    units: 'seconds',
    required: false
  },

  // Device Information Parameters
  'Device.DeviceInfo.Manufacturer': {
    path: 'Device.DeviceInfo.Manufacturer',
    name: 'Manufacturer',
    description: 'Device manufacturer name',
    type: 'string',
    writable: false,
    category: 'system',
    required: true
  },
  'Device.DeviceInfo.ProductClass': {
    path: 'Device.DeviceInfo.ProductClass',
    name: 'Product Class',
    description: 'Device product class',
    type: 'string',
    writable: false,
    category: 'system',
    required: true
  },
  'Device.DeviceInfo.SerialNumber': {
    path: 'Device.DeviceInfo.SerialNumber',
    name: 'Serial Number',
    description: 'Device serial number',
    type: 'string',
    writable: false,
    category: 'system',
    required: true
  },
  'Device.DeviceInfo.SoftwareVersion': {
    path: 'Device.DeviceInfo.SoftwareVersion',
    name: 'Software Version',
    description: 'Device software/firmware version',
    type: 'string',
    writable: false,
    category: 'system',
    required: true
  },
  'Device.DeviceInfo.HardwareVersion': {
    path: 'Device.DeviceInfo.HardwareVersion',
    name: 'Hardware Version',
    description: 'Device hardware version',
    type: 'string',
    writable: false,
    category: 'system',
    required: false
  },

  // Management Server Parameters
  'Device.ManagementServer.ConnectionRequestURL': {
    path: 'Device.ManagementServer.ConnectionRequestURL',
    name: 'Connection Request URL',
    description: 'ACS connection request URL',
    type: 'string',
    writable: true,
    category: 'configuration',
    required: true
  },
  'Device.ManagementServer.PeriodicInformInterval': {
    path: 'Device.ManagementServer.PeriodicInformInterval',
    name: 'Periodic Inform Interval',
    description: 'Periodic inform interval in seconds',
    type: 'unsignedInt',
    writable: true,
    category: 'configuration',
    units: 'seconds',
    minValue: 60,
    maxValue: 86400,
    defaultValue: 3600,
    required: false
  },
  'Device.ManagementServer.InformInterval': {
    path: 'Device.ManagementServer.InformInterval',
    name: 'Inform Interval',
    description: 'Inform interval in seconds',
    type: 'unsignedInt',
    writable: true,
    category: 'configuration',
    units: 'seconds',
    minValue: 60,
    maxValue: 86400,
    defaultValue: 3600,
    required: false
  },

  // Diagnostics Parameters
  'Device.IP.Diagnostics.IPPing.1.Interface': {
    path: 'Device.IP.Diagnostics.IPPing.1.Interface',
    name: 'Ping Interface',
    description: 'Interface to use for ping diagnostics',
    type: 'string',
    writable: true,
    category: 'diagnostics',
    required: false
  },
  'Device.IP.Diagnostics.IPPing.1.Host': {
    path: 'Device.IP.Diagnostics.IPPing.1.Host',
    name: 'Ping Host',
    description: 'Host to ping for diagnostics',
    type: 'string',
    writable: true,
    category: 'diagnostics',
    required: false
  },
  'Device.IP.Diagnostics.IPPing.1.NumberOfRepetitions': {
    path: 'Device.IP.Diagnostics.IPPing.1.NumberOfRepetitions',
    name: 'Ping Repetitions',
    description: 'Number of ping repetitions',
    type: 'unsignedInt',
    writable: true,
    category: 'diagnostics',
    minValue: 1,
    maxValue: 100,
    defaultValue: 4,
    required: false
  },

  // Security Parameters
  'Device.ManagementServer.Username': {
    path: 'Device.ManagementServer.Username',
    name: 'Management Username',
    description: 'Username for ACS authentication',
    type: 'string',
    writable: true,
    category: 'security',
    required: false
  },
  'Device.ManagementServer.Password': {
    path: 'Device.ManagementServer.Password',
    name: 'Management Password',
    description: 'Password for ACS authentication',
    type: 'string',
    writable: true,
    category: 'security',
    required: false
  }
};

// Parameter categories with their associated parameters
export const PARAMETER_CATEGORY_MAPPINGS: Record<ParameterCategory, string[]> = {
  location: [
    'Device.GPS.Latitude',
    'Device.GPS.Longitude',
    'Device.GPS.Accuracy',
    'Device.GPS.LastUpdate'
  ],
  performance: [
    'Device.WiFi.Radio.1.SignalStrength',
    'Device.Ethernet.Interface.1.Stats.BytesReceived',
    'Device.Ethernet.Interface.1.Stats.BytesSent',
    'Device.DeviceInfo.Uptime'
  ],
  network: [
    'Device.IP.Interface.1.IPAddress',
    'Device.Ethernet.Interface.1.MACAddress',
    'Device.WiFi.Radio.1.SSID',
    'Device.WiFi.Radio.1.Channel',
    'Device.WiFi.Radio.1.Frequency'
  ],
  system: [
    'Device.DeviceInfo.Manufacturer',
    'Device.DeviceInfo.ProductClass',
    'Device.DeviceInfo.SerialNumber',
    'Device.DeviceInfo.SoftwareVersion',
    'Device.DeviceInfo.HardwareVersion'
  ],
  configuration: [
    'Device.ManagementServer.ConnectionRequestURL',
    'Device.ManagementServer.PeriodicInformInterval',
    'Device.ManagementServer.InformInterval'
  ],
  diagnostics: [
    'Device.IP.Diagnostics.IPPing.1.Interface',
    'Device.IP.Diagnostics.IPPing.1.Host',
    'Device.IP.Diagnostics.IPPing.1.NumberOfRepetitions'
  ],
  security: [
    'Device.ManagementServer.Username',
    'Device.ManagementServer.Password'
  ],
  status: [] // Status parameters are typically derived from other parameters
};

// Utility functions for parameter management
export class TR069ParameterUtils {
  /**
   * Get parameter definition by path
   */
  static getParameterDefinition(path: string): TR069ParameterDefinition | undefined {
    return TR069_PARAMETER_DEFINITIONS[path];
  }

  /**
   * Get all parameters in a category
   */
  static getParametersByCategory(category: ParameterCategory): string[] {
    return PARAMETER_CATEGORY_MAPPINGS[category] || [];
  }

  /**
   * Get all parameter definitions for a category
   */
  static getParameterDefinitionsByCategory(category: ParameterCategory): TR069ParameterDefinition[] {
    const paths = this.getParametersByCategory(category);
    return paths
      .map(path => TR069_PARAMETER_DEFINITIONS[path])
      .filter(def => def !== undefined);
  }

  /**
   * Validate parameter value against definition
   */
  static validateParameterValue(
    definition: TR069ParameterDefinition,
    value: any
  ): { valid: boolean; error?: string } {
    // Type validation
    switch (definition.type) {
      case 'string':
        if (typeof value !== 'string') {
          return { valid: false, error: 'Value must be a string' };
        }
        break;
      case 'int':
      case 'unsignedInt':
        if (typeof value !== 'number' || !Number.isInteger(value)) {
          return { valid: false, error: 'Value must be an integer' };
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return { valid: false, error: 'Value must be a boolean' };
        }
        break;
      case 'dateTime':
        if (typeof value !== 'number' || isNaN(value)) {
          return { valid: false, error: 'Value must be a valid timestamp' };
        }
        break;
    }

    // Range validation for numeric types
    if ((definition.type === 'int' || definition.type === 'unsignedInt') && typeof value === 'number') {
      if (definition.minValue !== undefined && value < definition.minValue) {
        return { valid: false, error: `Value must be >= ${definition.minValue}` };
      }
      if (definition.maxValue !== undefined && value > definition.maxValue) {
        return { valid: false, error: `Value must be <= ${definition.maxValue}` };
      }
    }

    // Enum validation
    if (definition.enumValues && !definition.enumValues.includes(value)) {
      return { valid: false, error: `Value must be one of: ${definition.enumValues.join(', ')}` };
    }

    return { valid: true };
  }

  /**
   * Convert parameter value to appropriate type
   */
  static convertParameterValue(value: any, type: string): any {
    switch (type) {
      case 'string':
        return String(value);
      case 'int':
      case 'unsignedInt':
        const num = parseInt(String(value));
        return isNaN(num) ? value : num;
      case 'boolean':
        if (typeof value === 'boolean') return value;
        const str = String(value).toLowerCase();
        return str === 'true' || str === '1';
      case 'dateTime':
        if (typeof value === 'number') return value;
        const timestamp = Date.parse(String(value));
        return isNaN(timestamp) ? value : timestamp;
      default:
        return value;
    }
  }

  /**
   * Get parameter display value with units
   */
  static getDisplayValue(definition: TR069ParameterDefinition, value: any): string {
    const displayValue = this.convertParameterValue(value, definition.type);
    
    if (definition.units) {
      return `${displayValue} ${definition.units}`;
    }
    
    return String(displayValue);
  }

  /**
   * Check if parameter is writable
   */
  static isWritable(path: string): boolean {
    const definition = this.getParameterDefinition(path);
    return definition?.writable || false;
  }

  /**
   * Get required parameters for basic device setup
   */
  static getRequiredParameters(): string[] {
    return Object.values(TR069_PARAMETER_DEFINITIONS)
      .filter(def => def.required)
      .map(def => def.path);
  }

  /**
   * Get location-specific parameters
   */
  static getLocationParameters(): string[] {
    return this.getParametersByCategory('location');
  }

  /**
   * Get performance-specific parameters
   */
  static getPerformanceParameters(): string[] {
    return this.getParametersByCategory('performance');
  }

  /**
   * Get network-specific parameters
   */
  static getNetworkParameters(): string[] {
    return this.getParametersByCategory('network');
  }
}
