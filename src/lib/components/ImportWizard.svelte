<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Cell } from '../pciMapper';
  
  export let show = false;
  
  const dispatch = createEventDispatcher();
  
  let importMethod: 'csv' | 'kml' | 'manual' | null = null;
  let csvFile: FileList | null = null;
  let kmlFile: FileList | null = null;
  
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
  let channelBandwidth: 1.4 | 3 | 5 | 10 | 15 | 20 = 20;
  let earfcn = 0;
  let dlEarfcn = 0;
  let ulEarfcn = 0;
  
  let manualCells: Cell[] = [];
  
  function handleClose() {
    importMethod = null;
    manualCells = [];
    dispatch('close');
  }
  
  function selectMethod(method: 'csv' | 'kml' | 'manual') {
    importMethod = method;
  }
  
  function goBack() {
    importMethod = null;
    manualCells = [];
  }
  
  function handleCSVUpload() {
    if (!csvFile || csvFile.length === 0) return;
    
    const file = csvFile[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const imported: Cell[] = [];
      
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
      
      dispatch('import', { cells: imported });
      handleClose();
    };
    
    reader.readAsText(file);
  }
  
  function downloadCSVTemplate() {
    const template = `Cell ID,eNodeB,Sector,PCI,Latitude,Longitude,Frequency,RS Power,Azimuth,Tower Type,Technology,EARFCN,Channel Bandwidth,DL EARFCN,UL EARFCN
CELL001,1001,1,15,40.7128,-74.0060,2100,-85,0,3-sector,LTE,1950,20,1950,1850
CELL002,1001,2,,40.7128,-74.0060,2100,-87,120,3-sector,LTE,1950,20,1950,1850`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pci-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  
  function addManualCell() {
    if (!cellId || !latitude || !longitude) {
      alert('Please fill in Cell ID, Latitude, and Longitude');
      return;
    }
    
    const newCell: Cell = {
      id: cellId,
      eNodeB: eNodeB,
      sector: sector,
      pci: pci ? parseInt(pci) : -1,
      latitude: latitude,
      longitude: longitude,
      frequency: frequency,
      rsPower: rsPower,
      azimuth: azimuth || undefined,
      towerType: towerType,
      technology: technology,
      earfcn: earfcn || undefined,
      centerFreq: frequency,
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
  }
  
  function removeCell(index: number) {
    manualCells = manualCells.filter((_, i) => i !== index);
  }
  
  function importManualCells() {
    if (manualCells.length === 0) {
      alert('No cells to import');
      return;
    }
    
    dispatch('import', { cells: manualCells });
    handleClose();
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="wizard-overlay" on:click={handleClose}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="wizard-modal" on:click|stopPropagation>
      <div class="wizard-header">
        <h2>Import Data</h2>
        <button class="close-btn" on:click={handleClose}>×</button>
      </div>
      
      <div class="wizard-body">
        {#if !importMethod}
          <!-- Step 1: Choose Import Method -->
          <div class="wizard-intro">
            <p class="intro-text">Choose how you'd like to import cell data:</p>
          </div>
          
          <div class="method-grid">
            <button class="method-card" on:click={() => selectMethod('csv')}>
              <div class="method-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="12" y1="18" x2="12" y2="12"></line>
                  <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
              </div>
              <h3>CSV File</h3>
              <p>Upload a CSV file with cell tower data</p>
            </button>
            
            <button class="method-card" on:click={() => selectMethod('kml')}>
              <div class="method-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </div>
              <h3>KML File</h3>
              <p>Import from Google Earth or GIS software</p>
            </button>
            
            <button class="method-card" on:click={() => selectMethod('manual')}>
              <div class="method-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </div>
              <h3>Manual Entry</h3>
              <p>Add cell data manually one by one</p>
            </button>
          </div>
        {:else if importMethod === 'csv'}
          <!-- Step 2: CSV Import -->
          <div class="import-content">
            <button class="back-btn" on:click={goBack}>← Back</button>
            
            <h3>📄 CSV Import</h3>
            <p class="help-text">Upload a CSV file with tower/cell data. Leave PCI blank for auto-assignment.</p>
            
            <div class="file-upload-zone">
              <input 
                type="file" 
                accept=".csv" 
                bind:files={csvFile}
                on:change={handleCSVUpload}
                id="csv-upload"
              />
              <label for="csv-upload" class="upload-label">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <span>Choose CSV file or drag & drop</span>
              </label>
            </div>
            
            <button class="template-btn" on:click={downloadCSVTemplate}>
              📥 Download CSV Template
            </button>
          </div>
        {:else if importMethod === 'kml'}
          <!-- Step 2: KML Import -->
          <div class="import-content">
            <button class="back-btn" on:click={goBack}>← Back</button>
            
            <h3>🗺️ KML Import</h3>
            <p class="help-text">Upload a KML file from Google Earth or GIS software.</p>
            
            <div class="file-upload-zone">
              <input 
                type="file" 
                accept=".kml,.kmz" 
                bind:files={kmlFile}
                id="kml-upload"
              />
              <label for="kml-upload" class="upload-label">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>Choose KML/KMZ file or drag & drop</span>
              </label>
            </div>
            
            <div class="info-box">
              <strong>Note:</strong> KML import will extract location data and cell parameters from placemarks.
            </div>
          </div>
        {:else if importMethod === 'manual'}
          <!-- Step 2: Manual Entry -->
          <div class="import-content">
            <button class="back-btn" on:click={goBack}>← Back</button>
            
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
                <input type="number" bind:value={sector} min="1" max="4" />
              </div>
              
              <div class="form-group">
                <label>PCI (blank = auto)</label>
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
                <label>Tower Type</label>
                <select bind:value={towerType}>
                  <option value="3-sector">3-Sector (120°)</option>
                  <option value="4-sector">4-Sector (90°)</option>
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
            </div>
            
            <button class="add-btn" on:click={addManualCell}>
              ➕ Add Cell to List
            </button>
            
            {#if manualCells.length > 0}
              <div class="cell-preview">
                <h4>Cells to Import ({manualCells.length})</h4>
                <div class="cell-list">
                  {#each manualCells as cell, i}
                    <div class="cell-item">
                      <span class="cell-name">{cell.id}</span>
                      <span class="cell-info">eNB: {cell.eNodeB}, Sector: {cell.sector}, PCI: {cell.pci === -1 ? 'Auto' : cell.pci}</span>
                      <button class="remove-btn" on:click={() => removeCell(i)}>×</button>
                    </div>
                  {/each}
                </div>
                <button class="import-btn" on:click={importManualCells}>
                  Import {manualCells.length} Cell{manualCells.length !== 1 ? 's' : ''}
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .wizard-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    z-index: 2000;
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

  .wizard-modal {
    background: var(--card-bg);
    border-radius: var(--border-radius-xl);
    width: 100%;
    max-width: 700px;
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

  .wizard-header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .wizard-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
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
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition);
  }

  .close-btn:hover {
    background: var(--danger-light);
    color: var(--danger-color);
  }

  .wizard-body {
    padding: 2rem;
    overflow-y: auto;
    max-height: calc(90vh - 100px);
  }

  .wizard-intro {
    text-align: center;
    margin-bottom: 2rem;
  }

  .intro-text {
    font-size: 1rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .method-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }

  .method-card {
    background: var(--surface-secondary);
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    padding: 2rem 1rem;
    cursor: pointer;
    transition: all var(--transition);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .method-card:hover {
    border-color: var(--primary-color);
    background: var(--hover-bg);
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
  }

  .method-icon {
    color: var(--primary-color);
  }

  .method-card h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .method-card p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .import-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .back-btn {
    align-self: flex-start;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition);
  }

  .back-btn:hover {
    background: var(--hover-bg);
  }

  .import-content h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .help-text {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .file-upload-zone {
    position: relative;
  }

  .file-upload-zone input[type="file"] {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .upload-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 3rem 2rem;
    border: 2px dashed var(--border-color);
    border-radius: var(--border-radius-lg);
    background: var(--surface-secondary);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition);
  }

  .upload-label:hover {
    border-color: var(--primary-color);
    background: var(--hover-bg);
  }

  .upload-label svg {
    color: var(--primary-color);
  }

  .template-btn {
    padding: 0.75rem 1.5rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition);
  }

  .template-btn:hover {
    background: var(--hover-bg);
    box-shadow: var(--shadow-sm);
  }

  .info-box {
    padding: 1rem;
    background: var(--info-light);
    border-left: 4px solid var(--info-color);
    border-radius: var(--border-radius);
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .form-group label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-group input,
  .form-group select {
    padding: 0.625rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--focus-ring);
  }

  .add-btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--border-radius);
    background: var(--primary-color);
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition);
  }

  .add-btn:hover {
    background: var(--button-primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .cell-preview {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--surface-secondary);
    border-radius: var(--border-radius-lg);
    border: 1px solid var(--border-color);
  }

  .cell-preview h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .cell-list {
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 1rem;
  }

  .cell-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    margin-bottom: 0.5rem;
  }

  .cell-name {
    font-weight: 600;
    color: var(--text-primary);
    min-width: 80px;
  }

  .cell-info {
    flex: 1;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .remove-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: var(--danger-light);
    color: var(--danger-color);
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    transition: all var(--transition);
  }

  .remove-btn:hover {
    background: var(--danger-color);
    color: white;
  }

  .import-btn {
    width: 100%;
    padding: 0.875rem 1.5rem;
    border: none;
    border-radius: var(--border-radius);
    background: var(--success-color);
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition);
  }

  .import-btn:hover {
    background: var(--success-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  @media (max-width: 768px) {
    .method-grid {
      grid-template-columns: 1fr;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }

    .wizard-modal {
      max-width: 95%;
    }
  }
</style>

