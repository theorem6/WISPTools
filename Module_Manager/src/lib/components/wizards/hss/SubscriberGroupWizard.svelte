<script lang="ts">
  /**
   * Subscriber Group Wizard
   * Guides users through creating an HSS subscriber group (name, optional plan, APN, QCI).
   */
  import { createEventDispatcher } from 'svelte';
  import BaseWizard from '../BaseWizard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { auth } from '$lib/firebase';
  import { authService } from '$lib/services/authService';
  import { API_CONFIG } from '$lib/config/api';

  export let show = false;
  const dispatch = createEventDispatcher<{ close: void; saved: void }>();

  const HSS_API = API_CONFIG.PATHS.HSS;

  let currentStep = 0;
  let isLoading = false;
  let error = '';
  let success = '';

  const steps = [
    { id: 'welcome', title: 'Welcome', icon: '📦' },
    { id: 'details', title: 'Group Details', icon: '📋' },
    { id: 'complete', title: 'Complete', icon: '🎉' }
  ];

  let name = '';
  let description = '';
  let bandwidth_plan_id = '';
  let default_apn = 'internet';
  let default_qci = 9;

  let bandwidthPlans: Array<{ plan_id?: string; id?: string; _id?: string; name?: string }> = [];

  async function loadBandwidthPlans() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) return;
    const user = auth().currentUser;
    if (!user) return;
    try {
      const token = await authService.getAuthTokenForApi();
      const response = await fetch(`${HSS_API}/bandwidth-plans`, {
        headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        const raw = data.plans || data || [];
        bandwidthPlans = Array.isArray(raw) ? raw : [];
      }
    } catch (err) {
      console.error('Failed to load bandwidth plans:', err);
      bandwidthPlans = [];
    }
  }

  function handleClose() {
    show = false;
    resetWizard();
    dispatch('close');
  }

  function resetWizard() {
    currentStep = 0;
    name = '';
    description = '';
    bandwidth_plan_id = '';
    default_apn = 'internet';
    default_qci = 9;
    error = '';
    success = '';
  }

  function handleStepChange(event: CustomEvent<number>) {
    currentStep = event.detail;
    if (currentStep === 1) loadBandwidthPlans();
  }

  function nextStep() {
    if (currentStep === 1) {
      if (!name.trim()) {
        error = 'Group name is required';
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

  function planId(plan: any): string {
    return plan.plan_id || plan.id || plan._id?.toString?.() || '';
  }

  function planName(plan: any): string {
    return plan.name || plan.plan_name || String(planId(plan) || 'Unnamed');
  }

  async function submitGroup() {
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
      const token = await authService.getAuthTokenForApi();
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        bandwidth_plan_id: bandwidth_plan_id || undefined,
        default_apn: default_apn.trim() || 'internet',
        default_qci: Number(default_qci) || 9
      };
      const response = await fetch(`${HSS_API}/groups`, {
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
        throw new Error(errData.error || `Failed to create group (${response.status})`);
      }
      success = `Subscriber group "${name}" created successfully.`;
      currentStep = steps.length - 1;
      dispatch('saved');
    } catch (err: any) {
      error = err.message || 'Failed to create subscriber group';
    } finally {
      isLoading = false;
    }
  }
</script>

<BaseWizard
  {show}
  title="📦 Subscriber Group Wizard"
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
        <h3>Create a Subscriber Group</h3>
        <p>Groups organize subscribers and can be linked to a bandwidth plan. New subscribers can be assigned to this group.</p>
        <div class="info-box">
          <h4>You will:</h4>
          <ul>
            <li>Enter a group name and optional description</li>
            <li>Optionally assign a bandwidth plan</li>
            <li>Set default APN and QCI for the group</li>
          </ul>
        </div>
      </div>
    {:else if currentStep === 1}
      <div class="wizard-panel">
        <h3>Group Details</h3>
        <div class="form-group">
          <label>Group Name <span class="required">*</span></label>
          <input type="text" bind:value={name} placeholder="e.g. Residential Standard" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Description</label>
          <input type="text" bind:value={description} placeholder="Optional description" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Bandwidth Plan</label>
          <select bind:value={bandwidth_plan_id} disabled={isLoading}>
            <option value="">— None —</option>
            {#each bandwidthPlans as plan}
              <option value={planId(plan)}>{planName(plan)}</option>
            {/each}
          </select>
        </div>
        <div class="form-group">
          <label>Default APN</label>
          <input type="text" bind:value={default_apn} placeholder="internet" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Default QCI</label>
          <input type="number" bind:value={default_qci} min="1" max="9" step="1" disabled={isLoading} />
        </div>
      </div>
    {:else if currentStep === 2}
      <div class="wizard-panel">
        {#if success}
          <h3>🎉 Group created</h3>
          <p>{success}</p>
          <div class="info-box success">
            <p><strong>{name}</strong></p>
            {#if bandwidth_plan_id}
              {@const selectedPlan = bandwidthPlans.find(p => planId(p) === bandwidth_plan_id)}
              {#if selectedPlan}
                <p>Plan: {planName(selectedPlan)}</p>
              {/if}
            {/if}
          </div>
          <a href="/modules/hss-management" class="next-step-item">Back to HSS Management →</a>
        {:else}
          <h3>Review & create</h3>
          <div class="summary-row"><span class="label">Name</span><span class="value">{name}</span></div>
          {#if description}
            <div class="summary-row"><span class="label">Description</span><span class="value">{description}</span></div>
          {/if}
          {#if bandwidth_plan_id}
            {@const selectedPlan = bandwidthPlans.find(p => planId(p) === bandwidth_plan_id)}
            <div class="summary-row"><span class="label">Bandwidth Plan</span><span class="value">{selectedPlan ? planName(selectedPlan) : bandwidth_plan_id}</span></div>
          {/if}
          <div class="summary-row"><span class="label">Default APN</span><span class="value">{default_apn || 'internet'}</span></div>
          <div class="summary-row"><span class="label">Default QCI</span><span class="value">{default_qci}</span></div>
          <button type="button" class="wizard-btn-primary" on:click={submitGroup} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Group'}
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
  .form-group input, .form-group select { width: 100%; padding: var(--spacing-sm) var(--spacing-md); border: 1px solid var(--border-color); border-radius: var(--radius-md); font-size: var(--font-size-sm); background: var(--input-bg); color: var(--text-primary); }
  .required { color: var(--danger-color); }
  .summary-row { display: flex; justify-content: space-between; padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
  .summary-row .label { color: var(--text-secondary); }
  .next-step-item { display: inline-block; margin-top: var(--spacing-md); padding: var(--spacing-sm) var(--spacing-md); background: var(--primary-color); color: var(--text-inverse); border-radius: var(--radius-md); text-decoration: none; }
  .footer-actions { display: flex; gap: var(--spacing-sm); }
</style>
