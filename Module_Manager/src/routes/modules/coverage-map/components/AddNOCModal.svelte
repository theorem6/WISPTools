<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { coverageMapService } from '../lib/coverageMapService.mongodb';
  
  export let show = false;
  export let initialLatitude: number | null = null;
  export let initialLongitude: number | null = null;
  export let tenantId: string;
  
  const dispatch = createEventDispatcher();
  
  let isSaving = false;
  let error = '';
  
  // Form data - NOC specific (minimal fields)
  let formData = {
    name: '',
    latitude: initialLatitude || 40.7128,
    longitude: initialLongitude || -74.0060,
    address: '',
    city: '',
    state: '',
    zipCode: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    notes: ''
  };
  
  $: if (initialLatitude !== null) formData.latitude = initialLatitude;
  $: if (initialLongitude !== null) formData.longitude = initialLongitude;
  
  async function handleSave() {
    if (!formData.name.trim()) {
      error = 'NOC name is required';
      return;
    }
    
    isSaving = true;
    error = '';
    
    try {
      const siteData: any = {
        name: formData.name,
        type: 'noc',
        location: {
          latitude: formData.latitude,
          longitude: formData.longitude
        },
        tenantId
      };
      
      // Add optional location fields only if they have values
      if (formData.address?.trim()) siteData.location.address = formData.address.trim();
      if (formData.city?.trim()) siteData.location.city = formData.city.trim();
      if (formData.state?.trim()) siteData.location.state = formData.state.trim();
      if (formData.zipCode?.trim()) siteData.location.zipCode = formData.zipCode.trim();
      
      // Add optional contact only if name is provided
      if (formData.contactName?.trim()) {
        siteData.siteContact = {
          name: formData.contactName.trim(),
          phone: formData.contactPhone?.trim() || '',
          email: formData.contactEmail?.trim() || ''
        };
      }
      
      // Add notes if provided
      if (formData.notes?.trim()) {
        siteData.accessInstructions = formData.notes.trim();
      }
      
      await coverageMapService.createTowerSite(tenantId, siteData);
      
      dispatch('saved');
      handleClose();
    } catch (err: any) {
      error = err.message || 'Failed to create NOC';
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
      <h2>🏢 Add NOC (Network Operations Center)</h2>
      <button class="close-btn" on:click={handleClose}>✕</button>
    </div>
    
    {#if error}
      <div class="error-banner">{error}</div>
    {/if}
    
    <div class="modal-body">
      <!-- Basic Info -->
      <div class="section">
        <h3>📋 Basic Information</h3>
        <div class="form-group">
          <label>NOC Name *</label>
          <input type="text" bind:value={formData.name} placeholder="Main NOC" required />
        </div>
      </div>
      
      <!-- Location -->
      <div class="section">
        <h3>📍 Location</h3>
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
          <input type="text" bind:value={formData.address} placeholder="123 Data Center Dr" />
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
      
      <!-- Contact Info -->
      <div class="section">
        <h3>👤 NOC Contact</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Contact Name</label>
            <input type="text" bind:value={formData.contactName} placeholder="NOC Manager" />
          </div>
          
          <div class="form-group">
            <label>Phone</label>
            <input type="tel" bind:value={formData.contactPhone} placeholder="555-1234" />
          </div>
          
          <div class="form-group">
            <label>Email</label>
            <input type="email" bind:value={formData.contactEmail} placeholder="noc@company.com" />
          </div>
        </div>
      </div>
      
      <!-- Notes -->
      <div class="section">
        <h3>📝 Notes</h3>
        <div class="form-group">
          <textarea 
            bind:value={formData.notes} 
            placeholder="Building access, parking, special instructions..."
            rows="3"
          ></textarea>
        </div>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" on:click={handleClose}>Cancel</button>
      <button class="btn-primary" on:click={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : '✅ Create NOC'}
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
    max-width: 600px;
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
    background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
    color: white;
    border-radius: 12px 12px 0 0;
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
    color: white;
    padding: 0.25rem;
  }
  
  .error-banner {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 1rem;
    margin: 1rem 1.5rem;
    border-radius: 6px;
  }
  
  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }
  
  .section {
    margin-bottom: 1.5rem;
  }
  
  .section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: var(--brand-primary);
  }
  
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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
  .form-group textarea {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  
  .form-group textarea {
    resize: vertical;
    font-family: inherit;
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

