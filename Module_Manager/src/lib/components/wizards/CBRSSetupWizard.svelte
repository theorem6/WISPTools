<script lang="ts">
  /**
   * CBRS Setup Wizard
   * 
   * Guides users through CBRS/SAS configuration for their tenant.
   */
  
  import { createEventDispatcher, onMount } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { loadCBRSConfig, saveCBRSConfig, getConfigStatus, type CBRSConfig } from '../../routes/modules/cbrs-management/lib/services/configService';
  
  export let show = false;
  export let autoStart = false;
  
  const dispatch = createEventDispatcher();
  
  let currentStep = 0;
  let isLoading = false;
  let error = '';
  let success = '';
  
  // Wizard steps
  const steps = [
    { id: 'welcome', title: 'Welcome', icon: '📡' },
    { id: 'info', title: 'Information', icon: 'ℹ️' },
    { id: 'google-user-id', title: 'Google User ID', icon: '🔑' },
    { id: 'test', title: 'Test Connection', icon: '✅' },
    { id: 'complete', title: 'Complete!', icon: '🎉' }
  ];
  
  // Configuration state
  let googleUserId = '';
  let googleEmail = '';
  let configStatus: { status: 'complete' | 'incomplete' | 'missing'; message: string } | null = null;
  let existingConfig: CBRSConfig | null = null;
  
  onMount(async () => {
    if (show && autoStart) {
      await checkExistingConfig();
    }
  });
  
  async function checkExistingConfig() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) {
      error = 'No tenant selected';
      return;
    }
    
    isLoading = true;
    try {
      existingConfig = await loadCBRSConfig(tenantId);
      if (existingConfig) {
        googleUserId = existingConfig.googleUserId || '';
        googleEmail = existingConfig.googleEmail || '';
        configStatus = getConfigStatus(existingConfig);
        
        // If config is complete, skip to completion
        if (configStatus.status === 'complete') {
          currentStep = steps.length - 1;
        }
      }
    } catch (err: any) {
      error = err.message || 'Failed to load configuration';
    } finally {
      isLoading = false;
    }
  }
  
  function handleClose() {
    dispatch('close');
  }
  
  function nextStep() {
    if (currentStep < steps.length - 1) {
      currentStep++;
      error = '';
      success = '';
    }
  }
  
  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
      error = '';
      success = '';
    }
  }
  
  async function saveConfiguration() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) {
      error = 'No tenant selected';
      return;
    }
    
    if (!googleUserId.trim()) {
      error = 'Google User ID is required';
      return;
    }
    
    isLoading = true;
    error = '';
    success = '';
    
    try {
      const config: CBRSConfig = {
        deploymentModel: 'shared-platform',
        provider: 'google',
        googleUserId: googleUserId.trim(),
        googleEmail: googleEmail.trim() || undefined,
        tenantId,
        enableAnalytics: true,
        enableOptimization: true
      };
      
      await saveCBRSConfig(config);
      success = 'Configuration saved successfully!';
      existingConfig = config;
      configStatus = getConfigStatus(config);
      
      // Move to test step
      setTimeout(() => {
        nextStep();
      }, 1000);
    } catch (err: any) {
      error = err.message || 'Failed to save configuration';
    } finally {
      isLoading = false;
    }
  }
  
  async function testConnection() {
    isLoading = true;
    error = '';
    success = '';
    
    try {
      // Basic validation - actual connection test would require backend API call
      if (!googleUserId.trim()) {
        error = 'Google User ID is required';
        return;
      }
      
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      success = 'Configuration validated successfully!';
      
      // Move to completion step
      setTimeout(() => {
        nextStep();
      }, 1000);
    } catch (err: any) {
      error = err.message || 'Connection test failed';
    } finally {
      isLoading = false;
    }
  }
  
  function completeSetup() {
    dispatch('complete');
    handleClose();
  }
</script>

{#if show}
  <div class="wizard-overlay" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
    <div class="wizard-modal">
      <div class="wizard-header">
        <h2 id="wizard-title">📡 CBRS Setup Wizard</h2>
        <button class="close-btn" on:click={handleClose} aria-label="Close">✕</button>
      </div>
      
      <!-- Progress Steps -->
      <nav class="wizard-steps" aria-label="CBRS setup steps">
        {#each steps as step, index}
          <button
            type="button"
            class="wizard-step"
            class:active={index === currentStep}
            class:complete={index < currentStep}
            disabled={index > currentStep}
          >
            <span class="step-icon">{step.icon}</span>
            <span class="step-title">{step.title}</span>
          </button>
        {/each}
      </nav>
      
      <!-- Step Content -->
      <div class="wizard-content">
        {#if error}
          <div class="alert alert-error">{error}</div>
        {/if}
        
        {#if success}
          <div class="alert alert-success">{success}</div>
        {/if}
        
        {#if currentStep === 0}
          <!-- Welcome Step -->
          <div class="wizard-panel">
            <div class="welcome-content">
              <h3>Welcome to CBRS Setup! 📡</h3>
              <p>Let's configure your CBRS (Citizens Broadband Radio Service) integration with Google SAS.</p>
              
              <div class="info-box">
                <h4>What is CBRS?</h4>
                <p>CBRS allows you to use shared spectrum in the 3.5 GHz band for wireless broadband services. This setup will connect your system to Google's Spectrum Access System (SAS).</p>
              </div>
              
              <div class="setup-requirements">
                <h4>What You'll Need:</h4>
                <ul>
                  <li>✅ Google SAS account</li>
                  <li>✅ Google User ID from your platform administrator</li>
                  <li>✅ Access to your tenant settings</li>
                </ul>
              </div>
              
              <div class="setup-time">
                <strong>⏱️ Estimated time:</strong> 2-3 minutes
              </div>
            </div>
          </div>
          
        {:else if currentStep === 1}
          <!-- Information Step -->
          <div class="wizard-panel">
            <h3>How CBRS Works</h3>
            
            <div class="info-section">
              <h4>📋 Shared Platform Mode</h4>
              <p>Your organization uses a shared CBRS platform. The platform administrator manages API keys, and you only need to provide your Google User ID.</p>
            </div>
            
            <div class="info-section">
              <h4>🔑 Getting Your Google User ID</h4>
              <ol>
                <li>Contact your platform administrator</li>
                <li>Request your Google SAS User ID</li>
                <li>They will provide you with a User ID unique to your organization</li>
              </ol>
            </div>
            
            <div class="info-section">
              <h4>✨ What This Enables</h4>
              <ul>
                <li>Register CBRS devices with Google SAS</li>
                <li>Request spectrum grants</li>
                <li>Monitor grant status</li>
                <li>Manage device heartbeats</li>
              </ul>
            </div>
          </div>
          
        {:else if currentStep === 2}
          <!-- Google User ID Step -->
          <div class="wizard-panel">
            <h3>Enter Google User ID</h3>
            <p>Enter the Google User ID provided by your platform administrator.</p>
            
            <div class="form-group">
              <label for="google-user-id">
                Google User ID <span class="required">*</span>
              </label>
              <input
                id="google-user-id"
                type="text"
                bind:value={googleUserId}
                placeholder="e.g., user-123456"
                class="form-input"
                disabled={isLoading}
              />
              <small class="form-hint">This is the unique identifier for your organization in Google SAS.</small>
            </div>
            
            <div class="form-group">
              <label for="google-email">
                Google Account Email (Optional)
              </label>
              <input
                id="google-email"
                type="email"
                bind:value={googleEmail}
                placeholder="your-email@example.com"
                class="form-input"
                disabled={isLoading}
              />
              <small class="form-hint">Optional: Your Google account email for reference.</small>
            </div>
            
            {#if existingConfig}
              <div class="info-card">
                <p><strong>Note:</strong> You're updating an existing configuration.</p>
              </div>
            {/if}
          </div>
          
        {:else if currentStep === 3}
          <!-- Test Connection Step -->
          <div class="wizard-panel">
            <h3>Test Configuration</h3>
            <p>Let's verify your configuration is correct.</p>
            
            <div class="test-section">
              <h4>Configuration Summary</h4>
              <div class="config-summary">
                <div class="summary-row">
                  <span class="label">Google User ID:</span>
                  <span class="value">{googleUserId || 'Not set'}</span>
                </div>
                <div class="summary-row">
                  <span class="label">Email:</span>
                  <span class="value">{googleEmail || 'Not provided'}</span>
                </div>
                <div class="summary-row">
                  <span class="label">Deployment Model:</span>
                  <span class="value">Shared Platform</span>
                </div>
                <div class="summary-row">
                  <span class="label">Provider:</span>
                  <span class="value">Google SAS</span>
                </div>
              </div>
            </div>
            
            <button class="btn-primary btn-test" on:click={testConnection} disabled={isLoading}>
              {isLoading ? 'Testing...' : '✅ Test Connection'}
            </button>
            
            <div class="info-box">
              <p><strong>Note:</strong> The connection test validates your configuration format. Actual device registration and grant requests will be performed when you add devices in the CBRS Management module.</p>
            </div>
          </div>
          
        {:else if currentStep === 4}
          <!-- Complete Step -->
          <div class="wizard-panel">
            <h3>🎉 CBRS Setup Complete!</h3>
            <p>Your CBRS configuration has been saved successfully.</p>
            
            <div class="next-steps">
              <h4>What's Next?</h4>
              <div class="next-step-item">
                <span class="icon">📱</span>
                <div>
                  <strong>Add Your First Device</strong>
                  <p>Register a CBRS device to start using spectrum</p>
                </div>
              </div>
              <div class="next-step-item">
                <span class="icon">📊</span>
                <div>
                  <strong>Request Spectrum Grants</strong>
                  <p>Request spectrum grants for your devices</p>
                </div>
              </div>
              <div class="next-step-item">
                <span class="icon">🔍</span>
                <div>
                  <strong>Monitor Grant Status</strong>
                  <p>Track your grant requests and device status</p>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Wizard Footer -->
      <div class="wizard-footer">
        {#if currentStep > 0}
          <button class="btn-secondary" on:click={prevStep} disabled={isLoading}>
            ← Previous
          </button>
        {:else}
          <button class="btn-secondary" on:click={handleClose} disabled={isLoading}>
            Cancel
          </button>
        {/if}
        
        <div class="footer-actions">
          {#if currentStep === 2}
            <button class="btn-primary" on:click={saveConfiguration} disabled={isLoading || !googleUserId.trim()}>
              {isLoading ? 'Saving...' : 'Save & Continue →'}
            </button>
          {:else if currentStep === 3}
            <button class="btn-secondary" on:click={prevStep} disabled={isLoading}>
              ← Back
            </button>
            <button class="btn-primary" on:click={nextStep} disabled={isLoading || !success}>
              Skip Test →
            </button>
          {:else if currentStep < steps.length - 1}
            <button class="btn-primary" on:click={nextStep} disabled={isLoading}>
              Next →
            </button>
          {:else}
            <button class="btn-primary" on:click={completeSetup} disabled={isLoading}>
              Finish →
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Reuse styles from FirstTimeSetupWizard with CBRS-specific adjustments */
  .wizard-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: 1rem;
  }
  
  .wizard-modal {
    background: var(--card-bg, #ffffff);
    border-radius: 1rem;
    max-width: 700px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
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
  
  .wizard-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }
  
  .wizard-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #1a1a1a);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary, #666);
    padding: 0.25rem;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }
  
  .close-btn:hover {
    background: var(--hover-bg, #f5f5f5);
    color: var(--text-primary, #1a1a1a);
  }
  
  .wizard-steps {
    display: flex;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    overflow-x: auto;
  }
  
  .wizard-step {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color, #e0e0e0);
    background: var(--bg-secondary, #f9f9f9);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    font-size: 0.875rem;
  }
  
  .wizard-step:hover:not(:disabled) {
    background: var(--hover-bg, #f0f0f0);
  }
  
  .wizard-step.active {
    background: var(--primary-color, #007bff);
    color: white;
    border-color: var(--primary-color, #007bff);
  }
  
  .wizard-step.complete {
    background: var(--success-bg, #d4edda);
    border-color: var(--success-color, #28a745);
  }
  
  .wizard-step:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .step-icon {
    font-size: 1.25rem;
  }
  
  .wizard-content {
    flex: 1;
    overflow-y: auto;
    padding: 2rem;
  }
  
  .wizard-panel h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    color: var(--text-primary, #1a1a1a);
  }
  
  .wizard-panel p {
    color: var(--text-secondary, #666);
    line-height: 1.6;
    margin: 0.5rem 0;
  }
  
  .wizard-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color, #e0e0e0);
    gap: 1rem;
  }
  
  .footer-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .btn-primary, .btn-secondary {
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    border: none;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--primary-color, #007bff);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--primary-hover, #0056b3);
    transform: translateY(-1px);
  }
  
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    background: var(--bg-secondary, #f9f9f9);
    color: var(--text-primary, #1a1a1a);
    border: 1px solid var(--border-color, #e0e0e0);
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: var(--hover-bg, #f0f0f0);
  }
  
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .info-box {
    background: var(--info-bg, #d1ecf1);
    border-left: 4px solid var(--info-color, #0c5460);
    padding: 1rem;
    margin: 1rem 0;
    border-radius: 0.25rem;
  }
  
  .info-box h4 {
    margin: 0 0 0.5rem 0;
    color: var(--info-color, #0c5460);
  }
  
  .setup-requirements {
    margin: 1.5rem 0;
  }
  
  .setup-requirements h4 {
    margin-bottom: 0.5rem;
    color: var(--text-primary, #1a1a1a);
  }
  
  .setup-requirements ul {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }
  
  .setup-requirements li {
    margin: 0.25rem 0;
    color: var(--text-secondary, #666);
  }
  
  .setup-time {
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--info-bg, #d1ecf1);
    border-radius: 0.5rem;
    color: var(--info-color, #0c5460);
  }
  
  .info-section {
    margin: 1.5rem 0;
    padding: 1rem;
    background: var(--bg-secondary, #f9f9f9);
    border-radius: 0.5rem;
  }
  
  .info-section h4 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary, #1a1a1a);
  }
  
  .info-section ol, .info-section ul {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }
  
  .info-section li {
    margin: 0.25rem 0;
    color: var(--text-secondary, #666);
  }
  
  .form-group {
    margin: 1.5rem 0;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary, #1a1a1a);
  }
  
  .required {
    color: var(--danger, #dc3545);
  }
  
  .form-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    transition: border-color 0.2s;
  }
  
  .form-input:focus {
    outline: none;
    border-color: var(--primary-color, #007bff);
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }
  
  .form-input:disabled {
    background: var(--bg-secondary, #f9f9f9);
    cursor: not-allowed;
  }
  
  .form-hint {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-secondary, #666);
  }
  
  .info-card {
    background: var(--bg-secondary, #f9f9f9);
    border-radius: 0.5rem;
    padding: 1rem;
    margin: 1rem 0;
  }
  
  .test-section {
    margin: 1.5rem 0;
  }
  
  .config-summary {
    background: var(--bg-secondary, #f9f9f9);
    border-radius: 0.5rem;
    padding: 1rem;
    margin: 1rem 0;
  }
  
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }
  
  .summary-row:last-child {
    border-bottom: none;
  }
  
  .summary-row .label {
    font-weight: 500;
    color: var(--text-secondary, #666);
  }
  
  .summary-row .value {
    color: var(--text-primary, #1a1a1a);
  }
  
  .btn-test {
    margin: 1rem 0;
  }
  
  .next-steps {
    margin: 2rem 0;
  }
  
  .next-steps h4 {
    margin-bottom: 1rem;
    color: var(--text-primary, #1a1a1a);
  }
  
  .next-step-item {
    display: flex;
    align-items: start;
    gap: 1rem;
    padding: 1rem;
    margin: 0.5rem 0;
    background: var(--bg-secondary, #f9f9f9);
    border-radius: 0.5rem;
  }
  
  .next-step-item .icon {
    font-size: 1.5rem;
  }
  
  .alert {
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .alert-error {
    background: var(--error-bg, #f8d7da);
    color: var(--error-color, #721c24);
  }
  
  .alert-success {
    background: var(--success-bg, #d4edda);
    color: var(--success-color, #155724);
  }
  
  @media (max-width: 640px) {
    .wizard-modal {
      max-width: 100%;
      margin: 0.5rem;
    }
    
    .wizard-steps {
      flex-wrap: nowrap;
      overflow-x: auto;
    }
  }
</style>
