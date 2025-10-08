<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { Cell } from '../pciMapper';
  import SiteEditor from './SiteEditor.svelte';
  import type { CellSite } from '$lib/models/cellSite';
  import { convertCellSiteToLegacy } from '$lib/models/cellSite';
  
  export let show = false;
  
  const dispatch = createEventDispatcher();
  
  // Handle Escape key to close modal
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && show) {
      event.preventDefault();
      event.stopPropagation();
      handleClose();
    }
  }
  
  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
  
  let importMethod: 'csv' | 'kml' | 'manual' | null = null;
  let csvFile: FileList | null = null;
  let kmlFile: FileList | null = null;
  
  // Site editor for manual import
  let showSiteEditorInWizard = false;
  let manualSites: CellSite[] = [];
  
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
    manualSites = [];
    dispatch('close');
  }
  
  function selectMethod(method: 'csv' | 'kml' | 'manual') {
    importMethod = method;
  }
  
  function goBack() {
    importMethod = null;
    manualCells = [];
    manualSites = [];
  }
  
  function handleManualSiteSave(event: CustomEvent) {
    const site = event.detail as CellSite;
    manualSites = [...manualSites, site];
    showSiteEditorInWizard = false;
    console.log('Site added to manual import:', site);
  }
  
  function removeSiteFromImport(index: number) {
    manualSites = manualSites.filter((_, i) => i !== index);
  }
  
  function importManualSites() {
    if (manualSites.length === 0) {
      alert('Please add at least one cell site');
      return;
    }
    
    // Convert all sites to legacy cell format
    const cells = manualSites.flatMap(site => convertCellSiteToLegacy([site]));
    
    dispatch('import', { cells });
    handleClose();
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
      
      if (imported.length > 0) {
        dispatch('import', { cells: imported });
        handleClose();
      } else {
        alert('No valid cell data found in CSV file');
      }
    };
    
    reader.readAsText(file);
  }

  function handleKMLUpload() {
    if (!kmlFile || kmlFile.length === 0) return;
    
    const file = kmlFile[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const imported: Cell[] = [];
      
      try {
        // Parse KML/XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        
        // Check for parsing errors
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
          alert('Invalid KML file format');
          return;
        }
        
        // Extract Placemarks
        const placemarks = xmlDoc.querySelectorAll('Placemark');
        
        placemarks.forEach((placemark, index) => {
          // Get name
          const nameElement = placemark.querySelector('name');
          const name = nameElement?.textContent?.trim() || `CELL${String(index + 1).padStart(3, '0')}`;
          
          // Get coordinates
          const coordsElement = placemark.querySelector('coordinates');
          if (!coordsElement) return;
          
          const coords = coordsElement.textContent?.trim().split(/[\s,]+/);
          if (!coords || coords.length < 2) return;
          
          const longitude = parseFloat(coords[0]);
          const latitude = parseFloat(coords[1]);
          
          if (isNaN(latitude) || isNaN(longitude)) return;
          
          // Get extended data (if available)
          const extendedData = placemark.querySelector('ExtendedData');
          let pci = -1;
          let eNodeB = 1000 + index;
          let sector = 1;
          let frequency = 2100;
          let rsPower = -85;
          let azimuth: number | undefined = undefined;
          let towerType: '3-sector' | '4-sector' = '3-sector';
          let technology: 'LTE' | 'CBRS' | 'LTE+CBRS' = 'LTE';
          
          if (extendedData) {
            // Try to extract custom data fields
            const dataElements = extendedData.querySelectorAll('Data');
            dataElements.forEach(dataEl => {
              const dataName = dataEl.getAttribute('name')?.toLowerCase();
              const value = dataEl.querySelector('value')?.textContent?.trim();
              
              if (!dataName || !value) return;
              
              switch (dataName) {
                case 'pci':
                  pci = parseInt(value) || -1;
                  break;
                case 'enodeb':
                  eNodeB = parseInt(value) || eNodeB;
                  break;
                case 'sector':
                  sector = parseInt(value) || 1;
                  break;
                case 'frequency':
                  frequency = parseInt(value) || 2100;
                  break;
                case 'rspower':
                case 'rssi':
                  rsPower = parseFloat(value) || -85;
                  break;
                case 'azimuth':
                  azimuth = parseInt(value);
                  break;
                case 'towertype':
                  if (value === '3-sector' || value === '4-sector') {
                    towerType = value;
                  }
                  break;
                case 'technology':
                case 'tech':
                  if (value === 'LTE' || value === 'CBRS' || value === 'LTE+CBRS') {
                    technology = value;
                  }
                  break;
              }
            });
          }
          
          // Also check description for data
          const description = placemark.querySelector('description')?.textContent || '';
          if (description) {
            const pciMatch = description.match(/PCI[:\s]+(\d+)/i);
            if (pciMatch) pci = parseInt(pciMatch[1]);
            
            const eNodeBMatch = description.match(/eNodeB[:\s]+(\d+)/i);
            if (eNodeBMatch) eNodeB = parseInt(eNodeBMatch[1]);
            
            const sectorMatch = description.match(/Sector[:\s]+(\d+)/i);
            if (sectorMatch) sector = parseInt(sectorMatch[1]);
          }
          
          imported.push({
            id: name,
            eNodeB,
            sector,
            pci,
            latitude,
            longitude,
            frequency,
            rsPower,
            azimuth,
            towerType,
            technology,
            earfcn: frequency === 3550 ? 55650 : 1950,
            centerFreq: frequency,
            channelBandwidth: 20,
            dlEarfcn: frequency === 3550 ? 55650 : 1950,
            ulEarfcn: frequency === 3550 ? 55650 : 1850
          });
        });
        
        if (imported.length > 0) {
          dispatch('import', { cells: imported });
          handleClose();
        } else {
          alert('No placemarks with coordinates found in KML file');
        }
      } catch (error) {
        console.error('KML parsing error:', error);
        alert('Error parsing KML file. Please check the file format.');
      }
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

  function downloadKMLTemplate() {
    const template = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>LTE Cell Towers</name>
    <Placemark>
      <name>CELL001</name>
      <description>
        eNodeB: 1001
        Sector: 1
        PCI: 15
        Frequency: 2100
        RS Power: -85
      </description>
      <ExtendedData>
        <Data name="PCI"><value>15</value></Data>
        <Data name="eNodeB"><value>1001</value></Data>
        <Data name="Sector"><value>1</value></Data>
        <Data name="Frequency"><value>2100</value></Data>
        <Data name="RSPower"><value>-85</value></Data>
        <Data name="Azimuth"><value>0</value></Data>
        <Data name="TowerType"><value>3-sector</value></Data>
        <Data name="Technology"><value>LTE</value></Data>
      </ExtendedData>
      <Point>
        <coordinates>-74.0060,40.7128,0</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`;
    
    const blob = new Blob([template], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pci-import-template.kml';
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
  <div 
    class="wizard-overlay" 
    role="presentation"
    on:click={handleClose}
    on:keydown={(e) => e.key === 'Escape' && handleClose()}
  >
    <div 
      class="wizard-modal" 
      role="dialog"
      tabindex="-1"
      aria-labelledby="import-wizard-modal-title"
      on:click|stopPropagation
      on:keydown|stopPropagation
    >
      <div class="wizard-header">
        <h2 id="import-wizard-modal-title">Import Data</h2>
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
                on:change={handleKMLUpload}
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
            
            <button class="template-btn" on:click={downloadKMLTemplate}>
              📥 Download KML Template
            </button>
            
            <div class="info-box">
              <strong>Supported Data:</strong> The KML parser will extract coordinates, name, and cell parameters from ExtendedData or description fields (PCI, eNodeB, Sector, Frequency, etc.).
            </div>
          </div>
        {:else if importMethod === 'manual'}
          <!-- Step 2: Manual Site Entry -->
          <div class="import-content">
            <button class="back-btn" on:click={goBack}>← Back</button>
            
            <h3>✏️ Manual Site Entry</h3>
            <p class="method-description">Add cell sites with sectors and channels</p>
            
            <!-- Add Site Button -->
            <div class="manual-add-section">
              <button 
                type="button"
                class="add-site-btn-large" 
                on:click={() => showSiteEditorInWizard = true}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                Add Cell Site
              </button>
              <p class="add-hint">Each site can have multiple sectors with different azimuths and EARFCNs</p>
            </div>
            
            <!-- Sites List -->
            {#if manualSites.length > 0}
              <div class="sites-list">
                <h4>Added Sites ({manualSites.length})</h4>
                {#each manualSites as site, index}
                  <div class="site-preview">
                    <div class="site-preview-header">
                      <strong>{site.name}</strong>
                      <span class="site-preview-meta">eNodeB {site.eNodeB} • {site.sectors.length} Sector{site.sectors.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="sector-summary">
                      {#each site.sectors as sector}
                        <span class="sector-badge">
                          Sec {sector.sectorNumber}: {sector.azimuth}° | PCI {sector.pci} | {sector.channels.length} Ch
                        </span>
                      {/each}
                    </div>
                    <button 
                      type="button"
                      class="remove-site-btn" 
                      on:click={() => removeSiteFromImport(index)}
                    >
                      Remove
                    </button>
                  </div>
                {/each}
              </div>
              
              <div class="manual-actions">
                <button class="import-btn" on:click={importManualSites}>
                  ✅ Import {manualSites.length} Site{manualSites.length !== 1 ? 's' : ''}
                </button>
              </div>
            {:else}
              <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <p>No sites added yet</p>
                <p class="empty-hint">Click "Add Cell Site" to configure your first site</p>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Nested Site Editor for Manual Import -->
<SiteEditor 
  site={null}
  isOpen={showSiteEditorInWizard}
  isNewSite={true}
  on:save={handleManualSiteSave}
  on:close={() => showSiteEditorInWizard = false}
/>

<style>
  .wizard-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem 2rem;
    animation: fadeIn 0.2s;
    overflow-y: auto;
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
    max-height: 80vh;
    box-shadow: var(--shadow-2xl);
    border: 1px solid var(--border-color);
    animation: slideUp 0.3s;
    display: flex;
    flex-direction: column;
    margin: auto;
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

  .manual-add-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem;
    margin: 1.5rem 0;
    background: var(--surface-secondary);
    border: 2px dashed var(--primary-color);
    border-radius: var(--border-radius-lg);
  }

  .add-site-btn-large {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2.5rem;
    border: none;
    border-radius: var(--border-radius-lg);
    background: var(--primary-color);
    color: white;
    font-size: 1.2rem;
    font-weight: 700;
    cursor: pointer;
    transition: all var(--transition);
    box-shadow: var(--shadow-md);
  }

  .add-site-btn-large:hover {
    background: var(--button-primary-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  .add-hint {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
    text-align: center;
  }

  .sites-list {
    margin-top: 1.5rem;
  }

  .sites-list h4 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .site-preview {
    padding: 1rem;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    margin-bottom: 1rem;
  }

  .site-preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .site-preview-header strong {
    font-size: 1rem;
    color: var(--text-primary);
  }

  .site-preview-meta {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .sector-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .sector-badge {
    padding: 0.375rem 0.75rem;
    background: var(--primary-light);
    color: var(--primary-color);
    border-radius: var(--border-radius);
    font-size: 0.75rem;
    font-weight: 600;
    font-family: var(--font-mono);
  }

  .remove-site-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: var(--border-radius);
    background: var(--danger-light);
    color: var(--danger-color);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition);
  }

  .remove-site-btn:hover {
    background: var(--danger-color);
    color: white;
  }

  .manual-actions {
    margin-top: 1.5rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 2rem;
    color: var(--text-secondary);
    text-align: center;
  }

  .empty-state svg {
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0.5rem 0;
    font-size: 1rem;
  }

  .empty-hint {
    font-size: 0.875rem !important;
    font-style: italic;
  }

  @media (max-width: 768px) {
    .method-grid {
      grid-template-columns: 1fr;
    }

    .wizard-modal {
      max-width: 95%;
    }
  }
</style>

