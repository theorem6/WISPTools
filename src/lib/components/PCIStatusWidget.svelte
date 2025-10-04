<script lang="ts">
  import { 
    cellsStore,
    conflictsStore,
    cellCount,
    conflictCount
  } from '$lib/stores/appState';
  import type { Cell, PCIConflict } from '$lib/pciMapper';
  
  interface PCIStatus {
    pci: number;
    status: 'available' | 'in-use' | 'conflict';
    conflictLevel?: 'critical' | 'high' | 'medium' | 'low';
    cells: Cell[];
  }
  
  let searchFilter = '';
  let statusFilter: 'all' | 'available' | 'in-use' | 'conflict' = 'all';
  let isExpanded = false;
  
  // Build PCI status map in real-time
  $: pciStatusMap = buildPCIStatusMap($cellsStore.items, $conflictsStore.items);
  $: filteredPCIs = filterPCIs(pciStatusMap, searchFilter, statusFilter);
  $: usedPCICount = Object.values(pciStatusMap).filter(p => p.status !== 'available').length;
  $: availablePCICount = 504 - usedPCICount;
  
  function buildPCIStatusMap(cells: Cell[], conflicts: PCIConflict[]): Record<number, PCIStatus> {
    const map: Record<number, PCIStatus> = {};
    
    // Initialize all PCIs as available
    for (let i = 0; i < 504; i++) {
      map[i] = {
        pci: i,
        status: 'available',
        cells: []
      };
    }
    
    // Mark used PCIs
    cells.forEach(cell => {
      if (cell.pci !== undefined && cell.pci >= 0 && cell.pci < 504) {
        map[cell.pci].status = 'in-use';
        map[cell.pci].cells.push(cell);
      }
    });
    
    // Mark conflict PCIs
    conflicts.forEach(conflict => {
      if (conflict.pci >= 0 && conflict.pci < 504) {
        map[conflict.pci].status = 'conflict';
        map[conflict.pci].conflictLevel = conflict.severity;
      }
    });
    
    return map;
  }
  
  function filterPCIs(map: Record<number, PCIStatus>, search: string, status: string): PCIStatus[] {
    let pcis = Object.values(map);
    
    // Filter by status
    if (status !== 'all') {
      pcis = pcis.filter(p => p.status === status);
    }
    
    // Filter by search
    if (search) {
      const searchNum = parseInt(search);
      if (!isNaN(searchNum)) {
        pcis = pcis.filter(p => p.pci.toString().includes(search));
      }
    }
    
    return pcis.sort((a, b) => a.pci - b.pci);
  }
  
  function getStatusColor(status: PCIStatus): string {
    if (status.status === 'available') return 'var(--text-muted)';
    if (status.status === 'in-use') return 'var(--success-color)';
    if (status.status === 'conflict') {
      switch (status.conflictLevel) {
        case 'critical': return 'var(--danger-color)';
        case 'high': return 'var(--warning-color)';
        case 'medium': return 'var(--info-color)';
        case 'low': return 'var(--text-secondary)';
        default: return 'var(--warning-color)';
      }
    }
    return 'var(--text-primary)';
  }
</script>

<div class="pci-status-widget" class:expanded={isExpanded}>
  <div class="status-header">
    <h2 class="status-title">PCI Status</h2>
    <button class="expand-btn" on:click={() => isExpanded = !isExpanded} title={isExpanded ? 'Collapse' : 'Expand'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        {#if isExpanded}
          <polyline points="18 15 12 9 6 15"></polyline>
        {:else}
          <polyline points="6 9 12 15 18 9"></polyline>
        {/if}
      </svg>
    </button>
  </div>
  
  <div class="status-summary">
    <div class="summary-item">
      <span class="summary-value">{usedPCICount}</span>
      <span class="summary-label">In Use</span>
    </div>
    <div class="summary-item">
      <span class="summary-value" style="color: var(--danger-color)">{$conflictCount}</span>
      <span class="summary-label">Conflicts</span>
    </div>
    <div class="summary-item">
      <span class="summary-value" style="color: var(--success-color)">{availablePCICount}</span>
      <span class="summary-label">Available</span>
    </div>
  </div>
  
  {#if isExpanded}
    <div class="pci-details">
      <div class="filters">
        <input 
          type="text" 
          class="search-input" 
          bind:value={searchFilter}
          placeholder="Search PCI..."
        />
        <select class="status-filter" bind:value={statusFilter}>
          <option value="all">All ({504})</option>
          <option value="in-use">In Use ({usedPCICount})</option>
          <option value="conflict">Conflicts ({$conflictCount})</option>
          <option value="available">Available ({availablePCICount})</option>
        </select>
      </div>
      
      <div class="pci-list">
        {#each filteredPCIs as pciStatus (pciStatus.pci)}
          <div class="pci-item" style="border-left: 3px solid {getStatusColor(pciStatus)}">
            <div class="pci-number">{pciStatus.pci}</div>
            <div class="pci-status-badge" style="background: {getStatusColor(pciStatus)}">
              {#if pciStatus.status === 'available'}
                <span>Available</span>
              {:else if pciStatus.status === 'in-use'}
                <span>{pciStatus.cells.length} Cell{pciStatus.cells.length > 1 ? 's' : ''}</span>
              {:else if pciStatus.status === 'conflict'}
                <span>{pciStatus.conflictLevel?.toUpperCase()}</span>
              {/if}
            </div>
          </div>
        {/each}
        
        {#if filteredPCIs.length === 0}
          <div class="empty-message">No PCIs match your filter</div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .pci-status-widget {
    position: fixed;
    top: 20px;
    right: 40px;
    z-index: 200;
    background: var(--card-bg);
    backdrop-filter: blur(16px);
    border-radius: 12px;
    padding: 1rem;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-color);
    min-width: 240px;
    max-width: 400px;
    transition: all 0.3s ease;
  }

  .pci-status-widget.expanded {
    max-height: calc(100vh - 40px);
    overflow-y: auto;
  }

  .status-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  .status-title {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .expand-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
  }

  .expand-btn:hover {
    background: var(--hover-bg);
    color: var(--primary-color);
  }

  .status-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .summary-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .summary-value {
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1;
    color: var(--text-primary);
  }

  .summary-label {
    font-size: 0.65rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .pci-details {
    border-top: 1px solid var(--border-color);
    padding-top: 0.75rem;
  }

  .filters {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .search-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px var(--primary-light);
  }

  .status-filter {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.875rem;
    cursor: pointer;
  }

  .status-filter:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  .pci-list {
    max-height: 400px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .pci-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: var(--bg-secondary);
    border-radius: 6px;
    border: 1px solid var(--border-color);
    transition: all 0.2s;
  }

  .pci-item:hover {
    background: var(--hover-bg);
    transform: translateX(-2px);
  }

  .pci-number {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-primary);
    font-family: 'Courier New', monospace;
  }

  .pci-status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 600;
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .empty-message {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  @media (max-width: 768px) {
    .pci-status-widget {
      top: 20px;
      right: 10px;
      min-width: 200px;
      max-width: 300px;
      padding: 0.75rem;
    }

    .status-title {
      font-size: 0.75rem;
    }

    .summary-value {
      font-size: 1rem;
    }

    .summary-label {
      font-size: 0.6rem;
    }

    .pci-list {
      max-height: 300px;
    }
  }
</style>

