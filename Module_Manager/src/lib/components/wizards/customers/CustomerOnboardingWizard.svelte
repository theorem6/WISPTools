<script lang="ts">
  /**
   * Customer Onboarding Wizard
   * Guides users through adding a new customer (basic info, address, service type, optional LTE).
   */
  import { createEventDispatcher } from 'svelte';
  import BaseWizard from '../BaseWizard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { customerService, type Customer } from '$lib/services/customerService';
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
    { id: 'welcome', title: 'Welcome', icon: '👋' },
    { id: 'basic', title: 'Basic Info', icon: '👤' },
    { id: 'address', title: 'Address', icon: '📍' },
    { id: 'service', title: 'Service', icon: '📡' },
    { id: 'lte', title: 'LTE (optional)', icon: '🔐' },
    { id: 'complete', title: 'Complete', icon: '🎉' }
  ];

  let firstName = '';
  let lastName = '';
  let primaryPhone = '';
  let email = '';
  let street = '';
  let city = '';
  let state = '';
  let zipCode = '';
  let serviceType: '' | '4G/5G' | 'FWA' | 'WiFi' | 'Fiber' = '';
  let groupId = '';
  let imsi = '';
  let ki = '';
  let opc = '';
  let macAddress = '';

  let groups: Array<{ group_id: string; name: string }> = [];

  async function loadGroups() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) return;
    const user = auth().currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    try {
      const res = await fetch(`${HSS_API}/groups`, {
        headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': tenantId }
      });
      if (res.ok) {
        const data = await res.json();
        const raw = Array.isArray(data) ? data : (data.groups || data.items || []);
        groups = raw.map((g: any) => ({ group_id: g.group_id || g.id || g._id || '', name: g.name || g.group_name || String(g.group_id || g.id || '') }));
      }
    } catch (e) {
      console.error('Failed to load groups:', e);
    }
  }

  function handleClose() {
    show = false;
    resetWizard();
    dispatch('close');
  }

  function resetWizard() {
    currentStep = 0;
    firstName = '';
    lastName = '';
    primaryPhone = '';
    email = '';
    street = '';
    city = '';
    state = '';
    zipCode = '';
    serviceType = '';
    groupId = '';
    imsi = '';
    ki = '';
    opc = '';
    macAddress = '';
    error = '';
    success = '';
  }

  function handleStepChange(event: CustomEvent<number>) {
    currentStep = event.detail;
    if (currentStep === 3) loadGroups();
  }

  function nextStep() {
    if (currentStep === 1) {
      if (!firstName.trim() || !lastName.trim()) {
        error = 'First and last name are required';
        return;
      }
      if (!primaryPhone.trim()) {
        error = 'Primary phone is required';
        return;
      }
    }
    if (currentStep === 2) {
      if (!street.trim() || !city.trim() || !zipCode.trim()) {
        error = 'Street, city, and ZIP are required';
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

  async function createCustomer() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) {
      error = 'No tenant selected';
      return;
    }
    isLoading = true;
    error = '';
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const customerData: Partial<Customer> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName,
        primaryPhone: primaryPhone.trim(),
        email: email.trim() || undefined,
        serviceAddress: {
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          zipCode: zipCode.trim(),
          country: 'USA'
        },
        serviceStatus: 'pending',
        serviceType: serviceType || undefined,
        groupId: groupId || undefined,
        macAddress: macAddress.trim() || undefined,
        isActive: true
      };
      if (serviceType === '4G/5G' && (imsi.trim() || ki.trim() || opc.trim())) {
        if (imsi.trim()) customerData.networkInfo = { imsi: imsi.trim() };
        if (ki.trim() || opc.trim()) {
          customerData.lteAuth = {
            ki: ki.trim() || undefined,
            opc: opc.trim() || undefined,
            sqn: 0
          };
        }
      }
      await customerService.createCustomer(customerData);
      success = 'Customer created successfully!';
      currentStep = steps.length - 1;
      dispatch('saved');
    } catch (err: any) {
      error = err.message || 'Failed to create customer';
    } finally {
      isLoading = false;
    }
  }
</script>

<BaseWizard
  {show}
  title="👋 Customer Onboarding Wizard"
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
        <h3>Add a New Customer</h3>
        <p>This wizard guides you through adding a customer: basic info, address, service type, and optional LTE credentials.</p>
        <div class="info-box">
          <h4>You will:</h4>
          <ul>
            <li>Enter name and contact info</li>
            <li>Set service address</li>
            <li>Choose service type and optional group</li>
            <li>Optionally add LTE/5G credentials</li>
          </ul>
        </div>
      </div>
    {:else if currentStep === 1}
      <div class="wizard-panel">
        <h3>Basic Information</h3>
        <div class="form-group">
          <label>First Name <span class="required">*</span></label>
          <input type="text" bind:value={firstName} placeholder="John" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Last Name <span class="required">*</span></label>
          <input type="text" bind:value={lastName} placeholder="Smith" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Primary Phone <span class="required">*</span></label>
          <input type="tel" bind:value={primaryPhone} placeholder="555-123-4567" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" bind:value={email} placeholder="john@example.com" disabled={isLoading} />
        </div>
      </div>
    {:else if currentStep === 2}
      <div class="wizard-panel">
        <h3>Service Address</h3>
        <div class="form-group">
          <label>Street <span class="required">*</span></label>
          <input type="text" bind:value={street} placeholder="123 Main St" disabled={isLoading} />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>City <span class="required">*</span></label>
            <input type="text" bind:value={city} placeholder="City" disabled={isLoading} />
          </div>
          <div class="form-group">
            <label>State</label>
            <input type="text" bind:value={state} placeholder="State" disabled={isLoading} />
          </div>
          <div class="form-group">
            <label>ZIP <span class="required">*</span></label>
            <input type="text" bind:value={zipCode} placeholder="12345" disabled={isLoading} />
          </div>
        </div>
      </div>
    {:else if currentStep === 3}
      <div class="wizard-panel">
        <h3>Service Type & Group</h3>
        <div class="form-group">
          <label>Service Type</label>
          <select bind:value={serviceType} disabled={isLoading}>
            <option value="">Select type</option>
            <option value="4G/5G">4G/5G (LTE/5G)</option>
            <option value="FWA">FWA (Fixed Wireless)</option>
            <option value="WiFi">WiFi</option>
            <option value="Fiber">Fiber</option>
          </select>
        </div>
        <div class="form-group">
          <label>Customer Group (optional)</label>
          <select bind:value={groupId} disabled={isLoading}>
            <option value="">No group</option>
            {#each groups as g}
              <option value={g.group_id}>{g.name}</option>
            {/each}
          </select>
        </div>
      </div>
    {:else if currentStep === 4}
      <div class="wizard-panel">
        <h3>LTE/5G (optional)</h3>
        <p class="hint">Only needed if service type is 4G/5G and you want to sync to HSS.</p>
        <div class="form-group">
          <label>IMSI (15 digits)</label>
          <input type="text" bind:value={imsi} placeholder="123456789012345" maxlength="15" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Ki (32 hex)</label>
          <input type="text" bind:value={ki} placeholder="32 hex characters" maxlength="32" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>OPc (32 hex)</label>
          <input type="text" bind:value={opc} placeholder="32 hex characters" maxlength="32" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>MAC Address (optional)</label>
          <input type="text" bind:value={macAddress} placeholder="aa:bb:cc:dd:ee:ff" disabled={isLoading} />
        </div>
      </div>
    {:else if currentStep === 5}
      <div class="wizard-panel">
        {#if success}
          <h3>🎉 Customer created</h3>
          <p>{success}</p>
          <div class="info-box success">
            <p><strong>{firstName} {lastName}</strong></p>
            <p>{street}, {city}, {state} {zipCode}</p>
            {#if serviceType}<p>Service: {serviceType}</p>{/if}
          </div>
          <a href="/modules/customers" class="next-step-item">View in Customers module →</a>
        {:else}
          <h3>Review & create</h3>
          <div class="summary-row"><span class="label">Name</span><span class="value">{firstName} {lastName}</span></div>
          <div class="summary-row"><span class="label">Phone</span><span class="value">{primaryPhone}</span></div>
          <div class="summary-row"><span class="label">Address</span><span class="value">{street}, {city}, {state} {zipCode}</span></div>
          <div class="summary-row"><span class="label">Service</span><span class="value">{serviceType || '—'}</span></div>
          {#if groupId}
            <div class="summary-row"><span class="label">Group</span><span class="value">{groups.find(g => g.group_id === groupId)?.name || groupId}</span></div>
          {/if}
          <button type="button" class="wizard-btn-primary" on:click={createCustomer} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create customer'}
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
      {#if currentStep === 4}
        <button class="wizard-btn-primary" on:click={nextStep} disabled={isLoading}>Next →</button>
      {:else if currentStep === 5 && success}
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
  .hint { font-size: var(--font-size-sm); color: var(--text-secondary); }
  .info-box { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--spacing-md); margin: var(--spacing-md) 0; color: var(--text-primary); }
  .info-box.success { background: var(--success-light); border-color: var(--success-color); }
  .info-box ul { margin: var(--spacing-sm) 0 0 0; padding-left: 1.25rem; }
  .form-group { margin: var(--spacing-md) 0; }
  .form-group label { display: block; margin-bottom: var(--spacing-sm); font-weight: var(--font-weight-medium); color: var(--text-primary); }
  .form-group input, .form-group select { width: 100%; padding: var(--spacing-sm) var(--spacing-md); border: 1px solid var(--border-color); border-radius: var(--radius-md); font-size: var(--font-size-sm); background: var(--input-bg); color: var(--text-primary); }
  .form-row { display: grid; grid-template-columns: 1fr 1fr 120px; gap: var(--spacing-md); }
  .required { color: var(--danger-color); }
  .summary-row { display: flex; justify-content: space-between; padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
  .summary-row .label { color: var(--text-secondary); }
  .next-step-item { display: inline-block; margin-top: var(--spacing-md); padding: var(--spacing-sm) var(--spacing-md); background: var(--primary-color); color: var(--text-inverse); border-radius: var(--radius-md); text-decoration: none; }
  .footer-actions { display: flex; gap: var(--spacing-sm); }
</style>
