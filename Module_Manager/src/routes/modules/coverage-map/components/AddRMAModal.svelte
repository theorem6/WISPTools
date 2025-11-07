<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { coverageMapService } from '../lib/coverageMapService.mongodb';
  import { mapLayerManager } from '$lib/map/MapLayerManager';
  
  export let show = false;
  export let initialLatitude: number | null = null;
  export let initialLongitude: number | null = null;
  export let tenantId: string;
export let planId: string | null = null;
  
  const dispatch = createEventDispatcher();
  let isSaving = false;
  let error = '';
  
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
      error = 'RMA center name is required';
      return;
    }
    
    isSaving = true;
    error = '';
    
    try {
      if (planId) {
        const properties: Record<string, any> = {
          name: formData.name.trim(),
          siteType: 'rma',
          address: formData.address?.trim() || undefined,
          city: formData.city?.trim() || undefined,
          state: formData.state?.trim() || undefined,
          zipCode: formData.zipCode?.trim() || undefined,
          contact: formData.contactName?.trim()
            ? {
                name: formData.contactName.trim(),
                phone: formData.contactPhone?.trim() || undefined,
                email: formData.contactEmail?.trim() || undefined
              }
            : undefined,
          notes: formData.notes?.trim() || undefined
        };

        await mapLayerManager.addFeature(planId, {
          featureType: 'site',
          geometry: {
            type: 'Point',
            coordinates: [formData.longitude, formData.latitude]
          },
          properties,
          status: 'draft'
        });

        dispatch('saved', { message: 'RMA center staged in plan.' });
      } else {
        const siteData: any = {
          name: formData.name,
          type: 'rma',
          location: {
            latitude: formData.latitude,
            longitude: formData.longitude
          },
          tenantId
        };

        if (formData.address?.trim()) siteData.location.address = formData.address.trim();
        if (formData.city?.trim()) siteData.location.city = formData.city.trim();
        if (formData.state?.trim()) siteData.location.state = formData.state.trim();
        if (formData.zipCode?.trim()) siteData.location.zipCode = formData.zipCode.trim();

        if (formData.contactName?.trim()) {
          siteData.siteContact = {
            name: formData.contactName.trim(),
            phone: formData.contactPhone?.trim() || '',
            email: formData.contactEmail?.trim() || ''
          };
        }

        if (formData.notes?.trim()) {
          siteData.accessInstructions = formData.notes.trim();
        }

        await coverageMapService.createTowerSite(tenantId, siteData);
        dispatch('saved', { message: 'RMA center created successfully.' });
      }
      handleClose();
    } catch (err: any) {
      error = err.message || 'Failed to create RMA center';
    } finally {
      isSaving = false;
    }
  }
  
  function handleClose() { show = false; error = ''; }
</script>

{#if show}
<div class="modal-overlay" on:click={handleClose}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <h2>🔧 Add RMA / Repair Center</h2>
      <button class="close-btn" on:click={handleClose}>✕</button>
    </div>
    
    {#if error}<div class="error-banner">{error}</div>{/if}
    
    <div class="modal-body">
      <div class="form-group">
        <label>RMA Center Name *</label>
        <input type="text" bind:value={formData.name} placeholder="Repair Center" required />
      </div>
      
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
        <label>Address</label>
        <input type="text" bind:value={formData.address} placeholder="789 Repair Blvd" />
      </div>
      
      <div class="form-grid">
        <div class="form-group">
          <label>City</label>
          <input type="text" bind:value={formData.city} />
        </div>
        
        <div class="form-group">
          <label>State</label>
          <input type="text" bind:value={formData.state} />
        </div>
        
        <div class="form-group">
          <label>ZIP</label>
          <input type="text" bind:value={formData.zipCode} />
        </div>
      </div>
      
      <div class="form-grid">
        <div class="form-group">
          <label>Contact Name</label>
          <input type="text" bind:value={formData.contactName} />
        </div>
        
        <div class="form-group">
          <label>Phone</label>
          <input type="tel" bind:value={formData.contactPhone} />
        </div>
      </div>
      
      <div class="form-group">
        <label>Notes</label>
        <textarea bind:value={formData.notes} rows="2" placeholder="RMA procedures, shipping address..."></textarea>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" on:click={handleClose}>Cancel</button>
      <button class="btn-primary" on:click={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : '✅ Create RMA Center'}
      </button>
    </div>
  </div>
</div>
{/if}

<style>
  .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .modal-content { background: var(--card-bg); border-radius: 12px; width: 90%; max-width: 500px; max-height: 90vh; display: flex; flex-direction: column; }
  .modal-header { display: flex; justify-content: space-between; padding: 1.5rem; border-bottom: 1px solid var(--border-color); background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: white; border-radius: 12px 12px 0 0; }
  .modal-header h2 { margin: 0; font-size: 1.5rem; }
  .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: white; }
  .error-banner { background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 1rem; margin: 1rem 1.5rem; border-radius: 6px; }
  .modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; }
  .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; }
  .form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.75rem; }
  .form-group label { font-weight: 500; font-size: 0.85rem; }
  .form-group input, .form-group textarea { padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); }
  .form-group textarea { resize: vertical; font-family: inherit; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 1rem; padding: 1.5rem; border-top: 1px solid var(--border-color); }
  .btn-primary, .btn-secondary { padding: 0.75rem 1.5rem; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .btn-primary { background: var(--brand-primary); color: white; }
  .btn-primary:disabled { opacity: 0.6; }
  .btn-secondary { background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); }
</style>

