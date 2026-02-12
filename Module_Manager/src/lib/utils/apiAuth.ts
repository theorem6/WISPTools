/**
 * Centralized API authentication utilities.
 * Use getAuthHeadersForApi() for ALL backend API requests to avoid 401 from expired tokens.
 *
 * Firebase ID tokens expire after 1 hour. This module uses authService.getAuthTokenForApi()
 * which: waits for auth init, forces token refresh, and retries on failure.
 */

import { browser } from '$app/environment';
import { authService } from '$lib/services/authService';

/**
 * Get headers for authenticated API requests.
 * Includes fresh Firebase ID token and optional X-Tenant-ID.
 * Use this for every fetch() to backend - never use user.getIdToken() directly.
 */
export async function getAuthHeadersForApi(tenantId?: string): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (!browser) return headers;

  const token = await authService.getAuthTokenForApi();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }

  return headers;
}

/**
 * Get tenant ID from localStorage (for same-origin API calls).
 */
export function getTenantIdFromStorage(): string | null {
  if (!browser) return null;
  return localStorage.getItem('selectedTenantId');
}
