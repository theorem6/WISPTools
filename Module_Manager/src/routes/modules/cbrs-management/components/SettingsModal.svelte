<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  export let config: any = {};
  
  const dispatch = createEventDispatcher();
  
  // Fixed to shared platform mode with Google SAS only
  let formData = {
    deploymentModel: 'shared-platform', // Fixed
    provider: 'google', // Fixed
    googleUserId: config.googleUserId || '',
    
    // Enhanced features
    enableAnalytics: config.enableAnalytics || false,
    enableOptimization: config.enableOptimization || false,
    enableMultiSite: config.enableMultiSite || false,
    enableInterferenceMonitoring: config.enableInterferenceMonitoring || false
  };
  
  let isSaving = false;
  
  function handleClose() {
    dispatch('close');
  }
  
  async function handleSave() {
    isSaving = true;
    try {
      dispatch('save', formData);
    } catch (error: any) {
      console.error('Error saving settings:', error);
    } finally {
      isSaving = false;
    }
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={handleClose}>
    <div class="modal-content settings-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>⚙️ CBRS Configuration</h3>
        <button class="modal-close" on:click={handleClose}>✕</button>
      </div>
      
      <div class="modal-body">
        <form on:submit|preventDefault={handleSave}>
          <!-- Platform Info -->
          <div class="info-banner">
            <span class="info-icon">🏢</span>
            <div class="info-content">
              <strong>Shared Platform Mode</strong>
              <p>You're using the platform's Google SAS API. Just provide your unique User ID to identify your organization in the SAS system.</p>
            </div>
          </div>
          
          <!-- Google SAS Configuration -->
          <div class="form-section">
            <h4>🔵 Google SAS User ID</h4>
            
            <div class="form-group">
              <label>
                Google User ID
                <span class="required">*</span>
              </label>
              <input 
                type="text" 
                bind:value={formData.googleUserId}
                placeholder="your-organization-id"
                required
              />
              <span class="form-hint">
                Your unique Google SAS User ID (e.g., "acme-wireless", "tenant-001").
                This identifies your organization in the shared SAS system.
              </span>
            </div>
          </div>
          
          <!-- Enhanced Features -->
          <div class="form-section enhancement-section">
            <h4>Enhanced Features</h4>
            
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={formData.enableAnalytics} />
                <span>Enable Advanced Analytics</span>
              </label>
              <p class="checkbox-hint">Get detailed performance metrics and insights</p>
            </div>
            
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={formData.enableOptimization} />
                <span>Enable Automated Optimization</span>
              </label>
              <p class="checkbox-hint">Let SAS automatically optimize spectrum assignments</p>
            </div>
            
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={formData.enableMultiSite} />
                <span>Enable Multi-Site Coordination</span>
              </label>
              <p class="checkbox-hint">Coordinate spectrum across multiple sites</p>
            </div>
            
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={formData.enableInterferenceMonitoring} />
                <span>Enable Interference Monitoring</span>
              </label>
              <p class="checkbox-hint">Real-time interference detection and alerts</p>
            </div>
          </div>
          
          <!-- Security Notice -->
          <div class="security-notice">
            <div class="notice-icon">🔒</div>
            <div class="notice-content">
              <strong>Platform API Keys:</strong> The platform administrator manages the Google SAS API credentials.
              Your data is isolated using your unique User ID.
            </div>
          </div>
          
          <!-- Actions -->
          <div class="form-actions">
            <button 
              type="button" 
              class="btn btn-secondary" 
              on:click={handleClose}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              class="btn btn-primary" 
              disabled={isSaving}
            >
              {#if isSaving}
                <span class="spinner"></span>
                Saving...
              {:else}
                💾 Save Settings
              {/if}
            </button>
          </div>
        </form>
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
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .settings-modal {
    background: var(--bg-primary);
    border-radius: 0.75rem;
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.3s ease-out;
  }
  
  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
    border-radius: 0.75rem 0.75rem 0 0;
  }
  
  .modal-header h3 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  
  .modal-close {
    background: none;
    border: none;
    font-size: 1.75rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
    line-height: 1;
  }
  
  .modal-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  .modal-body {
    padding: 2rem;
  }
  
  .form-section {
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .form-section:last-of-type {
    border-bottom: none;
  }
  
  .form-section h4 {
    margin: 0 0 1.5rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .info-banner {
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 2rem;
    display: flex;
    gap: 0.75rem;
  }
  
  .info-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }
  
  .info-content {
    flex: 1;
  }
  
  .info-content strong {
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
    color: var(--text-primary);
  }
  
  .info-content p {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }
  
  .form-group {
    margin-bottom: 1.5rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text-primary);
  }
  
  .required {
    color: #ef4444;
    margin-left: 0.25rem;
  }
  
  .form-group input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.875rem;
    transition: all 0.2s;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
  
  .form-hint {
    display: block;
    margin-top: 0.375rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-style: italic;
  }
  
  .enhancement-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.25rem;
  }
  
  .checkbox-group {
    margin-bottom: 1rem;
  }
  
  .checkbox-group:last-child {
    margin-bottom: 0;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.875rem;
  }
  
  .checkbox-label input[type="checkbox"] {
    width: auto;
    cursor: pointer;
    width: 1.125rem;
    height: 1.125rem;
  }
  
  .checkbox-hint {
    margin: 0.25rem 0 0 1.75rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  
  .security-notice {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
  }
  
  .notice-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }
  
  .notice-content {
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--text-secondary);
  }
  
  .notice-content strong {
    color: var(--text-primary);
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
  
  .btn {
    padding: 0.625rem 1.25rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .btn-primary {
    background: var(--accent-color);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  }
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  
  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--bg-hover);
    border-color: var(--accent-color);
  }
  
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  /* Scrollbar styling */
  .settings-modal::-webkit-scrollbar {
    width: 8px;
  }
  
  .settings-modal::-webkit-scrollbar-track {
    background: var(--bg-secondary);
  }
  
  .settings-modal::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
  }
  
  .settings-modal::-webkit-scrollbar-thumb:hover {
    background: var(--text-secondary);
  }
  
  @media (max-width: 768px) {
    .settings-modal {
      width: 95%;
      max-height: 95vh;
    }
    
    .modal-header {
      padding: 1rem 1.5rem;
    }
    
    .modal-header h3 {
      font-size: 1.25rem;
    }
    
    .modal-body {
      padding: 1.5rem;
    }
    
    .form-actions {
      flex-direction: column;
    }
    
    .btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>
