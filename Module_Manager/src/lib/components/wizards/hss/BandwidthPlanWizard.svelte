<script lang="ts">
  /**
   * Bandwidth Plan Wizard
   * Guides users through creating an HSS bandwidth plan (name, download/upload Mbps).
   */
  import { createEventDispatcher } from 'svelte';
  import BaseWizard from '../BaseWizard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { auth } from '$lib/firebase';
  import { API_CONFIG } from '$lib/config/api';

  export let show = false;
  const dispatch = createEventDispatcher<{ close: void; saved: void }>();

  const HSS_API = API_CONFIG.PATHS.HSS;

  let currentStep = 0;
  let isLoading = false;
  let error = '';
  let success = '';

  const steps = [
    { id: 'welcome', title: 'Welcome', icon: '📶' },
    { id: 'details', title: 'Plan Details', icon: '📋' },
    { id: 'complete', title: 'Complete', icon: '🎉' }
  ];

  let name = '';
  let description = '';
  let download_mbps = 100;
  let upload_mbps = 50;

  function handleClose() {
    show = false;
    resetWizard();
    dispatch('close');
  }

  function resetWizard() {
    currentStep = 0;
    name = '';
    description = '';
    download_mbps = 100;
    upload_mbps = 50;
    error = '';
    success = '';
  }

  function handleStepChange(event: CustomEvent<number>) {
    currentStep = event.detail;
  }

  function nextStep() {
    if (currentStep === 1) {
      if (!name.trim()) {
        error = 'Plan name is required';
        return;
      }
      if (download_mbps < 0 || upload_mbps < 0) {
        error = 'Bandwidth values must be non-negative';
        return;
      }
    }
    error = '';
    if (currentStep < steps.length - 1) {
      currentStep++;
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
      error = '';
    }
  }

  async function submitPlan() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) {
      error = 'No tenant selected';
      return;
    }
    const user = auth().currentUser;
    if (!user) {
      error = 'Please sign in';
      return;
    }
    isLoading = true;
    error = '';
    try {
      const token = await user.getIdToken();
      const body = {
        plan_id: `plan_${Date.now()}`,
        name: name.trim(),
        description: description.trim() || undefined,
        download_mbps: Number(download_mbps),
        upload_mbps: Number(upload_mbps)
      };
      const response = await fetch(`${HSS_API}/bandwidth-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to create plan (${response.status})`);
      }
      success = `Bandwidth plan "${name}" created successfully.`;
      currentStep = steps.length - 1;
      dispatch('saved');
    } catch (err: any) {
      error = err.message || 'Failed to create bandwidth plan';
    } finally {
      isLoading = false;
    }
  }
</script>

<BaseWizard
  {show}
  title="📶 Bandwidth Plan Wizard"
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
      <div class="wizard-panel">
        <h3>Create a Bandwidth Plan</h3>
        <p>Define download and upload limits (Mbps) for subscriber groups. Groups can then be assigned to this plan.</p>
        <div class="info-box">
          <h4>You will:</h4>
          <ul>
            <li>Enter a plan name</li>
            <li>Set download and upload bandwidth (Mbps)</li>
            <li>Optionally add a description</li>
          </ul>
        </div>
      </div>
    {:else if currentStep === 1}
      <div class="wizard-panel">
        <h3>Plan Details</h3>
        <div class="form-group">
          <label>Plan Name <span class="required">*</span></label>
          <input type="text" bind:value={name} placeholder="e.g. Standard 100/50" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Description</label>
          <input type="text" bind:value={description} placeholder="Optional description" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Download (Mbps)</label>
          <input type="number" bind:value={download_mbps} min="0" step="1" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Upload (Mbps)</label>
          <input type="number" bind:value={upload_mbps} min="0" step="1" disabled={isLoading} />
        </div>
      </div>
    {:else if currentStep === 2}
      <div class="wizard-panel">
        {#if success}
          <h3>🎉 Plan created</h3>
          <p>{success}</p>
          <div class="info-box success">
            <p><strong>{name}</strong> — {download_mbps} Mbps down / {upload_mbps} Mbps up</p>
          </div>
          <a href="/modules/hss-management" class="next-step-item">Back to HSS Management →</a>
        {:else}
          <h3>Review & create</h3>
          <div class="summary-row"><span class="label">Name</span><span class="value">{name}</span></div>
          <div class="summary-row"><span class="label">Download</span><span class="value">{download_mbps} Mbps</span></div>
          <div class="summary-row"><span class="label">Upload</span><span class="value">{upload_mbps} Mbps</span></div>
          {#if description}
            <div class="summary-row"><span class="label">Description</span><span class="value">{description}</span></div>
          {/if}
          <button type="button" class="wizard-btn-primary" on:click={submitPlan} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Plan'}
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <div slot="footer" let:currentStep let:nextStep let:prevStep let:handleClose let:isLoading>
    {#if currentStep > 0 && currentStep < steps.length - 1}
      <button class="wizard-btn-secondary" on:click={prevStep} disabled={isLoading}>← Previous</button>
    {:else if currentStep === 0}
      <button class="wizard-btn-secondary" on:click={handleClose} disabled={isLoading}>Cancel</button>
    {/if}
    <div class="footer-actions">
      {#if currentStep === 1}
        <button class="wizard-btn-primary" on:click={nextStep} disabled={isLoading}>Next →</button>
      {:else if currentStep === 2 && success}
        <button class="wizard-btn-primary" on:click={handleClose}>Done</button>
      {:else if currentStep < steps.length - 1}
        <button class="wizard-btn-primary" on:click={nextStep} disabled={isLoading}>Next →</button>
      {/if}
    </div>
  </div>
</BaseWizard>

<style>
  .wizard-panel h3 { margin: 0 0 var(--spacing-md) 0; font-size: var(--font-size-2xl); color: var(--text-primary); }
  .wizard-panel p { margin: var(--spacing-sm) 0; color: var(--text-secondary); }
  .info-box { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--spacing-md); margin: var(--spacing-md) 0; color: var(--text-primary); }
  .info-box.success { background: var(--success-light); border-color: var(--success-color); }
  .info-box ul { margin: var(--spacing-sm) 0 0 0; padding-left: 1.25rem; }
  .form-group { margin: var(--spacing-md) 0; }
  .form-group label { display: block; margin-bottom: var(--spacing-sm); font-weight: var(--font-weight-medium); color: var(--text-primary); }
  .form-group input { width: 100%; padding: var(--spacing-sm) var(--spacing-md); border: 1px solid var(--border-color); border-radius: var(--radius-md); font-size: var(--font-size-sm); background: var(--input-bg); color: var(--text-primary); }
  .required { color: var(--danger-color); }
  .summary-row { display: flex; justify-content: space-between; padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
  .summary-row .label { color: var(--text-secondary); }
  .next-step-item { display: inline-block; margin-top: var(--spacing-md); padding: var(--spacing-sm) var(--spacing-md); background: var(--primary-color); color: var(--text-inverse); border-radius: var(--radius-md); text-decoration: none; }
  .footer-actions { display: flex; gap: var(--spacing-sm); }
</style>
