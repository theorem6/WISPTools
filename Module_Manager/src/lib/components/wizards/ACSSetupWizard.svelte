<script lang="ts">
  /**
   * ACS/TR-069 Setup Wizard
   * 
   * Guides users through ACS/TR-069 CPE management configuration.
   */
  
  import { createEventDispatcher, onMount } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  
  export let show = false;
  export let autoStart = false;
  
  const dispatch = createEventDispatcher();
  
  let currentStep = 0;
  let isLoading = false;
  let error = '';
  let success = '';
  
  // Wizard steps
  const steps = [
    { id: 'welcome', title: 'Welcome', icon: '⚙️' },
    { id: 'info', title: 'Information', icon: 'ℹ️' },
    { id: 'genieacs-url', title: 'Tenant ACS URL', icon: '🔗' },
    { id: 'test', title: 'Test Connection', icon: '✅' },
    { id: 'complete', title: 'Complete!', icon: '🎉' }
  ];
  
  // Configuration state
  let genieacsUrl = '';
  let genieacsApiUrl = '';
  let isLoaded = false;

  $: if (show && $currentTenant?.cwmpUrl && genieacsUrl !== $currentTenant.cwmpUrl) {
    genieacsUrl = $currentTenant.cwmpUrl;
  }

  onMount(async () => {
    if (show && autoStart) {
      await loadConfiguration();
    }
  });

  async function loadConfiguration() {
    if (!$currentTenant?.id) {
      error = 'No tenant selected';
      return;
    }

    isLoading = true;
    error = '';
    try {
      const response = await fetch('/api/tr069/configuration', {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': $currentTenant.id
        }
      });
      const data = await response.json();
      if (response.ok && data?.config) {
        genieacsUrl = $currentTenant?.cwmpUrl || data.config.genieacsUrl || '';
        genieacsApiUrl = data.config.genieacsApiUrl || '';
      }
      isLoaded = true;
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
    
    if (!genieacsUrl.trim()) {
      error = 'Tenant ACS URL is missing. Please contact support.';
      return;
    }
    
    isLoading = true;
    error = '';
    success = '';
    
    try {
      // Normalize URL (add https:// if missing, remove trailing slash)
      let normalizedUrl = genieacsUrl.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }
      normalizedUrl = normalizedUrl.replace(/\/$/, '');

      // Extract API URL (typically GenieACS URL + /api)
      const normalizedApiUrl = genieacsApiUrl.trim()
        ? genieacsApiUrl.trim().replace(/\/$/, '')
        : `${normalizedUrl}/api`;

      const response = await fetch('/api/tr069/configuration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({
          genieacsUrl: normalizedUrl,
          genieacsApiUrl: normalizedApiUrl
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save configuration');
      }

        genieacsUrl = $currentTenant?.cwmpUrl || normalizedUrl;
      genieacsApiUrl = normalizedApiUrl;
      success = 'Configuration saved successfully!';
      
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
    const tenantId = $currentTenant?.id;
    if (!tenantId) {
      error = 'No tenant selected';
      return;
    }

    isLoading = true;
    error = '';
    success = '';
    
    try {
      if (!genieacsApiUrl.trim()) {
        error = 'GenieACS API URL is required';
        return;
      }

      const response = await fetch('/api/tr069/connection-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({ genieacsApiUrl: genieacsApiUrl.trim() })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Connection failed');
      }

      success = 'Connection successful! GenieACS is accessible.';
      
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
        <h2 id="wizard-title">⚙️ ACS/TR-069 Setup Wizard</h2>
        <button class="close-btn" on:click={handleClose} aria-label="Close">✕</button>
      </div>
      
      <!-- Progress Steps -->
      <nav class="wizard-steps" aria-label="ACS setup steps">
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
              <h3>Welcome to ACS/TR-069 Setup! ⚙️</h3>
              <p>Let's configure your TR-069 Auto-Configuration Server (ACS) for CPE device management.</p>
              
              <div class="info-box">
                <h4>What is ACS/TR-069?</h4>
                <p>TR-069 is a protocol that allows remote management of customer premise equipment (CPE) like routers, modems, and access points. GenieACS is an open-source ACS server that implements this standard.</p>
              </div>
              
              <div class="setup-requirements">
                <h4>What You'll Need:</h4>
                <ul>
                  <li>✅ GenieACS server URL</li>
                  <li>✅ GenieACS API access</li>
                  <li>✅ Admin credentials (if authentication required)</li>
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
            <h3>How ACS/TR-069 Works</h3>
            
            <div class="info-section">
              <h4>📋 Overview</h4>
              <p>ACS allows you to remotely configure, monitor, and update CPE devices using the TR-069 standard. GenieACS provides the server infrastructure to manage these devices.</p>
            </div>
            
            <div class="info-section">
              <h4>🔧 Key Features</h4>
              <ul>
                <li>Remote device configuration</li>
                <li>Firmware updates</li>
                <li>Performance monitoring</li>
                <li>Fault detection and diagnostics</li>
                <li>Bulk operations</li>
              </ul>
            </div>
            
            <div class="info-section">
              <h4>✨ What This Enables</h4>
              <ul>
                <li>Automated device provisioning</li>
                <li>Centralized configuration management</li>
                <li>Real-time device status monitoring</li>
                <li>Automated firmware upgrades</li>
                <li>Fault management and alerts</li>
              </ul>
            </div>
          </div>
          
        {:else if currentStep === 2}
          <!-- GenieACS URL Step -->
          <div class="wizard-panel">
            <h3>Tenant ACS URL</h3>
            <p>This ACS endpoint is generated automatically for your tenant.</p>
            
            <div class="form-group">
              <label>
                Tenant ACS URL <span class="required">*</span>
              </label>
              <div class="form-input" style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="flex: 1; word-break: break-all;">{genieacsUrl || 'Not available'}</span>
                {#if genieacsUrl}
                  <button
                    type="button"
                    class="btn-secondary"
                    style="padding: 0.35rem 0.75rem; font-size: 0.75rem;"
                    on:click={() => navigator.clipboard?.writeText(genieacsUrl)}
                  >
                    Copy
                  </button>
                {/if}
              </div>
              <small class="form-hint">Use this URL in your CPE device ACS settings.</small>
            </div>
            
            <div class="info-card">
              <p><strong>💡 Tip:</strong> If this URL is missing, contact support to confirm tenant setup.</p>
            </div>
          </div>
          
        {:else if currentStep === 3}
          <!-- Test Connection Step -->
          <div class="wizard-panel">
            <h3>Test Connection</h3>
            <p>Let's verify your GenieACS connection is working.</p>
            
            <div class="test-section">
              <h4>Configuration Summary</h4>
              <div class="config-summary">
                <div class="summary-row">
                  <span class="label">GenieACS URL:</span>
                  <span class="value">{genieacsUrl || 'Not set'}</span>
                </div>
                <div class="summary-row">
                  <span class="label">API URL:</span>
                  <span class="value">{genieacsApiUrl || 'Will be auto-generated'}</span>
                </div>
              </div>
            </div>
            
            <button class="btn-primary btn-test" on:click={testConnection} disabled={isLoading}>
              {isLoading ? 'Testing...' : '✅ Test Connection'}
            </button>
            
            <div class="info-box">
              <p><strong>Note:</strong> The connection test verifies that the GenieACS server is accessible. Device management features will be available once devices are registered with GenieACS.</p>
            </div>
          </div>
          
        {:else if currentStep === 4}
          <!-- Complete Step -->
          <div class="wizard-panel">
            <h3>🎉 ACS Setup Complete!</h3>
            <p>Your ACS/TR-069 configuration has been saved successfully.</p>
            
            <div class="next-steps">
              <h4>What's Next?</h4>
              <a href="/modules/acs-cpe-management" class="next-step-item">
                <span class="icon">📱</span>
                <div>
                  <strong>Register CPE Devices</strong>
                  <p>Sync from GenieACS or use Onboard Device to add CPEs</p>
                </div>
              </a>
              <a href="/modules/acs-cpe-management/devices" class="next-step-item">
                <span class="icon">⚙️</span>
                <div>
                  <strong>Devices & Presets</strong>
                  <p>Manage devices, presets, and parameters</p>
                </div>
              </a>
              <a href="/modules/acs-cpe-management/monitoring" class="next-step-item">
                <span class="icon">📊</span>
                <div>
                  <strong>Monitoring & Graphs</strong>
                  <p>Per-device metrics, Performance Analytics, and charts</p>
                </div>
              </a>
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
            <button class="btn-primary" on:click={saveConfiguration} disabled={isLoading || !genieacsUrl.trim()}>
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
  /* Reuse styles - same structure as CBRSSetupWizard */
  /* See CBRSSetupWizard.svelte for complete CSS styles */
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
  
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .next-steps {
    margin-top: 1rem;
  }

  .next-steps h4 {
    margin-bottom: 0.75rem;
    color: var(--text-primary, #1a1a1a);
  }

  .next-steps a.next-step-item {
    display: flex;
    align-items: start;
    gap: 1rem;
    padding: 1rem;
    margin-bottom: 0.5rem;
    background: var(--bg-secondary, #f9f9f9);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.5rem;
    text-decoration: none;
    color: inherit;
    transition: background 0.2s, border-color 0.2s;
  }

  .next-steps a.next-step-item:hover {
    background: var(--hover-bg, #f0f0f0);
    border-color: var(--primary-color, #007bff);
  }

  .next-steps a.next-step-item .icon {
    font-size: 1.5rem;
  }

  .next-steps a.next-step-item strong {
    display: block;
    color: var(--text-primary, #1a1a1a);
  }

  .next-steps a.next-step-item p {
    margin: 0.25rem 0 0 0;
    font-size: 0.875rem;
    color: var(--text-secondary, #666);
  }
</style>
