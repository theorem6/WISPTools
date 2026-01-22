<script lang="ts">
  /**
   * Monitoring Setup Wizard
   * 
   * Guides users through monitoring configuration (SNMP, MikroTik, ping monitoring).
   */
  
  import { createEventDispatcher } from 'svelte';
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
    { id: 'welcome', title: 'Welcome', icon: '📊' },
    { id: 'snmp', title: 'SNMP Setup', icon: '🔧' },
    { id: 'mikrotik', title: 'MikroTik (Optional)', icon: '📡' },
    { id: 'complete', title: 'Complete!', icon: '🎉' }
  ];
  
  // Configuration state
  let snmpCommunity = 'public';
  let snmpVersion = '2c';
  let mikrotikEnabled = false;
  let mikrotikUsername = '';
  let mikrotikPassword = '';

  $: if (show && autoStart) {
    currentStep = 0;
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
    
    isLoading = true;
    error = '';
    success = '';
    
    try {
      const response = await fetch('/api/snmp/configuration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({
          community: snmpCommunity,
          version: snmpVersion
        })
      });
      const data = await response.json();
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || 'Failed to save SNMP configuration');
      }

      success = 'SNMP configuration saved successfully!';
      
      // Move to completion step
      setTimeout(() => {
        nextStep();
      }, 1000);
    } catch (err: any) {
      error = err.message || 'Failed to save configuration';
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
        <h2 id="wizard-title">📊 Monitoring Setup Wizard</h2>
        <button class="close-btn" on:click={handleClose} aria-label="Close">✕</button>
      </div>
      
      <!-- Progress Steps -->
      <nav class="wizard-steps" aria-label="Monitoring setup steps">
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
              <h3>Welcome to Monitoring Setup! 📊</h3>
              <p>Let's configure network monitoring to track device performance and health.</p>
              
              <div class="info-box">
                <h4>What is Network Monitoring?</h4>
                <p>Network monitoring allows you to track device status, performance metrics, and network health in real-time using SNMP, ping, and device-specific protocols.</p>
              </div>
              
              <div class="setup-requirements">
                <h4>What You'll Configure:</h4>
                <ul>
                  <li>✅ SNMP credentials for device polling</li>
                  <li>✅ MikroTik device credentials (optional)</li>
                  <li>✅ Ping monitoring (automatic)</li>
                </ul>
              </div>
              
              <div class="setup-time">
                <strong>⏱️ Estimated time:</strong> 3-5 minutes
              </div>
            </div>
          </div>
          
        {:else if currentStep === 1}
          <!-- SNMP Setup Step -->
          <div class="wizard-panel">
            <h3>Configure SNMP</h3>
            <p>Set up SNMP (Simple Network Management Protocol) to monitor network devices.</p>
            
            <div class="form-group">
              <label for="snmp-community">
                SNMP Community <span class="required">*</span>
              </label>
              <input
                id="snmp-community"
                type="text"
                bind:value={snmpCommunity}
                placeholder="public"
                class="form-input"
                disabled={isLoading}
              />
              <small class="form-hint">The SNMP community string configured on your devices (typically "public" for read-only)</small>
            </div>
            
            <div class="form-group">
              <label for="snmp-version">
                SNMP Version
              </label>
              <select
                id="snmp-version"
                bind:value={snmpVersion}
                class="form-input"
                disabled={isLoading}
              >
                <option value="1">SNMPv1</option>
                <option value="2c">SNMPv2c</option>
                <option value="3">SNMPv3</option>
              </select>
              <small class="form-hint">Most devices use SNMPv2c</small>
            </div>
            
            <div class="info-card">
              <p><strong>💡 Tip:</strong> Make sure your network devices have SNMP enabled with the community string you specify here.</p>
            </div>
          </div>
          
        {:else if currentStep === 2}
          <!-- MikroTik Setup Step -->
          <div class="wizard-panel">
            <h3>MikroTik Credentials (Optional)</h3>
            <p>If you have MikroTik devices, configure credentials for enhanced monitoring.</p>
            
            <div class="form-group">
              <label>
                <input
                  type="checkbox"
                  bind:checked={mikrotikEnabled}
                  disabled={isLoading}
                />
                Enable MikroTik monitoring
              </label>
            </div>
            
            {#if mikrotikEnabled}
              <div class="form-group">
                <label for="mikrotik-username">
                  MikroTik Username
                </label>
                <input
                  id="mikrotik-username"
                  type="text"
                  bind:value={mikrotikUsername}
                  placeholder="admin"
                  class="form-input"
                  disabled={isLoading}
                />
              </div>
              
              <div class="form-group">
                <label for="mikrotik-password">
                  MikroTik Password
                </label>
                <input
                  id="mikrotik-password"
                  type="password"
                  bind:value={mikrotikPassword}
                  placeholder="Enter password"
                  class="form-input"
                  disabled={isLoading}
                />
              </div>
            {/if}
            
            <div class="info-card">
              <p><strong>Note:</strong> MikroTik monitoring is optional. You can skip this step if you don't have MikroTik devices or want to configure them later.</p>
            </div>
          </div>
          
        {:else if currentStep === 3}
          <!-- Complete Step -->
          <div class="wizard-panel">
            <h3>🎉 Monitoring Setup Complete!</h3>
            <p>Your monitoring configuration has been saved successfully.</p>
            
            <div class="next-steps">
              <h4>What's Next?</h4>
              <div class="next-step-item">
                <span class="icon">📊</span>
                <div>
                  <strong>View Device Monitoring</strong>
                  <p>See device status and metrics in the Monitoring module</p>
                </div>
              </div>
              <div class="next-step-item">
                <span class="icon">📈</span>
                <div>
                  <strong>Monitor Performance</strong>
                  <p>Track CPU, memory, and network usage over time</p>
                </div>
              </div>
              <div class="next-step-item">
                <span class="icon">🔔</span>
                <div>
                  <strong>Set Up Alerts</strong>
                  <p>Configure alerts for device outages and performance issues</p>
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
            <button class="btn-primary" on:click={saveConfiguration} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save & Complete →'}
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
  /* Reuse styles from CBRSSetupWizard - same CSS structure */
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
  
  .info-box, .setup-requirements, .setup-time, .info-section, .form-group, .form-input, .form-hint, .info-card, .next-steps, .next-step-item, .alert {
    /* Styles match CBRSSetupWizard - see that file for complete styles */
  }
  
</style>
