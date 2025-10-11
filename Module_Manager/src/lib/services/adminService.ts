// Admin Service - Check if user is platform admin
// Only admins can access tenant management

import { browser } from '$app/environment';

// Platform admins - only these users can manage ALL tenants
const PLATFORM_ADMINS = [
  'david@david.com'
];

/**
 * Check if current user is a platform admin
 */
export function isPlatformAdmin(userEmail: string | null): boolean {
  if (!userEmail) return false;
  return PLATFORM_ADMINS.includes(userEmail.toLowerCase());
}

/**
 * Get current user email from auth or localStorage
 */
export function getCurrentUserEmail(): string | null {
  if (!browser) return null;
  
  // Try to get from localStorage (set during login)
  return localStorage.getItem('userEmail');
}

/**
 * Check if current user is admin
 */
export function isCurrentUserAdmin(): boolean {
  const email = getCurrentUserEmail();
  return isPlatformAdmin(email);
}

