/**
 * CBRS Configuration Service
 * Manages SAS provider configuration and credentials
 */

import { browser } from '$app/environment';

/**
 * Deployment model for CBRS configuration
 */
export type CBRSDeploymentModel = 'shared-platform' | 'per-tenant';

/**
 * Platform-level CBRS configuration (admin-only)
 * Shared API keys used by all tenants in shared-platform mode
 */
export interface PlatformCBRSConfig {
  googleApiKey: string;
  googleApiEndpoint: string;
  googleCertificatePath?: string;
  federatedApiKey: string;
  federatedApiEndpoint: string;
  federatedCertificatePath?: string;
  sharedMode: boolean;
  updatedAt?: Date;
  updatedBy?: string;
}

/**
 * Tenant-level CBRS configuration
 * Fixed to shared-platform mode with Google SAS only
 */
export interface CBRSConfig {
  // Deployment model (fixed)
  deploymentModel: 'shared-platform';
  
  // Provider selection (fixed)
  provider: 'google';
  
  // Google SAS Authentication (shared platform)
  googleUserId: string;              // Google SAS User ID (required)
  googleEmail?: string;              // Google account email for OAuth
  googleCertificate?: string;        // Client certificate content (base64)
  googlePrivateKey?: string;         // Private key content (base64)
  googleCertificateName?: string;    // Original certificate filename
  googlePrivateKeyName?: string;     // Original private key filename
  
  // Enhanced features
  enableAnalytics?: boolean;
  enableOptimization?: boolean;
  enableMultiSite?: boolean;
  enableInterferenceMonitoring?: boolean;
  
  // Metadata
  tenantId: string;
  updatedAt?: Date;
  updatedBy?: string;
}

/**
 * Save CBRS configuration to Firestore
 */
export async function saveCBRSConfig(config: CBRSConfig): Promise<void> {
  try {
    if (!browser) return;
    
    console.log('[CBRS Config] Saving configuration for tenant:', config.tenantId);
    
    // Import Firebase dynamically
    const { db } = await import('$lib/firebase');
    const { doc, setDoc } = await import('firebase/firestore');
    
    // Call db() as a function to get Firestore instance
    const configDoc = doc(db(), 'cbrs_config', config.tenantId);
    
    await setDoc(configDoc, {
      ...config,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    console.log('[CBRS Config] Configuration saved successfully');
  } catch (error) {
    console.error('[CBRS Config] Failed to save configuration:', error);
    throw error;
  }
}

/**
 * Load CBRS configuration from Firestore
 */
export async function loadCBRSConfig(tenantId: string): Promise<CBRSConfig | null> {
  try {
    if (!browser) return null;
    
    console.log('[CBRS Config] Loading configuration for tenant:', tenantId);
    
    // Import Firebase dynamically
    const { db } = await import('$lib/firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    
    // Call db() as a function to get Firestore instance
    const configDoc = doc(db(), 'cbrs_config', tenantId);
    const snapshot = await getDoc(configDoc);
    
    if (!snapshot.exists()) {
      console.log('[CBRS Config] No configuration found, using defaults');
      return getDefaultConfig(tenantId);
    }
    
    const data = snapshot.data();
    const config: CBRSConfig = {
      ...data,
      tenantId,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined
    } as CBRSConfig;
    
    console.log('[CBRS Config] Configuration loaded successfully');
    return config;
  } catch (error) {
    console.error('[CBRS Config] Failed to load configuration:', error);
    return getDefaultConfig(tenantId);
  }
}

/**
 * Save platform-level CBRS configuration (admin only)
 */
export async function savePlatformCBRSConfig(config: PlatformCBRSConfig): Promise<void> {
  try {
    if (!browser) return;
    
    console.log('[CBRS Config] Saving platform configuration');
    
    const { db } = await import('$lib/firebase');
    const { doc, setDoc } = await import('firebase/firestore');
    
    // Call db() as a function to get Firestore instance
    const configDoc = doc(db(), 'cbrs_platform_config', 'platform');
    
    await setDoc(configDoc, {
      ...config,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    console.log('[CBRS Config] Platform configuration saved successfully');
  } catch (error) {
    console.error('[CBRS Config] Failed to save platform configuration:', error);
    throw error;
  }
}

/**
 * Load platform-level CBRS configuration
 */
export async function loadPlatformCBRSConfig(): Promise<PlatformCBRSConfig | null> {
  try {
    if (!browser) return null;
    
    console.log('[CBRS Config] Loading platform configuration');
    
    const { db } = await import('$lib/firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    
    // Call db() as a function to get Firestore instance
    const configDoc = doc(db(), 'cbrs_platform_config', 'platform');
    const snapshot = await getDoc(configDoc);
    
    if (!snapshot.exists()) {
      console.log('[CBRS Config] No platform configuration found');
      return null;
    }
    
    const data = snapshot.data();
    const config: PlatformCBRSConfig = {
      ...data,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined
    } as PlatformCBRSConfig;
    
    console.log('[CBRS Config] Platform configuration loaded successfully');
    return config;
  } catch (error) {
    console.error('[CBRS Config] Failed to load platform configuration:', error);
    return null;
  }
}

/**
 * Get default configuration
 * Fixed to shared-platform mode with Google SAS only
 */
export function getDefaultConfig(tenantId: string): CBRSConfig {
  return {
    deploymentModel: 'shared-platform', // Fixed to shared platform mode
    provider: 'google', // Fixed to Google SAS only
    googleUserId: '', // User must configure their Google User ID
    enableAnalytics: false,
    enableOptimization: false,
    enableMultiSite: false,
    enableInterferenceMonitoring: false,
    tenantId
  };
}

/**
 * Validate configuration (fixed to shared-platform mode with Google SAS)
 */
export function validateConfig(config: CBRSConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Required fields for Google SAS
  if (!config.googleUserId) {
    errors.push('Google User ID is required');
  }
  
  if (!config.googleEmail) {
    errors.push('Google Account Email is required');
  }
  
  // Validate email format
  if (config.googleEmail && !config.googleEmail.includes('@')) {
    errors.push('Google Account Email must be a valid email address');
  }
  
  // Certificate and private key should be provided together
  if (config.googleCertificate && !config.googlePrivateKey) {
    errors.push('Private key is required when certificate is provided');
  }
  
  if (config.googlePrivateKey && !config.googleCertificate) {
    errors.push('Certificate is required when private key is provided');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate platform configuration
 */
export function validatePlatformConfig(config: PlatformCBRSConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.googleApiKey) {
    errors.push('Google SAS API key is required');
  }
  if (!config.googleApiEndpoint) {
    errors.push('Google SAS API endpoint is required');
  }
  if (!config.federatedApiKey) {
    errors.push('Federated Wireless API key is required');
  }
  if (!config.federatedApiEndpoint) {
    errors.push('Federated Wireless API endpoint is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Encrypt sensitive configuration data before storing
 * Note: In production, this should use proper encryption
 */
export function encryptConfig(config: CBRSConfig): CBRSConfig {
  // In a real implementation, encrypt API keys here
  // For now, we just return the config as-is
  // TODO: Implement proper encryption using Firebase Functions
  return config;
}

/**
 * Decrypt sensitive configuration data after loading
 */
export function decryptConfig(config: CBRSConfig): CBRSConfig {
  // In a real implementation, decrypt API keys here
  // For now, we just return the config as-is
  return config;
}

/**
 * Check if configuration is complete
 */
export function isConfigComplete(config: CBRSConfig | null): boolean {
  if (!config) return false;
  
  const validation = validateConfig(config);
  return validation.valid;
}

/**
 * Get configuration status message
 */
export function getConfigStatus(config: CBRSConfig | null): { status: 'complete' | 'incomplete' | 'missing'; message: string } {
  if (!config) {
    return {
      status: 'missing',
      message: 'No configuration found. Please configure your Google SAS credentials.'
    };
  }
  
  const validation = validateConfig(config);
  
  if (validation.valid) {
    const certStatus = config.googleCertificate ? ' with mTLS' : '';
    return {
      status: 'complete',
      message: `Google SAS configured (${config.googleEmail})${certStatus}`
    };
  } else {
    return {
      status: 'incomplete',
      message: `Configuration incomplete: ${validation.errors.join(', ')}`
    };
  }
}

