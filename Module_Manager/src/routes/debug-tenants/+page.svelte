<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { authService } from '$lib/services/authService';
  import { tenantStore } from '$lib/stores/tenantStore';
  import { tenantService } from '$lib/services/tenantService';
  import type { User } from 'firebase/auth';

  interface DebugInfo {
    isAuthenticated: boolean;
    currentUser: User | null;
    tenantState: unknown;
    userTenants: unknown[];
    error: string | null;
  }

  let debugInfo: DebugInfo = {
    isAuthenticated: false,
    currentUser: null,
    tenantState: null,
    userTenants: [],
    error: null
  };

  onMount(async () => {
    if (!browser) return;

    try {
      // Check authentication
      const currentUser = authService.getCurrentUser();
      debugInfo.isAuthenticated = !!currentUser;
      debugInfo.currentUser = currentUser;

      if (currentUser) {
        // Check tenant store state
        const unsubscribe = tenantStore.subscribe(state => {
          debugInfo.tenantState = state;
        });

        // Try to load user tenants directly
        try {
          const tenants = await tenantService.getUserTenants(currentUser.uid);
          debugInfo.userTenants = tenants;
        } catch (err: unknown) {
          debugInfo.error = err instanceof Error ? err.message : String(err);
        }

        // Cleanup subscription
        unsubscribe();
      }
    } catch (err: unknown) {
      debugInfo.error = err instanceof Error ? err.message : String(err);
    }
  });
</script>

<div class="debug-container">
  <h1>Tenant Debug Information</h1>
  
  <div class="debug-section">
    <h2>Authentication Status</h2>
    <p><strong>Is Authenticated:</strong> {debugInfo.isAuthenticated}</p>
    <p><strong>User Email:</strong> {debugInfo.currentUser?.email || 'None'}</p>
    <p><strong>User UID:</strong> {debugInfo.currentUser?.uid || 'None'}</p>
  </div>

  <div class="debug-section">
    <h2>Tenant Store State</h2>
    <pre>{JSON.stringify(debugInfo.tenantState, null, 2)}</pre>
  </div>

  <div class="debug-section">
    <h2>User Tenants (Direct API Call)</h2>
    <p><strong>Count:</strong> {debugInfo.userTenants.length}</p>
    <pre>{JSON.stringify(debugInfo.userTenants, null, 2)}</pre>
  </div>

  {#if debugInfo.error}
    <div class="debug-section error">
      <h2>Error</h2>
      <p>{debugInfo.error}</p>
    </div>
  {/if}
</div>

<style>
  .debug-container {
    max-width: 800px;
    margin: 2rem auto;
    padding: 2rem;
    font-family: monospace;
  }

  .debug-section {
    margin: 2rem 0;
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 8px;
    background: #f9f9f9;
  }

  .debug-section.error {
    background: #ffe6e6;
    border-color: #ff6b6b;
  }

  pre {
    background: #f0f0f0;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.9rem;
  }
</style>
