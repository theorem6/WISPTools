<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Cell } from '$lib/pciMapper';
  
  const dispatch = createEventDispatcher();
  
  let showImportModal = false;
  let importData = '';
  let csvFile: FileList | null = null;
  
  // Manual entry fields (simplified)
  let cellId = '';
  let sector = 1;
  let pci = '';
  let latitude = 0;
  let longitude = 0;
  let azimuth = 0;
  let altitude = 0;
  let earfcn = 1950; // Default to LTE Band 1
  
  let manualCells: Cell[] = [];
  
  function addManualCell() {
    if (!cellId || !latitude || !longitude || !earfcn) {
      alert('Please fill in Cell ID, Latitude, Longitude, and EARFCN');
      return;
    }
    
    // Derive frequency from EARFCN
    let frequency = 2100;
    if (earfcn >= 55240 && earfcn <= 56739) {
      frequency = 3550; // CBRS
    } else if (earfcn >= 0 && earfcn <= 599) {
      frequency = 2100; // Band 1
    } else if (earfcn >= 1200 && earfcn <= 1949) {
      frequency = 1800; // Band 3
    } else if (earfcn >= 2750 && earfcn <= 3449) {
      frequency = 2600; // Band 7
    }
    
    const newCell: Cell = {
      id: cellId,
      eNodeB: parseInt(cellId.replace(/[^0-9]/g, '')) || 0,
      sector: sector,
      pci: pci ? parseInt(pci) : -1,
      latitude: latitude,
      longitude: longitude,
      frequency: frequency,
      rsPower: -85, // Default value
      azimuth: azimuth || undefined,
      heightAGL: altitude || undefined,
      technology: frequency === 3550 ? 'CBRS' : 'LTE',
      earfcn: earfcn,
      centerFreq: frequency,
      channelBandwidth: 20,
      dlEarfcn: earfcn,
      ulEarfcn: earfcn
    };
    
    manualCells = [...manualCells, newCell];
    
    // Reset form
    cellId = '';
    sector = 1;
    pci = '';
    latitude = 0;
    longitude = 0;
    azimuth = 0;
    altitude = 0;
    earfcn = 1950;
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
        // Simplified CSV: Cell ID, Sector, Azimuth, Altitude, PCI, EARFCN, Latitude, Longitude
        if (parts.length >= 6) {
          const cellId = parts[0].trim();
          const sector = parts[1].trim() ? parseInt(parts[1].trim()) : 1;
          const azimuth = parts[2].trim() ? parseInt(parts[2].trim()) : undefined;
          const altitude = parts[3].trim() ? parseInt(parts[3].trim()) : undefined;
          const pci = parts[4].trim() ? parseInt(parts[4].trim()) : -1;
          const earfcn = parts[5].trim() ? parseInt(parts[5].trim()) : undefined;
          const latitude = parts.length > 6 && parts[6].trim() ? parseFloat(parts[6].trim()) : 0;
          const longitude = parts.length > 7 && parts[7].trim() ? parseFloat(parts[7].trim()) : 0;
          
          // Derive frequency from EARFCN if provided, otherwise default to 2100
          let frequency = 2100;
          if (earfcn) {
            if (earfcn >= 55240 && earfcn <= 56739) {
              frequency = 3550; // CBRS
            } else if (earfcn >= 0 && earfcn <= 599) {
              frequency = 2100; // Band 1
            } else if (earfcn >= 1200 && earfcn <= 1949) {
              frequency = 1800; // Band 3
            } else if (earfcn >= 2750 && earfcn <= 3449) {
              frequency = 2600; // Band 7
            }
          }
          
          imported.push({
            id: cellId,
            eNodeB: parseInt(cellId.replace(/[^0-9]/g, '')) || 0, // Extract numbers from cell ID for eNodeB
            sector: sector,
            pci: pci,
            latitude: latitude,
            longitude: longitude,
            frequency: frequency,
            rsPower: -85, // Default value
            azimuth: azimuth,
            heightAGL: altitude,
            technology: frequency === 3550 ? 'CBRS' : 'LTE',
            earfcn: earfcn,
            centerFreq: frequency,
            channelBandwidth: 20,
            dlEarfcn: earfcn,
            ulEarfcn: earfcn
          });
        }
      }
      
      if (imported.length > 0) {
        manualCells = [...manualCells, ...imported];
        alert(`Imported ${imported.length} cell(s) successfully`);
      } else {
        alert('No valid cells found in CSV. Please check the format.');
      }
    };
    
    reader.readAsText(file);
  }
  
  function downloadCSVTemplate() {
    const template = `Cell ID,Sector,Azimuth,Altitude,PCI,EARFCN,Latitude,Longitude
CELL001,1,0,100,15,1950,40.7128,-74.0060
CELL002,2,120,100,,1950,40.7128,-74.0060
CELL003,3,240,100,21,1950,40.7128,-74.0060
CELL004,1,0,120,,1950,40.7689,-73.9667
CELL005,2,120,120,,1950,40.7689,-73.9667
CELL006,3,240,120,,1950,40.7689,-73.9667
CELL007,1,0,150,,55650,40.7589,-73.9851
CELL008,2,90,150,,55650,40.7589,-73.9851
CELL009,3,180,150,,55650,40.7589,-73.9851
CELL010,4,270,150,,55650,40.7589,-73.9851`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pci-import-template-simplified.csv';
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
          <p class="help-text">Upload a simplified CSV with just the essentials: Cell ID, Sector, Azimuth, Altitude, PCI, EARFCN, Latitude, Longitude.</p>
          <p class="help-text"><strong>Note:</strong> Leave PCI blank for auto-assignment. Frequency is automatically derived from EARFCN.</p>
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
          <h3>✏️ Manual Entry (Simplified)</h3>
          <p class="help-text">Enter only essential fields: Cell ID, Sector, Azimuth, Altitude, PCI, EARFCN, Lat/Lng. Frequency and RS Power are auto-derived.</p>
          <div class="form-grid">
            <div class="form-group">
              <label>Cell ID *</label>
              <input type="text" bind:value={cellId} placeholder="CELL001" />
            </div>
            
            <div class="form-group">
              <label>Sector</label>
              <input type="number" bind:value={sector} min="1" max="4" />
              <small class="help-text">Sector number (1-4)</small>
            </div>
            
            <div class="form-group">
              <label>Azimuth (degrees)</label>
              <input type="number" min="0" max="359" bind:value={azimuth} placeholder="0" />
              <small class="help-text">0=auto-calculate from sector. 3-sector: 0°/120°/240°, 4-sector: 0°/90°/180°/270°</small>
            </div>
            
            <div class="form-group">
              <label>Altitude (feet)</label>
              <input type="number" bind:value={altitude} placeholder="100" />
              <small class="help-text">Height above ground for line-of-sight calculations</small>
            </div>
            
            <div class="form-group">
              <label>PCI (leave blank for auto-assign)</label>
              <input type="text" bind:value={pci} placeholder="Auto" />
              <small class="help-text">Physical Cell ID (0-503)</small>
            </div>
            
            <div class="form-group">
              <label>EARFCN *</label>
              <input type="number" bind:value={earfcn} placeholder="1950" />
              <small class="help-text">Frequency channel. 1950=Band1(2100MHz), 55650=CBRS(3550MHz). Frequency/RS Power auto-derived.</small>
            </div>
            
            <div class="form-group">
              <label>Latitude *</label>
              <input type="number" step="0.000001" bind:value={latitude} placeholder="40.7128" />
            </div>
            
            <div class="form-group">
              <label>Longitude *</label>
              <input type="number" step="0.000001" bind:value={longitude} placeholder="-74.0060" />
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
