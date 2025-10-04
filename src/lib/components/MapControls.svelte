<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let currentBasemap: 'streets' | 'topo' | 'satellite' = 'topo';
  export let zoom: number = 10;
  export let minZoom: number = 3;
  export let maxZoom: number = 20;
  
  const dispatch = createEventDispatcher();
  
  function changeBasemap(basemap: 'streets' | 'topo' | 'satellite') {
    currentBasemap = basemap;
    dispatch('basemapChange', basemap);
  }
  
  function zoomIn() {
    dispatch('zoomIn');
  }
  
  function zoomOut() {
    dispatch('zoomOut');
  }
</script>

<div class="map-controls">
  <!-- Zoom Controls -->
  <div class="zoom-controls">
    <button 
      class="zoom-btn" 
      on:click={zoomIn}
      disabled={zoom >= maxZoom}
      title="Zoom in"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
    <button 
      class="zoom-btn" 
      on:click={zoomOut}
      disabled={zoom <= minZoom}
      title="Zoom out"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
  </div>
  
  <!-- Basemap Switcher -->
  <div class="basemap-switcher">
    <button 
      class="basemap-btn" 
      class:active={currentBasemap === 'streets'}
      on:click={() => changeBasemap('streets')}
      title="Streets"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    </button>
    <button 
      class="basemap-btn" 
      class:active={currentBasemap === 'topo'}
      on:click={() => changeBasemap('topo')}
      title="Topographic"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
    </button>
    <button 
      class="basemap-btn" 
      class:active={currentBasemap === 'satellite'}
      on:click={() => changeBasemap('satellite')}
      title="Satellite"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <circle cx="12" cy="12" r="6"></circle>
        <circle cx="12" cy="12" r="2"></circle>
      </svg>
    </button>
  </div>
</div>

<style>
  .map-controls {
    position: fixed;
    top: 20px;
    left: 20px;
    z-index: 200;
    display: flex;
    gap: 0.5rem;
  }

  .zoom-controls {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: var(--card-bg);
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-color);
    overflow: hidden;
  }

  .zoom-btn {
    width: 40px;
    height: 40px;
    background: var(--card-bg);
    border: none;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .zoom-btn:last-child {
    border-bottom: none;
  }

  .zoom-btn:hover:not(:disabled) {
    background: var(--hover-bg);
    color: var(--primary-color);
  }

  .zoom-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .basemap-switcher {
    display: flex;
    gap: 1px;
    background: var(--card-bg);
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-color);
    overflow: hidden;
  }

  .basemap-btn {
    width: 40px;
    height: 40px;
    background: var(--card-bg);
    border: none;
    border-right: 1px solid var(--border-color);
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .basemap-btn:last-child {
    border-right: none;
  }

  .basemap-btn:hover {
    background: var(--hover-bg);
    color: var(--primary-color);
  }

  .basemap-btn.active {
    background: var(--primary-color);
    color: white;
  }

  @media (max-width: 768px) {
    .map-controls {
      top: 10px;
      left: 10px;
      flex-direction: column;
    }

    .zoom-btn,
    .basemap-btn {
      width: 36px;
      height: 36px;
    }
  }
</style>

