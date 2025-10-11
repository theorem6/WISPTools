<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { isCurrentUserAdmin } from '$lib/services/adminService';
  import { authService } from '$lib/services/authService';
  import AdminMenu from '../components/AdminMenu.svelte';

  let isAuthorized = false;
  let isChecking = true;
  let error = '';

  onMount(async () => {
    if (!browser) return;

    // Check authentication
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      await goto('/login');
      return;
    }

    // Check if user is platform admin
    if (!isCurrentUserAdmin()) {
      error = 'Access Denied: Platform Admin privileges required to access ACS configuration';
      setTimeout(() => {
        goto('/modules/acs-cpe-management');
      }, 2000);
      return;
    }

    console.log('Platform admin access granted to ACS admin pages');
    isAuthorized = true;
    isChecking = false;
  });
</script>

<svelte:head>
  <title>ACS Administration - LTE WISP Management Platform</title>
  <meta name="description" content="ACS system configuration and management (Admin Only)" />
</svelte:head>

{#if isChecking}
  <div class="checking-access">
    <div class="spinner-large"></div>
    <p>Verifying admin access...</p>
  </div>
{:else if error}
  <div class="access-denied">
    <div class="denied-icon">🔒</div>
    <h2>Access Denied</h2>
    <p>{error}</p>
    <p class="redirect-message">Redirecting to ACS Management...</p>
  </div>
{:else if isAuthorized}
  <div class="admin-layout">
    <div class="admin-notice">
      <span class="admin-icon">🔐</span>
      <span>Platform Admin Mode - System Configuration</span>
      <span class="admin-user">(david@david.com only)</span>
    </div>
    <div class="admin-container">
      <AdminMenu />
      <div class="admin-content">
        <slot />
      </div>
    </div>
  </div>
{/if}

<style>
  .checking-access, .access-denied {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary);
    padding: 2rem;
    text-align: center;
  }

  .spinner-large {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(124, 58, 237, 0.2);
    border-top-color: var(--brand-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .denied-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .access-denied h2 {
    font-size: 2rem;
    margin-bottom: 1rem;
    color: #ef4444;
  }

  .access-denied p {
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .redirect-message {
    font-style: italic;
    margin-top: 1rem;
  }

  .admin-layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .admin-notice {
    background: rgba(239, 68, 68, 0.1);
    border-bottom: 2px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 0.75rem 2rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-weight: 600;
    font-size: 0.875rem;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .admin-icon {
    font-size: 1.25rem;
  }

  .admin-user {
    margin-left: auto;
    font-size: 0.75rem;
    opacity: 0.8;
  }

  .admin-container {
    display: flex;
    flex: 1;
  }

  .admin-content {
    flex: 1;
    padding: 2rem;
    overflow-y: auto;
  }

  @media (max-width: 768px) {
    .admin-container {
      flex-direction: column;
    }

    .admin-notice {
      padding: 0.5rem 1rem;
      font-size: 0.75rem;
    }

    .admin-user {
      display: none;
    }

    .admin-content {
      padding: 1rem;
    }
  }
</style>
