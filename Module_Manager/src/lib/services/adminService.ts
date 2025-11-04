// Admin Service - Check if user is platform admin
// Uses UID-based checks for robustness (email may not be reliable)

import { browser } from '$app/environment';
import { auth } from '$lib/firebase';

// Platform admin UIDs - only these users can manage ALL tenants
const PLATFORM_ADMIN_UIDS = [
  '1tf7J4Df4jMuZlEfrRQZ3Kmj1Gy1' // david@david.com
];

// Legacy email fallback (for backwards compatibility)
const PLATFORM_ADMIN_EMAILS = [
  'david@david.com',
  'david@4gengineer.com'
];

/**
 * Check if a user UID is a platform admin
 */
export function isPlatformAdminByUid(userUid: string | null | undefined): boolean {
  if (!userUid) return false;
  return PLATFORM_ADMIN_UIDS.includes(userUid);
}

/**
 * Check if current user is a platform admin (by email - legacy)
 * @deprecated Use isPlatformAdminByUid instead
 */
export function isPlatformAdmin(userEmail: string | null): boolean {
  if (!userEmail) return false;
  return PLATFORM_ADMIN_EMAILS.includes(userEmail.toLowerCase());
}

/**
 * Check if current user is a platform admin (by UID - preferred)
 */
export async function isCurrentUserPlatformAdmin(): Promise<boolean> {
  if (!browser) return false;
  
  try {
    const currentUser = auth().currentUser;
    if (!currentUser) return false;
    
    // Check by UID first (most reliable)
    if (isPlatformAdminByUid(currentUser.uid)) {
      return true;
    }
    
    // Fallback to email check (for backwards compatibility)
    return isPlatformAdmin(currentUser.email);
  } catch (error) {
    console.error('Error checking platform admin status:', error);
    return false;
  }
}

/**
 * Get current user email from auth or localStorage
 */
export function getCurrentUserEmail(): string | null {
  if (!browser) return null;
  
  // Try to get from Firebase Auth first
  try {
    const currentUser = auth().currentUser;
    if (currentUser?.email) return currentUser.email;
  } catch (error) {
    console.error('Error getting user email from auth:', error);
  }
  
  // Fallback to localStorage (set during login)
  return localStorage.getItem('userEmail');
}

/**
 * Get current user UID
 */
export function getCurrentUserUid(): string | null {
  if (!browser) return null;
  
  try {
    const currentUser = auth().currentUser;
    return currentUser?.uid || null;
  } catch (error) {
    console.error('Error getting user UID:', error);
    return null;
  }
}

/**
 * Check if current user is admin (synchronous - uses email/UID from current state)
 */
export function isCurrentUserAdmin(): boolean {
  const uid = getCurrentUserUid();
  if (uid && isPlatformAdminByUid(uid)) {
    return true;
  }
  
  const email = getCurrentUserEmail();
  return isPlatformAdmin(email);
}

