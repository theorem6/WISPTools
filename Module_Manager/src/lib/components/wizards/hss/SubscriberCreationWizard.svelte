<script lang="ts">
  /**
   * Subscriber Creation Wizard
   * Guides users through creating an HSS/LTE subscriber (IMSI, auth, group, plan).
   */
  import { createEventDispatcher } from 'svelte';
  import BaseWizard from '../BaseWizard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { auth } from '$lib/firebase';
  import { authService } from '$lib/services/authService';
  import { API_CONFIG } from '$lib/config/api';

  export let show = false;
  const dispatch = createEventDispatcher<{ close: void }>();

  const HSS_API = API_CONFIG.PATHS.HSS;

  let currentStep = 0;
  let isLoading = false;
  let error = '';
  let success = '';

  const steps = [
    { id: 'welcome', title: 'Welcome', icon: '🔐' },
    { id: 'identity', title: 'Identity', icon: '📱' },
    { id: 'auth', title: 'Authentication', icon: '🔑' },
    { id: 'group', title: 'Group & Plan', icon: '📋' },
    { id: 'complete', title: 'Complete', icon: '🎉' }
  ];

  let imsi = '';
  let subscriber_name = '';
  let msisdn = '';
  let ki = '';
  let opc = '';
  let group_id = '';
  let bandwidth_plan_id = '';
  let max_bandwidth_ul = 100;
  let max_bandwidth_dl = 100;
  let apn = 'internet';
  let enabled = true;

  let groups: Array<{ group_id: string; name: string }> = [];
  let bandwidthPlans: Array<{ id: string; name: string }> = [];

  function generateRandomHex(length: number): string {
    const chars = '0123456789ABCDEF';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  function generateKi() {
    ki = generateRandomHex(32);
  }

  function generateOPc() {
    opc = generateRandomHex(32);
  }

  async function loadGroupsAndPlans() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) return;
    const user = auth().currentUser;
    if (!user) return;
    const token = await authService.getAuthTokenForApi();
    try {
      const [groupsRes, plansRes] = await Promise.all([
        fetch(`${HSS_API}/groups`, {
          headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': tenantId }
        }),
        fetch(`${HSS_API}/bandwidth-plans`, {
          headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': tenantId }
        })
      ]);
      if (groupsRes.ok) {
        const data = await groupsRes.json();
        const raw = Array.isArray(data) ? data : (data.groups || data.items || []);
        groups = raw.map((g: any) => ({ group_id: g.group_id || g.id || g._id || '', name: g.name || g.group_name || String(g.group_id || g.id || '') }));
      }
      if (plansRes.ok) {
        const data = await plansRes.json();
        const raw = Array.isArray(data) ? data : (data.plans || data.items || []);
        bandwidthPlans = raw.map((p: any) => ({ id: p.id || p.plan_id || p._id || '', name: p.name || p.plan_name || String(p.id || p.plan_id || '') }));
      }
    } catch (e) {
      console.error('Failed to load groups/plans:', e);
    }
  }

  function handleClose() {
    show = false;
    resetWizard();
    dispatch('close');
  }

  function resetWizard() {
    currentStep = 0;
    imsi = '';
    subscriber_name = '';
    msisdn = '';
    ki = '';
    opc = '';
    group_id = '';
    bandwidth_plan_id = '';
    max_bandwidth_ul = 100;
    max_bandwidth_dl = 100;
    apn = 'internet';
    enabled = true;
    error = '';
    success = '';
  }

  function handleStepChange(event: CustomEvent<number>) {
    currentStep = event.detail;
    if (currentStep === 3) {
      loadGroupsAndPlans();
    }
  }

  function nextStep() {
    if (currentStep === 1) {
      if (!imsi.trim() || imsi.length !== 15) {
        error = 'IMSI must be 15 digits';
        return;
      }
      if (!subscriber_name.trim()) {
        error = 'Subscriber name is required';
        return;
      }
    }
    if (currentStep === 2) {
      if (!ki.trim() || ki.length !== 32) {
        error = 'Ki must be 32 hex characters';
        return;
      }
      if (!opc.trim() || opc.length !== 32) {
        error = 'OPc must be 32 hex characters';
        return;
      }
    }
    if (currentStep === 3) {
      if (!group_id) {
        error = 'Please select a group';
        return;
      }
      if (!bandwidth_plan_id) {
        error = 'Please select a bandwidth plan';
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

  async function createSubscriber() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) {
      error = 'No tenant selected';
      return;
    }
    const user = auth().currentUser;
    if (!user) {
      error = 'Not authenticated';
      return;
    }
    isLoading = true;
    error = '';
    try {
      const token = await authService.getAuthTokenForApi();
      const body = {
        imsi: imsi.trim(),
        subscriber_name: subscriber_name.trim(),
        msisdn: msisdn.trim() || undefined,
        ki: ki.trim(),
        opc: opc.trim(),
        amf: '8000',
        sqn: '000000000000',
        qci: 9,
        apn,
        group_id,
        bandwidth_plan_id,
        max_bandwidth_ul,
        max_bandwidth_dl,
        enabled
      };
      const response = await fetch(`${HSS_API}/subscribers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add subscriber');
      }
      success = 'Subscriber created successfully!';
      currentStep = steps.length - 1;
    } catch (err: any) {
      error = err.message || 'Failed to create subscriber';
    } finally {
      isLoading = false;
    }
  }
</script>

<BaseWizard
  {show}
  title="🔐 Subscriber Creation Wizard"
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
        <h3>Add HSS Subscriber</h3>
        <p>Create a new LTE/5G subscriber with IMSI, authentication keys, and service plan.</p>
        <div class="info-box">
          <h4>You will:</h4>
          <ul>
            <li>Enter IMSI and subscriber name</li>
            <li>Set Ki and OPc (or generate)</li>
            <li>Assign group and bandwidth plan</li>
          </ul>
        </div>
      </div>
    {:else if currentStep === 1}
      <div class="wizard-panel">
        <h3>Identity</h3>
        <div class="form-group">
          <label>IMSI <span class="required">*</span></label>
          <input type="text" bind:value={imsi} placeholder="15 digits, e.g. 001010000000001" maxlength="15" pattern="[0-9]{15}" disabled={isLoading} />
          <small>15-digit International Mobile Subscriber Identity</small>
        </div>
        <div class="form-group">
          <label>Subscriber name <span class="required">*</span></label>
          <input type="text" bind:value={subscriber_name} placeholder="Display name" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>MSISDN (phone number)</label>
          <input type="text" bind:value={msisdn} placeholder="Optional" disabled={isLoading} />
        </div>
      </div>
    {:else if currentStep === 2}
      <div class="wizard-panel">
        <h3>Authentication (Ki, OPc)</h3>
        <div class="form-group">
          <label>Ki <span class="required">*</span></label>
          <div class="input-row">
            <input type="text" bind:value={ki} placeholder="32 hex characters" maxlength="32" disabled={isLoading} />
            <button type="button" class="btn-small" on:click={generateKi} disabled={isLoading}>Generate</button>
          </div>
        </div>
        <div class="form-group">
          <label>OPc <span class="required">*</span></label>
          <div class="input-row">
            <input type="text" bind:value={opc} placeholder="32 hex characters" maxlength="32" disabled={isLoading} />
            <button type="button" class="btn-small" on:click={generateOPc} disabled={isLoading}>Generate</button>
          </div>
        </div>
        <div class="form-group">
          <label>APN</label>
          <input type="text" bind:value={apn} disabled={isLoading} />
        </div>
      </div>
    {:else if currentStep === 3}
      <div class="wizard-panel">
        <h3>Group & Bandwidth Plan</h3>
        <button type="button" class="btn-small" on:click={loadGroupsAndPlans} disabled={isLoading}>Load groups & plans</button>
        <div class="form-group">
          <label>Group <span class="required">*</span></label>
          <select bind:value={group_id} disabled={isLoading}>
            <option value="">-- Select group --</option>
            {#each groups as g}
              <option value={g.group_id}>{g.name || g.group_id}</option>
            {/each}
          </select>
        </div>
        <div class="form-group">
          <label>Bandwidth plan <span class="required">*</span></label>
          <select bind:value={bandwidth_plan_id} disabled={isLoading}>
            <option value="">-- Select plan --</option>
            {#each bandwidthPlans as p}
              <option value={p.id}>{p.name || p.id}</option>
            {/each}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Max UL (Mbps)</label>
            <input type="number" bind:value={max_bandwidth_ul} min="1" max="1000" disabled={isLoading} />
          </div>
          <div class="form-group">
            <label>Max DL (Mbps)</label>
            <input type="number" bind:value={max_bandwidth_dl} min="1" max="1000" disabled={isLoading} />
          </div>
        </div>
        <div class="form-group">
          <label><input type="checkbox" bind:checked={enabled} disabled={isLoading} /> Enabled</label>
        </div>
      </div>
    {:else if currentStep === 4}
      <div class="wizard-panel">
        {#if success}
          <h3>🎉 Subscriber created</h3>
          <p>{success}</p>
          <div class="info-box success">
            <p><strong>{subscriber_name}</strong> · IMSI {imsi}</p>
          </div>
          <a href="/modules/hss-management" class="next-step-item">View in HSS module →</a>
        {:else}
          <h3>Review & create</h3>
          <div class="summary-row"><span class="label">IMSI</span><span class="value">{imsi}</span></div>
          <div class="summary-row"><span class="label">Name</span><span class="value">{subscriber_name}</span></div>
          <div class="summary-row"><span class="label">Group</span><span class="value">{groups.find(g => g.group_id === group_id)?.name || group_id}</span></div>
          <div class="summary-row"><span class="label">Plan</span><span class="value">{bandwidthPlans.find(p => p.id === bandwidth_plan_id)?.name || bandwidth_plan_id}</span></div>
          <button type="button" class="wizard-btn-primary" on:click={createSubscriber} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create subscriber'}
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
      {#if currentStep === 3}
        <button class="wizard-btn-primary" on:click={nextStep} disabled={isLoading}>Next →</button>
      {:else if currentStep === 4 && success}
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
  .form-group small { display: block; margin-top: var(--spacing-xs); font-size: var(--font-size-xs); color: var(--text-secondary); }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); }
  .input-row { display: flex; gap: var(--spacing-sm); }
  .input-row input { flex: 1; }
  .required { color: var(--danger-color); }
  .btn-small { padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-md); border: none; font-size: var(--font-size-sm); cursor: pointer; background: var(--primary-color); color: var(--text-inverse); margin-bottom: var(--spacing-sm); }
  .btn-small:disabled { opacity: 0.5; cursor: not-allowed; }
  .summary-row { display: flex; justify-content: space-between; padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
  .summary-row .label { color: var(--text-secondary); }
  .next-step-item { display: inline-block; margin-top: var(--spacing-md); padding: var(--spacing-sm) var(--spacing-md); background: var(--primary-color); color: var(--text-inverse); border-radius: var(--radius-md); text-decoration: none; }
  .footer-actions { display: flex; gap: var(--spacing-sm); }
</style>
