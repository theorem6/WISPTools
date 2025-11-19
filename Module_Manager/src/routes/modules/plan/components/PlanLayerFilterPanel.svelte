<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export interface PlanLayerFilters {
    showMarketing: boolean;
    showPlanFeatures: boolean;
    showNetworkAssets: boolean;
    showBackhaul: boolean;
  }

  export let filters: PlanLayerFilters;
  
  const dispatch = createEventDispatcher();

  function toggleLayer(layer: keyof PlanLayerFilters) {
    filters = { ...filters, [layer]: !filters[layer] };
    dispatch('change', filters);
  }
</script>

<div class="filter-panel">
  <h3>🔍 Map Layers</h3>
  
  <div class="filter-options">
    <label class="filter-checkbox">
      <input 
        type="checkbox" 
        checked={filters.showMarketing}
        on:change={() => toggleLayer('showMarketing')}
      />
      <span class="filter-icon">📍</span>
      <span>Marketing Addresses</span>
    </label>
    
    <label class="filter-checkbox">
      <input 
        type="checkbox" 
        checked={filters.showPlanFeatures}
        on:change={() => toggleLayer('showPlanFeatures')}
      />
      <span class="filter-icon">📋</span>
      <span>Plan Features</span>
    </label>
    
    <label class="filter-checkbox">
      <input 
        type="checkbox" 
        checked={filters.showNetworkAssets}
        on:change={() => toggleLayer('showNetworkAssets')}
      />
      <span class="filter-icon">📡</span>
      <span>Network Assets</span>
    </label>
    
    <label class="filter-checkbox">
      <input 
        type="checkbox" 
        checked={filters.showBackhaul}
        on:change={() => toggleLayer('showBackhaul')}
      />
      <span class="filter-icon">🔗</span>
      <span>Backhaul Links</span>
    </label>
  </div>
</div>

<style>
  .filter-panel {
    background: var(--card-bg, #1e293b);
    border: 1px solid var(--border-color, rgba(148, 163, 184, 0.2));
    border-radius: 8px;
    padding: 1.5rem;
    min-width: 250px;
    max-height: 80vh;
    overflow-y: auto;
  }
  
  h3 {
    margin: 0 0 1.5rem 0;
    font-size: 1.25rem;
    color: var(--text-primary, #f1f5f9);
    border-bottom: 2px solid var(--brand-primary, #3b82f6);
    padding-bottom: 0.5rem;
  }
  
  .filter-options {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .filter-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--text-primary, #f1f5f9);
    padding: 0.5rem;
    border-radius: 4px;
    transition: background-color 0.2s;
  }
  
  .filter-checkbox:hover {
    background: var(--bg-hover, rgba(148, 163, 184, 0.1));
  }
  
  .filter-checkbox input[type="checkbox"] {
    cursor: pointer;
    width: 18px;
    height: 18px;
  }
  
  .filter-icon {
    font-size: 1.25rem;
  }
</style>
