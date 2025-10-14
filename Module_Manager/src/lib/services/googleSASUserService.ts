/**
 * Google SAS User Management Service
 * Fetches list of SAS User IDs that the authenticated user has access to
 */

import { browser } from '$app/environment';

export interface SASUserID {
  userId: string;
  displayName?: string;
  organizationName?: string;
  registrationStatus?: string;
  isPrimary?: boolean;
}

/**
 * Get list of SAS User IDs for the authenticated Google account
 * Calls the Cloud Function proxy which then calls Google SAS API
 */
export async function fetchAuthorizedSASUserIDs(
  tenantId: string,
  googleEmail: string,
  accessToken: string
): Promise<SASUserID[]> {
  if (!browser) return [];
  
  try {
    console.log('[SAS Users] Fetching authorized User IDs for:', googleEmail);
    
    // Get Firebase auth token
    const { auth } = await import('$lib/firebase');
    const currentUser = auth().currentUser;
    
    if (!currentUser) {
      throw new Error('User not authenticated with Firebase');
    }
    
    const firebaseToken = await currentUser.getIdToken();
    
    // Get Cloud Functions URL
    const functionsUrl = import.meta.env.VITE_FUNCTIONS_URL || 
                        'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net';
    
    // Call the proxy function to get User IDs from Google SAS
    const response = await fetch(`${functionsUrl}/getSASUserIDs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${firebaseToken}`
      },
      body: JSON.stringify({
        tenantId,
        googleEmail,
        googleAccessToken: accessToken
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Failed to fetch User IDs: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success || !result.userIds) {
      throw new Error(result.error || 'Failed to fetch User IDs');
    }
    
    console.log('[SAS Users] Found', result.userIds.length, 'authorized User IDs');
    
    return result.userIds;
    
  } catch (error: any) {
    console.error('[SAS Users] Error fetching User IDs:', error);
    
    // If API call fails, return empty array
    // User can still manually enter their User ID
    return [];
  }
}

/**
 * Validate a User ID with Google SAS
 */
export async function validateSASUserID(
  tenantId: string,
  userId: string,
  googleEmail: string,
  accessToken: string
): Promise<boolean> {
  if (!browser) return false;
  
  try {
    console.log('[SAS Users] Validating User ID:', userId);
    
    const userIds = await fetchAuthorizedSASUserIDs(tenantId, googleEmail, accessToken);
    
    // Check if the userId is in the authorized list
    const isAuthorized = userIds.some(u => u.userId === userId);
    
    if (!isAuthorized && userIds.length > 0) {
      console.warn('[SAS Users] User ID not in authorized list:', userId);
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('[SAS Users] Error validating User ID:', error);
    // If validation fails, allow it (fail-open for manual entry)
    return true;
  }
}

