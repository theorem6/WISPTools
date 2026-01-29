<script lang="ts">
  /**
   * Bulk Operations Wizard
   * 
   * Guides users through performing bulk operations on multiple CPE devices.
   */
  
  import { createEventDispatcher } from 'svelte';
  import BaseWizard from '../BaseWizard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  
  const dispatch = createEventDispatcher<{ close: void }>();
  export let show = false;
  export let selectedDevices: string[] = [];
  
  let currentStep = 0;
  let isLoading = false;
  let error = '';
  let success = '';
  
  // Wizard steps
  const steps = [
    { id: 'welcome', title: 'Welcome', icon: '📦' },
    { id: 'select', title: 'Select Devices', icon: '📋' },
    { id: 'operation', title: 'Choose Operation', icon: '⚙️' },
    { id: 'configure', title: 'Configure', icon: '🔧' },
    { id: 'execute', title: 'Execute', icon: '▶️' },
    { id: 'complete', title: 'Complete', icon: '🎉' }
  ];
  
  // Operation state
  let operationType: 'preset' | 'reboot' | 'refresh' | 'firmware' | null = null;
  let selectedPreset: string | null = null;
  let availablePresets: Array<{ _id: string; name: string }> = [];
  let firmwareVersion = '';
  let executionResults: {
    success: number;
    failed: number;
    errors: Array<{ device: string; error: string }>;
  } | null = null;
  
  $: deviceCount = selectedDevices.length;
  
  async function loadPresets() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) return;
    
    try {
      const response = await fetch('/api/tr069/presets', {
        headers: {
          'x-tenant-id': tenantId
        }
      });
      const data = await response.json();
      if (response.ok) {
        availablePresets = (data.presets || []).filter((p: any) => p.enabled);
      }
    } catch (err) {
      console.error('Failed to load presets:', err);
    }
  }
  
  function handleClose() {
    show = false;
    resetWizard();
    dispatch('close');
  }
  
  function resetWizard() {
    currentStep = 0;
    operationType = null;
    selectedPreset = null;
    firmwareVersion = '';
    executionResults = null;
    error = '';
    success = '';
  }
  
  function handleStepChange(event: CustomEvent<number>) {
    currentStep = event.detail;
    if (currentStep === 2 && operationType === 'preset') {
      loadPresets();
    }
  }
  
  function nextStep() {
    if (currentStep === 1 && selectedDevices.length === 0) {
      error = 'Please select at least one device';
      return;
    }
    if (currentStep === 2 && !operationType) {
      error = 'Please select an operation';
      return;
    }
    if (currentStep === 3 && operationType === 'preset' && !selectedPreset) {
      error = 'Please select a preset';
      return;
    }
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
  
  function selectOperation(op: 'preset' | 'reboot' | 'refresh' | 'firmware') {
    operationType = op;
    nextStep();
  }
  
  async function executeOperation() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) {
      error = 'No tenant selected';
      return;
    }
    
    if (selectedDevices.length === 0) {
      error = 'No devices selected';
      return;
    }
    
    isLoading = true;
    error = '';
    
    try {
      let endpoint = '/api/tr069/bulk-tasks';
      let body: any = {
        deviceIds: selectedDevices,
        action: operationType
      };
      
      if (operationType === 'preset' && selectedPreset) {
        body.presetId = selectedPreset;
      } else if (operationType === 'firmware' && firmwareVersion) {
        body.firmwareVersion = firmwareVersion;
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Operation failed');
      }
      
      executionResults = {
        success: data.results?.success || 0,
        failed: data.results?.failed || 0,
        errors: data.results?.errors || []
      };
      
      success = `Operation completed: ${executionResults.success} succeeded, ${executionResults.failed} failed`;
      
      setTimeout(() => {
        nextStep();
      }, 1500);
    } catch (err: any) {
      error = err.message || 'Failed to execute operation';
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
  title="📦 Bulk Operations Wizard"
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
        <h3>Welcome to Bulk Operations! 📦</h3>
        <p>Perform operations on multiple CPE devices at once.</p>
        
        <div class="info-box">
          <h4>Available Operations:</h4>
          <ul>
            <li><strong>Apply Preset:</strong> Apply a configuration preset to selected devices</li>
            <li><strong>Reboot:</strong> Reboot selected devices</li>
            <li><strong>Refresh Parameters:</strong> Force devices to refresh their parameters</li>
            <li><strong>Firmware Update:</strong> Update firmware on selected devices</li>
          </ul>
        </div>
        
        <div class="info-box">
          <p><strong>Selected Devices:</strong> {deviceCount} device(s)</p>
        </div>
      </div>
      
    {:else if currentStep === 1}
      <!-- Select Devices -->
      <div class="wizard-panel">
        <h3>Select Devices</h3>
        <p>You have {deviceCount} device(s) selected for bulk operations.</p>
        
        {#if deviceCount === 0}
          <div class="info-box warning">
            <p>⚠️ No devices selected. Please go to the Devices page and select devices first.</p>
          </div>
        {:else}
          <div class="devices-summary">
            <p>Ready to perform operations on {deviceCount} device(s).</p>
            <p class="hint">You can change device selection by going back to the Devices page.</p>
          </div>
        {/if}
      </div>
      
    {:else if currentStep === 2}
      <!-- Choose Operation -->
      <div class="wizard-panel">
        <h3>Choose Operation</h3>
        <p>What operation would you like to perform on {deviceCount} device(s)?</p>
        
        <div class="operation-grid">
          <button 
            class="operation-card" 
            on:click={() => selectOperation('preset')}
            disabled={isLoading}
          >
            <div class="operation-icon">⚙️</div>
            <h4>Apply Preset</h4>
            <p>Apply a configuration preset to all selected devices</p>
          </button>
          
          <button 
            class="operation-card" 
            on:click={() => selectOperation('reboot')}
            disabled={isLoading}
          >
            <div class="operation-icon">🔄</div>
            <h4>Reboot Devices</h4>
            <p>Reboot all selected devices</p>
          </button>
          
          <button 
            class="operation-card" 
            on:click={() => selectOperation('refresh')}
            disabled={isLoading}
          >
            <div class="operation-icon">🔄</div>
            <h4>Refresh Parameters</h4>
            <p>Force devices to refresh their parameters</p>
          </button>
          
          <button 
            class="operation-card" 
            on:click={() => selectOperation('firmware')}
            disabled={isLoading}
          >
            <div class="operation-icon">📦</div>
            <h4>Firmware Update</h4>
            <p>Update firmware on selected devices</p>
          </button>
        </div>
      </div>
      
    {:else if currentStep === 3}
      <!-- Configure Operation -->
      {#if operationType === 'preset'}
        <div class="wizard-panel">
          <h3>Select Preset</h3>
          <p>Choose a preset to apply to {deviceCount} device(s).</p>
          
          {#if availablePresets.length === 0}
            <div class="info-box warning">
              <p>⚠️ No presets available. Create a preset first.</p>
            </div>
          {:else}
            <div class="presets-list">
              {#each availablePresets as preset}
                <button
                  class="preset-card"
                  class:selected={selectedPreset === preset._id}
                  on:click={() => selectedPreset = preset._id}
                  disabled={isLoading}
                >
                  <h4>{preset.name}</h4>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {:else if operationType === 'firmware'}
        <div class="wizard-panel">
          <h3>Firmware Version</h3>
          <p>Enter the firmware version to install on {deviceCount} device(s).</p>
          
          <div class="form-group">
            <label>
              Firmware Version <span class="required">*</span>
            </label>
            <input 
              type="text" 
              bind:value={firmwareVersion}
              placeholder="e.g., 1.2.3"
              disabled={isLoading}
            />
          </div>
        </div>
      {:else}
        <div class="wizard-panel">
          <h3>Operation Configuration</h3>
          <p>Ready to {operationType} {deviceCount} device(s).</p>
          
          <div class="info-box">
            <p><strong>Operation:</strong> {operationType}</p>
            <p><strong>Devices:</strong> {deviceCount}</p>
          </div>
        </div>
      {/if}
      
    {:else if currentStep === 4}
      <!-- Execute -->
      <div class="wizard-panel">
        <h3>Execute Operation</h3>
        <p>Ready to execute {operationType} on {deviceCount} device(s).</p>
        
        <div class="execution-summary">
          <h4>Operation Summary</h4>
          <div class="summary-row">
            <span class="label">Operation:</span>
            <span class="value">{operationType}</span>
          </div>
          <div class="summary-row">
            <span class="label">Devices:</span>
            <span class="value">{deviceCount}</span>
          </div>
          {#if operationType === 'preset' && selectedPreset}
            <div class="summary-row">
              <span class="label">Preset:</span>
              <span class="value">{availablePresets.find(p => p._id === selectedPreset)?.name || 'Unknown'}</span>
            </div>
          {/if}
          {#if operationType === 'firmware' && firmwareVersion}
            <div class="summary-row">
              <span class="label">Firmware Version:</span>
              <span class="value">{firmwareVersion}</span>
            </div>
          {/if}
        </div>
        
        <button 
          class="wizard-btn-primary btn-execute" 
          on:click={executeOperation} 
          disabled={isLoading}
        >
          {isLoading ? 'Executing...' : '▶️ Execute Operation'}
        </button>
      </div>
      
    {:else if currentStep === 5}
      <!-- Complete -->
      <div class="wizard-panel">
        <h3>🎉 Operation Complete!</h3>
        
        {#if executionResults}
          <div class="results-summary">
            <div class="result-stat success">
              <div class="stat-value">{executionResults.success}</div>
              <div class="stat-label">Succeeded</div>
            </div>
            <div class="result-stat failed">
              <div class="stat-value">{executionResults.failed}</div>
              <div class="stat-label">Failed</div>
            </div>
          </div>
          
          {#if executionResults.errors.length > 0}
            <div class="errors-list">
              <h4>Errors:</h4>
              {#each executionResults.errors as errorItem}
                <div class="error-item">
                  <strong>{errorItem.device}:</strong> {errorItem.error}
                </div>
              {/each}
            </div>
          {/if}
        {/if}
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
      {#if currentStep === 4}
        <!-- Execute button is in content -->
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
  
  .info-box.warning {
    background: var(--warning-light);
    border-color: var(--warning-color);
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
  
  .operation-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin: 1.5rem 0;
  }
  
  .operation-card {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
    color: var(--text-primary);
  }
  
  .operation-card:hover:not(:disabled) {
    border-color: var(--primary-color);
    transform: translateY(-2px);
  }
  
  .operation-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .operation-icon {
    font-size: 3rem;
    margin-bottom: 0.5rem;
  }
  
  .operation-card h4 {
    margin: 0.5rem 0;
    font-size: 1.1rem;
  }
  
  .operation-card p {
    font-size: 0.875rem;
    margin: 0.5rem 0 0 0;
  }
  
  .presets-list {
    display: grid;
    gap: 0.75rem;
    margin: 1rem 0;
  }
  
  .preset-card {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    color: var(--text-primary);
  }
  
  .preset-card:hover:not(:disabled) {
    border-color: var(--primary-color);
  }
  
  .preset-card.selected {
    background: var(--primary-color);
    color: var(--text-inverse);
    border-color: var(--primary-color);
  }
  
  .preset-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
    background: var(--input-bg);
    color: var(--text-primary);
  }
  
  .required {
    color: var(--danger-color);
  }
  
  .execution-summary {
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    padding: 1rem;
    margin: 1rem 0;
    color: var(--text-primary);
  }
  
  .execution-summary h4 {
    margin: 0 0 0.75rem 0;
  }
  
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
  }
  
  .summary-row .label {
    font-weight: 500;
  }
  
  .btn-execute {
    width: 100%;
    margin-top: 1rem;
    padding: 1rem;
    font-size: 1rem;
  }
  
  .results-summary {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin: 1.5rem 0;
  }
  
  .result-stat {
    text-align: center;
    padding: 1.5rem;
    border-radius: 0.5rem;
  }
  
  .result-stat.success {
    background: var(--success-light);
    border: 1px solid var(--success-color);
    color: var(--text-primary);
  }
  
  .result-stat.failed {
    background: var(--danger-light);
    border: 1px solid var(--danger-color);
    color: var(--text-primary);
  }
  
  .stat-value {
    font-size: 2.5rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
  }
  
  .stat-label {
    font-size: 0.875rem;
    text-transform: uppercase;
  }
  
  .errors-list {
    margin-top: 1.5rem;
  }
  
  .errors-list h4 {
    margin: 0 0 0.75rem 0;
    color: var(--text-primary);
  }
  
  .error-item {
    padding: 0.75rem;
    background: var(--danger-light);
    border-radius: 0.5rem;
    margin: 0.5rem 0;
    font-size: 0.875rem;
    color: var(--text-primary);
  }
  
  .devices-summary {
    margin: 1rem 0;
  }
  
  .hint {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .footer-actions {
    display: flex;
    gap: 0.5rem;
  }
</style>
