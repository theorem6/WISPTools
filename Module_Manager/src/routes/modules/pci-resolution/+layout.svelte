<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let isReady = false;
  
  onMount(() => {
    if (browser) {
      console.log('PCI Resolution layout: Mounting...');
      // Small delay to ensure everything is ready
      setTimeout(() => {
        isReady = true;
        console.log('PCI Resolution layout: Ready');
      }, 100);
    }
  });
</script>

{#if isReady}
  <slot />
{:else}
  <div class="pci-loading">
    <div class="loading-content">
      <div class="spinner-large"></div>
      <h2>Loading PCI Resolution Module</h2>
      <p>Initializing map and analysis tools...</p>
    </div>
  </div>
{/if}

<style>
  .pci-loading {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
  
  .loading-content {
    text-align: center;
    color: white;
  }
  
  .spinner-large {
    width: 64px;
    height: 64px;
    border: 6px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 2rem;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .loading-content h2 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: white;
  }
  
  .loading-content p {
    font-size: 1rem;
    opacity: 0.9;
  }
</style>

