/**
 * Notification Service
 * Fetches in-app notifications from backend (project approvals, work orders, etc.)
 * Uses direct apiProxy URL to avoid Hosting rewrite path issues (400 on /api/notifications).
 */

import { browser } from '$app/environment';
import { authService } from '$lib/services/authService';
import { API_CONFIG } from '$lib/config/api';

// Prefer relative /api when on same origin (Hosting rewrite); use Cloud Function + ?path= when direct
const useCloudProxy =
  typeof window !== 'undefined' &&
  API_CONFIG.CLOUD_FUNCTIONS.API_PROXY &&
  (() => {
    try {
      return new URL(API_CONFIG.CLOUD_FUNCTIONS.API_PROXY).origin !== window.location.origin;
    } catch {
      return true;
    }
  })();
function notificationsEndpoint(path: string): string {
  if (useCloudProxy) {
    const base = API_CONFIG.CLOUD_FUNCTIONS.API_PROXY;
    return `${base}?path=${encodeURIComponent(path)}`;
  }
  return path;
}

export interface AppNotification {
  id: string;
  userId: string;
  tenantId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  data?: Record<string, unknown>;
  projectId?: string;
  projectName?: string;
}

async function getAuthHeaders(tenantId?: string): Promise<HeadersInit> {
  const token = await authService.getAuthTokenForApi();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (tenantId && typeof tenantId === 'string') {
    headers['X-Tenant-ID'] = tenantId;
  }
  return headers;
}

/**
 * Fetch notifications for the current user. Skips if no auth token.
 * Throws on 400/5xx so the UI can show Retry; 401/403 return [] (auth issue).
 */
export async function getNotifications(tenantId?: string): Promise<AppNotification[]> {
  if (!browser) return [];
  const token = await authService.getAuthTokenForApi();
  if (!token) return [];
  const res = await fetch(notificationsEndpoint('/api/notifications'), {
    method: 'GET',
    headers: await getAuthHeaders(tenantId)
  });
  if (res.status === 401 || res.status === 403) return [];
  if (!res.ok) {
    const msg = res.status === 400 ? 'Notifications unavailable. Try again.' : res.statusText || 'Failed to load';
    console.warn('[NotificationService] getNotifications failed:', res.status, msg);
    throw new Error(msg);
  }
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data?.items ?? data?.notifications ?? []);
  return list.map((n: any) => ({
    ...n,
    id: n.id ?? n._id,
    createdAt: n.createdAt ? (n.createdAt?.toDate ? n.createdAt.toDate() : new Date(n.createdAt)) : new Date()
  }));
}

/**
 * Get unread count. Skips if no auth token. Throws on 400/5xx so UI can show Retry.
 */
export async function getUnreadCount(tenantId?: string): Promise<number> {
  if (!browser) return 0;
  const token = await authService.getAuthTokenForApi();
  if (!token) return 0;
  const res = await fetch(notificationsEndpoint('/api/notifications/count'), {
    method: 'GET',
    headers: await getAuthHeaders(tenantId)
  });
  if (res.status === 401 || res.status === 403) return 0;
  if (!res.ok) {
    const msg = res.status === 400 ? 'Notifications unavailable. Try again.' : res.statusText || 'Failed to load';
    console.warn('[NotificationService] getUnreadCount failed:', res.status, msg);
    throw new Error(msg);
  }
  const data = await res.json();
  return typeof data?.count === 'number' ? data.count : 0;
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string, tenantId?: string): Promise<boolean> {
  if (!browser) return false;
  try {
    const res = await fetch(notificationsEndpoint(`/api/notifications/${notificationId}/read`), {
      method: 'PUT',
      headers: await getAuthHeaders(tenantId)
    });
    return res.ok;
  } catch (e) {
    console.warn('[NotificationService] markAsRead failed:', e);
    return false;
  }
}
