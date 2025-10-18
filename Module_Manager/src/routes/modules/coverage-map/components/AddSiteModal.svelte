<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { coverageMapService } from '../lib/coverageMapService.mongodb';
  
  export let show = false;
  export let initialLatitude: number | null = null;
  export let initialLongitude: number | null = null;
  export let initialType: 'tower' | 'noc' | null = null;
  export let tenantId: string;
  
  const dispatch = createEventDispatcher();
  
  let isSearching = false;
  let isSaving = false;
  let error = '';
  let searchAddress = '';
  
  // Form data
  let formData = {
    name: '',
    type: (initialType || 'tower') as 'tower' | 'rooftop' | 'monopole' | 'warehouse' | 'noc' | 'other',
    latitude: initialLatitude || 40.7128,
    longitude: initialLongitude || -74.0060,
    address: '',
    city: '',
    state: '',
    zipCode: '',
    height: 100,
    fccId: '',
    towerOwner: '',
    towerContactName: '',
    towerContactPhone: '',
    towerContactEmail: '',
    siteContactName: '',
    siteContactPhone: '',
    siteContactEmail: '',
    gateCode: '',
    accessInstructions: '',
    safetyNotes: ''
  };
  
  $: if (initialLatitude !== null) formData.latitude = initialLatitude;
  $: if (initialLongitude !== null) formData.longitude = initialLongitude;
  
  async function handleSearchAddress() {
    if (!searchAddress.trim()) {
      error = 'Please enter an address';
      return;
    }
    
    isSearching = true;
    error = '';
    
    try {
      const result = await coverageMapService.geocodeAddress(searchAddress);
      if (result) {
        formData.latitude = result.latitude;
        formData.longitude = result.longitude;
        formData.address = searchAddress;
      } else {
        error = 'Address not found. Try a different search.';
      }
    } catch (err: any) {
      error = err.message || 'Geocoding failed';
    } finally {
      isSearching = false;
    }
  }
  
  async function handleSave() {
    if (!formData.name.trim()) {
      error = 'Site name is required';
      return;
    }
    
    isSaving = true;
    error = '';
    
    try {
      const siteData = {
        name: formData.name,
        type: formData.type,
        location: {
          latitude: formData.latitude,
          longitude: formData.longitude,
          address: formData.address || undefined,
          city: formData.city || undefined,
          state: formData.state || undefined,
          zipCode: formData.zipCode || undefined
        },
        height: formData.height || undefined,
        fccId: formData.fccId || undefined,
        towerOwner: formData.towerOwner || undefined,
        towerContact: formData.towerContactName ? {
          name: formData.towerContactName,
          phone: formData.towerContactPhone,
          email: formData.towerContactEmail
        } : undefined,
        siteContact: formData.siteContactName ? {
          name: formData.siteContactName,
          phone: formData.siteContactPhone,
          email: formData.siteContactEmail
        } : undefined,
        gateCode: formData.gateCode || undefined,
        accessInstructions: formData.accessInstructions || undefined,
        safetyNotes: formData.safetyNotes || undefined
      };
      
      await coverageMapService.createTowerSite(tenantId, siteData);
      
      dispatch('saved');
      handleClose();
    } catch (err: any) {
      error = err.message || 'Failed to create site';
    } finally {
      isSaving = false;
    }
  }
  
  function handleClose() {
    show = false;
    error = '';
    searchAddress = '';
  }
</script>

{#if show}
<div class="modal-overlay" on:click={handleClose}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <h2>📡 Add Tower Site</h2>
      <button class="close-btn" on:click={handleClose}>✕</button>
    </div>
    
    {#if error}
      <div class="error-banner">{error}</div>
    {/if}
    
    <div class="modal-body">
      <!-- Address Search -->
      <div class="section">
        <h3>🔍 Find Location</h3>
        <div class="search-group">
          <input
            type="text"
            bind:value={searchAddress}
            placeholder="Enter address to search..."
            on:keydown={(e) => e.key === 'Enter' && handleSearchAddress()}
          />
          <button 
            class="btn-secondary" 
            on:click={handleSearchAddress}
            disabled={isSearching}
          >
            {isSearching ? '...' : 'Search'}
          </button>
        </div>
        <p class="help-text">Or enter GPS coordinates below</p>
      </div>
      
      <!-- Basic Info -->
      <div class="section">
        <h3>📋 Basic Information</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Site Name *</label>
            <input type="text" bind:value={formData.name} placeholder="Main Tower Site" required />
          </div>
          
          <div class="form-group">
            <label>Type</label>
          <select bind:value={formData.type}>
            <option value="tower">Tower</option>
            <option value="rooftop">Rooftop</option>
            <option value="monopole">Monopole</option>
            <option value="warehouse">Warehouse</option>
            <option value="noc">NOC (Network Operations Center)</option>
            <option value="other">Other</option>
          </select>
          </div>
          
          <div class="form-group">
            <label>Height (feet)</label>
            <input type="number" bind:value={formData.height} placeholder="100" />
          </div>
          
          <div class="form-group">
            <label>FCC ID</label>
            <input type="text" bind:value={formData.fccId} placeholder="FCC-12345" />
          </div>
        </div>
      </div>
      
      <!-- Location -->
      <div class="section">
        <h3>📍 GPS Coordinates</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Latitude *</label>
            <input type="number" step="0.000001" bind:value={formData.latitude} required />
          </div>
          
          <div class="form-group">
            <label>Longitude *</label>
            <input type="number" step="0.000001" bind:value={formData.longitude} required />
          </div>
        </div>
        
        <div class="form-group">
          <label>Street Address</label>
          <input type="text" bind:value={formData.address} placeholder="123 Tower Rd" />
        </div>
        
        <div class="form-grid">
          <div class="form-group">
            <label>City</label>
            <input type="text" bind:value={formData.city} placeholder="New York" />
          </div>
          
          <div class="form-group">
            <label>State</label>
            <input type="text" bind:value={formData.state} placeholder="NY" />
          </div>
          
          <div class="form-group">
            <label>ZIP Code</label>
            <input type="text" bind:value={formData.zipCode} placeholder="10001" />
          </div>
        </div>
      </div>
      
      <!-- Tower Contact -->
      <div class="section">
        <h3>🏢 Tower Owner Contact</h3>
        <div class="form-group">
          <label>Tower Owner</label>
          <input type="text" bind:value={formData.towerOwner} placeholder="Tower Company LLC" />
        </div>
        
        <div class="form-grid">
          <div class="form-group">
            <label>Contact Name</label>
            <input type="text" bind:value={formData.towerContactName} placeholder="John Doe" />
          </div>
          
          <div class="form-group">
            <label>Phone</label>
            <input type="tel" bind:value={formData.towerContactPhone} placeholder="555-1234" />
          </div>
          
          <div class="form-group">
            <label>Email</label>
            <input type="email" bind:value={formData.towerContactEmail} placeholder="contact@tower.com" />
          </div>
        </div>
      </div>
      
      <!-- Site Contact -->
      <div class="section">
        <h3>👷 On-Site Contact</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Site Manager</label>
            <input type="text" bind:value={formData.siteContactName} placeholder="Jane Smith" />
          </div>
          
          <div class="form-group">
            <label>Phone</label>
            <input type="tel" bind:value={formData.siteContactPhone} placeholder="555-5678" />
          </div>
          
          <div class="form-group">
            <label>Email</label>
            <input type="email" bind:value={formData.siteContactEmail} placeholder="manager@site.com" />
          </div>
        </div>
      </div>
      
      <!-- Access Info -->
      <div class="section">
        <h3>🔐 Site Access</h3>
        <div class="form-group">
          <label>Gate Code</label>
          <input type="text" bind:value={formData.gateCode} placeholder="1234#" />
        </div>
        
        <div class="form-group">
          <label>Access Instructions</label>
          <textarea 
            bind:value={formData.accessInstructions} 
            placeholder="Call 30 minutes before arrival. Gate code required."
            rows="2"
          ></textarea>
        </div>
        
        <div class="form-group">
          <label>Safety Notes</label>
          <textarea 
            bind:value={formData.safetyNotes} 
            placeholder="High voltage equipment. PPE required. Confined space."
            rows="2"
          ></textarea>
        </div>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" on:click={handleClose}>Cancel</button>
      <button class="btn-primary" on:click={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : '✅ Create Site'}
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
    color: var(--text-primary);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem;
  }
  
  .close-btn:hover {
    color: var(--text-primary);
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
    color: var(--text-primary);
  }
  
  .form-group input,
  .form-group select,
  .form-group textarea {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.9rem;
  }
  
  .form-group textarea {
    resize: vertical;
    font-family: inherit;
  }
  
  .help-text {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
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

