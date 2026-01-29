<script lang="ts">
  /**
   * Firmware Update Wizard
   * 
   * Guides users through updating firmware on CPE devices.
   */
  
  import { createEventDispatcher } from 'svelte';
  import BaseWizard from '../BaseWizard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  
  const dispatch = createEventDispatcher<{ close: void }>();
  export let show = false;
  export let deviceIds: string[] = [];
  
  let currentStep = 0;
  let isLoading = false;
  let error = '';
  let success = '';
  
  // Wizard steps
  const steps = [
    { id: 'welcome', title: 'Welcome', icon: '📦' },
    { id: 'select', title: 'Select Devices', icon: '📋' },
    { id: 'firmware', title: 'Firmware Info', icon: '💾' },
    { id: 'schedule', title: 'Schedule', icon: '📅' },
    { id: 'review', title: 'Review', icon: '👀' },
    { id: 'complete', title: 'Complete', icon: '🎉' }
  ];
  
  // Firmware state
  let firmwareFile: File | null = null;
  let firmwareUrl = '';
  let firmwareVersion = '';
  let firmwareDescription = '';
  let scheduleType: 'immediate' | 'scheduled' | 'maintenance' = 'immediate';
  let scheduledDate = '';
  let scheduledTime = '';
  let updateResults: {
    success: number;
    failed: number;
    pending: number;
    errors: Array<{ device: string; error: string }>;
  } | null = null;
  
  $: deviceCount = deviceIds.length;
  
  function handleClose() {
    show = false;
    resetWizard();
    dispatch('close');
  }
  
  function resetWizard() {
    currentStep = 0;
    firmwareFile = null;
    firmwareUrl = '';
    firmwareVersion = '';
    firmwareDescription = '';
    scheduleType = 'immediate';
    scheduledDate = '';
    scheduledTime = '';
    updateResults = null;
    error = '';
    success = '';
  }
  
  function handleStepChange(event: CustomEvent<number>) {
    currentStep = event.detail;
  }
  
  function nextStep() {
    if (currentStep === 1 && deviceIds.length === 0) {
      error = 'Please select at least one device';
      return;
    }
    if (currentStep === 2 && !firmwareUrl && !firmwareFile) {
      error = 'Please provide firmware file or URL';
      return;
    }
    if (currentStep === 2 && !firmwareVersion.trim()) {
      error = 'Firmware version is required';
      return;
    }
    if (currentStep === 3 && scheduleType === 'scheduled' && (!scheduledDate || !scheduledTime)) {
      error = 'Please select scheduled date and time';
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
  
  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      firmwareFile = target.files[0];
      firmwareUrl = ''; // Clear URL if file is selected
    }
  }
  
  async function uploadFirmware() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) {
      error = 'No tenant selected';
      return;
    }
    
    if (deviceIds.length === 0) {
      error = 'No devices selected';
      return;
    }
    
    isLoading = true;
    error = '';
    
    try {
      // Upload firmware file if provided
      let firmwareFileId = '';
      if (firmwareFile) {
        const formData = new FormData();
        formData.append('firmware', firmwareFile);
        formData.append('version', firmwareVersion);
        formData.append('description', firmwareDescription);
        
        const uploadResponse = await fetch('/api/tr069/firmware/upload', {
          method: 'POST',
          headers: {
            'x-tenant-id': tenantId
          },
          body: formData
        });
        
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok) {
          throw new Error(uploadData.error || 'Failed to upload firmware');
        }
        firmwareFileId = uploadData.fileId;
      }
      
      // Create firmware update task
      const taskBody: any = {
        deviceIds: deviceIds,
        firmwareVersion: firmwareVersion,
        description: firmwareDescription,
        scheduleType: scheduleType
      };
      
      if (firmwareFileId) {
        taskBody.firmwareFileId = firmwareFileId;
      } else if (firmwareUrl) {
        taskBody.firmwareUrl = firmwareUrl;
      }
      
      if (scheduleType === 'scheduled' && scheduledDate && scheduledTime) {
        taskBody.scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }
      
      const response = await fetch('/api/tr069/firmware/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify(taskBody)
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create firmware update task');
      }
      
      updateResults = {
        success: data.results?.success || 0,
        failed: data.results?.failed || 0,
        pending: data.results?.pending || 0,
        errors: data.results?.errors || []
      };
      
      success = `Firmware update task created: ${updateResults.success} succeeded, ${updateResults.pending} pending, ${updateResults.failed} failed`;
      
      setTimeout(() => {
        nextStep();
      }, 1500);
    } catch (err: any) {
      error = err.message || 'Failed to create firmware update';
    } finally {
      isLoading = false;
    }
  }
  
  function complete() {
    handleClose();
  }
  
  // Get today's date in YYYY-MM-DD format
  $: today = new Date().toISOString().split('T')[0];
</script>

<BaseWizard
  {show}
  title="📦 Firmware Update Wizard"
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
        <h3>Welcome to Firmware Update! 📦</h3>
        <p>Update firmware on your CPE devices safely and efficiently.</p>
        
        <div class="info-box">
          <h4>What This Wizard Does:</h4>
          <ul>
            <li>✅ Upload or specify firmware file/URL</li>
            <li>✅ Select devices to update</li>
            <li>✅ Schedule updates (immediate or scheduled)</li>
            <li>✅ Track update progress</li>
          </ul>
        </div>
        
        <div class="info-box warning">
          <h4>⚠️ Important Notes:</h4>
          <ul>
            <li>Firmware updates may cause temporary device downtime</li>
            <li>Ensure devices have stable connectivity</li>
            <li>Backup device configurations before updating</li>
          </ul>
        </div>
      </div>
      
    {:else if currentStep === 1}
      <!-- Select Devices -->
      <div class="wizard-panel">
        <h3>Select Devices</h3>
        <p>You have {deviceCount} device(s) selected for firmware update.</p>
        
        {#if deviceCount === 0}
          <div class="info-box warning">
            <p>⚠️ No devices selected. Please go to the Devices page and select devices first.</p>
          </div>
        {:else}
          <div class="devices-summary">
            <p>Ready to update firmware on {deviceCount} device(s).</p>
            <p class="hint">You can change device selection by going back to the Devices page.</p>
          </div>
        {/if}
      </div>
      
    {:else if currentStep === 2}
      <!-- Firmware Info -->
      <div class="wizard-panel">
        <h3>Firmware Information</h3>
        
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
        
        <div class="form-group">
          <label>Description</label>
          <textarea 
            bind:value={firmwareDescription}
            placeholder="Describe this firmware version..."
            rows="3"
            disabled={isLoading}
          ></textarea>
        </div>
        
        <div class="firmware-source">
          <h4>Firmware Source</h4>
          
          <div class="source-option">
            <label>
              <input 
                type="radio" 
                name="firmwareSource" 
                value="file"
                checked={firmwareFile !== null}
                on:change={() => { firmwareUrl = ''; }}
                disabled={isLoading}
              />
              Upload File
            </label>
            <input 
              type="file" 
              accept=".bin,.img,.firmware"
              on:change={handleFileSelect}
              disabled={isLoading}
            />
            {#if firmwareFile}
              <div class="file-info">
                <strong>Selected:</strong> {firmwareFile.name} ({(firmwareFile.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            {/if}
          </div>
          
          <div class="source-option">
            <label>
              <input 
                type="radio" 
                name="firmwareSource" 
                value="url"
                checked={firmwareUrl !== ''}
                on:change={() => { firmwareFile = null; }}
                disabled={isLoading}
              />
              Firmware URL
            </label>
            <input 
              type="url" 
              bind:value={firmwareUrl}
              placeholder="https://example.com/firmware.bin"
              disabled={isLoading || firmwareFile !== null}
            />
          </div>
        </div>
      </div>
      
    {:else if currentStep === 3}
      <!-- Schedule -->
      <div class="wizard-panel">
        <h3>Schedule Update</h3>
        
        <div class="form-group">
          <label>Update Type</label>
          <select bind:value={scheduleType} disabled={isLoading}>
            <option value="immediate">Immediate</option>
            <option value="scheduled">Scheduled</option>
            <option value="maintenance">Maintenance Window</option>
          </select>
        </div>
        
        {#if scheduleType === 'scheduled'}
          <div class="form-group">
            <label>
              Scheduled Date <span class="required">*</span>
            </label>
            <input 
              type="date" 
              bind:value={scheduledDate}
              min={today}
              disabled={isLoading}
            />
          </div>
          
          <div class="form-group">
            <label>
              Scheduled Time <span class="required">*</span>
            </label>
            <input 
              type="time" 
              bind:value={scheduledTime}
              disabled={isLoading}
            />
          </div>
        {:else if scheduleType === 'maintenance'}
          <div class="info-box">
            <p>Updates will be applied during the configured maintenance window for each device.</p>
          </div>
        {:else}
          <div class="info-box warning">
            <p>⚠️ Updates will start immediately after confirmation. Devices may experience brief downtime.</p>
          </div>
        {/if}
      </div>
      
    {:else if currentStep === 4}
      <!-- Review -->
      <div class="wizard-panel">
        <h3>Review Update</h3>
        <p>Review your firmware update configuration before proceeding.</p>
        
        <div class="review-section">
          <h4>Update Summary</h4>
          <div class="review-row">
            <span class="label">Devices:</span>
            <span class="value">{deviceCount}</span>
          </div>
          <div class="review-row">
            <span class="label">Firmware Version:</span>
            <span class="value">{firmwareVersion}</span>
          </div>
          <div class="review-row">
            <span class="label">Firmware Source:</span>
            <span class="value">{firmwareFile ? firmwareFile.name : firmwareUrl || 'Not specified'}</span>
          </div>
          <div class="review-row">
            <span class="label">Schedule:</span>
            <span class="value">
              {scheduleType === 'immediate' ? 'Immediate' : 
               scheduleType === 'scheduled' ? `Scheduled: ${scheduledDate} ${scheduledTime}` :
               'Maintenance Window'}
            </span>
          </div>
        </div>
        
        <button 
          class="wizard-btn-primary btn-execute" 
          on:click={uploadFirmware} 
          disabled={isLoading}
        >
          {isLoading ? 'Creating Update Task...' : '▶️ Create Update Task'}
        </button>
      </div>
      
    {:else if currentStep === 5}
      <!-- Complete -->
      <div class="wizard-panel">
        <h3>🎉 Firmware Update Task Created!</h3>
        
        {#if updateResults}
          <div class="results-summary">
            <div class="result-stat success">
              <div class="stat-value">{updateResults.success}</div>
              <div class="stat-label">Succeeded</div>
            </div>
            <div class="result-stat pending">
              <div class="stat-value">{updateResults.pending}</div>
              <div class="stat-label">Pending</div>
            </div>
            <div class="result-stat failed">
              <div class="stat-value">{updateResults.failed}</div>
              <div class="stat-label">Failed</div>
            </div>
          </div>
          
          {#if updateResults.errors.length > 0}
            <div class="errors-list">
              <h4>Errors:</h4>
              {#each updateResults.errors as errorItem}
                <div class="error-item">
                  <strong>{errorItem.device}:</strong> {errorItem.error}
                </div>
              {/each}
            </div>
          {/if}
        {/if}
        
        <div class="next-steps">
          <h4>What's Next?</h4>
          <a href="/modules/acs-cpe-management/devices" class="next-step-item">
            <span class="icon">📊</span>
            <div>
              <strong>Monitor Progress</strong>
              <p>Track firmware update progress in the Devices page</p>
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
  
  .form-group {
    margin: 1rem 0;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    background: var(--input-bg);
    color: var(--text-primary);
  }
  
  .required {
    color: var(--danger-color);
  }
  
  .firmware-source {
    margin: 1.5rem 0;
  }
  
  .firmware-source h4 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }
  
  .source-option {
    margin: 1rem 0;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    color: var(--text-primary);
  }
  
  .source-option label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }
  
  .source-option input[type="file"],
  .source-option input[type="url"] {
    width: 100%;
    margin-top: 0.5rem;
  }
  
  .file-info {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: var(--bg-tertiary);
    border-radius: 0.25rem;
    font-size: 0.875rem;
    color: var(--text-primary);
  }
  
  .review-section {
    margin: 1.5rem 0;
  }
  
  .review-section h4 {
    margin: 0 0 0.75rem 0;
    color: var(--text-primary);
  }
  
  .review-row {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border-color);
  }
  
  .review-row .label {
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .btn-execute {
    width: 100%;
    margin-top: 1rem;
    padding: 1rem;
    font-size: 1rem;
  }
  
  .results-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
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
  
  .result-stat.pending {
    background: var(--info-light);
    border: 1px solid var(--info-color);
    color: var(--text-primary);
  }
  
  .result-stat.failed {
    background: var(--danger-light);
    border: 1px solid var(--danger-color);
    color: var(--text-primary);
  }
  
  .stat-value {
    font-size: 2rem;
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
</style>
