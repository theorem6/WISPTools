// GenieACS Integration - Main Export File
// Exports all GenieACS-related modules for easy importing

// Models
export type { 
  CPEDevice, 
  CPEDeviceId, 
  CPELocation, 
  CPENetworkInfo, 
  CPEPerformanceMetrics,
  TR069Parameter,
  CPETask,
  CPEFault
} from './models/cpeDevice';

export { 
  CPEDeviceUtils,
  TR069_PARAMETER_PATHS,
  PARAMETER_CATEGORIES
} from './models/cpeDevice';

export type {
  TR069ParameterDefinition,
  ParameterCategory
} from './models/tr069Parameters';

export {
  TR069_PARAMETER_DEFINITIONS,
  PARAMETER_CATEGORY_MAPPINGS,
  TR069ParameterUtils
} from './models/tr069Parameters';

// API Client
export type {
  GenieACSConfig,
  DeviceQuery,
  DeviceParameter,
  DeviceTask,
  GenieACSDevice
} from './api/nbiClient';

export { GenieACSNBIClient } from './api/nbiClient';

// Services
export type {
  GenieACSServiceConfig,
  DeviceUpdateEvent,
  PerformanceMetricsUpdate
} from './services/genieacsService';

export { GenieACSService } from './services/genieacsService';

export type {
  LocationValidationResult,
  LocationCluster,
  LocationAnalytics
} from './services/locationService';

export { LocationService } from './services/locationService';

// Enhanced Mapper
export type {
  CPEMapCell,
  CPEPerformanceData
} from './mappers/enhancedArcGISMapper';

export { EnhancedPCIArcGISMapper } from './mappers/enhancedArcGISMapper';

// Configuration
export type { GenieACSIntegrationConfig } from './config/genieacsConfig';

export {
  DEFAULT_GENIEACS_CONFIG,
  getEnvironmentConfig,
  GenieACSConfigValidator,
  GenieACSConfigManager
} from './config/genieacsConfig';

// Utility functions for easy setup
export class GenieACSIntegration {
  private configManager: GenieACSConfigManager;
  private genieacsService: GenieACSService;
  private locationService: typeof LocationService;
  private enhancedMapper: EnhancedPCIArcGISMapper;

  constructor(config?: Partial<GenieACSIntegrationConfig>) {
    this.configManager = new GenieACSConfigManager(config);
    this.locationService = LocationService;
    this.enhancedMapper = new EnhancedPCIArcGISMapper();
    
    // Initialize GenieACS service with configuration
    this.genieacsService = new GenieACSService({
      ...this.configManager.getGenieACSConfig(),
      ...this.configManager.getDeviceManagementConfig()
    });
  }

  /**
   * Initialize the complete GenieACS integration
   */
  async initialize(): Promise<void> {
    try {
      console.log('GenieACS Integration: Initializing...');
      
      // Initialize GenieACS service
      await this.genieacsService.initialize();
      
      console.log('GenieACS Integration: Initialized successfully');
      
    } catch (error) {
      console.error('GenieACS Integration: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get the GenieACS service instance
   */
  getService(): GenieACSService {
    return this.genieacsService;
  }

  /**
   * Get the location service utilities
   */
  getLocationService(): typeof LocationService {
    return this.locationService;
  }

  /**
   * Get the enhanced mapper instance
   */
  getMapper(): EnhancedPCIArcGISMapper {
    return this.enhancedMapper;
  }

  /**
   * Get the configuration manager
   */
  getConfigManager(): GenieACSConfigManager {
    return this.configManager;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.genieacsService.dispose();
    // Additional cleanup if needed
  }
}

// Factory function for easy integration setup
export function createGenieACSIntegration(config?: Partial<GenieACSIntegrationConfig>): GenieACSIntegration {
  return new GenieACSIntegration(config);
}

// Quick setup functions for common use cases
export class GenieACSQuickSetup {
  /**
   * Setup for development environment
   */
  static createDevelopmentSetup(): GenieACSIntegration {
    return createGenieACSIntegration({
      genieacs: {
        baseUrl: 'http://localhost:7557',
        timeout: 30000
      },
      logging: {
        enableDebugLogs: true,
        logLevel: 'debug',
        logToConsole: true
      },
      deviceManagement: {
        enableAutoDiscovery: true,
        updateInterval: 30000,
        locationUpdateInterval: 60000,
        maxDevices: 1000
      }
    });
  }

  /**
   * Setup for production environment
   */
  static createProductionSetup(genieacsUrl: string, credentials?: { username: string; password: string }): GenieACSIntegration {
    return createGenieACSIntegration({
      genieacs: {
        baseUrl: genieacsUrl,
        username: credentials?.username,
        password: credentials?.password,
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
      },
      deviceManagement: {
        enableAutoDiscovery: true,
        updateInterval: 60000,
        locationUpdateInterval: 300000,
        maxDevices: 10000
      }
    });
  }

  /**
   * Setup for testing environment
   */
  static createTestSetup(): GenieACSIntegration {
    return createGenieACSIntegration({
      genieacs: {
        baseUrl: 'http://localhost:7557',
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
    });
  }
}
