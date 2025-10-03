<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Cell } from '$lib/pciMapper';
  
  const dispatch = createEventDispatcher();
  
  let showImportModal = false;
  let importData = '';
  let csvFile: FileList | null = null;
  
  // Manual entry fields
  let cellId = '';
  let eNodeB = 0;
  let sector = 1;
  let pci = '';
  let latitude = 0;
  let longitude = 0;
  let frequency = 2100;
  let rsPower = -85;
  let azimuth = 0;
  let towerType: '3-sector' | '4-sector' = '3-sector';
  let technology: 'LTE' | 'CBRS' | 'LTE+CBRS' = 'LTE';
  
  // LTE Frequency Parameters
  let earfcn = 0;
  let channelBandwidth: 1.4 | 3 | 5 | 10 | 15 | 20 = 20;
  let dlEarfcn = 0;
  let ulEarfcn = 0;
  
  let manualCells: Cell[] = [];
  
  function addManualCell() {
    if (!cellId || !latitude || !longitude) {
      alert('Please fill in Cell ID, Latitude, and Longitude');
      return;
    }
    
    const newCell: Cell = {
      id: cellId,
      eNodeB: eNodeB,
      sector: sector,
      pci: pci ? parseInt(pci) : -1, // -1 means PCI needs to be assigned
      latitude: latitude,
      longitude: longitude,
      frequency: frequency,
      rsPower: rsPower,
      azimuth: azimuth || undefined, // Allow undefined for auto-calculate
      towerType: towerType,
      technology: technology,
      earfcn: earfcn || undefined,
      centerFreq: frequency, // Use frequency as center frequency
      channelBandwidth: channelBandwidth,
      dlEarfcn: dlEarfcn || undefined,
      ulEarfcn: ulEarfcn || undefined
    };
    
    manualCells = [...manualCells, newCell];
    
    // Reset form
    cellId = '';
    eNodeB = 0;
    sector = 1;
    pci = '';
    latitude = 0;
    longitude = 0;
    frequency = 2100;
    rsPower = -85;
    azimuth = 0;
    earfcn = 0;
    dlEarfcn = 0;
    ulEarfcn = 0;
    // Keep towerType, technology, and channelBandwidth as they're likely the same for batch entry
  }
  
  function removeCell(index: number) {
    manualCells = manualCells.filter((_, i) => i !== index);
  }
  
  function importCells() {
    if (manualCells.length === 0) {
      alert('No cells to import');
      return;
    }
    
    dispatch('import', { cells: manualCells });
    manualCells = [];
    showImportModal = false;
  }
  
  function handleCSVUpload() {
    if (!csvFile || csvFile.length === 0) return;
    
    const file = csvFile[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const imported: Cell[] = [];
      
      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',');
        if (parts.length >= 8) {
          imported.push({
            id: parts[0].trim(),
            eNodeB: parseInt(parts[1].trim()),
            sector: parseInt(parts[2].trim()),
            pci: parts[3].trim() ? parseInt(parts[3].trim()) : -1,
            latitude: parseFloat(parts[4].trim()),
            longitude: parseFloat(parts[5].trim()),
            frequency: parseInt(parts[6].trim()),
            rsPower: parseFloat(parts[7].trim()),
            azimuth: parts[8] && parts[8].trim() ? parseInt(parts[8].trim()) : undefined,
            towerType: parts[9] ? parts[9].trim() as '3-sector' | '4-sector' : '3-sector',
            technology: parts[10] ? parts[10].trim() as 'LTE' | 'CBRS' | 'LTE+CBRS' : 'LTE',
            earfcn: parts[11] && parts[11].trim() ? parseInt(parts[11].trim()) : undefined,
            channelBandwidth: parts[12] && parts[12].trim() ? parseFloat(parts[12].trim()) as 1.4 | 3 | 5 | 10 | 15 | 20 : 20,
            dlEarfcn: parts[13] && parts[13].trim() ? parseInt(parts[13].trim()) : undefined,
            ulEarfcn: parts[14] && parts[14].trim() ? parseInt(parts[14].trim()) : undefined
          });
        }
      }
      
      manualCells = [...manualCells, ...imported];
    };
    
    reader.readAsText(file);
  }
  
  function downloadCSVTemplate() {
    const template = `Cell ID,eNodeB,Sector,PCI,Latitude,Longitude,Frequency,RS Power,Azimuth,Tower Type,Technology,EARFCN,Channel Bandwidth,DL EARFCN,UL EARFCN
CELL001,1001,1,15,40.7128,-74.0060,2100,-85,0,3-sector,LTE,1950,20,1950,1850
CELL002,1001,2,,40.7128,-74.0060,2100,-87,120,3-sector,LTE,1950,20,1950,1850
CELL003,1001,3,21,40.7128,-74.0060,2100,-83,240,3-sector,LTE,1950,20,1950,1850
CELL004,1002,1,,40.7689,-73.9667,2100,-89,0,3-sector,LTE,1950,20,1950,1850
CELL005,1002,2,,40.7689,-73.9667,2100,-86,120,3-sector,LTE,1950,20,1950,1850
CELL006,1002,3,,40.7689,-73.9667,2100,-88,240,3-sector,LTE,1950,20,1950,1850
CELL007,1003,1,,40.7589,-73.9851,3550,-85,0,4-sector,CBRS,55650,20,55650,55650
CELL008,1003,2,,40.7589,-73.9851,3550,-87,90,4-sector,CBRS,55650,20,55650,55650
CELL009,1003,3,,40.7589,-73.9851,3550,-83,180,4-sector,CBRS,55650,20,55650,55650
CELL010,1003,4,,40.7589,-73.9851,3550,-89,270,4-sector,CBRS,55650,20,55650,55650`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pci-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<button 
  class="import-button" 
  on:click={() => showImportModal = true}
>
  📥 Manual Import / CSV
</button>

{#if showImportModal}
  <div 
    class="modal-overlay" 
    role="presentation"
    on:click={() => showImportModal = false}
    on:keydown={(e) => e.key === 'Escape' && (showImportModal = false)}
  >
    <div 
      class="modal-content" 
      role="dialog"
      aria-labelledby="manual-import-modal-title"
      on:click|stopPropagation
      on:keydown|stopPropagation
    >
      <div class="modal-header">
        <h2 id="manual-import-modal-title">Import Towers, Cells & Transmitters</h2>
        <button class="close-button" on:click={() => showImportModal = false}>×</button>
      </div>
      
      <div class="modal-body">
        <!-- CSV Import -->
        <div class="import-section">
          <h3>📄 CSV Import</h3>
          <p class="help-text">Upload a CSV file with tower/cell data. Leave PCI blank for auto-assignment.</p>
          <div class="file-upload">
            <input 
              type="file" 
              accept=".csv" 
              bind:files={csvFile}
              on:change={handleCSVUpload}
            />
            <button class="template-button" on:click={downloadCSVTemplate}>
              Download CSV Template
            </button>
          </div>
        </div>
        
        <div class="divider">OR</div>
        
        <!-- Manual Entry -->
        <div class="import-section">
          <h3>✏️ Manual Entry</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Cell ID *</label>
              <input type="text" bind:value={cellId} placeholder="CELL001" />
            </div>
            
            <div class="form-group">
              <label>eNodeB</label>
              <input type="number" bind:value={eNodeB} placeholder="1001" />
            </div>
            
            <div class="form-group">
              <label>Sector</label>
              <input type="number" bind:value={sector} min="1" max="3" />
            </div>
            
            <div class="form-group">
              <label>PCI (leave blank for auto-assign)</label>
              <input type="text" bind:value={pci} placeholder="Auto" />
            </div>
            
            <div class="form-group">
              <label>Latitude *</label>
              <input type="number" step="0.000001" bind:value={latitude} placeholder="40.7128" />
            </div>
            
            <div class="form-group">
              <label>Longitude *</label>
              <input type="number" step="0.000001" bind:value={longitude} placeholder="-74.0060" />
            </div>
            
            <div class="form-group">
              <label>Frequency (MHz)</label>
              <input type="number" bind:value={frequency} placeholder="2100" />
            </div>
            
            <div class="form-group">
              <label>RS Power (dBm)</label>
              <input type="number" bind:value={rsPower} placeholder="-85" />
            </div>
            
            <div class="form-group">
              <label>Azimuth (degrees) - Leave blank for auto-calculate</label>
              <input type="number" min="0" max="359" bind:value={azimuth} placeholder="Auto-calculate" />
              <small class="help-text">
                {#if towerType === '3-sector'}
                  Auto: 0°, 120°, 240° (based on sector 1,2,3)
                {:else}
                  Auto: 0°, 90°, 180°, 270° (based on sector 1,2,3,4)
                {/if}
              </small>
            </div>
            
            <div class="form-group">
              <label>Tower Type</label>
              <select bind:value={towerType}>
                <option value="3-sector">3-Sector (120° LTE)</option>
                <option value="4-sector">4-Sector (90° CBRS)</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Technology</label>
              <select bind:value={technology}>
                <option value="LTE">LTE</option>
                <option value="CBRS">CBRS</option>
                <option value="LTE+CBRS">LTE+CBRS</option>
              </select>
            </div>
            
            <!-- LTE Frequency Parameters -->
            <h4>LTE Frequency Parameters</h4>
            <div class="form-group">
              <label>EARFCN (Primary)</label>
              <input type="number" bind:value={earfcn} placeholder="e.g., 1950" />
              <small class="help-text">E-UTRA Absolute Radio Frequency Channel Number</small>
            </div>
            
            <div class="form-group">
              <label>Channel Bandwidth (MHz)</label>
              <select bind:value={channelBandwidth}>
                <option value={1.4}>1.4 MHz</option>
                <option value={3}>3 MHz</option>
                <option value={5}>5 MHz</option>
                <option value={10}>10 MHz</option>
                <option value={15}>15 MHz</option>
                <option value={20}>20 MHz</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>DL EARFCN (Optional)</label>
              <input type="number" bind:value={dlEarfcn} placeholder="Downlink EARFCN" />
              <small class="help-text">Leave blank to use primary EARFCN</small>
            </div>
            
            <div class="form-group">
              <label>UL EARFCN (Optional)</label>
              <input type="number" bind:value={ulEarfcn} placeholder="Uplink EARFCN" />
              <small class="help-text">Leave blank to use primary EARFCN</small>
            </div>
          </div>
          
          <button class="add-button" on:click={addManualCell}>
            ➕ Add Cell
          </button>
        </div>
        
        <!-- Cell List -->
        {#if manualCells.length > 0}
          <div class="cell-list">
            <h3>📋 Cells to Import ({manualCells.length})</h3>
            <div class="cell-table">
              {#each manualCells as cell, i}
                <div class="cell-row">
                  <span class="cell-id">{cell.id}</span>
                  <span class="cell-info">
                    eNB: {cell.eNodeB}, Sector: {cell.sector}, 
                    PCI: {cell.pci === -1 ? 'Auto' : cell.pci}
                  </span>
                  <span class="cell-location">
                    {cell.latitude.toFixed(4)}, {cell.longitude.toFixed(4)}
                  </span>
                  <button class="remove-button" on:click={() => removeCell(i)}>
                    🗑️
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      
      <div class="modal-footer">
        <button class="cancel-button" on:click={() => showImportModal = false}>
          Cancel
        </button>
        <button 
          class="import-action-button" 
          on:click={importCells}
          disabled={manualCells.length === 0}
        >
          Import {manualCells.length} Cell{manualCells.length !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .import-button {
    width: 100%;
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--gradient-success);
    color: var(--text-inverse);
    border: none;
    border-radius: var(--border-radius);
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    transition: var(--transition);
    box-shadow: var(--shadow-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
  }
  
  .import-button:hover {
    background: var(--success-color);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }
  
  .modal-content {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    max-width: 900px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: var(--shadow-xl);
    border: 1px solid var(--border-color);
    backdrop-filter: blur(8px);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.5rem;
  }
  
  .close-button {
    background: none;
    border: none;
    font-size: 2rem;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s ease;
  }
  
  .close-button:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }
  
  .modal-body {
    padding: 1.5rem;
  }
  
  .import-section {
    margin-bottom: 2rem;
  }
  
  .import-section h3 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
    font-size: 1.1rem;
  }
  
  .help-text {
    margin: 0 0 1rem 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  
  .file-upload {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .template-button {
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s ease;
  }
  
  .template-button:hover {
    background: var(--hover-bg);
  }
  
  .divider {
    text-align: center;
    color: var(--text-secondary);
    margin: 2rem 0;
    font-weight: 500;
  }
  
  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
  }
  
  .form-group label {
    margin-bottom: 0.25rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-weight: 500;
  }
  
  .form-group input {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.9rem;
  }
  
  .form-group input:focus,
  .form-group select:focus {
    outline: 2px solid var(--primary-color);
    outline-offset: 0;
  }
  
  .form-group select {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.9rem;
    cursor: pointer;
  }
  
  .help-text {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-style: italic;
  }
  
  .add-button {
    width: 100%;
    padding: 0.75rem;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
  }
  
  .add-button:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  
  .cell-list {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
  
  .cell-list h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1.1rem;
  }
  
  .cell-table {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: 6px;
  }
  
  .cell-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }
  
  .cell-row:last-child {
    border-bottom: none;
  }
  
  .cell-id {
    font-weight: 600;
    color: var(--text-primary);
    min-width: 80px;
  }
  
  .cell-info {
    flex: 1;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }
  
  .cell-location {
    color: var(--text-secondary);
    font-size: 0.85rem;
    margin-right: 0.5rem;
  }
  
  .remove-button {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0.25rem;
    transition: transform 0.2s ease;
  }
  
  .remove-button:hover {
    transform: scale(1.2);
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
  
  .cancel-button {
    padding: 0.75rem 1.5rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
  }
  
  .cancel-button:hover {
    background: var(--hover-bg);
  }
  
  .import-action-button {
    padding: var(--spacing-md) var(--spacing-xl);
    background: var(--gradient-success);
    color: var(--text-inverse);
    border: none;
    border-radius: var(--border-radius);
    cursor: pointer;
    font-weight: 600;
    transition: var(--transition);
    box-shadow: var(--shadow-sm);
  }
  
  .import-action-button:hover:not(:disabled) {
    background: var(--success-color);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  
  .import-action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
    
    .modal-content {
      width: 95%;
      max-height: 95vh;
    }
  }
</style>
