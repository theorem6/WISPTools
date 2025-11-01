<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { coverageMapService } from '../lib/coverageMapService.mongodb';
  import type { TowerSite } from '../lib/models';
  
  export let show = false;
  export let sites: TowerSite[] = [];
  export let initialLatitude: number | null = null;
  export let initialLongitude: number | null = null;
  export let tenantId: string;
  export let planId: string | null = null; // Plan ID if creating CPE within a plan
  
  const dispatch = createEventDispatcher();
  
  let isSearching = false;
  let isSaving = false;
  let error = '';
  let searchAddress = '';
  
  // Form data
  let formData = {
    siteId: '',
    name: '',
    latitude: initialLatitude || 40.7128,
    longitude: initialLongitude || -74.0060,
    address: '',
    azimuth: 0,
    beamwidth: 30,
    heightAGL: 25,
    manufacturer: '',
    model: '',
    serialNumber: '',
    macAddress: '',
    subscriberName: '',
    subscriberPhone: '',
    subscriberEmail: '',
    accountNumber: '',
    serviceType: 'residential' as const,
    technology: 'FWA' as const,
    band: '',
    status: 'offline' as const
  };
  
  $: if (initialLatitude !== null) formData.latitude = initialLatitude;
  $: if (initialLongitude !== null) formData.longitude = initialLongitude;
  
  async function handleSearchAddress() {
    if (!searchAddress.trim()) return;
    
    isSearching = true;
    error = '';
    
    try {
      const result = await coverageMapService.geocodeAddress(searchAddress);
      if (result) {
        formData.latitude = result.latitude;
        formData.longitude = result.longitude;
        formData.address = searchAddress;
      }
    } catch (err: any) {
      error = 'Address not found';
    } finally {
      isSearching = false;
    }
  }
  
  async function handleSave() {
    if (!formData.name.trim() || !formData.manufacturer || !formData.model || !formData.serialNumber) {
      error = 'Name, manufacturer, model, and serial number are required';
      return;
    }
    
    isSaving = true;
    error = '';
    
    try {
      const cpeData = {
        siteId: formData.siteId || undefined,
        name: formData.name,
        location: {
          latitude: formData.latitude,
          longitude: formData.longitude,
          address: formData.address || undefined
        },
        azimuth: formData.azimuth,
        beamwidth: formData.beamwidth,
        heightAGL: formData.heightAGL || undefined,
        manufacturer: formData.manufacturer,
        model: formData.model,
        serialNumber: formData.serialNumber,
        macAddress: formData.macAddress || undefined,
        subscriberName: formData.subscriberName || undefined,
        subscriberContact: formData.subscriberName ? {
          name: formData.subscriberName,
          phone: formData.subscriberPhone,
          email: formData.subscriberEmail
        } : undefined,
        accountNumber: formData.accountNumber || undefined,
        serviceType: formData.serviceType,
        technology: formData.technology,
        band: formData.band || undefined,
        status: formData.status
      };
      
      await coverageMapService.createCPE(tenantId, cpeData);
      
      dispatch('saved');
      handleClose();
    } catch (err: any) {
      error = err.message || 'Failed to create CPE';
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
      <h2>📱 Add CPE Device</h2>
      <button class="close-btn" on:click={handleClose}>✕</button>
    </div>
    
    {#if error}
      <div class="error-banner">{error}</div>
    {/if}
    
    <div class="modal-body">
      <!-- Address Search -->
      <div class="section">
        <h3>🔍 Customer Location</h3>
        <div class="search-group">
          <input
            type="text"
            bind:value={searchAddress}
            placeholder="Enter customer address..."
            on:keydown={(e) => e.key === 'Enter' && handleSearchAddress()}
          />
          <button class="btn-secondary" on:click={handleSearchAddress} disabled={isSearching}>
            {isSearching ? '...' : 'Search'}
          </button>
        </div>
        
        <div class="form-grid">
          <div class="form-group">
            <label>Latitude *</label>
            <input type="number" step="0.000001" bind:value={formData.latitude} />
          </div>
          
          <div class="form-group">
            <label>Longitude *</label>
            <input type="number" step="0.000001" bind:value={formData.longitude} />
          </div>
        </div>
        
        <div class="form-group">
          <label>Address</label>
          <input type="text" bind:value={formData.address} placeholder="123 Main St, City, State" />
        </div>
      </div>
      
      <!-- Basic Info -->
      <div class="section">
        <h3>📋 Equipment Information</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Device Name *</label>
            <input type="text" bind:value={formData.name} placeholder="Smith Residence FWA" />
          </div>
          
          <div class="form-group">
            <label>Manufacturer *</label>
            <input type="text" bind:value={formData.manufacturer} placeholder="Telrad" />
          </div>
        </div>
        
        <div class="form-grid">
          <div class="form-group">
            <label>Model *</label>
            <input type="text" bind:value={formData.model} placeholder="CPE7000" />
          </div>
          
          <div class="form-group">
            <label>Serial Number *</label>
            <input type="text" bind:value={formData.serialNumber} placeholder="CPE-123456" />
          </div>
          
          <div class="form-group">
            <label>MAC Address</label>
            <input type="text" bind:value={formData.macAddress} placeholder="00:11:22:33:44:55" />
          </div>
        </div>
      </div>
      
      <!-- Installation -->
      <div class="section">
        <h3>📡 Installation Details</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Pointing Azimuth (degrees) *</label>
            <input type="number" min="0" max="360" bind:value={formData.azimuth} />
            <p class="help-text">Direction CPE antenna is pointed</p>
          </div>
          
          <div class="form-group">
            <label>Beamwidth (degrees)</label>
            <input type="number" bind:value={formData.beamwidth} />
            <p class="help-text">Default: 30° for FWA CPE</p>
          </div>
          
          <div class="form-group">
            <label>Height Above Ground (feet)</label>
            <input type="number" bind:value={formData.heightAGL} placeholder="25" />
          </div>
        </div>
        
        <div class="form-grid">
          <div class="form-group">
            <label>Technology</label>
            <select bind:value={formData.technology}>
              <option value="FWA">Fixed Wireless (FWA)</option>
              <option value="LTE">LTE</option>
              <option value="CBRS">CBRS</option>
              <option value="5G">5G NR</option>
              <option value="WiFi">WiFi</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Band / Frequency</label>
            <input type="text" bind:value={formData.band} placeholder="5GHz" />
          </div>
          
          <div class="form-group">
            <label>Connected to Site</label>
            <select bind:value={formData.siteId}>
              <option value="">None / Unknown</option>
              {#each sites as site}
                <option value={site.id}>{site.name}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>
      
      <!-- Subscriber Info -->
      <div class="section">
        <h3>👤 Subscriber Information</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Subscriber Name</label>
            <input type="text" bind:value={formData.subscriberName} placeholder="John Smith" />
          </div>
          
          <div class="form-group">
            <label>Phone</label>
            <input type="tel" bind:value={formData.subscriberPhone} placeholder="555-1234" />
          </div>
          
          <div class="form-group">
            <label>Email</label>
            <input type="email" bind:value={formData.subscriberEmail} placeholder="customer@example.com" />
          </div>
        </div>
        
        <div class="form-grid">
          <div class="form-group">
            <label>Account Number</label>
            <input type="text" bind:value={formData.accountNumber} placeholder="ACCT-1001" />
          </div>
          
          <div class="form-group">
            <label>Service Type</label>
            <select bind:value={formData.serviceType}>
              <option value="residential">Residential</option>
              <option value="business">Business</option>
              <option value="temporary">Temporary</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Status</label>
            <select bind:value={formData.status}>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="maintenance">Maintenance</option>
              <option value="inventory">Inventory</option>
            </select>
          </div>
        </div>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" on:click={handleClose}>Cancel</button>
      <button class="btn-primary" on:click={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : '✅ Create CPE'}
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
    max-width: 800px;
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
  
  .section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: var(--brand-primary);
  }
  
  .search-group {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .search-group input {
    flex: 1;
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
  }
  
  .form-group input,
  .form-group select {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
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
  }
  
  .btn-primary {
    background: var(--brand-primary);
    color: white;
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
</style>

