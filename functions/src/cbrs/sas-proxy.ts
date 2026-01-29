/**
 * CBRS SAS Proxy Functions
 * Handles SAS API requests (Google SAS & Federated Wireless)
 */

import { onCall } from 'firebase-functions/v2/https';
import { db } from '../firebaseInit.js';
import { getDecryptedCbrsConfig } from './config-secure.js';

/**
 * Proxy SAS requests to Google or Federated Wireless
 */
export const proxySASRequest = onCall(async (request) => {
  try {
    const { tenantId, sasProvider, endpoint, method, body, userID } = request.data;
    
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    
    // Verify user authentication
    if (!request.auth) {
      throw new Error('Authentication required');
    }
    
    console.log(`[SAS Proxy] ${sasProvider} ${method} ${endpoint} for tenant ${tenantId}`);
    
    // Load configuration (decrypted when stored with encryption)
    const config = await getDecryptedCbrsConfig(tenantId);
    
    if (!config) {
      throw new Error('CBRS configuration not found. Please configure your SAS API keys.');
    }
    
    // Try tenant config first, fall back to platform config
    let apiUrl: string;
    let apiKey: string;
    
    const c = config as Record<string, unknown>;
    const platformDoc = () => db.collection('platform_config').doc('cbrs').get();
    if (sasProvider === 'google') {
      if (c?.deployment_model === 'shared-platform') {
        console.log('[SAS Proxy] Using shared platform configuration');
        const platformConfigDoc = await platformDoc();
        const platformConfig = platformConfigDoc.data() as Record<string, unknown> | undefined;
        const key = platformConfig?.google_sas_api_key;
        if (!key || typeof key !== 'string') {
          throw new Error('Platform Google SAS API key not configured');
        }
        apiUrl = (platformConfig?.google_sas_api_url as string) || 'https://wirelessconnectivity.googleapis.com/v1';
        apiKey = key;
      } else {
        const key = c?.google_sas_api_key;
        if (!key || typeof key !== 'string') {
          throw new Error('Google SAS API key not configured for this tenant');
        }
        apiUrl = (c?.google_sas_api_url as string) || 'https://wirelessconnectivity.googleapis.com/v1';
        apiKey = key;
      }
    } else if (sasProvider === 'federated') {
      if (c?.deployment_model === 'shared-platform') {
        const platformConfigDoc = await platformDoc();
        const platformConfig = platformConfigDoc.data() as Record<string, unknown> | undefined;
        const key = platformConfig?.federated_api_key;
        if (!key || typeof key !== 'string') {
          throw new Error('Platform Federated Wireless API key not configured');
        }
        apiUrl = (platformConfig?.federated_api_url as string) || 'https://api.federatedwireless.com';
        apiKey = key;
      } else {
        const key = c?.federated_api_key;
        if (!key || typeof key !== 'string') {
          throw new Error('Federated Wireless API key not configured for this tenant');
        }
        apiUrl = (c?.federated_api_url as string) || 'https://api.federatedwireless.com';
        apiKey = key;
      }
    } else {
      throw new Error('Invalid SAS provider');
    }
    
    // Make the actual request
    const url = `${apiUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Add authentication
    if (sasProvider === 'google') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (sasProvider === 'federated') {
      headers['X-API-Key'] = apiKey;
    }
    
    // Add userID if provided (for SAS multi-user support)
    if (userID) {
      headers['X-User-ID'] = userID;
    }
    
    console.log(`[SAS Proxy] Making request to: ${url}`);
    
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('[SAS Proxy] SAS API error:', responseData);
      throw new Error(responseData.error?.message || `SAS API returned ${response.status}`);
    }
    
    console.log('[SAS Proxy] Request successful');
    
    return {
      success: true,
      data: responseData
    };
  } catch (error: any) {
    console.error('[SAS Proxy] Error:', error);
    throw new Error(error.message || 'SAS proxy request failed');
  }
});

/**
 * Get SAS User IDs for multi-user support
 */
export const getSASUserIDs = onCall(async (request) => {
  try {
    const { tenantId, sasProvider } = request.data;
    
    if (!tenantId || !sasProvider) {
      throw new Error('Tenant ID and SAS provider are required');
    }
    
    // Verify user authentication
    if (!request.auth) {
      throw new Error('Authentication required');
    }
    
    console.log(`[SAS User IDs] Getting ${sasProvider} user IDs for tenant ${tenantId}`);
    
    // Load configuration
    const configDoc = await db.collection('cbrs_config').doc(tenantId).get();
    
    if (!configDoc.exists) {
      throw new Error('CBRS configuration not found');
    }
    
    const config = configDoc.data();
    
    // Determine API credentials based on deployment model
    let apiUrl: string;
    let apiKey: string;
    
    if (config?.deployment_model === 'shared-platform') {
      const platformConfigDoc = await db.collection('platform_config').doc('cbrs').get();
      const platformConfig = platformConfigDoc.data();
      
      if (sasProvider === 'google') {
        apiUrl = platformConfig?.google_sas_api_url || 'https://wirelessconnectivity.googleapis.com/v1';
        apiKey = platformConfig?.google_sas_api_key;
      } else {
        apiUrl = platformConfig?.federated_api_url || 'https://api.federatedwireless.com';
        apiKey = platformConfig?.federated_api_key;
      }
    } else {
      if (sasProvider === 'google') {
        apiUrl = config?.google_sas_api_url || 'https://wirelessconnectivity.googleapis.com/v1';
        apiKey = config?.google_sas_api_key;
      } else {
        apiUrl = config?.federated_api_url || 'https://api.federatedwireless.com';
        apiKey = config?.federated_api_key;
      }
    }
    
    if (!apiKey) {
      throw new Error('SAS API key not configured');
    }
    
    // Make request to get user IDs
    const url = `${apiUrl}/users`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (sasProvider === 'google') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      headers['X-API-Key'] = apiKey;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to fetch user IDs');
    }
    
    const data = await response.json();
    
    return {
      success: true,
      userIDs: data.users || []
    };
  } catch (error: any) {
    console.error('[SAS User IDs] Error:', error);
    throw new Error(error.message || 'Failed to get SAS user IDs');
  }
});

/**
 * Get SAS installations/devices
 */
export const getSASInstallations = onCall(async (request) => {
  try {
    const { tenantId, sasProvider, userID } = request.data;
    
    if (!tenantId || !sasProvider) {
      throw new Error('Tenant ID and SAS provider are required');
    }
    
    // Verify user authentication
    if (!request.auth) {
      throw new Error('Authentication required');
    }
    
    console.log(`[SAS Installations] Getting ${sasProvider} installations for tenant ${tenantId}, userID: ${userID || 'default'}`);
    
    // Load configuration
    const configDoc = await db.collection('cbrs_config').doc(tenantId).get();
    
    if (!configDoc.exists) {
      throw new Error('CBRS configuration not found');
    }
    
    const config = configDoc.data();
    
    // Determine API credentials
    let apiUrl: string;
    let apiKey: string;
    
    if (config?.deployment_model === 'shared-platform') {
      const platformConfigDoc = await db.collection('platform_config').doc('cbrs').get();
      const platformConfig = platformConfigDoc.data();
      
      if (sasProvider === 'google') {
        apiUrl = platformConfig?.google_sas_api_url || 'https://wirelessconnectivity.googleapis.com/v1';
        apiKey = platformConfig?.google_sas_api_key;
      } else {
        apiUrl = platformConfig?.federated_api_url || 'https://api.federatedwireless.com';
        apiKey = platformConfig?.federated_api_key;
      }
    } else {
      if (sasProvider === 'google') {
        apiUrl = config?.google_sas_api_url || 'https://wirelessconnectivity.googleapis.com/v1';
        apiKey = config?.google_sas_api_key;
      } else {
        apiUrl = config?.federated_api_url || 'https://api.federatedwireless.com';
        apiKey = config?.federated_api_key;
      }
    }
    
    if (!apiKey) {
      throw new Error('SAS API key not configured');
    }
    
    // Make request to get installations
    const url = userID 
      ? `${apiUrl}/installations?userId=${userID}`
      : `${apiUrl}/installations`;
      
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (sasProvider === 'google') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      headers['X-API-Key'] = apiKey;
    }
    
    if (userID) {
      headers['X-User-ID'] = userID;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to fetch installations');
    }
    
    const data = await response.json();
    
    return {
      success: true,
      installations: data.installations || []
    };
  } catch (error: any) {
    console.error('[SAS Installations] Error:', error);
    throw new Error(error.message || 'Failed to get SAS installations');
  }
});

