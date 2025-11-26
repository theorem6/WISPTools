<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { coverageMapService } from '../lib/coverageMapService.mongodb';
  
  export let show = false;
  export let site: any = null;  // Site data for editing, or null for new site
  export let tenantId: string;
  
  const dispatch = createEventDispatcher();
  
  let isSaving = false;
  let error = '';
  let searchAddress = '';
  let isSearching = false;
  
  // Form data - comprehensive for all site types
  let formData = {
    name: '',
    type: 'tower' as 'tower' | 'building' | 'noc' | 'warehouse' | 'pole' | 'internet-access' | 'internet' | 'other',
    status: 'active' as 'active' | 'inactive' | 'maintenance' | 'planned',
    
    // Location
    latitude: 40.7128,
    longitude: -74.0060,
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
    
    // Physical properties
    height: 0,
    structureType: '' as '' | 'self-supporting' | 'guyed' | 'monopole' | 'building-mounted' | 'other',
    owner: '',
    fccId: '',
    
    // Tower contact (for tower sites)
    towerContact: {
      name: '',
      email: '',
      phone: '',
      company: ''
    },
    
    // Building contact (for building sites)
    buildingContact: {
      name: '',
      email: '',
      phone: '',
      company: '',
      buildingManager: ''
    },
    
    // Site contact (on-site manager/maintenance)
    siteContact: {
      name: '',
      email: '',
      phone: '',
      role: ''
    },
    
    // General contact (fallback)
    contact: {
      name: '',
      email: '',
      phone: ''
    },
    
    // Access information
    gateCode: '',
    accessInstructions: '',
    safetyNotes: '',
    accessHours: ''
  };
  
  // Initialize form when modal opens or site changes
  $: if (show && site) {
    // Editing existing site
    formData.name = site.name || '';
    formData.type = site.type || 'tower';
    formData.status = site.status || 'active';
    formData.latitude = site.location?.latitude || 0;
    formData.longitude = site.location?.longitude || 0;
    formData.address = site.location?.address || '';
    formData.city = site.location?.city || '';
    formData.state = site.location?.state || '';
    formData.zipCode = site.location?.zipCode || '';
    formData.country = site.location?.country || 'US';
    formData.height = site.height || 0;
    formData.structureType = site.structureType || '';
    formData.owner = site.owner || '';
    formData.fccId = site.fccId || '';
    formData.gateCode = site.gateCode || '';
    formData.accessInstructions = site.accessInstructions || '';
    formData.safetyNotes = site.safetyNotes || '';
    formData.accessHours = site.accessHours || '';
    
    // Contacts
    formData.towerContact = {
      name: site.towerContact?.name || '',
      email: site.towerContact?.email || '',
      phone: site.towerContact?.phone || '',
      company: site.towerContact?.company || ''
    };
    formData.buildingContact = {
      name: site.buildingContact?.name || '',
      email: site.buildingContact?.email || '',
      phone: site.buildingContact?.phone || '',
      company: site.buildingContact?.company || '',
      buildingManager: site.buildingContact?.buildingManager || ''
    };
    formData.siteContact = {
      name: site.siteContact?.name || '',
      email: site.siteContact?.email || '',
      phone: site.siteContact?.phone || '',
      role: site.siteContact?.role || ''
    };
    formData.contact = {
      name: site.contact?.name || '',
      email: site.contact?.email || '',
      phone: site.contact?.phone || ''
    };
  } else if (show && !site) {
    // New site - reset to defaults
    formData = {
      name: '',
      type: 'tower',
      status: 'active',
      latitude: 0,
      longitude: 0,
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'US',
      height: 0,
      structureType: '',
      owner: '',
      fccId: '',
      towerContact: { name: '', email: '', phone: '', company: '' },
      buildingContact: { name: '', email: '', phone: '', company: '', buildingManager: '' },
      siteContact: { name: '', email: '', phone: '', role: '' },
      contact: { name: '', email: '', phone: '' },
      gateCode: '',
      accessInstructions: '',
      safetyNotes: '',
      accessHours: ''
    };
  }
  
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
    
    if (!formData.latitude || !formData.longitude) {
      error = 'GPS coordinates are required';
      return;
    }
    
    isSaving = true;
    error = '';
    
    try {
      const siteData: any = {
        name: formData.name.trim(),
        type: formData.type,
        status: formData.status,
        location: {
          latitude: formData.latitude,
          longitude: formData.longitude
        },
        tenantId
      };
      
      // Add location details
      if (formData.address?.trim()) siteData.location.address = formData.address.trim();
      if (formData.city?.trim()) siteData.location.city = formData.city.trim();
      if (formData.state?.trim()) siteData.location.state = formData.state.trim();
      if (formData.zipCode?.trim()) siteData.location.zipCode = formData.zipCode.trim();
      if (formData.country?.trim()) siteData.location.country = formData.country;
      
      // Physical properties
      if (formData.height) siteData.height = formData.height;
      if (formData.structureType) siteData.structureType = formData.structureType;
      if (formData.owner?.trim()) siteData.owner = formData.owner.trim();
      if (formData.fccId?.trim()) siteData.fccId = formData.fccId.trim();
      
      // Contacts (only if they have data)
      if (formData.towerContact.name?.trim()) {
        siteData.towerContact = {
          name: formData.towerContact.name.trim(),
          email: formData.towerContact.email?.trim() || '',
          phone: formData.towerContact.phone?.trim() || '',
          company: formData.towerContact.company?.trim() || ''
        };
      }
      
      if (formData.buildingContact.name?.trim()) {
        siteData.buildingContact = {
          name: formData.buildingContact.name.trim(),
          email: formData.buildingContact.email?.trim() || '',
          phone: formData.buildingContact.phone?.trim() || '',
          company: formData.buildingContact.company?.trim() || '',
          buildingManager: formData.buildingContact.buildingManager?.trim() || ''
        };
      }
      
      if (formData.siteContact.name?.trim()) {
        siteData.siteContact = {
          name: formData.siteContact.name.trim(),
          email: formData.siteContact.email?.trim() || '',
          phone: formData.siteContact.phone?.trim() || '',
          role: formData.siteContact.role?.trim() || ''
        };
      }
      
      // Fallback to general contact if no specific contacts
      if (!siteData.towerContact && !siteData.buildingContact && !siteData.siteContact) {
        if (formData.contact.name?.trim()) {
          siteData.contact = {
            name: formData.contact.name.trim(),
            email: formData.contact.email?.trim() || '',
            phone: formData.contact.phone?.trim() || ''
          };
        }
      }
      
      // Access information
      if (formData.gateCode?.trim()) siteData.gateCode = formData.gateCode.trim();
      if (formData.accessInstructions?.trim()) siteData.accessInstructions = formData.accessInstructions.trim();
      if (formData.safetyNotes?.trim()) siteData.safetyNotes = formData.safetyNotes.trim();
      if (formData.accessHours?.trim()) siteData.accessHours = formData.accessHours.trim();
      
      if (site?._id || site?.id) {
        // Update existing site
        const siteId = site._id || site.id;
        await coverageMapService.updateTowerSite(tenantId, siteId, siteData);
        dispatch('saved', { action: 'updated', siteId });
      } else {
        // Create new site
        const newSite = await coverageMapService.createTowerSite(tenantId, siteData);
        const createdSiteId = (newSite as { _id?: string })._id ?? newSite.id;
        dispatch('saved', { action: 'created', siteId: createdSiteId });
      }
      
      handleClose();
    } catch (err: any) {
      error = err.message || 'Failed to save site';
    } finally {
      isSaving = false;
    }
  }
  
  function handleClose() {
    show = false;
    error = '';
    searchAddress = '';
    dispatch('close');
  }
</script>

{#if show}
<div class="modal-overlay" onclick={handleClose}>
  <div class="modal-content" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2>
        {#if site}
          ✏️ Edit Site: {site.name}
        {:else}
          ➕ Create New Site
        {/if}
      </h2>
      <button class="close-btn" onclick={handleClose}>✕</button>
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
            onclick={handleSearchAddress}
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
            <label>Site Type *</label>
            <select bind:value={formData.type}>
              <option value="tower">📡 Tower</option>
              <option value="building">🏢 Building / Rooftop</option>
              <option value="noc">🖥️ NOC (Network Operations Center)</option>
              <option value="internet-access">🌐 Internet Access Point</option>
              <option value="warehouse">🏭 Warehouse</option>
              <option value="pole">📡 Pole / Monopole</option>
              <option value="other">📍 Other</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Status</label>
            <select bind:value={formData.status}>
              <option value="active">✅ Active</option>
              <option value="inactive">❌ Inactive</option>
              <option value="maintenance">🔧 Maintenance</option>
              <option value="planned">📅 Planned</option>
            </select>
          </div>
          
          {#if formData.type === 'tower' || formData.type === 'pole'}
          <div class="form-group">
            <label>Height (feet)</label>
            <input type="number" bind:value={formData.height} placeholder="100" min="0" />
          </div>
          
          <div class="form-group">
            <label>Structure Type</label>
            <select bind:value={formData.structureType}>
              <option value="">-- Select --</option>
              <option value="self-supporting">Self-Supporting</option>
              <option value="guyed">Guyed</option>
              <option value="monopole">Monopole</option>
              <option value="building-mounted">Building-Mounted</option>
              <option value="other">Other</option>
            </select>
          </div>
          {/if}
          
          <div class="form-group">
            <label>Owner</label>
            <input type="text" bind:value={formData.owner} placeholder="Tower Company LLC" />
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
          
          <div class="form-group">
            <label>Country</label>
            <input type="text" bind:value={formData.country} placeholder="US" />
          </div>
        </div>
      </div>
      
      <!-- Tower Contact (for tower/pole sites) -->
      {#if formData.type === 'tower' || formData.type === 'pole'}
      <div class="section">
        <h3>🏢 Tower Owner Contact</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Company</label>
            <input type="text" bind:value={formData.towerContact.company} placeholder="Tower Company LLC" />
          </div>
          
          <div class="form-group">
            <label>Contact Name</label>
            <input type="text" bind:value={formData.towerContact.name} placeholder="John Doe" />
          </div>
          
          <div class="form-group">
            <label>Phone</label>
            <input type="tel" bind:value={formData.towerContact.phone} placeholder="555-1234" />
          </div>
          
          <div class="form-group">
            <label>Email</label>
            <input type="email" bind:value={formData.towerContact.email} placeholder="contact@tower.com" />
          </div>
        </div>
      </div>
      {/if}
      
      <!-- Building Contact (for building sites) -->
      {#if formData.type === 'building'}
      <div class="section">
        <h3>🏢 Building Owner Contact</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Company</label>
            <input type="text" bind:value={formData.buildingContact.company} placeholder="Building Management Co" />
          </div>
          
          <div class="form-group">
            <label>Building Manager</label>
            <input type="text" bind:value={formData.buildingContact.buildingManager} placeholder="Jane Smith" />
          </div>
          
          <div class="form-group">
            <label>Contact Name</label>
            <input type="text" bind:value={formData.buildingContact.name} placeholder="John Doe" />
          </div>
          
          <div class="form-group">
            <label>Phone</label>
            <input type="tel" bind:value={formData.buildingContact.phone} placeholder="555-1234" />
          </div>
          
          <div class="form-group">
            <label>Email</label>
            <input type="email" bind:value={formData.buildingContact.email} placeholder="contact@building.com" />
          </div>
        </div>
      </div>
      {/if}
      
      <!-- Site Contact (for all site types) -->
      <div class="section">
        <h3>👷 On-Site Contact</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Name</label>
            <input type="text" bind:value={formData.siteContact.name} placeholder="Jane Smith" />
          </div>
          
          <div class="form-group">
            <label>Role</label>
            <input type="text" bind:value={formData.siteContact.role} placeholder="Site Manager" />
          </div>
          
          <div class="form-group">
            <label>Phone</label>
            <input type="tel" bind:value={formData.siteContact.phone} placeholder="555-5678" />
          </div>
          
          <div class="form-group">
            <label>Email</label>
            <input type="email" bind:value={formData.siteContact.email} placeholder="manager@site.com" />
          </div>
        </div>
      </div>
      
      <!-- General Contact (fallback) -->
      <div class="section">
        <h3>📞 General Contact (Fallback)</h3>
        <p class="help-text">Used if no specific contact types are provided</p>
        <div class="form-grid">
          <div class="form-group">
            <label>Name</label>
            <input type="text" bind:value={formData.contact.name} placeholder="Contact Name" />
          </div>
          
          <div class="form-group">
            <label>Phone</label>
            <input type="tel" bind:value={formData.contact.phone} placeholder="555-0000" />
          </div>
          
          <div class="form-group">
            <label>Email</label>
            <input type="email" bind:value={formData.contact.email} placeholder="contact@example.com" />
          </div>
        </div>
      </div>
      
      <!-- Access Information -->
      <div class="section">
        <h3>🔐 Site Access</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Gate Code</label>
            <input type="text" bind:value={formData.gateCode} placeholder="1234#" />
          </div>
          
          <div class="form-group">
            <label>Access Hours</label>
            <input type="text" bind:value={formData.accessHours} placeholder="24/7 or Mon-Fri 8am-5pm" />
          </div>
        </div>
        
        <div class="form-group">
          <label>Access Instructions</label>
          <textarea 
            bind:value={formData.accessInstructions} 
            placeholder="Call 30 minutes before arrival. Gate code required. Enter through main gate."
            rows="3"
          ></textarea>
        </div>
        
        <div class="form-group">
          <label>Safety Notes</label>
          <textarea 
            bind:value={formData.safetyNotes} 
            placeholder="High voltage equipment. PPE required. Confined space. Lockout/tagout required."
            rows="3"
          ></textarea>
        </div>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" onclick={handleClose}>Cancel</button>
      <button class="btn-primary" onclick={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : (site ? '💾 Save Changes' : '✅ Create Site')}
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

