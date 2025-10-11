/**
 * CBRS Configuration Service
 * Manages SAS provider configuration and credentials
 */

import { browser } from '$app/environment';

export interface CBRSConfig {
  provider: 'google' | 'federated-wireless' | 'both';
  googleApiEndpoint?: string;
  googleApiKey?: string;
  googleCertificatePath?: string;
  federatedApiEndpoint?: string;
  federatedApiKey?: string;
  federatedCustomerId?: string;
  enableAnalytics?: boolean;
  enableOptimization?: boolean;
  enableMultiSite?: boolean;
  enableInterferenceMonitoring?: boolean;
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
    
    const configDoc = doc(db, 'cbrs_config', config.tenantId);
    
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
    
    const configDoc = doc(db, 'cbrs_config', tenantId);
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
 * Get default configuration
 */
export function getDefaultConfig(tenantId: string): CBRSConfig {
  return {
    provider: 'google',
    googleApiEndpoint: 'https://sas.googleapis.com/v1',
    googleApiKey: '',
    federatedApiEndpoint: 'https://sas.federatedwireless.com/api/v1',
    federatedApiKey: '',
    federatedCustomerId: '',
    enableAnalytics: false,
    enableOptimization: false,
    enableMultiSite: false,
    enableInterferenceMonitoring: false,
    tenantId
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: CBRSConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check provider-specific requirements
  if (config.provider === 'google' || config.provider === 'both') {
    if (!config.googleApiKey) {
      errors.push('Google API key is required');
    }
    if (!config.googleApiEndpoint) {
      errors.push('Google API endpoint is required');
    }
  }
  
  if (config.provider === 'federated-wireless' || config.provider === 'both') {
    if (!config.federatedApiKey) {
      errors.push('Federated Wireless API key is required');
    }
    if (!config.federatedCustomerId) {
      errors.push('Federated Wireless Customer ID is required');
    }
    if (!config.federatedApiEndpoint) {
      errors.push('Federated Wireless API endpoint is required');
    }
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
      message: 'No configuration found. Please configure SAS provider settings.'
    };
  }
  
  const validation = validateConfig(config);
  
  if (validation.valid) {
    return {
      status: 'complete',
      message: `Configured for ${config.provider === 'both' ? 'both providers' : config.provider === 'google' ? 'Google SAS' : 'Federated Wireless'}`
    };
  } else {
    return {
      status: 'incomplete',
      message: `Configuration incomplete: ${validation.errors.join(', ')}`
    };
  }
}

