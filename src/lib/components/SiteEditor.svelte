<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { CellSite, Sector, Channel } from '$lib/models/cellSite';
  
  export let site: CellSite | null = null;
  export let isOpen = false;
  export let isNewSite = false;
  export let initialLatitude: number | undefined = undefined;
  export let initialLongitude: number | undefined = undefined;
  
  const dispatch = createEventDispatcher();
  
  // Handle Escape key to close modal
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isOpen) {
      handleClose();
    }
  }
  
  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
  
  // Create working copy with default initialization
  let editedSite: CellSite = {
    id: 'TEMP',
    name: '',
    eNodeB: 1000,
    latitude: 0,
    longitude: 0,
    sectors: []
  };
  let selectedSectorIndex: number | null = null;
  let initialized = false;
  
  // Initialize site data when modal opens (only once per open)
  $: if (isOpen && !initialized) {
    console.log('SiteEditor: Initializing modal. isNewSite:', isNewSite, 'site:', site);
    
    if (isNewSite) {
      const siteNumber = Date.now().toString().slice(-4);
      editedSite = {
        id: `SITE${siteNumber}`,
        name: `New Site ${siteNumber}`,
        eNodeB: 1000,
        latitude: initialLatitude || 40.7128,
        longitude: initialLongitude || -74.0060,
        sectors: []
      };
      console.log('SiteEditor: Created new site template:', editedSite);
    } else if (site) {
      // Deep copy to avoid mutating the original
      editedSite = JSON.parse(JSON.stringify(site));
      console.log('SiteEditor: Loaded site for editing:', editedSite.name, 'with', editedSite.sectors.length, 'sectors');
    }
    selectedSectorIndex = null;
    initialized = true;
  }
  
  // Reset initialized flag when modal closes
  $: if (!isOpen && initialized) {
    initialized = false;
  }
  
  function handleClose() {
    dispatch('close');
  }
  
  function handleSave() {
    // Validate
    if (!editedSite.name || editedSite.sectors.length === 0) {
      alert('Site must have a name and at least one sector');
      return;
    }
    
    dispatch('save', editedSite);
    handleClose();
  }
  
  function addSector() {
    console.log('SiteEditor: Adding sector. Current sectors:', editedSite.sectors.length);
    
    const sectorNumber = editedSite.sectors.length + 1;
    // Smart azimuth suggestion based on existing sectors
    let suggestedAzimuth = 0;
    
    if (editedSite.sectors.length === 0) {
      suggestedAzimuth = 0; // First sector: North
    } else if (editedSite.sectors.length === 1) {
      suggestedAzimuth = 120; // Second sector: SE (3-sector default)
    } else if (editedSite.sectors.length === 2) {
      suggestedAzimuth = 240; // Third sector: SW (3-sector default)
    } else if (editedSite.sectors.length === 3) {
      suggestedAzimuth = 90; // Fourth sector: E (4-sector)
    } else {
      // For additional sectors, find the largest gap
      suggestedAzimuth = findLargestAzimuthGap(editedSite.sectors);
    }
    
    const newSector: Sector = {
      id: `${editedSite.id}-SEC${sectorNumber}`,
      sectorNumber,
      azimuth: suggestedAzimuth,
      beamwidth: 65, // Default 65° beamwidth (typical for macro cells)
      heightAGL: 100, // Default 100 feet above ground level
      rmodId: ((sectorNumber - 1) % 3) + 1, // Auto-assign RMOD (1-3)
      channels: [
        {
          id: `${editedSite.id}-SEC${sectorNumber}-CH1`,
          name: `Carrier 1`,
          dlEarfcn: 55640,
          ulEarfcn: 55640,
          centerFreq: 3625,
          channelBandwidth: 20,
          pci: 0,
          isPrimary: true
        }
      ],
      rsPower: -75,
      technology: 'CBRS'
    };
    
    editedSite.sectors = [...editedSite.sectors, newSector];
    selectedSectorIndex = editedSite.sectors.length - 1;
    
    // Force Svelte reactivity by reassigning the entire object
    editedSite = { ...editedSite, sectors: editedSite.sectors };
    
    console.log('SiteEditor: Added sector. New count:', editedSite.sectors.length);
  }
  
  // Find the largest gap between azimuths for smart sector placement
  function findLargestAzimuthGap(sectors: Sector[]): number {
    if (sectors.length === 0) return 0;
    
    const azimuths = sectors.map(s => s.azimuth).sort((a, b) => a - b);
    let largestGap = 0;
    let gapMidpoint = 0;
    
    for (let i = 0; i < azimuths.length; i++) {
      const current = azimuths[i];
      const next = azimuths[(i + 1) % azimuths.length];
      const gap = next > current ? next - current : (360 - current) + next;
      
      if (gap > largestGap) {
        largestGap = gap;
        gapMidpoint = (current + gap / 2) % 360;
      }
    }
    
    return Math.round(gapMidpoint);
  }
  
  function removeSector(index: number) {
    console.log('SiteEditor: Removing sector at index', index, '. Current count:', editedSite.sectors.length);
    editedSite.sectors = editedSite.sectors.filter((_, i) => i !== index);
    if (selectedSectorIndex === index) {
      selectedSectorIndex = null;
    }
    
    // Force Svelte reactivity by reassigning the entire object
    editedSite = { ...editedSite, sectors: editedSite.sectors };
    
    console.log('SiteEditor: Removed sector. New count:', editedSite.sectors.length);
  }
  
  function addChannelToSector(sectorIndex: number) {
    const sector = editedSite.sectors[sectorIndex];
    const channelNumber = sector.channels.length + 1;
    const newChannel: Channel = {
      id: `${sector.id}-CH${channelNumber}`,
      name: `Carrier ${channelNumber}`,
      dlEarfcn: 55640,
      ulEarfcn: 55640,
      centerFreq: 3625,
      channelBandwidth: 20,
      pci: 0,
      isPrimary: false
    };
    
    sector.channels = [...sector.channels, newChannel];
    editedSite.sectors = [...editedSite.sectors];
    // Force Svelte reactivity
    editedSite = { ...editedSite, sectors: editedSite.sectors };
  }
  
  function removeChannel(sectorIndex: number, channelIndex: number) {
    const sector = editedSite.sectors[sectorIndex];
    sector.channels = sector.channels.filter((_, i) => i !== channelIndex);
    editedSite.sectors = [...editedSite.sectors];
    // Force Svelte reactivity
    editedSite = { ...editedSite, sectors: editedSite.sectors };
  }
  
  function setPrimaryChannel(sectorIndex: number, channelIndex: number) {
    const sector = editedSite.sectors[sectorIndex];
    sector.channels.forEach((ch, i) => {
      ch.isPrimary = i === channelIndex;
    });
    editedSite.sectors = [...editedSite.sectors];
    // Force Svelte reactivity
    editedSite = { ...editedSite, sectors: editedSite.sectors };
  }
  
  // Removed handleBackdropClick - modal should only close via Cancel or X button
  // This prevents accidental closes when editing sectors
</script>

{#if isOpen}
  <div class="modal-backdrop">
    <div class="site-editor">
      <div class="editor-header">
        <h2>
          {#if isNewSite}
            🏗️ Create New Cell Site
          {:else}
            🏗️ Edit Cell Site: {site?.name || 'Unknown'}
          {/if}
        </h2>
        <button class="close-btn" on:click={handleClose}>×</button>
      </div>
      
      <div class="editor-content">
        <!-- Site Information -->
        <section class="editor-section">
          <h3>Cell Site Information</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="siteId">Site ID</label>
              <input 
                type="text" 
                id="siteId"
                bind:value={editedSite.id} 
                disabled={!isNewSite}
              />
            </div>
            
            <div class="form-group">
              <label for="siteName">Site Name</label>
              <input 
                type="text" 
                id="siteName"
                bind:value={editedSite.name}
                placeholder="Manhattan Tower A"
                required
              />
            </div>
            
            <div class="form-group">
              <label for="eNodeB">eNodeB</label>
              <input 
                type="number" 
                id="eNodeB"
                bind:value={editedSite.eNodeB}
                required
              />
            </div>
          </div>
          
          <div class="form-grid">
            <div class="form-group">
              <label for="latitude">Latitude</label>
              <input 
                type="number" 
                id="latitude"
                bind:value={editedSite.latitude}
                step="0.000001"
                required
              />
            </div>
            
            <div class="form-group">
              <label for="longitude">Longitude</label>
              <input 
                type="number" 
                id="longitude"
                bind:value={editedSite.longitude}
                step="0.000001"
                required
              />
            </div>
          </div>
        </section>
        
        <!-- Sectors Section -->
        <section class="editor-section sectors-section">
          <div class="section-header">
            <h3>📡 Sectors (Transmitters on this Cell)</h3>
            <div class="sector-count-badge">{editedSite.sectors.length} Sector{editedSite.sectors.length !== 1 ? 's' : ''}</div>
          </div>
          
          <div class="add-sector-prompt">
            <button type="button" class="add-sector-btn-large" on:click={addSector}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              Add New Sector
            </button>
            <p class="add-sector-hint">Each sector represents a separate antenna/transmitter on this cell site</p>
          </div>
          
          {#if editedSite.sectors.length === 0}
            <p class="empty-message">
              📍 No sectors configured yet.<br/>
              Click "Add New Sector" above to create your first sector.
            </p>
          {:else}
            <div class="sectors-grid">
              {#each editedSite.sectors as sector, sectorIndex}
                <div class="sector-unit" class:selected={selectedSectorIndex === sectorIndex}>
                  <!-- Sector Header with Visual Indicator -->
                  <div class="sector-unit-header">
                    <div class="sector-title-section">
                      <div class="sector-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                          <path d="M2 17l10 5 10-5"></path>
                          <path d="M2 12l10 5 10-5"></path>
                        </svg>
                      </div>
                      <div class="sector-title-info">
                        <h4>Transmitter {sector.sectorNumber}</h4>
                        <span class="sector-subtitle">Azimuth: {sector.azimuth}° | RMOD-{sector.rmodId || 1} | {sector.channels.length} Carrier{sector.channels.length !== 1 ? 's' : ''}</span>
                        <span class="sector-pcis">PCIs: {sector.channels.map(c => c.pci).join(', ')}</span>
                      </div>
                    </div>
                    <button 
                      type="button"
                      class="remove-sector-btn" 
                      on:click={() => removeSector(sectorIndex)}
                      title="Remove this sector"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                  
                  <div class="sector-details">
                    <!-- Prominent Azimuth Control -->
                    <div class="azimuth-control">
                      <div class="azimuth-label">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
                        </svg>
                        Azimuth Direction
                      </div>
                      <div class="azimuth-input-group">
                        <input 
                          type="range" 
                          bind:value={sector.azimuth}
                          min="0"
                          max="359"
                          class="azimuth-slider"
                        />
                        <input 
                          type="number" 
                          bind:value={sector.azimuth}
                          min="0"
                          max="359"
                          class="azimuth-number"
                        />
                        <span class="azimuth-compass">
                          {#if sector.azimuth >= 337.5 || sector.azimuth < 22.5}N
                          {:else if sector.azimuth >= 22.5 && sector.azimuth < 67.5}NE
                          {:else if sector.azimuth >= 67.5 && sector.azimuth < 112.5}E
                          {:else if sector.azimuth >= 112.5 && sector.azimuth < 157.5}SE
                          {:else if sector.azimuth >= 157.5 && sector.azimuth < 202.5}S
                          {:else if sector.azimuth >= 202.5 && sector.azimuth < 247.5}SW
                          {:else if sector.azimuth >= 247.5 && sector.azimuth < 292.5}W
                          {:else if sector.azimuth >= 292.5 && sector.azimuth < 337.5}NW
                          {/if}
                        </span>
                      </div>
                    </div>
                    
                    <!-- Beamwidth Control -->
                    <div class="beamwidth-control">
                      <div class="beamwidth-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M12 2L2 7v10c0 5.5 3.84 7.66 10 9 6.16-1.34 10-3.5 10-9V7l-10-5z"></path>
                        </svg>
                        Beamwidth (Coverage Angle)
                      </div>
                      <div class="beamwidth-selector">
                        <select bind:value={sector.beamwidth} class="beamwidth-select">
                          <option value={33}>33° (Narrow - Directional)</option>
                          <option value={65}>65° (Standard - Macro)</option>
                          <option value={78}>78° (Wide - Coverage)</option>
                          <option value={90}>90° (Very Wide - Small Cell)</option>
                          <option value={120}>120° (Ultra Wide - Omni-like)</option>
                        </select>
                        <span class="beamwidth-visual">{sector.beamwidth}°</span>
                      </div>
                    </div>
                    
                    <!-- Height AGL Control -->
                    <div class="height-control">
                      <div class="height-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="12" y1="20" x2="12" y2="4"></line>
                          <polyline points="8 8 12 4 16 8"></polyline>
                          <polyline points="8 16 12 20 16 16"></polyline>
                        </svg>
                        Height Above Ground Level
                      </div>
                      <div class="height-input-group">
                        <input 
                          type="number" 
                          bind:value={sector.heightAGL}
                          min="0"
                          max="2000"
                          step="1"
                          class="height-input"
                        />
                        <span class="height-unit">feet</span>
                      </div>
                    </div>
                    
                    <div class="form-row">
                      <div class="form-group-sm">
                        <label>
                          Radio Module
                          <select bind:value={sector.rmodId}>
                            <option value={1}>RMOD-1</option>
                            <option value={2}>RMOD-2</option>
                            <option value={3}>RMOD-3</option>
                          </select>
                        </label>
                      </div>
                      
                      <div class="form-group-sm">
                        <label>
                          RS Power (dBm)
                          <input 
                            type="number" 
                            bind:value={sector.rsPower}
                            min="-120"
                            max="30"
                          />
                        </label>
                      </div>
                      
                      <div class="form-group-sm">
                        <label>
                          Technology
                          <select bind:value={sector.technology}>
                            <option value="LTE">LTE</option>
                            <option value="CBRS">CBRS (Band 48)</option>
                            <option value="5G">5G NR</option>
                          </select>
                        </label>
                      </div>
                    </div>
                    
                    <div class="pci-note">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <span>PCIs are configured per carrier below (each carrier needs its own unique PCI)</span>
                    </div>
                    
                    <!-- Carriers for this transmitter -->
                    <div class="channels-section">
                      <div class="channels-header">
                        <strong>📻 Carriers (Frequency Channels)</strong>
                        <button 
                          type="button"
                          class="add-channel-btn-sm" 
                          on:click={() => addChannelToSector(sectorIndex)}
                        >
                          + Add Carrier
                        </button>
                      </div>
                      
                      {#each sector.channels as channel, channelIndex}
                        <div class="carrier-card">
                          <div class="carrier-header">
                            <input 
                              type="radio" 
                              name="primary-{sectorIndex}"
                              checked={channel.isPrimary}
                              on:change={() => setPrimaryChannel(sectorIndex, channelIndex)}
                              title="Primary carrier"
                            />
                            <input 
                              type="text" 
                              bind:value={channel.name}
                              placeholder="Carrier name"
                              class="carrier-name-input"
                            />
                            <button 
                              type="button"
                              class="remove-channel-btn" 
                              on:click={() => removeChannel(sectorIndex, channelIndex)}
                              disabled={sector.channels.length === 1}
                              title="Remove carrier"
                            >
                              ×
                            </button>
                          </div>
                          
                          <div class="carrier-details">
                            <div class="carrier-field">
                              <label class="carrier-label-inline" for="earfcn-{sectorIndex}-{channelIndex}">EARFCN DL</label>
                              <input 
                                type="number"
                                id="earfcn-{sectorIndex}-{channelIndex}"
                                bind:value={channel.dlEarfcn}
                                placeholder="55640"
                                class="carrier-input"
                                min="55240"
                                max="56739"
                                title="Band 48: 55240-56739"
                              />
                            </div>
                            
                            <div class="carrier-field">
                              <label class="carrier-label-inline" for="bw-{sectorIndex}-{channelIndex}">Bandwidth</label>
                              <select id="bw-{sectorIndex}-{channelIndex}" bind:value={channel.channelBandwidth} class="carrier-select">
                                <option value={10}>10 MHz</option>
                                <option value={15}>15 MHz</option>
                                <option value={20}>20 MHz</option>
                              </select>
                            </div>
                            
                            <div class="carrier-field">
                              <label class="carrier-label-inline" for="pci-{sectorIndex}-{channelIndex}">PCI</label>
                              <input 
                                type="number"
                                id="pci-{sectorIndex}-{channelIndex}"
                                bind:value={channel.pci}
                                placeholder="0"
                                class="carrier-input-sm"
                                min="0"
                                max="503"
                              />
                            </div>
                            
                            <div class="carrier-field">
                              <span class="freq-display">{channel.centerFreq} MHz</span>
                            </div>
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      </div>
      
      <div class="editor-footer">
        <button type="button" class="cancel-btn" on:click={handleClose}>Cancel</button>
        <button type="button" class="save-btn" on:click={handleSave}>
          {#if isNewSite}
            🏗️ Create Site
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

  .site-editor {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 1000px;
    max-height: 90vh;
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

  .editor-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    border-bottom: 2px solid var(--primary-color);
    padding-bottom: 0.5rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section-header h3 {
    border: none;
    padding: 0;
    margin: 0;
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

  .form-group input {
    padding: 0.625rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.95rem;
    transition: all var(--transition);
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--focus-ring);
  }

  .form-group input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: var(--bg-secondary);
  }

  .sectors-section {
    background: linear-gradient(to bottom, var(--surface-secondary), var(--card-bg));
    padding: 1.5rem;
    border-radius: var(--border-radius-lg);
    border: 2px dashed var(--border-color);
  }

  .sector-count-badge {
    padding: 0.375rem 0.875rem;
    background: var(--primary-color);
    color: white;
    border-radius: 999px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .add-sector-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    background: var(--card-bg);
    border: 2px dashed var(--primary-color);
    border-radius: var(--border-radius-lg);
  }

  .add-sector-btn-large {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2rem;
    border: none;
    border-radius: var(--border-radius-lg);
    background: var(--success-color);
    color: white;
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all var(--transition);
    box-shadow: var(--shadow-md);
  }

  .add-sector-btn-large:hover {
    background: var(--success-dark);
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  .add-sector-hint {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
    text-align: center;
  }

  .empty-message {
    padding: 3rem 2rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 1rem;
    line-height: 1.6;
  }

  .sectors-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1.5rem;
  }

  .sector-unit {
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    padding: 0;
    background: var(--card-bg);
    transition: all var(--transition);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }

  .sector-unit.selected {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light), var(--shadow-md);
    transform: scale(1.02);
  }

  .sector-unit-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
    color: white;
    border-bottom: 2px solid var(--primary-dark);
  }

  .sector-title-section {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .sector-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
  }

  .sector-title-info h4 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: white;
  }

  .sector-subtitle {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 500;
  }

  .sector-pcis {
    display: block;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.8);
    font-weight: 400;
    margin-top: 0.25rem;
  }

  .pci-note {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--info-light);
    border: 1px solid var(--info-color);
    border-radius: var(--border-radius);
    margin-top: 0.5rem;
  }

  .pci-note svg {
    flex-shrink: 0;
    color: var(--info-color);
    margin-top: 0.125rem;
  }

  .pci-note span {
    font-size: 0.8125rem;
    color: var(--text-primary);
    line-height: 1.4;
  }

  .remove-sector-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    cursor: pointer;
    transition: all var(--transition);
  }

  .remove-sector-btn:hover {
    background: var(--danger-color);
    transform: scale(1.1);
  }

  .sector-details {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
  }

  .azimuth-control {
    padding: 1rem;
    background: var(--surface-secondary);
    border: 1px solid var(--primary-color);
    border-radius: var(--border-radius-lg);
    margin-bottom: 0.5rem;
  }

  .azimuth-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.75rem;
  }

  .azimuth-input-group {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .azimuth-slider {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(to right, 
      hsl(0, 70%, 60%),    /* 0° - Red (N) */
      hsl(60, 70%, 60%),   /* 90° - Yellow (E) */
      hsl(120, 70%, 60%),  /* 180° - Green (S) */
      hsl(240, 70%, 60%),  /* 270° - Blue (W) */
      hsl(360, 70%, 60%)   /* 360° - Red (N) */
    );
    outline: none;
    cursor: pointer;
  }

  .azimuth-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--primary-color);
    border: 3px solid white;
    cursor: pointer;
    box-shadow: var(--shadow-md);
  }

  .azimuth-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--primary-color);
    border: 3px solid white;
    cursor: pointer;
    box-shadow: var(--shadow-md);
  }

  .azimuth-number {
    width: 80px;
    padding: 0.5rem;
    border: 2px solid var(--primary-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 1.1rem;
    font-weight: 700;
    text-align: center;
  }

  .azimuth-compass {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--primary-color);
    color: white;
    border-radius: 50%;
    font-size: 1rem;
    font-weight: 700;
    box-shadow: var(--shadow-md);
  }

  .beamwidth-control {
    padding: 0.875rem;
    background: var(--surface-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    margin-bottom: 0.75rem;
  }

  .beamwidth-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .beamwidth-selector {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .beamwidth-select {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.875rem;
    cursor: pointer;
  }

  .beamwidth-visual {
    padding: 0.5rem 0.75rem;
    background: var(--info-light);
    color: var(--primary-color);
    border-radius: var(--border-radius);
    font-size: 0.875rem;
    font-weight: 700;
    min-width: 50px;
    text-align: center;
  }

  /* Height AGL Control */
  .height-control {
    margin-bottom: 1.25rem;
  }

  .height-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.75rem;
  }

  .height-label svg {
    color: var(--info-color);
  }

  .height-input-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .height-input {
    flex: 1;
    padding: 0.625rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 1rem;
    font-weight: 600;
  }

  .height-input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--focus-ring);
  }

  .height-unit {
    padding: 0.625rem 0.875rem;
    background: var(--surface-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
    min-width: 60px;
    text-align: center;
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 0.75rem;
  }

  .form-group-sm {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .form-group-sm label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-group-sm input,
  .form-group-sm select {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .channels-section {
    padding: 0.75rem;
    background: var(--card-bg);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
  }

  .channels-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .channels-header strong {
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .add-channel-btn-sm {
    padding: 0.25rem 0.625rem;
    border: none;
    border-radius: var(--border-radius);
    background: var(--primary-color);
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition);
  }

  .add-channel-btn-sm:hover {
    background: var(--button-primary-hover);
  }

  .remove-channel-btn {
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

  .remove-channel-btn:hover:not(:disabled) {
    background: var(--danger-color);
    color: white;
  }

  .remove-channel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Carrier Card Styles */
  .carrier-card {
    background: var(--surface-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .carrier-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  .carrier-name-input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-weight: 500;
  }

  .carrier-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
  }

  .carrier-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .carrier-label-inline {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .carrier-input {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .carrier-input-sm {
    width: 80px;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .carrier-select {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.875rem;
    cursor: pointer;
  }

  .freq-display {
    display: flex;
    align-items: center;
    height: 38px;
    padding: 0.5rem;
    background: var(--primary-light);
    color: var(--primary-color);
    border-radius: var(--border-radius);
    font-weight: 600;
    font-size: 0.875rem;
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

