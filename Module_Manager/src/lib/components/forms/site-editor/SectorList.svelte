<script lang="ts">
  import type { Sector } from '$lib/models/cellSite';
  import { createEventDispatcher } from 'svelte';
  
  export let sectors: Sector[];
  export let selectedIndex: number | null = null;
  export let maxSectors = 4;
  
  const dispatch = createEventDispatcher();
  
  function handleAddSector() {
    if (sectors.length >= maxSectors) {
      alert(`Maximum ${maxSectors} sectors per tower. LTE towers typically use 3-sector (120°) or 4-sector (90°) configurations.`);
      return;
    }
    
    const sectorNumber = sectors.length + 1;
    let suggestedAzimuth = 0;
    
    if (sectors.length === 0) {
      suggestedAzimuth = 0; // North
    } else if (sectors.length === 1) {
      suggestedAzimuth = 120; // 3-sector config
    } else if (sectors.length === 2) {
      suggestedAzimuth = 240; // 3-sector config
    } else if (sectors.length === 3) {
      suggestedAzimuth = 90; // 4-sector config
    }
    
    const newSector: Sector = {
      id: `temp-sector-${sectorNumber}`,
      sectorNumber,
      azimuth: suggestedAzimuth,
      beamwidth: 65,
      antennaBeamwidth: 65,
      heightAGL: 100,
      rmodId: ((sectorNumber - 1) % 3) + 1,
      channels: [],
      rsPower: 46,
      technology: 'LTE',
      pci: 0,
      earfcn: 2525,
      bandwidth: 10,
      tac: 1,
      transmitPower: 46,
      eNodeBLocalID: sectorNumber - 1
    };
    
    dispatch('add', newSector);
  }
  
  function handleSelectSector(index: number) {
    dispatch('select', index);
  }
  
  function handleDeleteSector(index: number) {
    if (confirm(`Delete Sector ${index + 1}?`)) {
      dispatch('delete', index);
    }
  }
</script>

<div class="sector-list">
  <div class="sector-list-header">
    <h4>Sectors ({sectors.length}/{maxSectors})</h4>
    <button 
      class="btn-add-sector" 
      on:click={handleAddSector}
      disabled={sectors.length >= maxSectors}
    >
      + Add Sector
    </button>
  </div>
  
  {#if sectors.length === 0}
    <div class="empty-state">
      <p>No sectors configured. Add at least one sector to save the site.</p>
    </div>
  {:else}
    <div class="sectors">
      {#each sectors as sector, index}
        <div 
          class="sector-card" 
          class:selected={selectedIndex === index}
          on:click={() => handleSelectSector(index)}
          on:keydown={(e) => e.key === 'Enter' && handleSelectSector(index)}
        >
          <div class="sector-header">
            <span class="sector-number">Sector {index + 1}</span>
            <span class="sector-pci">PCI {sector.pci}</span>
          </div>
          <div class="sector-details">
            <div class="detail">
              <span class="label">Azimuth:</span>
              <span class="value">{sector.azimuth}°</span>
            </div>
            <div class="detail">
              <span class="label">Beamwidth:</span>
              <span class="value">{sector.antennaBeamwidth ?? sector.beamwidth}°</span>
            </div>
            <div class="detail">
              <span class="label">EARFCN:</span>
              <span class="value">{sector.earfcn}</span>
            </div>
            <div class="detail">
              <span class="label">BW:</span>
              <span class="value">{(sector.bandwidth ?? sector.channels?.[0]?.channelBandwidth) ?? 0} MHz</span>
            </div>
          </div>
          <button 
            class="btn-delete" 
            on:click|stopPropagation={() => handleDeleteSector(index)}
          >
            Delete
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sector-list {
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    padding: var(--spacing-md);
  }
  
  .sector-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }
  
  .sector-list-header h4 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1rem;
    font-weight: 600;
  }
  
  .btn-add-sector {
    padding: var(--spacing-xs) var(--spacing-md);
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--border-radius-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
    font-size: 0.875rem;
  }
  
  .btn-add-sector:hover:not(:disabled) {
    background: var(--primary-hover);
    transform: translateY(-1px);
  }
  
  .btn-add-sector:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .empty-state {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--text-muted);
  }
  
  .sectors {
    display: grid;
    gap: var(--spacing-sm);
  }
  
  .sector-card {
    background: var(--card-bg);
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    padding: var(--spacing-md);
    cursor: pointer;
    transition: var(--transition);
    position: relative;
  }
  
  .sector-card:hover {
    border-color: var(--primary-color);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
  
  .sector-card.selected {
    border-color: var(--primary-color);
    background: var(--primary-light);
  }
  
  .sector-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--spacing-sm);
  }
  
  .sector-number {
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .sector-pci {
    background: var(--primary-color);
    color: white;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
  }
  
  .sector-details {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-sm);
  }
  
  .detail {
    display: flex;
    gap: var(--spacing-xs);
  }
  
  .detail .label {
    color: var(--text-secondary);
    font-size: 0.75rem;
  }
  
  .detail .value {
    color: var(--text-primary);
    font-size: 0.75rem;
    font-weight: 500;
  }
  
  .btn-delete {
    position: absolute;
    top: var(--spacing-sm);
    right: var(--spacing-sm);
    background: var(--danger-color);
    color: white;
    border: none;
    border-radius: var(--border-radius-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: 0.75rem;
    cursor: pointer;
    transition: var(--transition);
  }
  
  .btn-delete:hover {
    background: #dc2626;
    transform: scale(1.05);
  }
</style>

