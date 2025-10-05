<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let currentBasemap: string = 'topo-vector';
  
  const dispatch = createEventDispatcher();
  
  const basemaps = [
    { id: 'topo-vector', label: 'Topo', icon: '🗺️' },
    { id: 'streets-vector', label: 'Streets', icon: '🛣️' },
    { id: 'hybrid', label: 'Satellite', icon: '🛰️' }
  ];
  
  function selectBasemap(basemapId: string) {
    currentBasemap = basemapId;
    dispatch('change', basemapId);
  }
</script>

<div class="basemap-switcher">
  {#each basemaps as basemap}
    <button 
      class="basemap-btn"
      class:active={currentBasemap === basemap.id}
      on:click={() => selectBasemap(basemap.id)}
      title={basemap.label}
    >
      <span class="basemap-icon">{basemap.icon}</span>
      <span class="basemap-label">{basemap.label}</span>
    </button>
  {/each}
</div>

<style>
  .basemap-switcher {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 150;
    display: flex;
    gap: 0.5rem;
    background: var(--card-bg);
    padding: 0.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    border: 1px solid var(--border-color);
  }

  .basemap-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 60px;
  }

  .basemap-btn:hover {
    background: var(--hover-bg);
    border-color: var(--primary-color);
  }

  .basemap-btn.active {
    background: var(--primary-light);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }

  .basemap-icon {
    font-size: 1.25rem;
  }

  .basemap-label {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .basemap-btn.active .basemap-label {
    color: var(--primary-color);
    font-weight: 600;
  }

  @media (max-width: 768px) {
    .basemap-switcher {
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      padding: 0.35rem;
      gap: 0.35rem;
    }

    .basemap-btn {
      padding: 0.35rem 0.5rem;
      min-width: 50px;
    }

    .basemap-icon {
      font-size: 1rem;
    }

    .basemap-label {
      font-size: 0.65rem;
    }
  }
</style>

