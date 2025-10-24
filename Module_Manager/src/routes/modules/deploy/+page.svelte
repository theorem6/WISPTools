<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';

  let currentUser: any = null;
  let mapContainer: HTMLDivElement;

  onMount(async () => {
    if (browser) {
      currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        goto('/login');
      }
    }
  });

  function goBack() {
    goto('/dashboard');
  }
</script>

<TenantGuard requireTenant={true}>
  <div class="deploy-module">
    <!-- Simplified Header -->
    <div class="module-header-simple">
      <h1>🚀 Deploy</h1>
    </div>

    <!-- Map Container -->
    <div class="map-container">
      <!-- Map Area -->
      <div class="map-area" bind:this={mapContainer}>
        <iframe 
          src="/modules/coverage-map" 
          title="Network Coverage Map"
          class="coverage-map-iframe"
        ></iframe>
      </div>
    </div>
  </div>
</TenantGuard>

<style>
  .deploy-module {
    background: var(--background-color);
    min-height: 100vh;
    padding: 0.5rem;
    color: var(--text-color);
    display: flex;
    flex-direction: column;
  }

  .module-header-simple {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border-radius: var(--border-radius-md);
    padding: 0.5rem 1rem;
    margin-bottom: 0.5rem;
    box-shadow: var(--shadow-sm);
    color: white;
    text-align: center;
    flex-shrink: 0;
  }

  .module-header-simple h1 {
    font-size: 1.2rem;
    margin: 0;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .map-container {
    flex-grow: 1;
    position: relative;
    background: var(--card-bg);
    border-radius: var(--border-radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-md);
    min-height: calc(100vh - 100px);
  }

  .map-area {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .coverage-map-iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }
</style>