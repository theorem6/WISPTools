// GenieACS Integration Module
// Exports all GenieACS-related services, models, and utilities

// Models
export type { CPEDevice, TR069Parameter } from './models/cpeDevice';
export { CPEDeviceUtils, TR069_PARAMETER_PATHS } from './models/cpeDevice';
export type { TR069ParameterDefinition, ParameterCategory } from './models/tr069Parameters';
export { TR069_PARAMETER_DEFINITIONS, TR069ParameterUtils } from './models/tr069Parameters';

// API Client
export { GenieACSNBIClient } from './api/nbiClient';

// Services
export { GenieACSService } from './services/genieacsService';
export { LocationService } from './services/locationService';

// Mappers
export { EnhancedPCIArcGISMapper } from './mappers/enhancedArcGISMapper';

// Configuration
export { DEFAULT_GENIEACS_CONFIG, getEnvironmentConfig, GenieACSConfigManager, GenieACSConfigValidator } from './config/genieacsConfig';
export type { FirebaseGenieACSConfig } from './config/firebaseGenieacsConfig';
export { FirebaseGenieACSService, createFirebaseGenieACSService } from './config/firebaseGenieacsConfig';
