<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  // SettingsButton removed - now only on dashboard
  
  export let showFilters = false;
  export let showMainMenu = false;
  export let showStats = false;
  export let currentBasemap = 'topo-vector';
  
  const dispatch = createEventDispatcher();
  
  function toggleFilters() {
    showFilters = !showFilters;
    dispatch('toggle-filters', showFilters);
  }
  
  function toggleMainMenu() {
    showMainMenu = !showMainMenu;
    dispatch('toggle-main-menu', showMainMenu);
  }
  
  function toggleStats() {
    showStats = !showStats;
    dispatch('toggle-stats', showStats);
  }
  
  function changeBasemap(basemapId: string) {
    currentBasemap = basemapId;
    dispatch('change-basemap', basemapId);
  }
  
  function exportCSV() {
    dispatch('export-csv');
  }
  
  function exportPDF() {
    dispatch('export-pdf');
  }
  
  function importFromCBRS() {
    dispatch('import-cbrs');
  }
</script>

<!-- Map Controls -->
<div class="map-controls">
  <!-- Filter Toggle -->
  <button type="button" class="control-btn" on:click={toggleFilters} class:active={showFilters}>
    <span aria-hidden="true">🎛️</span>
    {#if showFilters}
      Hide
    {:else}
      Show
    {/if}
    Filters
  </button>
  
  <!-- Main Menu Toggle -->
  <button type="button" class="control-btn" on:click={toggleMainMenu} class:active={showMainMenu}>
    <span aria-hidden="true">📋</span>
    Menu
  </button>
  
  <!-- Stats Toggle -->
  <button type="button" class="control-btn" on:click={toggleStats} class:active={showStats}>
    <span aria-hidden="true">📊</span>
    {#if showStats}
      Hide
    {:else}
      Show
    {/if}
    Stats
  </button>
  
  <!-- Basemap Selector -->
  <select
    class="control-select"
    bind:value={currentBasemap}
    on:change={(event) => changeBasemap((event.currentTarget as HTMLSelectElement).value)}
  >
    <option value="topo-vector">Topographic</option>
    <option value="satellite">Satellite</option>
    <option value="street-map">Street Map</option>
    <option value="osm">OpenStreetMap</option>
  </select>
  
  <!-- Export Buttons -->
  <button type="button" class="control-btn" on:click={exportCSV}>
    <span aria-hidden="true">💾</span>
    Export CSV
  </button>
  
  <button type="button" class="control-btn" on:click={exportPDF}>
    <span aria-hidden="true">📄</span>
    Print PDF
  </button>
  
  <!-- Import -->
  <button type="button" class="control-btn" on:click={importFromCBRS}>
    <span aria-hidden="true">📥</span>
    Import from CBRS
  </button>
  
  <!-- Settings - Removed from modules -->
</div>

<style>
  .map-controls {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .control-btn {
    padding: 0.5rem 1rem;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }
  
  .control-btn:hover {
    background: var(--bg-hover);
  }
  
  .control-btn.active {
    background: var(--primary);
    color: white;
  }
  
  .control-select {
    padding: 0.5rem 1rem;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.875rem;
  }
  
  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .map-controls {
      top: 10px;
      right: 10px;
    }
    
    .control-btn,
    .control-select {
      font-size: 0.75rem;
      padding: 0.4rem 0.8rem;
    }
  }
</style>

