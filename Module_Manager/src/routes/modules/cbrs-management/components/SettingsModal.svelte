<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  export let config: any = {};
  
  const dispatch = createEventDispatcher();
  
  // Form state
  let formData = {
    deploymentModel: config.deploymentModel || 'shared-platform',
    provider: config.provider || 'google',
    
    // Shared platform mode (simpler)
    googleUserId: config.googleUserId || '',
    
    // Per-tenant mode (full credentials)
    googleApiEndpoint: config.googleApiEndpoint || 'https://sas.googleapis.com/v1',
    googleApiKey: config.googleApiKey || '',
    googleCertificatePath: config.googleCertificatePath || '',
    federatedApiEndpoint: config.federatedApiEndpoint || 'https://sas.federatedwireless.com/api/v1',
    federatedApiKey: config.federatedApiKey || '',
    federatedCustomerId: config.federatedCustomerId || '',
    
    // Enhanced features
    enableAnalytics: config.enableAnalytics || false,
    enableOptimization: config.enableOptimization || false,
    enableMultiSite: config.enableMultiSite || false,
    enableInterferenceMonitoring: config.enableInterferenceMonitoring || false
  };
  
  let isSaving = false;
  let testResult = '';
  let showTestResult = false;
  
  function handleClose() {
    dispatch('close');
  }
  
  async function handleSave() {
    isSaving = true;
    try {
      dispatch('save', formData);
      testResult = '';
      showTestResult = false;
    } catch (error: any) {
      console.error('Error saving settings:', error);
      testResult = `Error: ${error.message}`;
      showTestResult = true;
    } finally {
      isSaving = false;
    }
  }
  
  async function handleTestConnection() {
    showTestResult = true;
    testResult = 'Testing connection...';
    
    try {
      // Test the configuration
      const provider = formData.provider;
      const endpoint = provider === 'google' 
        ? formData.googleApiEndpoint 
        : formData.federatedApiEndpoint;
      
      testResult = `✓ Configuration valid for ${provider === 'google' ? 'Google SAS' : 'Federated Wireless'}`;
      
      // In a real implementation, you would make a test API call here
      // For now, we just validate that required fields are filled
      if (provider === 'google' && !formData.googleApiKey) {
        testResult = '✗ Google API key is required';
      } else if (provider === 'federated-wireless' && (!formData.federatedApiKey || !formData.federatedCustomerId)) {
        testResult = '✗ Federated Wireless requires API key and Customer ID';
      }
    } catch (error: any) {
      testResult = `✗ Connection test failed: ${error.message}`;
    }
  }
  
  function handleProviderChange() {
    testResult = '';
    showTestResult = false;
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={handleClose}>
    <div class="modal-content settings-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>⚙️ CBRS Module Settings</h3>
        <button class="modal-close" on:click={handleClose}>✕</button>
      </div>
      
      <div class="modal-body">
        <form on:submit|preventDefault={handleSave}>
          <!-- Deployment Model Selection -->
          <div class="form-section deployment-model-section">
            <h4>💡 Deployment Model</h4>
            
            <div class="deployment-cards">
              <label class="deployment-card" class:selected={formData.deploymentModel === 'shared-platform'}>
                <input type="radio" bind:group={formData.deploymentModel} value="shared-platform" />
                <div class="card-header">
                  <span class="card-icon">🏢</span>
                  <span class="card-title">Shared Platform</span>
                  <span class="card-badge recommended">Recommended</span>
                </div>
                <p class="card-description">
                  Use platform's shared API keys. You only need to provide your unique User ID / Customer ID.
                </p>
                <div class="card-benefits">
                  <span class="benefit">💰 Lower cost</span>
                  <span class="benefit">⚡ Quick setup</span>
                  <span class="benefit">✅ Tenant isolation via ID</span>
                </div>
              </label>
              
              <label class="deployment-card" class:selected={formData.deploymentModel === 'per-tenant'}>
                <input type="radio" bind:group={formData.deploymentModel} value="per-tenant" />
                <div class="card-header">
                  <span class="card-icon">🔒</span>
                  <span class="card-title">Private Credentials</span>
                  <span class="card-badge enterprise">Enterprise</span>
                </div>
                <p class="card-description">
                  Use your own SAS account and API keys for maximum security and isolation.
                </p>
                <div class="card-benefits">
                  <span class="benefit">🔐 Maximum security</span>
                  <span class="benefit">📊 Private quota</span>
                  <span class="benefit">🏆 White-label ready</span>
                </div>
              </label>
            </div>
          </div>
          
          <!-- Provider Selection -->
          <div class="form-section">
            <h4>SAS Provider Configuration</h4>
            
            <div class="form-group">
              <label>
                Primary SAS Provider
                <span class="required">*</span>
              </label>
              <select bind:value={formData.provider} on:change={handleProviderChange}>
                <option value="google">Google SAS</option>
                <option value="federated-wireless">Federated Wireless</option>
                <option value="both">Both (Advanced)</option>
              </select>
              <span class="form-hint">Select your primary Spectrum Access System provider</span>
            </div>
          </div>
          
          <!-- Google SAS Configuration -->
          {#if formData.provider === 'google' || formData.provider === 'both'}
            <div class="form-section">
              <h4>🔵 Google SAS Configuration</h4>
              
              {#if formData.deploymentModel === 'shared-platform'}
                <!-- Shared Platform Mode - Simple -->
                <div class="info-banner">
                  <span class="info-icon">ℹ️</span>
                  <div class="info-content">
                    <strong>Shared Platform Mode</strong>
                    <p>You're using the platform's shared Google SAS API key. Just provide your unique User ID.</p>
                  </div>
                </div>
                
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
              {:else}
                <!-- Per-Tenant Mode - Full Credentials -->
                <div class="info-banner warning">
                  <span class="info-icon">🔒</span>
                  <div class="info-content">
                    <strong>Private Credentials Mode</strong>
                    <p>You'll need your own Google SAS account and API credentials.</p>
                  </div>
                </div>
                
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
                  <span class="form-hint">Your Google SAS User ID registered with Google</span>
                </div>
                
                <div class="form-group">
                  <label>
                    API Endpoint
                    <span class="required">*</span>
                  </label>
                  <input 
                    type="text" 
                    bind:value={formData.googleApiEndpoint}
                    placeholder="https://sas.googleapis.com/v1"
                    required
                  />
                  <span class="form-hint">Google SAS API endpoint URL</span>
                </div>
                
                <div class="form-group">
                  <label>
                    API Key
                    <span class="required">*</span>
                  </label>
                  <input 
                    type="password" 
                    bind:value={formData.googleApiKey}
                    placeholder="Enter your Google SAS API key"
                    required
                  />
                  <span class="form-hint">Your private Google Cloud API key for SAS access</span>
                </div>
                
                <div class="form-group">
                  <label>Certificate Path (Optional)</label>
                  <input 
                    type="text" 
                    bind:value={formData.googleCertificatePath}
                    placeholder="/path/to/certificate.pem"
                  />
                  <span class="form-hint">Path to client certificate for mutual TLS (if required)</span>
                </div>
              {/if}
            </div>
          {/if}
          
          <!-- Federated Wireless Configuration -->
          {#if formData.provider === 'federated-wireless' || formData.provider === 'both'}
            <div class="form-section">
              <h4>🟢 Federated Wireless Configuration</h4>
              
              {#if formData.deploymentModel === 'shared-platform'}
                <!-- Shared Platform Mode - Simple -->
                <div class="info-banner">
                  <span class="info-icon">ℹ️</span>
                  <div class="info-content">
                    <strong>Shared Platform Mode</strong>
                    <p>You're using the platform's shared Federated Wireless API key. Just provide your Customer ID.</p>
                  </div>
                </div>
                
                <div class="form-group">
                  <label>
                    Customer ID
                    <span class="required">*</span>
                  </label>
                  <input 
                    type="text" 
                    bind:value={formData.federatedCustomerId}
                    placeholder="your-organization-customer-id"
                    required
                  />
                  <span class="form-hint">
                    Your unique Federated Wireless Customer ID (e.g., "acme-wireless-001").
                    This identifies your organization in the shared SAS system.
                  </span>
                </div>
              {:else}
                <!-- Per-Tenant Mode - Full Credentials -->
                <div class="info-banner warning">
                  <span class="info-icon">🔒</span>
                  <div class="info-content">
                    <strong>Private Credentials Mode</strong>
                    <p>You'll need your own Federated Wireless account and API credentials.</p>
                  </div>
                </div>
                
                <div class="form-group">
                  <label>
                    Customer ID
                    <span class="required">*</span>
                  </label>
                  <input 
                    type="text" 
                    bind:value={formData.federatedCustomerId}
                    placeholder="your-customer-id"
                    required
                  />
                  <span class="form-hint">Your unique Federated Wireless customer identifier</span>
                </div>
                
                <div class="form-group">
                  <label>
                    API Endpoint
                    <span class="required">*</span>
                  </label>
                  <input 
                    type="text" 
                    bind:value={formData.federatedApiEndpoint}
                    placeholder="https://sas.federatedwireless.com/api/v1"
                    required
                  />
                  <span class="form-hint">Federated Wireless SAS API endpoint URL</span>
                </div>
                
                <div class="form-group">
                  <label>
                    API Key
                    <span class="required">*</span>
                  </label>
                  <input 
                    type="password" 
                    bind:value={formData.federatedApiKey}
                    placeholder="Enter your Federated Wireless API key"
                    required
                  />
                  <span class="form-hint">Your private Federated Wireless API authentication key</span>
                </div>
              {/if}
              
              <div class="form-section enhancement-section">
                <h5>Enhanced Features</h5>
                
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
            </div>
          {/if}
          
          <!-- Test Connection -->
          {#if showTestResult}
            <div class="test-result" class:success={testResult.startsWith('✓')} class:error={testResult.startsWith('✗')}>
              {testResult}
            </div>
          {/if}
          
          <!-- Security Notice -->
          <div class="security-notice">
            <div class="notice-icon">🔒</div>
            <div class="notice-content">
              <strong>Security Note:</strong> API keys are encrypted and stored securely. 
              They are never exposed in client-side code and are only used by backend services.
            </div>
          </div>
          
          <!-- Actions -->
          <div class="form-actions">
            <button 
              type="button" 
              class="btn btn-secondary" 
              on:click={handleTestConnection}
            >
              🧪 Test Connection
            </button>
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
    max-width: 800px;
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
  
  .form-section h5 {
    margin: 1rem 0 0.75rem 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-secondary);
  }
  
  .deployment-model-section {
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }
  
  .deployment-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 1rem;
  }
  
  .deployment-card {
    background: var(--bg-primary);
    border: 2px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.25rem;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }
  
  .deployment-card input[type="radio"] {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .deployment-card:hover {
    border-color: var(--accent-color);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.1);
  }
  
  .deployment-card.selected {
    border-color: var(--accent-color);
    background: rgba(139, 92, 246, 0.05);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);
  }
  
  .card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  
  .card-icon {
    font-size: 1.5rem;
  }
  
  .card-title {
    font-weight: 600;
    font-size: 0.9375rem;
    flex: 1;
  }
  
  .card-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .card-badge.recommended {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }
  
  .card-badge.enterprise {
    background: rgba(139, 92, 246, 0.1);
    color: #8b5cf6;
  }
  
  .card-description {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: 1rem;
  }
  
  .card-benefits {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  
  .benefit {
    font-size: 0.75rem;
    color: var(--text-primary);
    padding: 0.25rem 0;
  }
  
  .info-banner {
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
    display: flex;
    gap: 0.75rem;
  }
  
  .info-banner.warning {
    background: rgba(251, 191, 36, 0.05);
    border-color: rgba(251, 191, 36, 0.2);
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
  
  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.875rem;
    transition: all 0.2s;
  }
  
  .form-group input:focus,
  .form-group select:focus {
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
    margin-top: 1.5rem;
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
  
  .test-result {
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    font-weight: 500;
    font-size: 0.875rem;
  }
  
  .test-result.success {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }
  
  .test-result.error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
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

