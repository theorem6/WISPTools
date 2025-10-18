<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { coverageMapService } from '../lib/coverageMapService.mongodb';
  import type { TowerSite } from '../lib/models';
  
  export let show = false;
  export let sites: TowerSite[] = [];
  export let selectedSite: TowerSite | null = null;
  export let tenantId: string;
  
  const dispatch = createEventDispatcher();
  
  let isSaving = false;
  let error = '';
  
  // Form data
  let formData = {
    siteId: selectedSite?.id || '',
    name: '',
    azimuth: 0,
    beamwidth: 65,
    tilt: 0,
    technology: 'LTE' as const,
    band: '',
    frequency: 0,
    bandwidth: 10,
    antennaModel: '',
    antennaManufacturer: '',
    antennaSerialNumber: '',
    radioModel: '',
    radioManufacturer: '',
    radioSerialNumber: '',
    status: 'active' as const
  };
  
  $: if (selectedSite) formData.siteId = selectedSite.id;
  
  // Update location when site changes
  $: selectedSiteData = sites.find(s => s.id === formData.siteId);
  
  // Technology presets
  const technologyPresets = {
    LTE: { beamwidth: 65, defaultBand: 'Band 71 (600MHz)', frequency: 617 },
    CBRS: { beamwidth: 90, defaultBand: 'CBRS (3.5GHz)', frequency: 3550 },
    FWA: { beamwidth: 30, defaultBand: '5GHz', frequency: 5800 },
    '5G': { beamwidth: 65, defaultBand: 'n71 (600MHz)', frequency: 617 },
    WiFi: { beamwidth: 360, defaultBand: '2.4GHz', frequency: 2400 }
  };
  
  function handleTechnologyChange() {
    const preset = technologyPresets[formData.technology];
    if (preset) {
      formData.beamwidth = preset.beamwidth;
      formData.band = preset.defaultBand;
      formData.frequency = preset.frequency;
    }
  }
  
  async function handleSave() {
    if (!formData.name.trim()) {
      error = 'Sector name is required';
      return;
    }
    
    if (!formData.siteId) {
      error = 'Please select a site';
      return;
    }
    
    const site = sites.find(s => s.id === formData.siteId);
    if (!site) {
      error = 'Selected site not found';
      return;
    }
    
    isSaving = true;
    error = '';
    
    try {
      const sectorData = {
        siteId: formData.siteId,
        name: formData.name,
        location: {
          latitude: site.location.latitude,
          longitude: site.location.longitude
        },
        azimuth: formData.azimuth,
        beamwidth: formData.beamwidth,
        tilt: formData.tilt || undefined,
        technology: formData.technology,
        band: formData.band || undefined,
        frequency: formData.frequency || undefined,
        bandwidth: formData.bandwidth || undefined,
        antennaModel: formData.antennaModel || undefined,
        antennaManufacturer: formData.antennaManufacturer || undefined,
        antennaSerialNumber: formData.antennaSerialNumber || undefined,
        radioModel: formData.radioModel || undefined,
        radioManufacturer: formData.radioManufacturer || undefined,
        radioSerialNumber: formData.radioSerialNumber || undefined,
        status: formData.status
      };
      
      await coverageMapService.createSector(tenantId, sectorData);
      
      dispatch('saved');
      handleClose();
    } catch (err: any) {
      error = err.message || 'Failed to create sector';
    } finally {
      isSaving = false;
    }
  }
  
  function handleClose() {
    show = false;
    error = '';
  }
</script>

{#if show}
<div class="modal-overlay" on:click={handleClose}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <h2>📶 Add Sector</h2>
      <button class="close-btn" on:click={handleClose}>✕</button>
    </div>
    
    {#if error}
      <div class="error-banner">{error}</div>
    {/if}
    
    <div class="modal-body">
      <!-- Site Selection -->
      <div class="section">
        <h3>📡 Tower Site</h3>
        <div class="form-group">
          <label>Select Site *</label>
          <select bind:value={formData.siteId}>
            <option value="">-- Select a tower site --</option>
            {#each sites as site}
              <option value={site.id}>{site.name} ({site.type})</option>
            {/each}
          </select>
          {#if selectedSiteData}
            <p class="help-text">
              📍 {selectedSiteData.location.latitude.toFixed(4)}, {selectedSiteData.location.longitude.toFixed(4)}
            </p>
          {/if}
        </div>
      </div>
      
      <!-- Basic Info -->
      <div class="section">
        <h3>📋 Sector Configuration</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Sector Name *</label>
            <input type="text" bind:value={formData.name} placeholder="Alpha Sector" />
          </div>
          
          <div class="form-group">
            <label>Technology *</label>
            <select bind:value={formData.technology} on:change={handleTechnologyChange}>
              <option value="LTE">LTE</option>
              <option value="CBRS">CBRS</option>
              <option value="FWA">Fixed Wireless (FWA)</option>
              <option value="5G">5G NR</option>
              <option value="WiFi">WiFi</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Status</label>
            <select bind:value={formData.status}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
              <option value="planned">Planned</option>
            </select>
          </div>
        </div>
      </div>
      
      <!-- RF Configuration -->
      <div class="section">
        <h3>📡 RF Configuration</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Azimuth (degrees) *</label>
            <input type="number" min="0" max="360" bind:value={formData.azimuth} />
            <p class="help-text">0° = North, 90° = East, 180° = South, 270° = West</p>
          </div>
          
          <div class="form-group">
            <label>Beamwidth (degrees) *</label>
            <input type="number" min="0" max="360" bind:value={formData.beamwidth} />
            <p class="help-text">Typical: 65° (LTE), 90° (CBRS), 30° (FWA)</p>
          </div>
          
          <div class="form-group">
            <label>Mechanical Tilt (degrees)</label>
            <input type="number" min="-90" max="90" bind:value={formData.tilt} />
            <p class="help-text">Downtilt angle (negative = down)</p>
          </div>
        </div>
        
        <div class="form-grid">
          <div class="form-group">
            <label>Band / Frequency Name</label>
            <input type="text" bind:value={formData.band} placeholder="Band 71 (600MHz)" />
          </div>
          
          <div class="form-group">
            <label>Center Frequency (MHz)</label>
            <input type="number" bind:value={formData.frequency} placeholder="617" />
          </div>
          
          <div class="form-group">
            <label>Bandwidth (MHz)</label>
            <input type="number" bind:value={formData.bandwidth} placeholder="10" />
          </div>
        </div>
      </div>
      
      <!-- Equipment -->
      <div class="section">
        <h3>📻 Equipment Details</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Antenna Manufacturer</label>
            <input type="text" bind:value={formData.antennaManufacturer} placeholder="Commscope" />
          </div>
          
          <div class="form-group">
            <label>Antenna Model</label>
            <input type="text" bind:value={formData.antennaModel} placeholder="SBNHH-1D65C" />
          </div>
          
          <div class="form-group">
            <label>Antenna Serial Number</label>
            <input type="text" bind:value={formData.antennaSerialNumber} placeholder="SN123456" />
          </div>
        </div>
        
        <div class="form-grid">
          <div class="form-group">
            <label>Radio Manufacturer</label>
            <input type="text" bind:value={formData.radioManufacturer} placeholder="Nokia" />
          </div>
          
          <div class="form-group">
            <label>Radio Model</label>
            <input type="text" bind:value={formData.radioModel} placeholder="AEQE" />
          </div>
          
          <div class="form-group">
            <label>Radio Serial Number</label>
            <input type="text" bind:value={formData.radioSerialNumber} placeholder="RN789012" />
          </div>
        </div>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" on:click={handleClose}>Cancel</button>
      <button class="btn-primary" on:click={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : '✅ Create Sector'}
      </button>
    </div>
  </div>
</div>
{/if}

<style>
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
    z-index: 1000;
  }
  
  .modal-content {
    background: var(--card-bg);
    border-radius: 12px;
    width: 90%;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
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
    font-size: 1.5rem;
    color: var(--text-primary);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
  }
  
  .error-banner {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 1rem;
    margin: 0 1.5rem;
    margin-top: 1rem;
    border-radius: 6px;
  }
  
  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }
  
  .section {
    margin-bottom: 2rem;
  }
  
  .section:last-child {
    margin-bottom: 0;
  }
  
  .section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: var(--brand-primary);
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
    font-weight: 500;
    font-size: 0.9rem;
    color: var(--text-primary);
  }
  
  .form-group input,
  .form-group select {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.9rem;
  }
  
  .help-text {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin: 0;
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--brand-primary);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--brand-primary-hover);
    transform: translateY(-2px);
  }
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }
</style>

