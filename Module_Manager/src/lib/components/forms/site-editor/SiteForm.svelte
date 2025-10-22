<script lang="ts">
  import type { CellSite } from '$lib/models/cellSite';
  import { createEventDispatcher } from 'svelte';
  
  export let site: CellSite;
  export let isNewSite = false;
  
  const dispatch = createEventDispatcher();
  
  function handleChange() {
    dispatch('change', site);
  }
</script>

<div class="site-form">
  <div class="form-section">
    <h4>Site Information</h4>
    
    <div class="form-group">
      <label for="siteName">Site Name *</label>
      <input
        id="siteName"
        type="text"
        bind:value={site.name}
        on:input={handleChange}
        placeholder="e.g., Downtown Tower 1"
        required
      />
    </div>
    
    <div class="form-row">
      <div class="form-group">
        <label for="eNodeB">eNodeB ID *</label>
        <input
          id="eNodeB"
          type="number"
          bind:value={site.eNodeB}
          on:input={handleChange}
          min="1"
          max="1048575"
          required
        />
        <span class="hint">Range: 1-1048575</span>
      </div>
      
      <div class="form-group">
        <label for="tac">TAC (Optional)</label>
        <input
          id="tac"
          type="number"
          bind:value={site.tac}
          on:input={handleChange}
          min="1"
          max="65535"
        />
        <span class="hint">Tracking Area Code</span>
      </div>
    </div>
  </div>
  
  <div class="form-section">
    <h4>Location</h4>
    
    <div class="form-row">
      <div class="form-group">
        <label for="latitude">Latitude *</label>
        <input
          id="latitude"
          type="number"
          step="0.000001"
          bind:value={site.latitude}
          on:input={handleChange}
          required
        />
      </div>
      
      <div class="form-group">
        <label for="longitude">Longitude *</label>
        <input
          id="longitude"
          type="number"
          step="0.000001"
          bind:value={site.longitude}
          on:input={handleChange}
          required
        />
      </div>
    </div>
    
    <div class="form-group">
      <label for="address">Address (Optional)</label>
      <input
        id="address"
        type="text"
        bind:value={site.address}
        on:input={handleChange}
        placeholder="Street address or landmark"
      />
    </div>
  </div>
  
  <div class="form-section">
    <h4>Network Configuration (Optional)</h4>
    
    <div class="form-row">
      <div class="form-group">
        <label for="mcc">MCC</label>
        <input
          id="mcc"
          type="text"
          bind:value={site.mcc}
          on:input={handleChange}
          maxlength="3"
          placeholder="e.g., 310"
        />
        <span class="hint">Mobile Country Code</span>
      </div>
      
      <div class="form-group">
        <label for="mnc">MNC</label>
        <input
          id="mnc"
          type="text"
          bind:value={site.mnc}
          on:input={handleChange}
          maxlength="3"
          placeholder="e.g., 410"
        />
        <span class="hint">Mobile Network Code</span>
      </div>
    </div>
  </div>
</div>

<style>
  .site-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }
  
  .form-section {
    background: var(--bg-secondary);
    padding: var(--spacing-md);
    border-radius: var(--border-radius);
  }
  
  .form-section h4 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-primary);
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .form-group {
    margin-bottom: var(--spacing-md);
  }
  
  .form-group:last-child {
    margin-bottom: 0;
  }
  
  .form-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-md);
  }
  
  label {
    display: block;
    margin-bottom: var(--spacing-sm);
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 0.875rem;
  }
  
  input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.875rem;
    transition: var(--transition);
  }
  
  input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light);
  }
  
  .hint {
    display: block;
    margin-top: var(--spacing-xs);
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  
  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>

