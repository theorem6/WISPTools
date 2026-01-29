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
    { id: 'acs', title: 'ACS (TR-069)', icon: '🛰️' },
    { id: 'complete', title: 'Complete!', icon: '🎉' }
  ];
  
  // Configuration state
  let snmpCommunity = 'public';
  let snmpVersion = '2c';
  let mikrotikEnabled = false;
  let mikrotikUsername = '';
  let mikrotikPassword = '';
  let genieacsUrl = '';
  let genieacsApiUrl = '';
  let acsLoaded = false;
  let snmpLoaded = false;

  $: if (show && autoStart) {
    currentStep = 0;
  }

  $: if (show && $currentTenant?.cwmpUrl && genieacsUrl !== $currentTenant.cwmpUrl) {
    genieacsUrl = $currentTenant.cwmpUrl;
  }

  $: if (show && !acsLoaded) {
    loadAcsConfiguration();
  }

  $: if (show && !snmpLoaded && $currentTenant?.id) {
    loadSnmpConfiguration();
  }
  
  function handleClose() {
    snmpLoaded = false;
    acsLoaded = false;
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

    if (!genieacsApiUrl.trim()) {
      error = 'GenieACS NBI API URL is required';
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

      const normalizedCwmpUrl = genieacsUrl.trim().replace(/\/$/, '');
      const normalizedNbiUrl = genieacsApiUrl.trim().replace(/\/$/, '');

      const acsResponse = await fetch('/api/tr069/configuration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({
          genieacsUrl: normalizedCwmpUrl,
          genieacsApiUrl: normalizedNbiUrl
        })
      });
      const acsData = await acsResponse.json();
      if (!acsResponse.ok || acsData?.success === false) {
        throw new Error(acsData?.error || acsData?.message || 'Failed to save ACS configuration');
      }

      success = 'Monitoring configuration saved successfully!';
      
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

  async function loadAcsConfiguration() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) return;

    try {
      const response = await fetch('/api/tr069/configuration', {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        }
      });
      const data = await response.json();
      if (response.ok && data?.config) {
        genieacsUrl = $currentTenant?.cwmpUrl || data.config.genieacsUrl || genieacsUrl;
        genieacsApiUrl = data.config.genieacsApiUrl || genieacsApiUrl;
      }
      acsLoaded = true;
    } catch (err) {
      console.warn('[MonitoringSetupWizard] Failed to load ACS configuration', err);
      acsLoaded = true;
    }
  }

  async function loadSnmpConfiguration() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) return;

    try {
      const response = await fetch('/api/snmp/configuration', {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        }
      });
      const data = await response.json();
      if (response.ok && data && typeof data === 'object') {
        snmpCommunity = data.defaultCommunity ?? data.community ?? snmpCommunity;
        snmpVersion = (data.defaultVersion ?? data.version ?? snmpVersion).toString().replace(/^v/, '') || '2c';
      }
      snmpLoaded = true;
    } catch (err) {
      console.warn('[MonitoringSetupWizard] Failed to load SNMP configuration', err);
      snmpLoaded = true;
    }
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
                  <li>✅ ACS (TR-069) endpoints for CPE management</li>
                  <li>✅ Ping monitoring (automatic)</li>
                </ul>
              </div>
              
              <div class="setup-time">
                <strong>⏱️ Estimated time:</strong> 5-7 minutes
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
          <!-- ACS Setup Step -->
          <div class="wizard-panel">
            <h3>ACS (TR-069) Configuration</h3>
            <p>Use your tenant's ACS endpoint and provide the GenieACS NBI API URL.</p>
            
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
              <small class="form-hint">This is generated automatically per tenant during setup.</small>
            </div>
            
            <div class="form-group">
              <label for="genieacs-api-url">
                GenieACS NBI API URL <span class="required">*</span>
              </label>
              <input
                id="genieacs-api-url"
                type="text"
                bind:value={genieacsApiUrl}
                placeholder="http://your-acs-server:7557"
                class="form-input"
                disabled={isLoading}
              />
              <small class="form-hint">NBI API base URL used for device actions and metrics</small>
            </div>
            
            <div class="info-card">
              <p><strong>💡 Tip:</strong> Keep your NBI URL pointing at the GenieACS server (default port 7557).</p>
            </div>
          </div>
          
        {:else if currentStep === 4}
          <!-- Complete Step -->
          <div class="wizard-panel">
            <h3>🎉 Monitoring Setup Complete!</h3>
            <p>Your monitoring configuration has been saved successfully.</p>
            
            <div class="next-steps">
              <h4>What's Next?</h4>
              <a href="/modules/monitoring" class="next-step-item">
                <span class="icon">📊</span>
                <div>
                  <strong>View Device Monitoring</strong>
                  <p>See device status, SNMP/TR-069 metrics, and topology</p>
                </div>
              </a>
              <a href="/modules/acs-cpe-management/monitoring" class="next-step-item">
                <span class="icon">📈</span>
                <div>
                  <strong>ACS CPE Metrics</strong>
                  <p>Per-device TR-069 metrics and Performance Analytics</p>
                </div>
              </a>
              <a href="/modules/acs-cpe-management/alerts" class="next-step-item">
                <span class="icon">🔔</span>
                <div>
                  <strong>ACS Alert Rules</strong>
                  <p>Configure alerts for CPE outages and performance</p>
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
        {#if currentStep === 3}
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
  /* Use app theme (app.css, theme.css) */
  .wizard-overlay {
    position: fixed;
    inset: 0;
    background: var(--modal-backdrop-color, rgba(15, 23, 42, 0.55));
    backdrop-filter: blur(var(--modal-backdrop-blur, 6px));
    -webkit-backdrop-filter: blur(var(--modal-backdrop-blur, 6px));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: 1rem;
  }
  
  .wizard-modal {
    background: var(--card-bg);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg, 1rem);
    max-width: 700px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--modal-surface-shadow, var(--shadow-lg));
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
    border-bottom: 1px solid var(--border-color);
  }
  
  .wizard-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    transition: all 0.2s;
  }
  
  .close-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }
  
  .wizard-steps {
    display: flex;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
    overflow-x: auto;
  }
  
  .wizard-step {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    font-size: 0.875rem;
  }
  
  .wizard-step.active {
    background: var(--primary-color);
    color: var(--text-inverse);
    border-color: var(--primary-color);
  }
  
  .wizard-step.complete {
    background: var(--success-light);
    border-color: var(--success-color);
    color: var(--text-primary);
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
    background: var(--card-bg);
    color: var(--text-primary);
  }
  
  .wizard-panel h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    color: var(--text-primary);
  }
  
  .wizard-panel p {
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0.5rem 0;
  }
  
  .wizard-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
    gap: 1rem;
    background: color-mix(in srgb, var(--card-bg) 94%, var(--bg-secondary) 6%);
  }
  
  .footer-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .btn-primary, .btn-secondary {
    padding: 0.75rem 1.5rem;
    border-radius: var(--radius-md);
    border: none;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--primary-color);
    color: var(--text-inverse);
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--primary-hover);
  }
  
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
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
    color: var(--text-primary);
  }

  .next-steps a.next-step-item {
    display: flex;
    align-items: start;
    gap: 1rem;
    padding: 1rem;
    margin-bottom: 0.5rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    text-decoration: none;
    color: var(--text-primary);
    transition: background 0.2s, border-color 0.2s;
  }

  .next-steps a.next-step-item:hover {
    background: var(--hover-bg);
    border-color: var(--primary-color);
  }

  .next-steps a.next-step-item .icon {
    font-size: 1.5rem;
  }

  .next-steps a.next-step-item strong {
    display: block;
    color: var(--text-primary);
  }

  .next-steps a.next-step-item p {
    margin: 0.25rem 0 0 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
</style>
