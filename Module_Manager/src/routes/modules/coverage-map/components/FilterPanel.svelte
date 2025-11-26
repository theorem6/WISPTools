<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CoverageMapFilters, BandFilter } from '../lib/models';

  export let filters: CoverageMapFilters;
  
  const dispatch = createEventDispatcher();
  
  // Mobile state for collapsible sections
  let expandedSections = {
    assetTypes: true,
    backhaulTypes: false,
    bands: false,
    status: false
  };
  
  // Check if we're on mobile
  let isMobile = false;
  
  if (typeof window !== 'undefined') {
    isMobile = window.innerWidth <= 768;
  }
  
  const availableBands = [
    { id: 'LTE', name: 'LTE', color: '#ef4444' },
    { id: 'CBRS', name: 'CBRS (3.5 GHz)', color: '#3b82f6' },
    { id: 'FWA', name: 'FWA / Fixed Wireless', color: '#10b981' },
    { id: '5G', name: '5G NR', color: '#8b5cf6' },
    { id: 'WiFi', name: 'WiFi', color: '#f59e0b' }
  ];
  
  function toggleAssetType(type: string) {
    switch(type) {
      case 'towers':
        filters.showTowers = !filters.showTowers;
        break;
      case 'sectors':
        filters.showSectors = !filters.showSectors;
        break;
      case 'cpe':
        filters.showCPE = !filters.showCPE;
        break;
      case 'marketing':
        filters.showMarketing = !filters.showMarketing;
        break;
      case 'equipment':
        filters.showEquipment = !filters.showEquipment;
        break;
      case 'backhaul':
        filters.showBackhaul = !filters.showBackhaul;
        break;
    }
    dispatch('change', filters);
  }
  
  function toggleBandFilter(bandId: string) {
    const bandFilter = filters.bandFilters.find(f => f.band === bandId);
    if (bandFilter) {
      bandFilter.enabled = !bandFilter.enabled;
    } else {
      const band = availableBands.find(b => b.id === bandId);
      if (band) {
        filters.bandFilters.push({
          enabled: true,
          band: bandId,
          color: band.color
        });
      }
    }
    filters.bandFilters = [...filters.bandFilters]; // Trigger reactivity
    dispatch('change', filters);
  }
  
  function isBandEnabled(bandId: string): boolean {
    const filter = filters.bandFilters.find(f => f.band === bandId);
    return filter ? filter.enabled : false;
  }
  
  function clearAllBandFilters() {
    filters.bandFilters = filters.bandFilters.map(f => ({ ...f, enabled: false }));
    dispatch('change', filters);
  }
  
  function showAllBands() {
    filters.bandFilters = availableBands.map(band => ({
      enabled: true,
      band: band.id,
      color: band.color
    }));
    dispatch('change', filters);
  }
  
  function toggleSection(section: keyof typeof expandedSections) {
    if (isMobile) {
      expandedSections[section] = !expandedSections[section];
    }
  }
</script>

<div class="filter-panel">
  <h3>🔍 Map Filters</h3>
  
  <!-- Asset Type Filters -->
  <div class="filter-section">
    <button 
      class="section-header" 
      class:collapsible={isMobile}
      onclick={() => toggleSection('assetTypes')}
    >
      <h4>Asset Types</h4>
      {#if isMobile}
        <span class="expand-icon" class:expanded={expandedSections.assetTypes}>▼</span>
      {/if}
    </button>
    <div class="filter-options" class:collapsed={isMobile && !expandedSections.assetTypes}>
      <label class="filter-checkbox">
        <input 
          type="checkbox" 
          checked={filters.showTowers}
          on:change={() => toggleAssetType('towers')}
        />
        <span class="filter-icon">📡</span>
        <span>Tower Sites</span>
      </label>
      
      <label class="filter-checkbox">
        <input 
          type="checkbox" 
          checked={filters.showSectors}
          on:change={() => toggleAssetType('sectors')}
        />
        <span class="filter-icon">📶</span>
        <span>Sectors</span>
      </label>
      
      <label class="filter-checkbox">
        <input 
          type="checkbox" 
          checked={filters.showCPE}
          on:change={() => toggleAssetType('cpe')}
        />
        <span class="filter-icon">📱</span>
        <span>CPE Devices</span>
      </label>
      
      <label class="filter-checkbox">
        <input 
          type="checkbox" 
          checked={filters.showMarketing}
          on:change={() => toggleAssetType('marketing')}
        />
        <span class="filter-icon">📍</span>
        <span>Marketing Leads</span>
      </label>
      
      <label class="filter-checkbox">
        <input 
          type="checkbox" 
          checked={filters.showEquipment}
          on:change={() => toggleAssetType('equipment')}
        />
        <span class="filter-icon">🔧</span>
        <span>Equipment</span>
      </label>
      
      <label class="filter-checkbox">
        <input 
          type="checkbox" 
          checked={filters.showBackhaul}
          on:change={() => toggleAssetType('backhaul')}
        />
        <span class="filter-icon">🔗</span>
        <span>Backhaul Links</span>
      </label>
    </div>
  </div>
  
  <!-- Backhaul Type Filters -->
  {#if filters.showBackhaul}
    <div class="filter-section">
      <button 
        class="section-header" 
        class:collapsible={isMobile}
        onclick={() => toggleSection('backhaulTypes')}
      >
        <h4>Backhaul Types</h4>
        {#if isMobile}
          <span class="expand-icon" class:expanded={expandedSections.backhaulTypes}>▼</span>
        {/if}
      </button>
      <div class="filter-options" class:collapsed={isMobile && !expandedSections.backhaulTypes}>
        <label class="filter-checkbox">
          <input 
            type="checkbox" 
            checked={filters.showFiber}
            on:change={() => {
              filters.showFiber = !filters.showFiber;
              dispatch('change', filters);
            }}
          />
          <span class="filter-icon">🌐</span>
          <span>Fiber</span>
        </label>
        
        <label class="filter-checkbox">
          <input 
            type="checkbox" 
            checked={filters.showWirelessLicensed}
            on:change={() => {
              filters.showWirelessLicensed = !filters.showWirelessLicensed;
              dispatch('change', filters);
            }}
          />
          <span class="filter-icon">📡</span>
          <span>Licensed Wireless</span>
        </label>
        
        <label class="filter-checkbox">
          <input 
            type="checkbox" 
            checked={filters.showWirelessUnlicensed}
            on:change={() => {
              filters.showWirelessUnlicensed = !filters.showWirelessUnlicensed;
              dispatch('change', filters);
            }}
          />
          <span class="filter-icon">📻</span>
          <span>Unlicensed Wireless</span>
        </label>
      </div>
    </div>
  {/if}
  
  <!-- Band/Technology Filters -->
  <div class="filter-section">
    <button 
      class="section-header" 
      class:collapsible={isMobile}
      onclick={() => toggleSection('bands')}
    >
      <div class="filter-header">
        <h4>Bands / Technology</h4>
        {#if !isMobile}
          <div class="filter-actions">
            <button class="btn-link" onclick={showAllBands}>All</button>
            <button class="btn-link" onclick={clearAllBandFilters}>None</button>
          </div>
        {/if}
      </div>
      {#if isMobile}
        <span class="expand-icon" class:expanded={expandedSections.bands}>▼</span>
      {/if}
    </button>
    <div class="filter-options" class:collapsed={isMobile && !expandedSections.bands}>
      {#if isMobile}
        <div class="filter-actions mobile-actions">
          <button class="btn-link" onclick={showAllBands}>All</button>
          <button class="btn-link" onclick={clearAllBandFilters}>None</button>
        </div>
      {/if}
      {#each availableBands as band}
        <label class="filter-checkbox">
          <input 
            type="checkbox" 
            checked={isBandEnabled(band.id)}
            on:change={() => toggleBandFilter(band.id)}
          />
          <span class="band-indicator" style="background-color: {band.color}"></span>
          <span>{band.name}</span>
        </label>
      {/each}
    </div>
    <p class="filter-note">
      {#if filters.bandFilters.filter(f => f.enabled).length === 0}
        Showing all bands
      {:else}
        Showing {filters.bandFilters.filter(f => f.enabled).length} band(s)
      {/if}
    </p>
  </div>
  
  <!-- Status Filters -->
  <div class="filter-section">
    <button 
      class="section-header" 
      class:collapsible={isMobile}
      onclick={() => toggleSection('status')}
    >
      <h4>Status</h4>
      {#if isMobile}
        <span class="expand-icon" class:expanded={expandedSections.status}>▼</span>
      {/if}
    </button>
    <div class="filter-options" class:collapsed={isMobile && !expandedSections.status}>
      <label class="filter-checkbox">
        <input 
          type="checkbox" 
          checked={filters.statusFilter.includes('active')}
          on:change={(e) => {
            if (e.currentTarget.checked) {
              filters.statusFilter = [...filters.statusFilter, 'active'];
            } else {
              filters.statusFilter = filters.statusFilter.filter(s => s !== 'active');
            }
            dispatch('change', filters);
          }}
        />
        <span class="status-dot active"></span>
        <span>Active</span>
      </label>
      
      <label class="filter-checkbox">
        <input 
          type="checkbox" 
          checked={filters.statusFilter.includes('inactive')}
          on:change={(e) => {
            if (e.currentTarget.checked) {
              filters.statusFilter = [...filters.statusFilter, 'inactive'];
            } else {
              filters.statusFilter = filters.statusFilter.filter(s => s !== 'inactive');
            }
            dispatch('change', filters);
          }}
        />
        <span class="status-dot inactive"></span>
        <span>Inactive</span>
      </label>
      
      <label class="filter-checkbox">
        <input 
          type="checkbox" 
          checked={filters.statusFilter.includes('maintenance')}
          on:change={(e) => {
            if (e.currentTarget.checked) {
              filters.statusFilter = [...filters.statusFilter, 'maintenance'];
            } else {
              filters.statusFilter = filters.statusFilter.filter(s => s !== 'maintenance');
            }
            dispatch('change', filters);
          }}
        />
        <span class="status-dot maintenance"></span>
        <span>Maintenance</span>
      </label>
    </div>
  </div>
</div>

<style>
  .filter-panel {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    max-height: 80vh;
    overflow-y: auto;
  }
  
  h3 {
    margin: 0 0 1.5rem 0;
    font-size: 1.25rem;
    color: var(--text-primary);
    border-bottom: 2px solid var(--brand-primary);
    padding-bottom: 0.5rem;
  }
  
  .filter-section {
    margin-bottom: 2rem;
  }
  
  .filter-section:last-child {
    margin-bottom: 0;
  }
  
  .section-header {
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
  }
  
  .section-header.collapsible {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
  }
  
  .section-header.collapsible:hover {
    background: var(--bg-hover);
    border-radius: 4px;
  }
  
  .expand-icon {
    transition: transform 0.2s ease;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .expand-icon.expanded {
    transform: rotate(180deg);
  }
  
  .filter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  .filter-options.collapsed {
    display: none;
  }
  
  .mobile-actions {
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  h4 {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    color: var(--text-primary);
  }
  
  .filter-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .btn-link {
    background: none;
    border: none;
    color: var(--brand-primary);
    font-size: 0.875rem;
    cursor: pointer;
    padding: 0;
  }
  
  .btn-link:hover {
    text-decoration: underline;
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
    color: var(--text-primary);
  }
  
  .filter-checkbox input[type="checkbox"] {
    cursor: pointer;
  }
  
  .filter-icon {
    font-size: 1.25rem;
  }
  
  .band-indicator {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: inline-block;
  }
  
  .status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
  }
  
  .status-dot.active {
    background-color: #10b981;
  }
  
  .status-dot.inactive {
    background-color: #6b7280;
  }
  
  .status-dot.maintenance {
    background-color: #f59e0b;
  }
  
  .filter-note {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-style: italic;
  }
  
  /* Mobile-specific styles */
  @media (max-width: 768px) {
    .filter-panel {
      padding: 1rem;
      max-height: 80vh;
    }
    
    .filter-checkbox {
      min-height: 44px;
      padding: 0.5rem 0;
      font-size: 1rem;
    }
    
    .filter-checkbox input[type="checkbox"] {
      width: 20px;
      height: 20px;
      margin-right: 0.75rem;
    }
    
    .btn-link {
      min-height: 44px;
      padding: 0.5rem 1rem;
      font-size: 1rem;
      border-radius: 6px;
      background: var(--bg-hover);
    }
    
    .btn-link:hover {
      background: var(--brand-primary);
      color: white;
    }
    
    .section-header.collapsible {
      min-height: 48px;
      padding: 0.75rem 0;
    }
    
    .section-header h4 {
      margin: 0;
      font-size: 1.1rem;
    }
  }
</style>

