<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Cell } from '$lib/pciMapper';
  
  export let cell: Cell | null = null;
  export let isOpen = false;
  export let isNewCell = false;
  export let initialLatitude: number | undefined = undefined;
  export let initialLongitude: number | undefined = undefined;
  
  const dispatch = createEventDispatcher();
  
  // Create a working copy of the cell data
  let editedCell: Cell;
  let additionalEarfcns: number[] = [];
  let newEarfcn = '';
  
  // Initialize cell data
  $: if (isOpen) {
    if (isNewCell) {
      // Create new cell with default values
      const nextCellNumber = Date.now().toString().slice(-6);
      editedCell = {
        id: `CELL${nextCellNumber}`,
        eNodeB: 1000,
        sector: 1,
        pci: 0,
        latitude: initialLatitude || 40.7128,
        longitude: initialLongitude || -74.0060,
        frequency: 2100,
        rsPower: -75,
        azimuth: 0,
        towerType: '3-sector',
        technology: 'LTE',
        earfcn: 1950,
        centerFreq: 2100,
        channelBandwidth: 20,
        dlEarfcn: 1950,
        ulEarfcn: 1850
      };
    } else if (cell) {
      editedCell = { ...cell };
    }
    additionalEarfcns = [];
    newEarfcn = '';
  }
  
  function handleClose() {
    dispatch('close');
  }
  
  function handleSave() {
    dispatch('save', editedCell);
    handleClose();
  }
  
  function addEarfcn() {
    const earfcn = parseInt(newEarfcn);
    if (!isNaN(earfcn) && earfcn > 0 && earfcn < 70000) {
      additionalEarfcns = [...additionalEarfcns, earfcn];
      newEarfcn = '';
    }
  }
  
  function removeEarfcn(index: number) {
    additionalEarfcns = additionalEarfcns.filter((_, i) => i !== index);
  }
  
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }
  
  // Frequency band helper
  function getFrequencyBand(earfcn: number): string {
    if (earfcn >= 0 && earfcn <= 599) return 'Band 1 (2100 MHz)';
    if (earfcn >= 600 && earfcn <= 1199) return 'Band 2 (1900 MHz)';
    if (earfcn >= 1200 && earfcn <= 1949) return 'Band 3 (1800 MHz)';
    if (earfcn >= 1950 && earfcn <= 2399) return 'Band 4 (AWS)';
    if (earfcn >= 2400 && earfcn <= 2649) return 'Band 5 (850 MHz)';
    if (earfcn >= 2650 && earfcn <= 2749) return 'Band 6 (800 MHz)';
    if (earfcn >= 2750 && earfcn <= 3449) return 'Band 7 (2600 MHz)';
    if (earfcn >= 3450 && earfcn <= 3799) return 'Band 8 (900 MHz)';
    if (earfcn >= 9210 && earfcn <= 9659) return 'Band 12 (700 MHz)';
    if (earfcn >= 9870 && earfcn <= 9919) return 'Band 13 (700 MHz)';
    if (earfcn >= 5180 && earfcn <= 5279) return 'Band 17 (700 MHz)';
    if (earfcn >= 5730 && earfcn <= 5849) return 'Band 25 (1900 MHz)';
    if (earfcn >= 5850 && earfcn <= 6449) return 'Band 26 (850 MHz)';
    if (earfcn >= 9040 && earfcn <= 9209) return 'Band 28 (700 MHz)';
    if (earfcn >= 9660 && earfcn <= 9769) return 'Band 29 (700 MHz)';
    if (earfcn >= 36000 && earfcn <= 36199) return 'Band 33 (TDD 1900)';
    if (earfcn >= 36200 && earfcn <= 36349) return 'Band 34 (TDD 2000)';
    if (earfcn >= 38650 && earfcn <= 39649) return 'Band 41 (TDD 2500)';
    if (earfcn >= 39650 && earfcn <= 41589) return 'Band 42 (TDD 3500)';
    if (earfcn >= 41590 && earfcn <= 43589) return 'Band 43 (TDD 3700)';
    if (earfcn >= 55240 && earfcn <= 56739) return 'Band 48 (CBRS 3550)';
    if (earfcn >= 66436 && earfcn <= 67335) return 'Band 66 (AWS-3)';
    if (earfcn >= 67336 && earfcn <= 67535) return 'Band 70 (AWS-4)';
    if (earfcn >= 68586 && earfcn <= 68935) return 'Band 71 (600 MHz)';
    return 'Unknown Band';
  }
</script>

{#if isOpen}
  <div class="modal-backdrop" on:click={handleBackdropClick}>
    <div class="cell-editor">
      <div class="editor-header">
        <h2>
          {#if isNewCell}
            ➕ Create New Cell
          {:else}
            📡 Edit Cell: {cell?.id || 'Unknown'}
          {/if}
        </h2>
        <button class="close-btn" on:click={handleClose}>×</button>
      </div>
      
      <div class="editor-content">
        <!-- Basic Info Section -->
        <section class="editor-section">
          <h3>Basic Information</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="cellId">Cell ID</label>
              <input 
                type="text" 
                id="cellId"
                bind:value={editedCell.id} 
                disabled={!isNewCell}
                placeholder="CELL001"
              />
            </div>
            
            <div class="form-group">
              <label for="eNodeB">eNodeB</label>
              <input 
                type="number" 
                id="eNodeB"
                bind:value={editedCell.eNodeB}
              />
            </div>
            
            <div class="form-group">
              <label for="sector">Sector</label>
              <input 
                type="number" 
                id="sector"
                bind:value={editedCell.sector}
                min="1"
                max="12"
              />
            </div>
            
            <div class="form-group">
              <label for="pci">PCI</label>
              <input 
                type="number" 
                id="pci"
                bind:value={editedCell.pci}
                min="0"
                max="503"
              />
            </div>
          </div>
        </section>
        
        <!-- Location Section -->
        <section class="editor-section">
          <h3>Location</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="latitude">Latitude</label>
              <input 
                type="number" 
                id="latitude"
                bind:value={editedCell.latitude}
                step="0.000001"
              />
            </div>
            
            <div class="form-group">
              <label for="longitude">Longitude</label>
              <input 
                type="number" 
                id="longitude"
                bind:value={editedCell.longitude}
                step="0.000001"
              />
            </div>
            
            <div class="form-group">
              <label for="azimuth">Azimuth (degrees)</label>
              <input 
                type="number" 
                id="azimuth"
                bind:value={editedCell.azimuth}
                min="0"
                max="359"
                placeholder="0-359"
              />
            </div>
            
            <div class="form-group">
              <label for="towerType">Tower Type</label>
              <select id="towerType" bind:value={editedCell.towerType}>
                <option value="3-sector">3-Sector</option>
                <option value="4-sector">4-Sector</option>
              </select>
            </div>
          </div>
        </section>
        
        <!-- RF Parameters Section -->
        <section class="editor-section">
          <h3>RF Parameters</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="dlEarfcn">DL EARFCN</label>
              <input 
                type="number" 
                id="dlEarfcn"
                bind:value={editedCell.dlEarfcn}
                min="0"
                max="70000"
              />
              <span class="helper-text">{getFrequencyBand(editedCell.dlEarfcn || 0)}</span>
            </div>
            
            <div class="form-group">
              <label for="ulEarfcn">UL EARFCN</label>
              <input 
                type="number" 
                id="ulEarfcn"
                bind:value={editedCell.ulEarfcn}
                min="0"
                max="70000"
              />
            </div>
            
            <div class="form-group">
              <label for="centerFreq">Center Frequency (MHz)</label>
              <input 
                type="number" 
                id="centerFreq"
                bind:value={editedCell.centerFreq}
                step="0.1"
              />
            </div>
            
            <div class="form-group">
              <label for="channelBandwidth">Channel Bandwidth (MHz)</label>
              <select id="channelBandwidth" bind:value={editedCell.channelBandwidth}>
                <option value={1.4}>1.4 MHz</option>
                <option value={3}>3 MHz</option>
                <option value={5}>5 MHz</option>
                <option value={10}>10 MHz</option>
                <option value={15}>15 MHz</option>
                <option value={20}>20 MHz</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="rsPower">RS Power (dBm)</label>
              <input 
                type="number" 
                id="rsPower"
                bind:value={editedCell.rsPower}
                step="0.1"
              />
            </div>
            
            <div class="form-group">
              <label for="technology">Technology</label>
              <select id="technology" bind:value={editedCell.technology}>
                <option value="LTE">LTE</option>
                <option value="CBRS">CBRS</option>
                <option value="5G">5G</option>
              </select>
            </div>
          </div>
        </section>
        
        <!-- Additional EARFCNs Section -->
        <section class="editor-section">
          <h3>Additional EARFCNs</h3>
          <p class="section-description">Add carrier aggregation or additional frequency channels</p>
          
          <div class="earfcn-list">
            {#each additionalEarfcns as earfcn, index}
              <div class="earfcn-item">
                <span class="earfcn-value">{earfcn}</span>
                <span class="earfcn-band">{getFrequencyBand(earfcn)}</span>
                <button 
                  type="button"
                  class="remove-earfcn-btn" 
                  on:click={() => removeEarfcn(index)}
                >
                  ×
                </button>
              </div>
            {/each}
          </div>
          
          <div class="add-earfcn-group">
            <input 
              type="number" 
              bind:value={newEarfcn}
              placeholder="Enter EARFCN (e.g., 1950)"
              on:keydown={(e) => e.key === 'Enter' && addEarfcn()}
            />
            <button 
              type="button"
              class="add-earfcn-btn" 
              on:click={addEarfcn}
              disabled={!newEarfcn}
            >
              + Add EARFCN
            </button>
          </div>
        </section>
      </div>
      
      <div class="editor-footer">
        <button class="cancel-btn" on:click={handleClose}>Cancel</button>
        <button class="save-btn" on:click={handleSave}>
          {#if isNewCell}
            ➕ Create Cell
          {:else}
            💾 Save Changes
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 2rem;
  }

  .cell-editor {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 800px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-color);
  }

  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .editor-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    transition: all var(--transition);
  }

  .close-btn:hover {
    background: var(--danger-light);
    color: var(--danger-color);
  }

  .editor-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .editor-section {
    margin-bottom: 2rem;
  }

  .editor-section:last-child {
    margin-bottom: 0;
  }

  .editor-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    border-bottom: 2px solid var(--primary-color);
    padding-bottom: 0.5rem;
  }

  .section-description {
    margin: -0.5rem 0 1rem 0;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .form-group input,
  .form-group select {
    padding: 0.625rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.95rem;
    transition: all var(--transition);
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--focus-ring);
  }

  .form-group input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: var(--bg-secondary);
  }

  .helper-text {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-style: italic;
  }

  .earfcn-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .earfcn-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--surface-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
  }

  .earfcn-value {
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 600;
    color: var(--primary-color);
    min-width: 80px;
  }

  .earfcn-band {
    flex: 1;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .remove-earfcn-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 50%;
    background: var(--danger-light);
    color: var(--danger-color);
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    transition: all var(--transition);
  }

  .remove-earfcn-btn:hover {
    background: var(--danger-color);
    color: white;
  }

  .add-earfcn-group {
    display: flex;
    gap: 0.5rem;
  }

  .add-earfcn-group input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.95rem;
  }

  .add-earfcn-group input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--focus-ring);
  }

  .add-earfcn-btn {
    padding: 0.75rem 1.25rem;
    border: none;
    border-radius: var(--border-radius);
    background: var(--primary-color);
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition);
    white-space: nowrap;
  }

  .add-earfcn-btn:hover:not(:disabled) {
    background: var(--button-primary-hover);
    box-shadow: var(--shadow-sm);
  }

  .add-earfcn-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .editor-footer {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
  }

  .cancel-btn,
  .save-btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--border-radius);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition);
  }

  .cancel-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .cancel-btn:hover {
    background: var(--hover-bg);
  }

  .save-btn {
    background: var(--primary-color);
    color: white;
  }

  .save-btn:hover {
    background: var(--button-primary-hover);
    box-shadow: var(--shadow-sm);
  }
</style>

