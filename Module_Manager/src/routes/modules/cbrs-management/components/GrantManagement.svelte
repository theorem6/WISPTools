<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CBSDDevice } from '../lib/models/cbsdDevice';
  
  const dispatch = createEventDispatcher();
  
  export let device: CBSDDevice | null;
  export let show = false;
  export let isLoading = false;
  
  let grantRequest = {
    maxEirp: 20,
    lowFrequency: 3550000000,
    highFrequency: 3560000000
  };
  
  function handleSubmit() {
    dispatch('request', grantRequest);
  }
  
  function handleCancel() {
    dispatch('cancel');
  }
  
  function handleRelinquish(grantId: string) {
    dispatch('relinquish', { grantId });
  }
</script>

{#if show && device}
  <div class="modal-overlay" on:click={handleCancel} on:keydown={(e) => e.key === 'Escape' && handleCancel()}>
    <div class="modal-content" on:click|stopPropagation on:keydown|stopPropagation>
      <div class="modal-header">
        <h3>Grant Management - {device.cbsdSerialNumber}</h3>
        <button class="close-button" on:click={handleCancel}>×</button>
      </div>
      
      <div class="modal-body">
        {#if device.grants && device.grants.length > 0}
          <div class="grants-section">
            <h4>Active Grants</h4>
            {#each device.grants as grant}
              <div class="grant-card">
                <div class="grant-info">
                  <div class="grant-detail">
                    <span class="label">Grant ID:</span>
                    <span class="value">{grant.grantId}</span>
                  </div>
                  <div class="grant-detail">
                    <span class="label">Frequency:</span>
                    <span class="value">
                      {(grant.frequencyRange.lowFrequency / 1000000).toFixed(1)} - 
                      {(grant.frequencyRange.highFrequency / 1000000).toFixed(1)} MHz
                    </span>
                  </div>
                  <div class="grant-detail">
                    <span class="label">Max EIRP:</span>
                    <span class="value">{grant.maxEirp} dBm</span>
                  </div>
                  <div class="grant-detail">
                    <span class="label">State:</span>
                    <span class="value status-{grant.state}">{grant.state}</span>
                  </div>
                </div>
                <button 
                  class="btn-danger-sm" 
                  on:click={() => handleRelinquish(grant.grantId)}
                  disabled={isLoading}
                >
                  Relinquish
                </button>
              </div>
            {/each}
          </div>
        {/if}
        
        <div class="request-section">
          <h4>Request New Grant</h4>
          
          <div class="form-group">
            <label for="lowFreq">Low Frequency (Hz)</label>
            <input
              id="lowFreq"
              type="number"
              bind:value={grantRequest.lowFrequency}
              step="1000000"
              required
            />
            <span class="hint">{(grantRequest.lowFrequency / 1000000).toFixed(1)} MHz</span>
          </div>
          
          <div class="form-group">
            <label for="highFreq">High Frequency (Hz)</label>
            <input
              id="highFreq"
              type="number"
              bind:value={grantRequest.highFrequency}
              step="1000000"
              required
            />
            <span class="hint">{(grantRequest.highFrequency / 1000000).toFixed(1)} MHz</span>
          </div>
          
          <div class="form-group">
            <label for="maxEirp">Max EIRP (dBm)</label>
            <input
              id="maxEirp"
              type="number"
              bind:value={grantRequest.maxEirp}
              step="1"
              min="0"
              max="37"
              required
            />
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={handleCancel} disabled={isLoading}>
          Cancel
        </button>
        <button class="btn-primary" on:click={handleSubmit} disabled={isLoading}>
          {isLoading ? 'Requesting...' : 'Request Grant'}
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
    max-width: 700px;
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
  
  .grants-section, .request-section {
    margin-bottom: var(--spacing-xl);
  }
  
  .grants-section h4, .request-section h4 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-primary);
    font-size: 1rem;
    font-weight: 600;
  }
  
  .grant-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-md);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .grant-info {
    flex: 1;
  }
  
  .grant-detail {
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-xs);
  }
  
  .grant-detail .label {
    color: var(--text-secondary);
    font-size: 0.875rem;
    min-width: 100px;
  }
  
  .grant-detail .value {
    color: var(--text-primary);
    font-size: 0.875rem;
    font-weight: 500;
  }
  
  .status-GRANTED {
    color: var(--success-color);
  }
  
  .status-AUTHORIZED {
    color: var(--info-color);
  }
  
  .form-group {
    margin-bottom: var(--spacing-md);
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
  
  .hint {
    display: block;
    margin-top: var(--spacing-xs);
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  
  .modal-footer {
    padding: var(--spacing-lg);
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
  }
  
  .btn-primary, .btn-secondary, .btn-danger-sm {
    padding: var(--spacing-sm) var(--spacing-lg);
    border: none;
    border-radius: var(--border-radius-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
    font-size: 0.875rem;
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
  
  .btn-danger-sm {
    background: var(--danger-color);
    color: white;
    padding: var(--spacing-xs) var(--spacing-sm);
  }
  
  .btn-danger-sm:hover:not(:disabled) {
    background: #dc2626;
    transform: translateY(-1px);
  }
  
  .btn-primary:disabled, .btn-secondary:disabled, .btn-danger-sm:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>

