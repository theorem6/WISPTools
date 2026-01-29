<script lang="ts">
  /**
   * Preset Creation Wizard
   * 
   * Guides users through creating TR-069 configuration presets.
   */
  
  import { createEventDispatcher } from 'svelte';
  import BaseWizard from '../BaseWizard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  
  const dispatch = createEventDispatcher<{ close: void }>();
  export let show = false;
  
  let currentStep = 0;
  let isLoading = false;
  let error = '';
  let success = '';
  
  // Wizard steps
  const steps = [
    { id: 'welcome', title: 'Welcome', icon: '⚙️' },
    { id: 'basic', title: 'Basic Info', icon: '📝' },
    { id: 'config', title: 'Configurations', icon: '🔧' },
    { id: 'review', title: 'Review', icon: '👀' },
    { id: 'complete', title: 'Complete', icon: '🎉' }
  ];
  
  // Preset data
  let presetName = '';
  let presetDescription = '';
  let presetWeight = 100;
  let presetEnabled = true;
  let presetTags: string[] = [];
  let newTag = '';
  let configurations: Array<{
    path: string;
    value: string;
    type: 'string' | 'number' | 'boolean';
  }> = [];
  let newConfigPath = '';
  let newConfigValue = '';
  let newConfigType: 'string' | 'number' | 'boolean' = 'string';
  
  function handleClose() {
    show = false;
    resetWizard();
    dispatch('close');
  }
  
  function resetWizard() {
    currentStep = 0;
    presetName = '';
    presetDescription = '';
    presetWeight = 100;
    presetEnabled = true;
    presetTags = [];
    newTag = '';
    configurations = [];
    newConfigPath = '';
    newConfigValue = '';
    newConfigType = 'string';
    error = '';
    success = '';
  }
  
  function handleStepChange(event: CustomEvent<number>) {
    currentStep = event.detail;
  }
  
  function nextStep() {
    if (currentStep === 1 && !presetName.trim()) {
      error = 'Preset name is required';
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
  
  function addTag() {
    if (newTag.trim() && !presetTags.includes(newTag.trim())) {
      presetTags = [...presetTags, newTag.trim()];
      newTag = '';
    }
  }
  
  function removeTag(tag: string) {
    presetTags = presetTags.filter(t => t !== tag);
  }
  
  function addConfiguration() {
    if (newConfigPath.trim() && newConfigValue.trim()) {
      configurations = [...configurations, {
        path: newConfigPath.trim(),
        value: newConfigValue.trim(),
        type: newConfigType
      }];
      newConfigPath = '';
      newConfigValue = '';
      newConfigType = 'string';
    }
  }
  
  function removeConfiguration(index: number) {
    configurations = configurations.filter((_, i) => i !== index);
  }
  
  async function savePreset() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) {
      error = 'No tenant selected';
      return;
    }
    
    if (!presetName.trim()) {
      error = 'Preset name is required';
      return;
    }
    
    isLoading = true;
    error = '';
    
    try {
      const response = await fetch('/api/tr069/presets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({
          name: presetName.trim(),
          description: presetDescription.trim(),
          weight: presetWeight,
          enabled: presetEnabled,
          tags: presetTags,
          configurations: configurations.map(c => ({
            path: c.path,
            value: c.type === 'number' ? Number(c.value) : c.type === 'boolean' ? c.value === 'true' : c.value,
            type: c.type
          }))
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create preset');
      }
      
      success = 'Preset created successfully!';
      setTimeout(() => {
        nextStep();
      }, 1500);
    } catch (err: any) {
      error = err.message || 'Failed to create preset';
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
  title="⚙️ Preset Creation Wizard"
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
        <h3>Welcome to Preset Creation! ⚙️</h3>
        <p>Create configuration presets to quickly apply settings to multiple CPE devices.</p>
        
        <div class="info-box">
          <h4>What are Presets?</h4>
          <p>Presets are reusable configuration templates that define device parameters, settings, and behaviors. You can apply presets to individual devices or bulk operations.</p>
        </div>
        
        <div class="info-box">
          <h4>What You'll Create:</h4>
          <ul>
            <li>✅ Preset name and description</li>
            <li>✅ Configuration parameters</li>
            <li>✅ Tags for organization</li>
            <li>✅ Weight for priority ordering</li>
          </ul>
        </div>
      </div>
      
    {:else if currentStep === 1}
      <!-- Basic Info -->
      <div class="wizard-panel">
        <h3>Basic Information</h3>
        
        <div class="form-group">
          <label>
            Preset Name <span class="required">*</span>
          </label>
          <input 
            type="text" 
            bind:value={presetName}
            placeholder="e.g., Default Router Config"
            disabled={isLoading}
          />
        </div>
        
        <div class="form-group">
          <label>Description</label>
          <textarea 
            bind:value={presetDescription}
            placeholder="Describe what this preset does..."
            rows="3"
            disabled={isLoading}
          ></textarea>
        </div>
        
        <div class="form-group">
          <label>Weight (Priority)</label>
          <input 
            type="number" 
            bind:value={presetWeight}
            min="0"
            max="1000"
            disabled={isLoading}
          />
          <small>Higher weight = higher priority when multiple presets apply</small>
        </div>
        
        <div class="form-group">
          <label>
            <input 
              type="checkbox" 
              bind:checked={presetEnabled}
              disabled={isLoading}
            />
            Enabled (preset can be applied)
          </label>
        </div>
        
        <div class="form-group">
          <label>Tags</label>
          <div class="tag-input-group">
            <input 
              type="text" 
              bind:value={newTag}
              placeholder="Add a tag..."
              on:keydown={(e) => e.key === 'Enter' && addTag()}
              disabled={isLoading}
            />
            <button 
              class="btn-small" 
              on:click={addTag}
              disabled={isLoading || !newTag.trim()}
            >
              Add
            </button>
          </div>
          {#if presetTags.length > 0}
            <div class="tags-list">
              {#each presetTags as tag}
                <span class="tag">
                  {tag}
                  <button 
                    class="tag-remove" 
                    on:click={() => removeTag(tag)}
                    disabled={isLoading}
                  >
                    ×
                  </button>
                </span>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      
    {:else if currentStep === 2}
      <!-- Configurations -->
      <div class="wizard-panel">
        <h3>Configuration Parameters</h3>
        <p>Define the device parameters this preset will configure.</p>
        
        <div class="config-form">
          <div class="form-row">
            <div class="form-group">
              <label>Parameter Path</label>
              <input 
                type="text" 
                bind:value={newConfigPath}
                placeholder="e.g., InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Enable"
                disabled={isLoading}
              />
            </div>
            <div class="form-group">
              <label>Value</label>
              <input 
                type="text" 
                bind:value={newConfigValue}
                placeholder="e.g., true, 192.168.1.1, etc."
                disabled={isLoading}
              />
            </div>
            <div class="form-group">
              <label>Type</label>
              <select bind:value={newConfigType} disabled={isLoading}>
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
              </select>
            </div>
            <div class="form-group">
              <button 
                class="btn-small btn-primary" 
                on:click={addConfiguration}
                disabled={isLoading || !newConfigPath.trim() || !newConfigValue.trim()}
              >
                Add
              </button>
            </div>
          </div>
        </div>
        
        {#if configurations.length > 0}
          <div class="configurations-list">
            <h4>Added Configurations ({configurations.length})</h4>
            {#each configurations as config, index}
              <div class="config-item">
                <div class="config-path">{config.path}</div>
                <div class="config-value">
                  <span class="value">{config.value}</span>
                  <span class="type">({config.type})</span>
                </div>
                <button 
                  class="btn-icon" 
                  on:click={() => removeConfiguration(index)}
                  disabled={isLoading}
                >
                  🗑️
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <div class="info-box">
            <p>No configurations added yet. Add at least one configuration parameter.</p>
          </div>
        {/if}
      </div>
      
    {:else if currentStep === 3}
      <!-- Review -->
      <div class="wizard-panel">
        <h3>Review Preset</h3>
        <p>Review your preset before creating it.</p>
        
        <div class="review-section">
          <h4>Basic Information</h4>
          <div class="review-row">
            <span class="label">Name:</span>
            <span class="value">{presetName}</span>
          </div>
          <div class="review-row">
            <span class="label">Description:</span>
            <span class="value">{presetDescription || 'No description'}</span>
          </div>
          <div class="review-row">
            <span class="label">Weight:</span>
            <span class="value">{presetWeight}</span>
          </div>
          <div class="review-row">
            <span class="label">Enabled:</span>
            <span class="value">{presetEnabled ? 'Yes' : 'No'}</span>
          </div>
          {#if presetTags.length > 0}
            <div class="review-row">
              <span class="label">Tags:</span>
              <span class="value">{presetTags.join(', ')}</span>
            </div>
          {/if}
        </div>
        
        <div class="review-section">
          <h4>Configurations ({configurations.length})</h4>
          {#if configurations.length > 0}
            {#each configurations as config}
              <div class="config-review-item">
                <div class="config-path">{config.path}</div>
                <div class="config-value">{config.value} <span class="type">({config.type})</span></div>
              </div>
            {/each}
          {:else}
            <p class="warning">⚠️ No configurations defined. The preset will have no effect.</p>
          {/if}
        </div>
      </div>
      
    {:else if currentStep === 4}
      <!-- Complete -->
      <div class="wizard-panel">
        <h3>🎉 Preset Created!</h3>
        <p>Your preset "{presetName}" has been created successfully.</p>
        
        <div class="next-steps">
          <h4>What's Next?</h4>
          <a href="/modules/acs-cpe-management/presets" class="next-step-item">
            <span class="icon">📋</span>
            <div>
              <strong>View Presets</strong>
              <p>Go to the Presets page to manage your presets</p>
            </div>
          </a>
          <a href="/modules/acs-cpe-management/devices" class="next-step-item">
            <span class="icon">⚙️</span>
            <div>
              <strong>Apply to Devices</strong>
              <p>Use bulk operations to apply this preset to devices</p>
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
      {#if currentStep === 3}
        <button 
          class="wizard-btn-primary" 
          on:click={savePreset} 
          disabled={isLoading || !presetName.trim()}
        >
          {isLoading ? 'Creating...' : 'Create Preset →'}
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
  
  .form-group small {
    display: block;
    margin-top: 0.25rem;
    color: var(--text-secondary);
    font-size: 0.75rem;
  }
  
  .required {
    color: var(--danger-color);
  }
  
  .tag-input-group {
    display: flex;
    gap: 0.5rem;
  }
  
  .tag-input-group input {
    flex: 1;
  }
  
  .btn-small {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    border: none;
    font-size: 0.875rem;
    cursor: pointer;
    background: var(--primary-color);
    color: var(--text-inverse);
  }
  
  .btn-small:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--primary-color);
    color: var(--text-inverse);
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
  }
  
  .tag-remove {
    background: none;
    border: none;
    color: var(--text-inverse);
    cursor: pointer;
    font-size: 1.25rem;
    line-height: 1;
    padding: 0;
  }
  
  .config-form {
    margin: 1rem 0;
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 2fr 1fr 100px auto;
    gap: 0.5rem;
    align-items: end;
  }
  
  .configurations-list {
    margin-top: 1.5rem;
  }
  
  .configurations-list h4 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }
  
  .config-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    margin: 0.5rem 0;
  }
  
  .config-path {
    flex: 1;
    font-family: monospace;
    font-size: 0.875rem;
    word-break: break-all;
    color: var(--text-primary);
  }
  
  .config-value {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .config-value .value {
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .config-value .type {
    color: var(--text-secondary);
    font-size: 0.75rem;
  }
  
  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    padding: 0.25rem;
    color: var(--text-primary);
  }
  
  .review-section {
    margin: 1.5rem 0;
  }
  
  .review-section h4 {
    margin: 0 0 0.75rem 0;
    font-size: 1.1rem;
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
  
  .config-review-item {
    padding: 0.75rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    margin: 0.5rem 0;
  }
  
  .config-review-item .config-path {
    font-family: monospace;
    font-size: 0.875rem;
    margin-bottom: 0.25rem;
    color: var(--text-primary);
  }
  
  .warning {
    color: var(--warning-color);
    background: var(--warning-light);
    padding: 0.75rem;
    border-radius: 0.5rem;
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
