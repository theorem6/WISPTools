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
      
      <!-- Exit Button -->
      <button class="exit-btn" on:click={goBack}>
        <span class="exit-icon">✕</span>
        <span class="exit-text">Exit</span>
      </button>
    </div>
  </div>
</TenantGuard>

<style>
  .deploy-module {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    background: #000;
    z-index: 9999;
  }

  .map-container {
    width: 100%;
    height: 100%;
    position: relative;
    background: #000;
    overflow: hidden;
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

  .exit-btn {
    position: absolute;
    bottom: 20px;
    right: 20px;
    background: rgba(239, 68, 68, 0.9);
    color: white;
    border: none;
    border-radius: var(--border-radius-md);
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    box-shadow: var(--shadow-md);
    transition: all 0.2s ease;
    z-index: 999;
  }

  .exit-btn:hover {
    background: rgba(239, 68, 68, 1);
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }

  .exit-icon {
    font-size: 1.2rem;
  }

  .exit-text {
    font-size: 0.9rem;
    font-weight: 600;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .exit-btn {
      bottom: 10px;
      right: 10px;
      padding: 0.5rem 0.75rem;
    }

    .exit-text {
      display: none;
    }
  }
</style>