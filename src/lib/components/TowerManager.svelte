<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { cellsStore } from '../stores/appState';
  import { currentNetwork } from '../stores/networkStore';
  import { convertLegacyToCellSite, convertCellSiteToLegacy, type CellSite } from '../models/cellSite';
  import type { Cell } from '../pciMapper';
  import SiteEditor from './SiteEditor.svelte';
  import ImportWizard from './ImportWizard.svelte';
  
  export let show = false;
  
  const dispatch = createEventDispatcher();
  
  // Handle Escape key to close modal
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && show) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }
  
  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
  
  let showSiteEditor = false;
  let selectedSite: CellSite | null = null;
  let isCreatingNewSite = false;
  let searchQuery = '';
  let expandedTowerId: string | null = null;
  
  // Group cells by eNodeB to get towers
  $: towers = groupCellsByTower($cellsStore.items);
  $: filteredTowers = filterTowers(towers, searchQuery);
  
  interface SectorGroup {
    sectorNumber: number;
    carriers: Cell[];
    azimuth: number;
    pcis: number[];
  }
  
  interface Tower {
    eNodeB: number;
    name: string;
    latitude: number;
    longitude: number;
    sectors: SectorGroup[];
    sectorCount: number;
    carrierCount: number;
    technologies: string[];
    frequencies: number[];
  }
  
  function groupCellsByTower(cells: Cell[]): Tower[] {
    const towerMap = new Map<number, Tower>();
    
    cells.forEach(cell => {
      if (!towerMap.has(cell.eNodeB)) {
        towerMap.set(cell.eNodeB, {
          eNodeB: cell.eNodeB,
          name: `Tower ${cell.eNodeB}`,
          latitude: cell.latitude,
          longitude: cell.longitude,
          sectors: [],
          sectorCount: 0,
          carrierCount: 0,
          technologies: [],
          frequencies: []
        });
      }
      
      const tower = towerMap.get(cell.eNodeB)!;
      
      // Find or create sector group
      let sectorGroup = tower.sectors.find(s => s.sectorNumber === cell.sector);
      if (!sectorGroup) {
        sectorGroup = {
          sectorNumber: cell.sector,
          carriers: [],
          azimuth: cell.azimuth || 0,
          pcis: []
        };
        tower.sectors.push(sectorGroup);
      }
      
      // Add carrier to sector
      sectorGroup.carriers.push(cell);
      if (!sectorGroup.pcis.includes(cell.pci)) {
        sectorGroup.pcis.push(cell.pci);
      }
      
      tower.sectorCount = tower.sectors.length;
      tower.carrierCount = tower.sectors.reduce((sum, s) => sum + s.carriers.length, 0);
      
      // Collect unique technologies
      if (!tower.technologies.includes(cell.technology)) {
        tower.technologies.push(cell.technology);
      }
      
      // Collect unique frequencies
      if (!tower.frequencies.includes(cell.frequency)) {
        tower.frequencies.push(cell.frequency);
      }
    });
    
    return Array.from(towerMap.values()).sort((a, b) => a.eNodeB - b.eNodeB);
  }
  
  function filterTowers(towers: Tower[], query: string): Tower[] {
    if (!query.trim()) return towers;
    
    const lowerQuery = query.toLowerCase();
    return towers.filter(tower => 
      tower.name.toLowerCase().includes(lowerQuery) ||
      tower.eNodeB.toString().includes(lowerQuery) ||
      tower.technologies.some(tech => tech.toLowerCase().includes(lowerQuery)) ||
      tower.sectors.some(sector => sector.id.toLowerCase().includes(lowerQuery))
    );
  }
  
  function handleClose() {
    dispatch('close');
  }
  
  let showImportWizard = false;
  
  function handleAddTower() {
    // Show import wizard instead of directly opening site editor
    showImportWizard = true;
  }
  
  function handleImport(event: CustomEvent) {
    const importedCells = event.detail.cells;
    
    // Add imported cells to the store (cast to any to handle Cell/LegacyCell compatibility)
    const cells = [...$cellsStore.items, ...importedCells] as any;
    cellsStore.set({ 
      items: cells,
      isLoading: false,
      error: null
    });
    
    // Close import wizard and notify parent
    showImportWizard = false;
    dispatch('towersChanged');
  }
  
  function handleEditTower(tower: Tower) {
    // Flatten all carriers from all sectors for this tower
    const towerCells: Cell[] = [];
    tower.sectors.forEach(sectorGroup => {
      towerCells.push(...sectorGroup.carriers);
    });
    
    // Convert to CellSite format
    const cellSites = convertLegacyToCellSite(towerCells as any);
    if (cellSites.length > 0) {
      selectedSite = cellSites[0]; // Should only be one site per eNodeB
      isCreatingNewSite = false;
      showSiteEditor = true;
    }
  }
  
  async function handleDeleteTower(tower: Tower, event: Event) {
    event.stopPropagation();
    
    if (!confirm(`Delete Tower ${tower.eNodeB} with ${tower.sectorCount} sectors? This cannot be undone.`)) {
      return;
    }
    
    // Remove all sectors from this tower
    const remainingCells = $cellsStore.items.filter(cell => cell.eNodeB !== tower.eNodeB);
    cellsStore.set({ 
      items: remainingCells,
      isLoading: false,
      error: null
    });
    
    // Dispatch event to re-analyze and save
    dispatch('towersChanged');
  }
  
  function handleSiteSave(event: CustomEvent) {
    const savedSite = event.detail as CellSite;
    
    // Convert site to legacy cell format
    const legacyCells = convertCellSiteToLegacy([savedSite]);
    
    if (isCreatingNewSite) {
      // Add new site (cast to any to handle Cell/LegacyCell compatibility)
      const cells = [...$cellsStore.items, ...legacyCells] as any;
      cellsStore.set({ 
        items: cells,
        isLoading: false,
        error: null
      });
    } else {
      // Update existing site - remove old sectors, add new ones
      const siteId = savedSite.id;
      const cells = [
        ...$cellsStore.items.filter(c => !c.id.startsWith(siteId)),
        ...legacyCells
      ] as any;
      cellsStore.set({ 
        items: cells,
        isLoading: false,
        error: null
      });
    }
    
    // Close editor and notify parent
    showSiteEditor = false;
    selectedSite = null;
    isCreatingNewSite = false;
    dispatch('towersChanged');
  }
  
  function toggleExpand(towerId: number) {
    const towerIdStr = towerId.toString();
    expandedTowerId = expandedTowerId === towerIdStr ? null : towerIdStr;
  }
  
  function formatCoordinates(lat: number, lng: number): string {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
</script>

{#if show}
  <div 
    class="tower-overlay" 
    role="presentation"
    on:click={handleClose}
    on:keydown={(e) => e.key === 'Escape' && handleClose()}
  >
    <div 
      class="tower-modal" 
      role="dialog"
      tabindex="-1"
      aria-labelledby="tower-manager-modal-title"
      on:click|stopPropagation
      on:keydown|stopPropagation
    >
      <div class="tower-header">
        <div class="header-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
          <h2 id="tower-manager-modal-title">Tower Management</h2>
          {#if $currentNetwork}
            <span class="network-badge">{$currentNetwork.name}</span>
          {/if}
        </div>
        <button class="close-btn" on:click={handleClose}>×</button>
      </div>
      
      <div class="tower-body">
        <!-- Search and Actions Bar -->
        <div class="actions-bar">
          <div class="search-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input 
              type="text" 
              placeholder="Search towers by eNodeB, technology, or sector ID..."
              bind:value={searchQuery}
            />
          </div>
          <button class="add-tower-btn" on:click={handleAddTower}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Tower
          </button>
        </div>
        
        <!-- Tower Stats -->
        <div class="tower-stats">
          <div class="stat-card">
            <span class="stat-value">{towers.length}</span>
            <span class="stat-label">Towers</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{$cellsStore.items.length}</span>
            <span class="stat-label">Sectors</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{new Set($cellsStore.items.map(c => c.technology)).size}</span>
            <span class="stat-label">Technologies</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{new Set($cellsStore.items.map(c => c.frequency)).size}</span>
            <span class="stat-label">Frequencies</span>
          </div>
        </div>
        
        <!-- Tower List -->
        <div class="tower-list">
          {#if filteredTowers.length === 0}
            <div class="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
              {#if searchQuery}
                <h3>No Towers Found</h3>
                <p>Try adjusting your search terms.</p>
              {:else}
                <h3>No Towers Yet</h3>
                <p>Add your first cell tower to start planning your network.</p>
                <button class="add-first-tower-btn" on:click={handleAddTower}>
                  ➕ Add First Tower
                </button>
              {/if}
            </div>
          {:else}
            {#each filteredTowers as tower (tower.eNodeB)}
              <div class="tower-card" class:expanded={expandedTowerId === tower.eNodeB.toString()}>
                <div 
                  class="tower-card-header" 
                  role="button"
                  tabindex="0"
                  on:click={() => toggleExpand(tower.eNodeB)}
                  on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleExpand(tower.eNodeB)}
                >
                  <div class="tower-info">
                    <div class="tower-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                        <polyline points="2 17 12 22 22 17"></polyline>
                        <polyline points="2 12 12 17 22 12"></polyline>
                      </svg>
                    </div>
                    <div class="tower-details">
                      <h3>Tower {tower.eNodeB}</h3>
                      <div class="tower-meta">
                        <span class="meta-item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                          {tower.sectorCount} sector{tower.sectorCount !== 1 ? 's' : ''} ({tower.carrierCount} carriers)
                        </span>
                        <span class="meta-divider">•</span>
                        <span class="meta-item">
                          {tower.technologies.join(', ')}
                        </span>
                        <span class="meta-divider">•</span>
                        <span class="meta-item coordinates">
                          📍 {formatCoordinates(tower.latitude, tower.longitude)}
                        </span>
                      </div>
                      <div class="tower-frequencies">
                        {#each tower.frequencies as freq}
                          <span class="freq-badge">{freq} MHz</span>
                        {/each}
                      </div>
                    </div>
                  </div>
                  <div class="tower-actions">
                    <button 
                      class="action-btn edit-btn" 
                      on:click|stopPropagation={() => handleEditTower(tower)}
                      title="Edit tower"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button 
                      class="action-btn delete-btn" 
                      on:click={(e) => handleDeleteTower(tower, e)}
                      title="Delete tower"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                    <button 
                      class="expand-btn" 
                      aria-label={expandedTowerId === tower.eNodeB.toString() ? 'Collapse tower details' : 'Expand tower details'}
                      on:click|stopPropagation={() => toggleExpand(tower.eNodeB)}
                    >
                      <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        stroke-width="2"
                        class:rotated={expandedTowerId === tower.eNodeB.toString()}
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>
                  </div>
                </div>
                
                {#if expandedTowerId === tower.eNodeB.toString()}
                  <div class="tower-sectors">
                    <h4>Sectors ({tower.sectorCount}) - {tower.carrierCount} Total Carriers</h4>
                    <div class="sectors-grid">
                      {#each tower.sectors as sectorGroup}
                        <div class="sector-card">
                          <div class="sector-header">
                            <span class="sector-id">Sector {sectorGroup.sectorNumber}</span>
                            <span class="sector-pci">Azimuth: {sectorGroup.azimuth}°</span>
                          </div>
                          <div class="sector-details">
                            <div class="sector-row">
                              <span class="label">Carriers:</span>
                              <span class="value">{sectorGroup.carriers.length}</span>
                            </div>
                            <div class="sector-row">
                              <span class="label">PCIs:</span>
                              <span class="value">{sectorGroup.pcis.join(', ')}</span>
                            </div>
                            
                            <!-- List carriers -->
                            <div class="carriers-list">
                              <strong>RMOD Carriers:</strong>
                              {#each sectorGroup.carriers as carrier, idx}
                                <div class="carrier-row">
                                  <span class="carrier-label">C{idx + 1}:</span>
                                  <span class="carrier-data">PCI {carrier.pci}</span>
                                  <span class="carrier-data">EARFCN {carrier.dlEarfcn || carrier.earfcn}</span>
                                  <span class="carrier-data">{carrier.frequency} MHz</span>
                                </div>
                              {/each}
                            </div>
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Site Editor Modal -->
<SiteEditor 
  site={selectedSite}
  isOpen={showSiteEditor}
  isNewSite={isCreatingNewSite}
  on:save={handleSiteSave}
  on:close={() => { 
    showSiteEditor = false; 
    selectedSite = null; 
    isCreatingNewSite = false;
  }}
/>

<!-- Import Wizard Modal -->
<ImportWizard 
  show={showImportWizard}
  on:import={handleImport}
  on:close={() => showImportWizard = false}
/>

<style>
  .tower-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    animation: fadeIn 0.2s;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .tower-modal {
    background: var(--card-bg);
    border-radius: var(--border-radius-xl);
    width: 100%;
    max-width: 1200px;
    max-height: 90vh;
    box-shadow: var(--shadow-2xl);
    border: 1px solid var(--border-color);
    animation: slideUp 0.3s;
    display: flex;
    flex-direction: column;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .tower-header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--surface-secondary);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-title svg {
    color: var(--primary-color);
  }

  .header-title h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .network-badge {
    padding: 0.25rem 0.75rem;
    background: var(--primary-light);
    color: var(--primary-color);
    border-radius: var(--border-radius);
    font-size: 0.85rem;
    font-weight: 500;
  }

  .close-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: none;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 1.75rem;
    line-height: 1;
    cursor: pointer;
    transition: all var(--transition);
  }

  .close-btn:hover {
    background: var(--danger-light);
    color: var(--danger-color);
  }

  .tower-body {
    padding: 1.5rem 2rem;
    overflow-y: auto;
    flex: 1;
  }

  .actions-bar {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .search-box {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-box svg {
    position: absolute;
    left: 1rem;
    color: var(--text-tertiary);
  }

  .search-box input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 2.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.95rem;
    transition: all var(--transition);
  }

  .search-box input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--focus-ring);
  }

  .add-tower-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--border-radius);
    background: var(--primary-color);
    color: white;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all var(--transition);
    white-space: nowrap;
  }

  .add-tower-btn:hover {
    background: var(--button-primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .tower-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
    background: var(--surface-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    transition: all var(--transition);
  }

  .stat-card:hover {
    border-color: var(--primary-color);
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
  }

  .stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--primary-color);
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .tower-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
  }

  .empty-state svg {
    color: var(--text-tertiary);
    margin-bottom: 1.5rem;
  }

  .empty-state h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .empty-state p {
    margin: 0 0 2rem 0;
    color: var(--text-secondary);
  }

  .add-first-tower-btn {
    padding: 0.875rem 2rem;
    border: none;
    border-radius: var(--border-radius);
    background: var(--primary-color);
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition);
  }

  .add-first-tower-btn:hover {
    background: var(--button-primary-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .tower-card {
    background: var(--surface-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    transition: all var(--transition);
    overflow: hidden;
  }

  .tower-card:hover {
    border-color: var(--primary-color);
    box-shadow: var(--shadow-sm);
  }

  .tower-card.expanded {
    border-color: var(--primary-color);
  }

  .tower-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    cursor: pointer;
    transition: all var(--transition);
  }

  .tower-card-header:hover {
    background: var(--hover-bg);
  }

  .tower-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
  }

  .tower-icon {
    color: var(--primary-color);
    flex-shrink: 0;
  }

  .tower-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .tower-details h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .tower-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .meta-item svg {
    color: var(--text-tertiary);
  }

  .meta-divider {
    color: var(--border-color);
  }

  .coordinates {
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }

  .tower-frequencies {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .freq-badge {
    padding: 0.25rem 0.625rem;
    background: var(--primary-light);
    color: var(--primary-color);
    border-radius: var(--border-radius);
    font-size: 0.8rem;
    font-weight: 500;
  }

  .tower-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .action-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--card-bg);
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition);
  }

  .action-btn:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .edit-btn:hover {
    background: var(--primary-light);
    color: var(--primary-color);
    border-color: var(--primary-color);
  }

  .delete-btn:hover {
    background: var(--danger-light);
    color: var(--danger-color);
    border-color: var(--danger-color);
  }

  .expand-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--card-bg);
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition);
  }

  .expand-btn svg {
    transition: transform var(--transition);
  }

  .expand-btn svg.rotated {
    transform: rotate(180deg);
  }

  .tower-sectors {
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
    background: var(--bg-primary);
  }

  .tower-sectors h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .sectors-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .sector-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1rem;
    transition: all var(--transition);
  }

  .sector-card:hover {
    border-color: var(--primary-color);
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
  }

  .sector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  .sector-id {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  .sector-pci {
    padding: 0.25rem 0.5rem;
    background: var(--primary-light);
    color: var(--primary-color);
    border-radius: var(--border-radius);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .sector-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .sector-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
  }

  .sector-row .label {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .sector-row .value {
    color: var(--text-primary);
    font-weight: 600;
  }

  .carriers-list {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-color);
  }

  .carriers-list strong {
    font-size: 0.8rem;
    color: var(--text-secondary);
    display: block;
    margin-bottom: 0.5rem;
  }

  .carrier-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.375rem;
    background: var(--bg-secondary);
    border-radius: 4px;
    margin-bottom: 0.25rem;
    font-size: 0.8rem;
  }

  .carrier-label {
    font-weight: 700;
    color: var(--primary-color);
    min-width: 30px;
  }

  .carrier-data {
    color: var(--text-primary);
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: var(--card-bg);
    border-radius: 4px;
  }

  @media (max-width: 768px) {
    .tower-modal {
      max-width: 95%;
    }

    .actions-bar {
      flex-direction: column;
    }

    .tower-stats {
      grid-template-columns: repeat(2, 1fr);
    }

    .sectors-grid {
      grid-template-columns: 1fr;
    }

    .tower-meta {
      flex-direction: column;
      align-items: flex-start;
    }

    .meta-divider {
      display: none;
    }
  }
</style>

