<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import SettingsButton from '$lib/components/SettingsButton.svelte';

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
  <div class="app">
    <!-- Full Screen Map -->
    <div class="map-fullscreen" bind:this={mapContainer}>
      <iframe 
        src="/modules/coverage-map" 
        title="Network Coverage Map"
        class="coverage-map-iframe"
      ></iframe>
    </div>

    <!-- Minimal Header Overlay -->
    <div class="header-overlay">
      <div class="header-left">
        <button class="back-btn" on:click={() => goto('/dashboard')} title="Back to Dashboard">
          ←
        </button>
        <h1>📊 Monitor</h1>
      </div>
    </div>
  </div>
  
  <!-- Global Settings Button -->
  <SettingsButton />
</TenantGuard>

<style>
  /* App Container - Full Screen */
  .app {
    position: relative;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    background: var(--bg-primary);
  }

  /* Full Screen Map */
  .map-fullscreen {
    position: absolute;
    inset: 0;
    z-index: 0;
  }

  .coverage-map-iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }

  /* Header Overlay */
  .header-overlay {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--gradient-warning);
    border-radius: var(--border-radius-md);
    padding: 0.5rem 1rem;
    box-shadow: var(--shadow-sm);
    color: white;
    text-align: center;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-width: 400px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .back-btn {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    padding: 0.5rem;
    font-size: 1.2rem;
    cursor: pointer;
    color: white;
    transition: all 0.2s;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateX(-2px);
  }

  .header-overlay h1 {
    font-size: 1.2rem;
    margin: 0;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
</style>