/**
 * Notification store – in-app notification list and unread count
 */

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import {
  getNotifications,
  getUnreadCount,
  markAsRead as apiMarkAsRead,
  type AppNotification
} from '$lib/services/notificationService';

export const notifications = writable<AppNotification[]>([]);
export const unreadCount = writable<number>(0);
export const isLoading = writable<boolean>(false);
/** Set when list/count fetch fails (e.g. 400); cleared on next successful refresh */
export const loadError = writable<string | null>(null);

export const unreadNotifications = derived(notifications, ($n) =>
  $n.filter((n) => !n.read)
);

function getTenantId(): string | undefined {
  if (!browser) return undefined;
  return localStorage.getItem('selectedTenantId') ?? undefined;
}

/**
 * Refresh notifications from API. Pass tenantId or leave blank to use localStorage.
 */
export async function refreshNotifications(tenantId?: string): Promise<void> {
  if (!browser) return;
  loadError.set(null);
  isLoading.set(true);
  try {
    const tid = tenantId ?? getTenantId();
    const [list, count] = await Promise.all([
      getNotifications(tid ?? undefined),
      getUnreadCount(tid ?? undefined)
    ]);
    notifications.set(list);
    unreadCount.set(count);
  } catch (e) {
    loadError.set(e instanceof Error ? e.message : 'Failed to load notifications');
  } finally {
    isLoading.set(false);
  }
}

/**
 * Mark notification as read and update store
 */
export async function markNotificationAsRead(
  id: string,
  tenantId?: string
): Promise<void> {
  const ok = await apiMarkAsRead(id, tenantId ?? getTenantId() ?? undefined);
  if (ok) {
    notifications.update((list) =>
      list.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    unreadCount.update((c) => Math.max(0, c - 1));
  }
}
