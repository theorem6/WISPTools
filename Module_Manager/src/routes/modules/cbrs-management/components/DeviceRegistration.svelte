<script lang="ts">
  import type { CBSDCategory } from '../lib/models/cbsdDevice';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  export let show = false;
  export let isLoading = false;
  
  let newDevice = {
    cbsdSerialNumber: '',
    fccId: '',
    cbsdCategory: 'A' as CBSDCategory,
    sasProviderId: 'google' as const,
    latitude: 40.7128,
    longitude: -74.0060,
    height: 10,
    antennaGain: 5
  };
  
  function handleSubmit() {
    dispatch('register', newDevice);
  }
  
  function handleCancel() {
    dispatch('cancel');
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={handleCancel} on:keydown={(e) => e.key === 'Escape' && handleCancel()}>
    <div class="modal-content" on:click|stopPropagation on:keydown|stopPropagation>
      <div class="modal-header">
        <h3>Register New CBSD Device</h3>
        <button class="close-button" on:click={handleCancel}>×</button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label for="serialNumber">CBSD Serial Number *</label>
          <input
            id="serialNumber"
            type="text"
            bind:value={newDevice.cbsdSerialNumber}
            placeholder="e.g., SN123456789"
            required
          />
        </div>
        
        <div class="form-group">
          <label for="fccId">FCC ID *</label>
          <input
            id="fccId"
            type="text"
            bind:value={newDevice.fccId}
            placeholder="e.g., ABC-123-XYZ"
            required
          />
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="category">Category</label>
            <select id="category" bind:value={newDevice.cbsdCategory}>
              <option value="A">Category A (Indoor, &lt; 1 W)</option>
              <option value="B">Category B (Outdoor, &gt; 1 W)</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="provider">SAS Provider</label>
            <select id="provider" bind:value={newDevice.sasProviderId} disabled>
              <option value="google">Google SAS</option>
            </select>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="latitude">Latitude *</label>
            <input
              id="latitude"
              type="number"
              step="0.000001"
              bind:value={newDevice.latitude}
              required
            />
          </div>
          
          <div class="form-group">
            <label for="longitude">Longitude *</label>
            <input
              id="longitude"
              type="number"
              step="0.000001"
              bind:value={newDevice.longitude}
              required
            />
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="height">Height (m)</label>
            <input
              id="height"
              type="number"
              step="0.1"
              bind:value={newDevice.height}
            />
          </div>
          
          <div class="form-group">
            <label for="gain">Antenna Gain (dBi)</label>
            <input
              id="gain"
              type="number"
              step="0.1"
              bind:value={newDevice.antennaGain}
            />
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={handleCancel} disabled={isLoading}>
          Cancel
        </button>
        <button class="btn-primary" on:click={handleSubmit} disabled={isLoading}>
          {isLoading ? 'Registering...' : 'Register Device'}
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
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal-content {
    background: var(--card-bg);
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-xl);
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
  }
  
  .modal-header {
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .modal-header h3 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .close-button {
    background: none;
    border: none;
    font-size: 2rem;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius-sm);
    transition: var(--transition);
  }
  
  .close-button:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }
  
  .modal-body {
    padding: var(--spacing-lg);
  }
  
  .form-group {
    margin-bottom: var(--spacing-md);
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);
  }
  
  label {
    display: block;
    margin-bottom: var(--spacing-sm);
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 0.875rem;
  }
  
  input, select {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.875rem;
    transition: var(--transition);
  }
  
  input:focus, select:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light);
  }
  
  .modal-footer {
    padding: var(--spacing-lg);
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
  }
  
  .btn-primary, .btn-secondary {
    padding: var(--spacing-sm) var(--spacing-lg);
    border: none;
    border-radius: var(--border-radius-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
  }
  
  .btn-primary {
    background: var(--primary-color);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-tertiary);
  }
  
  .btn-primary:disabled, .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>

