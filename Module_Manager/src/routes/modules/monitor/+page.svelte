<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  onMount(() => {
    // Redirect to monitoring module (the actual monitoring implementation)
    if (browser) {
      goto('/modules/monitoring');
    }
  });
</script>

<TenantGuard>
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

  /* Left Horizontal Menu */
  .header-overlay {
    position: absolute;
    top: 20px;
    left: 20px;
    background: var(--gradient-warning);
    border-radius: var(--border-radius-md);
    padding: 0.75rem 1rem;
    box-shadow: var(--shadow-sm);
    color: white;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 0.75rem;
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