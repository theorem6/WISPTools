<script lang="ts">
  /**
   * In-app notification center: bell icon + dropdown with recent notifications.
   * Uses notificationService and notificationStore.
   */
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import {
    notifications,
    unreadCount,
    isLoading,
    loadError,
    refreshNotifications,
    markNotificationAsRead
  } from '$lib/stores/notificationStore';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import type { AppNotification } from '$lib/services/notificationService';

  let open = false;
  let panelEl: HTMLDivElement;
  let panelContentEl: HTMLDivElement | undefined;

  $: tenantId = $currentTenant?.id ?? (browser ? localStorage.getItem('selectedTenantId') ?? undefined : undefined);

  onMount(async () => {
    if (browser && tenantId) {
      const user = await authService.getCurrentUser();
      if (user) refreshNotifications(tenantId);
    }
  });

  async function toggle() {
    const willOpen = !open;
    open = willOpen;
    if (browser && willOpen && tenantId) {
      const user = await authService.getCurrentUser();
      if (user) refreshNotifications(tenantId);
    }
  }

  function handleClickOutside(e: MouseEvent) {
    if (panelEl && !panelEl.contains(e.target as Node)) {
      open = false;
    }
  }

  function getFocusables(container: HTMLElement): HTMLElement[] {
    const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(container.querySelectorAll<HTMLElement>(sel)).filter((el) => !el.hasAttribute('disabled'));
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') {
      open = false;
      return;
    }
    const panel = panelContentEl ?? panelEl?.querySelector('.panel');
    if (e.key === 'Tab' && panel instanceof HTMLElement) {
      const focusables = getFocusables(panel);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const target = e.shiftKey ? (document.activeElement === first ? last : null) : (document.activeElement === last ? first : null);
      if (target) {
        e.preventDefault();
        target.focus();
      }
    }
  }

  async function markRead(n: AppNotification) {
    if (n.read) return;
    await markNotificationAsRead(n.id, tenantId);
  }

  function formatTime(d: Date): string {
    const now = new Date();
    const diff = now.getTime() - (d instanceof Date ? d.getTime() : new Date(d).getTime());
    if (diff < 60_000) return 'Just now';
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
    return `${Math.floor(diff / 86400_000)}d ago`;
  }
</script>

<svelte:window onclick={handleClickOutside} onkeydown={handleKeydown} />

<div class="notification-center" bind:this={panelEl}>
  <button
    type="button"
    class="bell-btn"
    onclick={toggle}
    aria-label="Notifications"
    title="Notifications"
    aria-expanded={open}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
    {#if $unreadCount > 0}
      <span class="badge" aria-label="{$unreadCount} unread">{$unreadCount > 99 ? '99+' : $unreadCount}</span>
    {/if}
  </button>

  {#if open}
    <div class="panel" bind:this={panelContentEl} role="dialog" aria-label="Notifications panel">
      <div class="panel-header">
        <h3>Notifications</h3>
        {#if $unreadCount > 0}
          <span class="unread-label">{$unreadCount} unread</span>
        {/if}
      </div>
      <div class="panel-body">
        {#if $isLoading}
          <div class="empty">Loading…</div>
        {:else if $loadError}
          <div class="empty error">Couldn't load notifications.</div>
          <p class="hint">{$loadError}</p>
          <button type="button" class="retry-btn" onclick={() => refreshNotifications(tenantId)}>Retry</button>
        {:else if $notifications.length === 0}
          <div class="empty">No notifications yet.</div>
          <p class="hint">Project approvals and work orders will appear here.</p>
          <button type="button" class="retry-btn secondary" onclick={() => refreshNotifications(tenantId)}>Retry</button>
        {:else}
          <ul class="list">
            {#each $notifications as n (n.id)}
              <li
                class="item"
                class:unread={!n.read}
                role="button"
                tabindex="0"
                onclick={() => markRead(n)}
                onkeydown={(e) => e.key === 'Enter' && markRead(n)}
              >
                <div class="item-header">
                  <span class="title">{n.title}</span>
                  <span class="time">{formatTime(n.createdAt)}</span>
                </div>
                {#if n.message}
                  <p class="message">{n.message}</p>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .notification-center {
    position: relative;
  }
  .bell-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
  }
  .bell-btn:hover {
    background: var(--bg-hover, rgba(0, 0, 0, 0.05));
    color: var(--text-primary);
  }
  .bell-btn .badge {
    position: absolute;
    top: 4px;
    right: 4px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 18px;
    text-align: center;
    color: white;
    background: var(--accent-color, #3b82f6);
    border-radius: 9px;
  }
  .panel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 360px;
    max-height: 400px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    display: flex;
    flex-direction: column;
  }
  .panel-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .panel-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }
  .unread-label {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  .panel-body {
    overflow-y: auto;
    padding: 8px;
  }
  .empty {
    padding: 24px 16px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  .hint {
    margin: 0 16px 16px;
    font-size: 0.8rem;
    color: var(--text-secondary);
    text-align: center;
  }
  .empty.error {
    color: var(--error-color, #dc2626);
  }
  .retry-btn {
    display: block;
    margin: 0 auto 16px;
    padding: 8px 16px;
    font-size: 0.85rem;
    color: var(--accent-color, #3b82f6);
    background: transparent;
    border: 1px solid var(--accent-color, #3b82f6);
    border-radius: 8px;
    cursor: pointer;
  }
  .retry-btn:hover {
    background: rgba(59, 130, 246, 0.08);
  }
  .retry-btn.secondary {
    color: var(--text-secondary);
    border-color: var(--border-color, #e5e7eb);
  }
  .retry-btn.secondary:hover {
    background: var(--bg-hover, rgba(0, 0, 0, 0.04));
  }
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .item {
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .item:hover {
    background: var(--bg-hover, rgba(0, 0, 0, 0.04));
  }
  .item.unread {
    background: rgba(59, 130, 246, 0.06);
  }
  .item.unread:hover {
    background: rgba(59, 130, 246, 0.1);
  }
  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }
  .item .title {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-primary);
  }
  .item .time {
    font-size: 0.75rem;
    color: var(--text-secondary);
    flex-shrink: 0;
  }
  .item .message {
    margin: 6px 0 0;
    font-size: 0.85rem;
    color: var(--text-secondary);
    line-height: 1.35;
  }
</style>
