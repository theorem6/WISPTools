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
      rsPower: rsPower
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
            rsPower: parseFloat(parts[7].trim())
          });
        }
      }
      
      manualCells = [...manualCells, ...imported];
    };
    
    reader.readAsText(file);
  }
  
  function downloadCSVTemplate() {
    const template = `Cell ID,eNodeB,Sector,PCI,Latitude,Longitude,Frequency,RS Power
CELL001,1001,1,15,40.7128,-74.0060,2100,-85
CELL002,1002,2,,40.7689,-73.9667,2100,-87
CELL003,1003,3,21,40.7589,-73.9851,1800,-83`;
    
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
  📥 Manual Import
</button>

{#if showImportModal}
  <div class="modal-overlay" on:click={() => showImportModal = false}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Import Towers, Cells & Transmitters</h2>
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
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
  }
  
  .import-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
  }
  
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }
  
  .modal-content {
    background: var(--card-bg);
    border-radius: 12px;
    max-width: 800px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-color);
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
  
  .form-group input:focus {
    outline: 2px solid var(--primary-color);
    outline-offset: 0;
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
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
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
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
  }
  
  .import-action-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
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
