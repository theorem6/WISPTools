<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CellSite, Sector, Channel } from '$lib/models/cellSite';
  
  export let site: CellSite | null = null;
  export let isOpen = false;
  export let isNewSite = false;
  export let initialLatitude: number | undefined = undefined;
  export let initialLongitude: number | undefined = undefined;
  
  const dispatch = createEventDispatcher();
  
  // Create working copy
  let editedSite: CellSite;
  let selectedSectorIndex: number | null = null;
  
  // Initialize site data
  $: if (isOpen) {
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
    } else if (site) {
      editedSite = JSON.parse(JSON.stringify(site)); // Deep copy
    }
    selectedSectorIndex = null;
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
    const sectorNumber = editedSite.sectors.length + 1;
    const azimuth = (sectorNumber - 1) * (360 / 3); // Default 3-sector layout
    
    const newSector: Sector = {
      id: `${editedSite.id}-SEC${sectorNumber}`,
      sectorNumber,
      azimuth,
      pci: 0,
      channels: [
        {
          dlEarfcn: 1950,
          ulEarfcn: 19950,
          centerFreq: 2110,
          channelBandwidth: 20,
          isPrimary: true
        }
      ],
      rsPower: -75,
      technology: 'LTE'
    };
    
    editedSite.sectors = [...editedSite.sectors, newSector];
    selectedSectorIndex = editedSite.sectors.length - 1;
  }
  
  function removeSector(index: number) {
    editedSite.sectors = editedSite.sectors.filter((_, i) => i !== index);
    if (selectedSectorIndex === index) {
      selectedSectorIndex = null;
    }
  }
  
  function addChannelToSector(sectorIndex: number) {
    const sector = editedSite.sectors[sectorIndex];
    const newChannel: Channel = {
      dlEarfcn: 1950,
      ulEarfcn: 19950,
      centerFreq: 2110,
      channelBandwidth: 20,
      isPrimary: false
    };
    
    sector.channels = [...sector.channels, newChannel];
    editedSite.sectors = [...editedSite.sectors]; // Trigger reactivity
  }
  
  function removeChannel(sectorIndex: number, channelIndex: number) {
    const sector = editedSite.sectors[sectorIndex];
    sector.channels = sector.channels.filter((_, i) => i !== channelIndex);
    editedSite.sectors = [...editedSite.sectors]; // Trigger reactivity
  }
  
  function setPrimaryChannel(sectorIndex: number, channelIndex: number) {
    const sector = editedSite.sectors[sectorIndex];
    sector.channels.forEach((ch, i) => {
      ch.isPrimary = i === channelIndex;
    });
    editedSite.sectors = [...editedSite.sectors]; // Trigger reactivity
  }
  
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }
</script>

{#if isOpen}
  <div class="modal-backdrop" on:click={handleBackdropClick}>
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
        <section class="editor-section">
          <div class="section-header">
            <h3>Sectors (Transmitters)</h3>
            <button type="button" class="add-sector-btn" on:click={addSector}>
              ➕ Add Sector
            </button>
          </div>
          
          {#if editedSite.sectors.length === 0}
            <p class="empty-message">No sectors yet. Click "Add Sector" to create one.</p>
          {:else}
            <div class="sectors-list">
              {#each editedSite.sectors as sector, sectorIndex}
                <div class="sector-card" class:selected={selectedSectorIndex === sectorIndex}>
                  <div class="sector-header">
                    <h4>Sector {sector.sectorNumber} - Azimuth {sector.azimuth}°</h4>
                    <button 
                      type="button"
                      class="remove-btn" 
                      on:click={() => removeSector(sectorIndex)}
                      title="Remove sector"
                    >
                      🗑️
                    </button>
                  </div>
                  
                  <div class="sector-details">
                    <div class="form-row">
                      <div class="form-group-sm">
                        <label>Azimuth (°)</label>
                        <input 
                          type="number" 
                          bind:value={sector.azimuth}
                          min="0"
                          max="359"
                        />
                      </div>
                      
                      <div class="form-group-sm">
                        <label>PCI</label>
                        <input 
                          type="number" 
                          bind:value={sector.pci}
                          min="0"
                          max="503"
                        />
                      </div>
                      
                      <div class="form-group-sm">
                        <label>RS Power (dBm)</label>
                        <input 
                          type="number" 
                          bind:value={sector.rsPower}
                        />
                      </div>
                      
                      <div class="form-group-sm">
                        <label>Technology</label>
                        <select bind:value={sector.technology}>
                          <option value="LTE">LTE</option>
                          <option value="CBRS">CBRS</option>
                          <option value="5G">5G</option>
                        </select>
                      </div>
                    </div>
                    
                    <!-- Channels for this sector -->
                    <div class="channels-section">
                      <div class="channels-header">
                        <strong>Channels (EARFCNs)</strong>
                        <button 
                          type="button"
                          class="add-channel-btn-sm" 
                          on:click={() => addChannelToSector(sectorIndex)}
                        >
                          + Add Channel
                        </button>
                      </div>
                      
                      {#each sector.channels as channel, channelIndex}
                        <div class="channel-row">
                          <input 
                            type="radio" 
                            name="primary-{sectorIndex}"
                            checked={channel.isPrimary}
                            on:change={() => setPrimaryChannel(sectorIndex, channelIndex)}
                            title="Primary channel"
                          />
                          
                          <input 
                            type="number" 
                            bind:value={channel.dlEarfcn}
                            placeholder="DL EARFCN"
                            class="channel-input"
                          />
                          
                          <span class="channel-label">{channel.centerFreq} MHz</span>
                          
                          <input 
                            type="number" 
                            bind:value={channel.channelBandwidth}
                            class="channel-input-sm"
                            placeholder="BW"
                          />
                          <span class="channel-label-sm">MHz</span>
                          
                          <button 
                            type="button"
                            class="remove-channel-btn" 
                            on:click={() => removeChannel(sectorIndex, channelIndex)}
                            disabled={sector.channels.length === 1}
                          >
                            ×
                          </button>
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
        <button class="cancel-btn" on:click={handleClose}>Cancel</button>
        <button class="save-btn" on:click={handleSave}>
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

  .add-sector-btn {
    padding: 0.625rem 1.25rem;
    border: none;
    border-radius: var(--border-radius);
    background: var(--success-color);
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition);
  }

  .add-sector-btn:hover {
    background: var(--success-dark);
    box-shadow: var(--shadow-sm);
  }

  .empty-message {
    padding: 2rem;
    text-align: center;
    color: var(--text-secondary);
    font-style: italic;
  }

  .sectors-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .sector-card {
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    padding: 1rem;
    background: var(--surface-secondary);
    transition: all var(--transition);
  }

  .sector-card.selected {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px var(--primary-light);
  }

  .sector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .sector-header h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .remove-btn {
    padding: 0.375rem 0.75rem;
    border: none;
    border-radius: var(--border-radius);
    background: var(--danger-light);
    cursor: pointer;
    transition: all var(--transition);
  }

  .remove-btn:hover {
    background: var(--danger-color);
  }

  .sector-details {
    display: flex;
    flex-direction: column;
    gap: 1rem;
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

  .channel-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--surface-secondary);
    border-radius: var(--border-radius);
    margin-bottom: 0.5rem;
  }

  .channel-row:last-child {
    margin-bottom: 0;
  }

  .channel-input {
    width: 100px;
    padding: 0.375rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .channel-input-sm {
    width: 60px;
    padding: 0.375rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .channel-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    min-width: 80px;
  }

  .channel-label-sm {
    font-size: 0.875rem;
    color: var(--text-secondary);
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

