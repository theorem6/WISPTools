// GenieACS Configuration
// Central configuration for GenieACS integration with PCI Mapper

export interface GenieACSIntegrationConfig {
  // GenieACS server configuration
  genieacs: {
    baseUrl: string;                    // GenieACS NBI base URL
    username?: string;                  // Authentication username
    password?: string;                  // Authentication password
    timeout: number;                    // Request timeout in milliseconds
  };

  // Device discovery and management
  deviceManagement: {
    enableAutoDiscovery: boolean;       // Automatically discover new devices
    updateInterval: number;             // Device update interval in milliseconds
    locationUpdateInterval: number;     // Location update interval in milliseconds
    maxDevices: number;                 // Maximum number of devices to manage
  };

  // Location and mapping configuration
  location: {
    enableGPSTracking: boolean;         // Enable GPS location tracking
    gpsAccuracyThreshold: number;       // Minimum GPS accuracy in meters
    clusterRadius: number;              // Device clustering radius in meters
    minClusterSize: number;             // Minimum devices per cluster
    enableLocationAnalytics: boolean;   // Enable location analytics
  };

  // Performance monitoring
  performance: {
    enableMonitoring: boolean;          // Enable performance monitoring
    monitoringInterval: number;         // Performance data collection interval
    metricsRetentionDays: number;       // How long to keep performance data
    enableAlerts: boolean;              // Enable performance alerts
    alertThresholds: {
      signalStrength: number;           // Signal strength alert threshold (dBm)
      latency: number;                  // Latency alert threshold (ms)
      packetLoss: number;               // Packet loss alert threshold (%)
    };
  };

  // Map visualization
  visualization: {
    showCPEDevices: boolean;            // Show CPE devices on map
    showDeviceClusters: boolean;        // Show device clusters
    showPerformanceIndicators: boolean; // Show performance indicators
    deviceSymbolSize: number;           // Base device symbol size
    enableDeviceLabels: boolean;        // Show device labels when zoomed in
    clusterTransparency: number;        // Cluster overlay transparency (0-1)
  };

  // TR-069 parameter configuration
  tr069: {
    // Required parameters for device identification
    requiredParameters: string[];
    
    // Location parameters to monitor
    locationParameters: string[];
    
    // Performance parameters to monitor
    performanceParameters: string[];
    
    // Network parameters to monitor
    networkParameters: string[];
    
    // Parameter update intervals (in seconds)
    parameterUpdateIntervals: {
      location: number;
      performance: number;
      network: number;
      system: number;
    };
  };

  // Security and authentication
  security: {
    enableAuthentication: boolean;      // Enable GenieACS authentication
    apiKey?: string;                    // API key for external access
    allowedIPs: string[];               // Allowed IP addresses
    enableHTTPS: boolean;               // Force HTTPS connections
    certificateValidation: boolean;     // Validate SSL certificates
  };

  // Logging and debugging
  logging: {
    enableDebugLogs: boolean;           // Enable debug logging
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    logToConsole: boolean;              // Log to browser console
    logToServer: boolean;               // Log to server
    maxLogEntries: number;              // Maximum log entries to keep
  };

  // Integration with existing PCI Mapper
  pciMapper: {
    enableIntegration: boolean;         // Enable integration with PCI mapper
    showCPEWithCells: boolean;          // Show CPE devices alongside cell sites
    enableConflictDetection: boolean;   // Detect conflicts between CPEs and cells
    cpeConflictRadius: number;          // Radius for CPE-cell conflict detection
  };
}

// Default configuration
export const DEFAULT_GENIEACS_CONFIG: GenieACSIntegrationConfig = {
  genieacs: {
    baseUrl: typeof window !== 'undefined' && import.meta.env.PUBLIC_GENIEACS_NBI_URL 
      ? import.meta.env.PUBLIC_GENIEACS_NBI_URL 
      : 'http://localhost:7557',
    timeout: 30000
  },

  deviceManagement: {
    enableAutoDiscovery: true,
    updateInterval: 30000,              // 30 seconds
    locationUpdateInterval: 60000,      // 1 minute
    maxDevices: 10000
  },

  location: {
    enableGPSTracking: true,
    gpsAccuracyThreshold: 100,          // 100 meters
    clusterRadius: 500,                 // 500 meters
    minClusterSize: 2,
    enableLocationAnalytics: true
  },

  performance: {
    enableMonitoring: true,
    monitoringInterval: 60000,          // 1 minute
    metricsRetentionDays: 30,
    enableAlerts: true,
    alertThresholds: {
      signalStrength: -80,              // -80 dBm
      latency: 100,                     // 100 ms
      packetLoss: 5                     // 5%
    }
  },

  visualization: {
    showCPEDevices: true,
    showDeviceClusters: true,
    showPerformanceIndicators: true,
    deviceSymbolSize: 8,
    enableDeviceLabels: true,
    clusterTransparency: 0.3
  },

  tr069: {
    requiredParameters: [
      'Device.DeviceInfo.Manufacturer',
      'Device.DeviceInfo.ProductClass',
      'Device.DeviceInfo.SerialNumber',
      'Device.DeviceInfo.SoftwareVersion'
    ],
    
    locationParameters: [
      'Device.GPS.Latitude',
      'Device.GPS.Longitude',
      'Device.GPS.Accuracy',
      'Device.GPS.LastUpdate'
    ],
    
    performanceParameters: [
      'Device.WiFi.Radio.1.SignalStrength',
      'Device.Ethernet.Interface.1.Stats.BytesReceived',
      'Device.Ethernet.Interface.1.Stats.BytesSent',
      'Device.DeviceInfo.Uptime'
    ],
    
    networkParameters: [
      'Device.IP.Interface.1.IPAddress',
      'Device.Ethernet.Interface.1.MACAddress',
      'Device.WiFi.Radio.1.SSID',
      'Device.WiFi.Radio.1.Channel',
      'Device.WiFi.Radio.1.Frequency'
    ],
    
    parameterUpdateIntervals: {
      location: 300,                    // 5 minutes
      performance: 60,                  // 1 minute
      network: 600,                     // 10 minutes
      system: 3600                      // 1 hour
    }
  },

  security: {
    enableAuthentication: false,
    allowedIPs: [],
    enableHTTPS: false,
    certificateValidation: true
  },

  logging: {
    enableDebugLogs: false,
    logLevel: 'info',
    logToConsole: true,
    logToServer: false,
    maxLogEntries: 1000
  },

  pciMapper: {
    enableIntegration: true,
    showCPEWithCells: true,
    enableConflictDetection: true,
    cpeConflictRadius: 1000             // 1 km
  }
};

// Environment-specific configurations
export const getEnvironmentConfig = (): Partial<GenieACSIntegrationConfig> => {
  const env = import.meta.env.MODE;
  
  switch (env) {
    case 'development':
      return {
        genieacs: {
          baseUrl: import.meta.env.PUBLIC_GENIEACS_NBI_URL || 'http://localhost:7557',
          timeout: 30000
        },
        logging: {
          enableDebugLogs: true,
          logLevel: 'debug',
          logToConsole: true
        }
      };
      
    case 'production':
      return {
        genieacs: {
          baseUrl: import.meta.env.PUBLIC_GENIEACS_NBI_URL || process.env.GENIEACS_BASE_URL || 'http://localhost:7557',
          timeout: 15000
        },
        security: {
          enableAuthentication: true,
          enableHTTPS: true,
          certificateValidation: true
        },
        logging: {
          enableDebugLogs: false,
          logLevel: 'warn',
          logToConsole: false,
          logToServer: true
        }
      };
      
    case 'test':
      return {
        genieacs: {
          baseUrl: import.meta.env.PUBLIC_GENIEACS_NBI_URL || 'http://localhost:7557',
          timeout: 5000
        },
        deviceManagement: {
          enableAutoDiscovery: false,
          updateInterval: 1000,
          maxDevices: 100
        },
        logging: {
          enableDebugLogs: true,
          logLevel: 'debug',
          logToConsole: false
        }
      };
      
    default:
      return {};
  }
};

// Configuration validation
export class GenieACSConfigValidator {
  static validate(config: GenieACSIntegrationConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate GenieACS URL
    try {
      new URL(config.genieacs.baseUrl);
    } catch {
      errors.push('Invalid GenieACS base URL');
    }

    // Validate timeouts
    if (config.genieacs.timeout < 1000) {
      errors.push('GenieACS timeout must be at least 1000ms');
    }

    // Validate intervals
    if (config.deviceManagement.updateInterval < 1000) {
      errors.push('Device update interval must be at least 1000ms');
    }

    if (config.deviceManagement.locationUpdateInterval < 1000) {
      errors.push('Location update interval must be at least 1000ms');
    }

    // Validate thresholds
    if (config.location.gpsAccuracyThreshold < 0) {
      errors.push('GPS accuracy threshold must be non-negative');
    }

    if (config.performance.alertThresholds.signalStrength > 0) {
      errors.push('Signal strength threshold should be negative (dBm)');
    }

    // Validate parameter arrays
    if (config.tr069.requiredParameters.length === 0) {
      errors.push('At least one required parameter must be specified');
    }

    // Validate security settings
    if (config.security.enableAuthentication && !config.genieacs.username) {
      errors.push('Authentication is enabled but no username provided');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Configuration manager
export class GenieACSConfigManager {
  private config: GenieACSIntegrationConfig;

  constructor(initialConfig?: Partial<GenieACSIntegrationConfig>) {
    // Merge default config with environment-specific config and provided config
    this.config = {
      ...DEFAULT_GENIEACS_CONFIG,
      ...getEnvironmentConfig(),
      ...initialConfig
    } as GenieACSIntegrationConfig;

    // Validate configuration
    const validation = GenieACSConfigValidator.validate(this.config);
    if (!validation.valid) {
      console.error('GenieACS Configuration Validation Errors:', validation.errors);
      throw new Error(`Invalid GenieACS configuration: ${validation.errors.join(', ')}`);
    }
  }

  getConfig(): GenieACSIntegrationConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<GenieACSIntegrationConfig>): void {
    this.config = {
      ...this.config,
      ...updates
    };

    // Re-validate after update
    const validation = GenieACSConfigValidator.validate(this.config);
    if (!validation.valid) {
      console.error('GenieACS Configuration Update Validation Errors:', validation.errors);
      throw new Error(`Invalid configuration update: ${validation.errors.join(', ')}`);
    }
  }

  getGenieACSConfig() {
    return this.config.genieacs;
  }

  getDeviceManagementConfig() {
    return this.config.deviceManagement;
  }

  getLocationConfig() {
    return this.config.location;
  }

  getPerformanceConfig() {
    return this.config.performance;
  }

  getVisualizationConfig() {
    return this.config.visualization;
  }

  getTR069Config() {
    return this.config.tr069;
  }

  getSecurityConfig() {
    return this.config.security;
  }

  getLoggingConfig() {
    return this.config.logging;
  }

  getPCIMapperConfig() {
    return this.config.pciMapper;
  }

  // Helper methods for common configuration checks
  isAutoDiscoveryEnabled(): boolean {
    return this.config.deviceManagement.enableAutoDiscovery;
  }

  isGPSTrackingEnabled(): boolean {
    return this.config.location.enableGPSTracking;
  }

  isPerformanceMonitoringEnabled(): boolean {
    return this.config.performance.enableMonitoring;
  }

  isAuthenticationEnabled(): boolean {
    return this.config.security.enableAuthentication;
  }

  isDebugLoggingEnabled(): boolean {
    return this.config.logging.enableDebugLogs;
  }

  isPCIIntegrationEnabled(): boolean {
    return this.config.pciMapper.enableIntegration;
  }
}
