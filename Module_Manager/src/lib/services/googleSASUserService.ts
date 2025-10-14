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
    
    // Use Firebase Callable Functions (not HTTP endpoints)
    const { functions } = await import('$lib/firebase');
    const { httpsCallable } = await import('firebase/functions');
    
    const getSASUserIDs = httpsCallable(functions(), 'getSASUserIDs');
    
    // Call the Cloud Function
    const response = await getSASUserIDs({
      tenantId,
      googleEmail,
      googleAccessToken: accessToken
    });
    
    const result = response.data as any;
    
    if (!result.success || !result.userIds) {
      throw new Error(result.error || 'Failed to fetch User IDs');
    }
    
    console.log('[SAS Users] Found', result.userIds.length, 'authorized User IDs');
    if (result.note) {
      console.log('[SAS Users]', result.note);
    }
    
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

