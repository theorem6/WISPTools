<script lang="ts">
  /**
   * Device Registration Wizard
   * 
   * Guides users through registering CPE devices with GenieACS/TR-069.
   */
  
  import BaseWizard from '../BaseWizard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  
  export let show = false;
  
  let currentStep = 0;
  let isLoading = false;
  let error = '';
  let success = '';
  
  // Wizard steps
  const steps = [
    { id: 'welcome', title: 'Welcome', icon: '📱' },
    { id: 'method', title: 'Registration Method', icon: '🔧' },
    { id: 'configure', title: 'Configure Device', icon: '⚙️' },
    { id: 'verify', title: 'Verify', icon: '✅' },
    { id: 'complete', title: 'Complete', icon: '🎉' }
  ];
  
  // Registration state
  let registrationMethod: 'manual' | 'bulk' | 'auto' | null = null;
  let deviceSerial = '';
  let deviceOUI = '';
  let deviceProductClass = '';
  let deviceManufacturer = '';
  let acsUrl = '';
  let registeredDevices: Array<{ serial: string; status: string }> = [];
  
  $: acsUrl = $currentTenant?.cwmpUrl || '';
  
  function handleClose() {
    show = false;
    resetWizard();
    dispatch('close');
  }
  
  function resetWizard() {
    currentStep = 0;
    registrationMethod = null;
    deviceSerial = '';
    deviceOUI = '';
    deviceProductClass = '';
    deviceManufacturer = '';
    registeredDevices = [];
    error = '';
    success = '';
  }
  
  function handleStepChange(event: CustomEvent<number>) {
    currentStep = event.detail;
  }
  
  function selectMethod(method: 'manual' | 'bulk' | 'auto') {
    registrationMethod = method;
    nextStep();
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
  
  async function registerDevice() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) {
      error = 'No tenant selected';
      return;
    }
    
    if (!deviceSerial.trim()) {
      error = 'Device serial number is required';
      return;
    }
    
    isLoading = true;
    error = '';
    
    try {
      // In a real implementation, this would call the backend API
      // to register the device with GenieACS
      const response = await fetch('/api/tr069/devices/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({
          serialNumber: deviceSerial,
          oui: deviceOUI,
          productClass: deviceProductClass,
          manufacturer: deviceManufacturer
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to register device');
      }
      
      registeredDevices.push({ serial: deviceSerial, status: 'Registered' });
      success = 'Device registered successfully!';
      
      setTimeout(() => {
        nextStep();
      }, 1500);
    } catch (err: any) {
      error = err.message || 'Failed to register device';
    } finally {
      isLoading = false;
    }
  }
  
  function complete() {
    handleClose();
  }
</script>

<BaseWizard
  {show}
  title="📱 Device Registration Wizard"
  {steps}
  {currentStep}
  {isLoading}
  {error}
  {success}
  on:close={handleClose}
  on:stepChange={handleStepChange}
>
  <div slot="content">
    {#if currentStep === 0}
      <!-- Welcome Step -->
      <div class="wizard-panel">
        <h3>Welcome to Device Registration! 📱</h3>
        <p>This wizard will guide you through registering CPE devices with your GenieACS server.</p>
        
        <div class="info-box">
          <h4>What You'll Need:</h4>
          <ul>
            <li>✅ Device serial number</li>
            <li>✅ Device manufacturer/model information</li>
            <li>✅ ACS URL configured (we'll use your tenant URL)</li>
          </ul>
        </div>
        
        <div class="info-box">
          <h4>Registration Methods:</h4>
          <ul>
            <li><strong>Manual:</strong> Register devices one at a time</li>
            <li><strong>Bulk:</strong> Upload a CSV file with multiple devices</li>
            <li><strong>Auto:</strong> Devices register automatically when they connect</li>
          </ul>
        </div>
      </div>
      
    {:else if currentStep === 1}
      <!-- Method Selection -->
      <div class="wizard-panel">
        <h3>Choose Registration Method</h3>
        <p>How would you like to register devices?</p>
        
        <div class="method-grid">
          <button 
            class="method-card" 
            on:click={() => selectMethod('manual')}
            disabled={isLoading}
          >
            <div class="method-icon">✏️</div>
            <h4>Manual Registration</h4>
            <p>Register devices one at a time by entering device information</p>
          </button>
          
          <button 
            class="method-card" 
            on:click={() => selectMethod('bulk')}
            disabled={isLoading}
          >
            <div class="method-icon">📊</div>
            <h4>Bulk Registration</h4>
            <p>Upload a CSV file to register multiple devices at once</p>
          </button>
          
          <button 
            class="method-card" 
            on:click={() => selectMethod('auto')}
            disabled={isLoading}
          >
            <div class="method-icon">🔄</div>
            <h4>Auto Registration</h4>
            <p>Devices register automatically when they connect to ACS</p>
          </button>
        </div>
      </div>
      
    {:else if currentStep === 2}
      <!-- Configure Device -->
      {#if registrationMethod === 'manual'}
        <div class="wizard-panel">
          <h3>Enter Device Information</h3>
          
          <div class="form-group">
            <label>
              Device Serial Number <span class="required">*</span>
            </label>
            <input 
              type="text" 
              bind:value={deviceSerial}
              placeholder="e.g., SN123456789"
              disabled={isLoading}
            />
          </div>
          
          <div class="form-group">
            <label>Manufacturer</label>
            <input 
              type="text" 
              bind:value={deviceManufacturer}
              placeholder="e.g., TP-Link"
              disabled={isLoading}
            />
          </div>
          
          <div class="form-group">
            <label>Product Class</label>
            <input 
              type="text" 
              bind:value={deviceProductClass}
              placeholder="e.g., Router"
              disabled={isLoading}
            />
          </div>
          
          <div class="form-group">
            <label>OUI (Organizationally Unique Identifier)</label>
            <input 
              type="text" 
              bind:value={deviceOUI}
              placeholder="e.g., 00:11:22"
              disabled={isLoading}
            />
          </div>
          
          <div class="info-card">
            <p><strong>ACS URL:</strong> {acsUrl || 'Not configured'}</p>
            <p class="hint">Configure this URL in your CPE device's ACS settings.</p>
          </div>
        </div>
      {:else if registrationMethod === 'bulk'}
        <div class="wizard-panel">
          <h3>Upload Device List</h3>
          <p>Upload a CSV file with device information.</p>
          
          <div class="info-box">
            <h4>CSV Format:</h4>
            <pre>serialNumber,manufacturer,productClass,oui
SN123456789,TP-Link,Router,00:11:22
SN987654321,Netgear,Modem,33:44:55</pre>
          </div>
          
          <div class="form-group">
            <label>CSV File</label>
            <input type="file" accept=".csv" disabled={isLoading} />
            <small>Select a CSV file with device information</small>
          </div>
        </div>
      {:else if registrationMethod === 'auto'}
        <div class="wizard-panel">
          <h3>Auto Registration Configuration</h3>
          <p>Devices will automatically register when they connect to your ACS server.</p>
          
          <div class="info-card success">
            <h4>✅ Auto Registration Enabled</h4>
            <p>When devices connect to your ACS URL, they will be automatically registered and appear in your device list.</p>
          </div>
          
          <div class="info-card">
            <p><strong>ACS URL:</strong> {acsUrl || 'Not configured'}</p>
            <p class="hint">Make sure your CPE devices are configured to connect to this URL.</p>
          </div>
        </div>
      {/if}
      
    {:else if currentStep === 3}
      <!-- Verify -->
      <div class="wizard-panel">
        <h3>Verify Registration</h3>
        
        {#if registrationMethod === 'auto'}
          <div class="info-card success">
            <h4>✅ Auto Registration Active</h4>
            <p>Devices will appear in your device list automatically when they connect.</p>
          </div>
        {:else}
          <div class="summary-section">
            <h4>Registration Summary</h4>
            <div class="summary-row">
              <span class="label">Method:</span>
              <span class="value">{registrationMethod}</span>
            </div>
            {#if registrationMethod === 'manual'}
              <div class="summary-row">
                <span class="label">Serial Number:</span>
                <span class="value">{deviceSerial}</span>
              </div>
              <div class="summary-row">
                <span class="label">Manufacturer:</span>
                <span class="value">{deviceManufacturer || 'Not specified'}</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>
      
    {:else if currentStep === 4}
      <!-- Complete -->
      <div class="wizard-panel">
        <h3>🎉 Registration Complete!</h3>
        <p>Your device registration process is complete.</p>
        
        <div class="next-steps">
          <h4>What's Next?</h4>
          <a href="/modules/acs-cpe-management/devices" class="next-step-item">
            <span class="icon">📋</span>
            <div>
              <strong>View Devices</strong>
              <p>Check your device list to see registered devices</p>
            </div>
          </a>
          <a href="/modules/acs-cpe-management/presets" class="next-step-item">
            <span class="icon">⚙️</span>
            <div>
              <strong>Configure Devices</strong>
              <p>Apply presets or configure device parameters</p>
            </div>
          </a>
          <a href="/modules/acs-cpe-management/monitoring" class="next-step-item">
            <span class="icon">📊</span>
            <div>
              <strong>Monitor Performance</strong>
              <p>Track device status and metrics</p>
            </div>
          </a>
        </div>
      </div>
    {/if}
  </div>
  
  <div slot="footer" let:currentStep let:nextStep let:prevStep let:handleClose let:isLoading>
    {#if currentStep > 0}
      <button class="wizard-btn-secondary" on:click={prevStep} disabled={isLoading}>
        ← Previous
      </button>
    {:else}
      <button class="wizard-btn-secondary" on:click={handleClose} disabled={isLoading}>
        Cancel
      </button>
    {/if}
    
    <div class="footer-actions">
      {#if currentStep === 2 && registrationMethod === 'manual'}
        <button 
          class="wizard-btn-primary" 
          on:click={registerDevice} 
          disabled={isLoading || !deviceSerial.trim()}
        >
          {isLoading ? 'Registering...' : 'Register Device →'}
        </button>
      {:else if currentStep === 2 && registrationMethod === 'auto'}
        <button class="wizard-btn-primary" on:click={nextStep} disabled={isLoading}>
          Continue →
        </button>
      {:else if currentStep < steps.length - 1}
        <button class="wizard-btn-primary" on:click={nextStep} disabled={isLoading}>
          Next →
        </button>
      {:else}
        <button class="wizard-btn-primary" on:click={complete} disabled={isLoading}>
          Finish →
        </button>
      {/if}
    </div>
  </div>
</BaseWizard>

<style>
  .wizard-panel h3 {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    color: var(--text-primary);
  }
  
  .wizard-panel p {
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0.5rem 0;
  }
  
  .info-box {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1rem;
    margin: 1rem 0;
  }
  
  .info-box h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: var(--text-primary);
  }
  
  .info-box ul {
    margin: 0.5rem 0 0 1.5rem;
    padding: 0;
  }
  
  .info-box li {
    margin: 0.25rem 0;
  }
  
  .method-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin: 1.5rem 0;
  }
  
  .method-card {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
    color: var(--text-primary);
  }
  
  .method-card:hover:not(:disabled) {
    border-color: var(--primary-color);
    background: var(--hover-bg);
    transform: translateY(-2px);
  }
  
  .method-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .method-icon {
    font-size: 3rem;
    margin-bottom: 0.5rem;
  }
  
  .method-card h4 {
    margin: 0.5rem 0;
    font-size: 1.1rem;
  }
  
  .method-card p {
    font-size: 0.875rem;
    margin: 0.5rem 0 0 0;
  }
  
  .form-group {
    margin: 1rem 0;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .form-group input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    background: var(--input-bg);
    color: var(--text-primary);
  }
  
  .form-group input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .required {
    color: var(--danger-color);
  }
  
  .info-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1rem;
    margin: 1rem 0;
    color: var(--text-primary);
  }
  
  .info-card.success {
    background: var(--success-light);
    border-color: var(--success-color);
  }
  
  .info-card h4 {
    margin: 0 0 0.5rem 0;
  }
  
  .info-card .hint {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.5rem;
  }
  
  .summary-section {
    margin: 1rem 0;
  }
  
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border-color);
  }
  
  .summary-row .label {
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .next-steps {
    margin-top: 1.5rem;
  }

  a.next-step-item {
    text-decoration: none;
    color: inherit;
  }

  a.next-step-item:hover {
    background: var(--hover-bg, var(--bg-primary));
  }
  
  .next-step-item {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    margin: 0.75rem 0;
    color: var(--text-primary);
  }
  
  .next-step-item .icon {
    font-size: 2rem;
  }
  
  .next-step-item strong {
    display: block;
    margin-bottom: 0.25rem;
  }
  
  .next-step-item p {
    margin: 0;
    font-size: 0.875rem;
  }
  
  .footer-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  pre {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    font-size: 0.875rem;
  }
</style>
