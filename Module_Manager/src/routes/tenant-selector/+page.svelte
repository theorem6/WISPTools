<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { authService } from '$lib/services/authService';
  import { tenantStore } from '$lib/stores/tenantStore';
  import type { Tenant } from '$lib/models/tenant';

  let isLoading = true;
  let tenants: Tenant[] = [];
  let currentUser: any = null;
  let error = '';

  onMount(async () => {
    if (!browser) return;

    console.log('[Tenant Selector] Page loaded');

    // Check if user is authenticated
    currentUser = authService.getCurrentUser();
    if (!currentUser) {
      console.log('[Tenant Selector] Not authenticated, redirecting to login');
      await goto('/login');
      return;
    }

    // Initialize tenant store
    await tenantStore.initialize();

    // Load user's tenants
    try {
      tenants = await tenantStore.loadUserTenants(currentUser.uid, currentUser.email || undefined);
      console.log('[Tenant Selector] Loaded', tenants.length, 'tenants');
      
      if (tenants.length === 0) {
        // No tenants, redirect to tenant setup
        console.log('[Tenant Selector] No tenants, redirecting to setup');
        await goto('/tenant-setup');
      } else if (tenants.length === 1) {
        // Only one tenant, auto-select and redirect
        console.log('[Tenant Selector] Auto-selecting single tenant');
        selectTenant(tenants[0]);
      }
    } catch (err: any) {
      console.error('[Tenant Selector] Error loading tenants:', err);
      error = err.message || 'Failed to load tenants';
    } finally {
      isLoading = false;
    }
  });

  function selectTenant(tenant: Tenant) {
    console.log('[Tenant Selector] Tenant selected:', tenant.displayName);
    
    // Use tenant store to set current tenant
    tenantStore.setCurrentTenant(tenant);
    
    // Redirect to dashboard
    goto('/dashboard');
  }

  async function createNewTenant() {
    console.log('[Tenant Selector] Creating new tenant');
    await goto('/tenant-setup');
  }
</script>

<div class="tenant-selector-page">
  <div class="selector-container">
    <div class="selector-header">
      <h1>Select Organization</h1>
      <p>Choose the organization you want to work with</p>
    </div>

    {#if isLoading}
      <div class="loading-card">
        <div class="spinner-large"></div>
        <p>Loading your organizations...</p>
      </div>
    {:else if error}
      <div class="error-card">
        <span class="error-icon">⚠️</span>
        <h2>Error Loading Organizations</h2>
        <p>{error}</p>
        <button class="btn-primary" on:click={() => window.location.reload()}>
          Retry
        </button>
      </div>
    {:else}
      <div class="tenants-grid">
        {#each tenants as tenant}
          <button class="tenant-card" on:click={() => selectTenant(tenant)}>
            <div class="tenant-icon">🏢</div>
            <h3>{tenant.displayName}</h3>
            <p class="tenant-subdomain">{tenant.subdomain}</p>
            <div class="tenant-meta">
              <span class="status-badge status-{tenant.status}">{tenant.status}</span>
              <span class="role-badge">Your Role: Owner</span>
            </div>
          </button>
        {/each}

        <button class="tenant-card create-new" on:click={createNewTenant}>
          <div class="create-icon">➕</div>
          <h3>Create New Organization</h3>
          <p>Set up a new tenant for your devices</p>
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .tenant-selector-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .selector-container {
    max-width: 900px;
    width: 100%;
  }

  .selector-header {
    text-align: center;
    color: white;
    margin-bottom: 2rem;
  }

  .selector-header h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .selector-header p {
    opacity: 0.9;
  }

  .loading-card, .error-card {
    background: var(--card-bg);
    border-radius: 1rem;
    padding: 3rem;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    text-align: center;
  }

  .spinner-large {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(124, 58, 237, 0.2);
    border-top-color: var(--brand-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 1rem;
  }

  .tenants-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .tenant-card {
    background: var(--card-bg);
    border-radius: 1rem;
    padding: 2rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    cursor: pointer;
    transition: all 0.3s;
    border: 2px solid transparent;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .tenant-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
    border-color: var(--brand-primary);
  }

  .tenant-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .tenant-card h3 {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
  }

  .tenant-subdomain {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-bottom: 1rem;
    font-family: 'Courier New', monospace;
  }

  .tenant-meta {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-active {
    background-color: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .status-trial {
    background-color: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
  }

  .status-suspended {
    background-color: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .role-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    background-color: rgba(124, 58, 237, 0.2);
    color: var(--brand-secondary);
  }

  .create-new {
    border: 2px dashed var(--border-color);
    background: rgba(255, 255, 255, 0.05);
  }

  .create-new:hover {
    background: var(--card-bg);
    border-style: solid;
  }

  .create-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.7;
  }

  .btn-primary {
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 1rem;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(37, 99, 235, 0.3);
  }

  @media (max-width: 768px) {
    .tenant-selector-page {
      padding: 1rem;
    }

    .tenants-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

