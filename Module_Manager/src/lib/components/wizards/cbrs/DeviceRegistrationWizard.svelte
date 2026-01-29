<script lang="ts">
  /**
   * CBRS Device Registration Wizard
   * Guides users through registering a CBSD device (serial, FCC ID, category, location).
   * Emits saved with device payload; parent adds device and optionally registers with SAS.
   */
  import { createEventDispatcher } from 'svelte';
  import BaseWizard from '../BaseWizard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';

  export let show = false;
  const dispatch = createEventDispatcher<{ close: void; saved: CBSDDevicePayload }>();

  interface CBSDDevicePayload {
    cbsdSerialNumber: string;
    fccId: string;
    cbsdCategory: 'A' | 'B';
    sasProviderId: 'google';
    latitude: number;
    longitude: number;
    height: number;
    antennaGain: number;
  }

  let currentStep = 0;
  let error = '';
  let success = '';

  const steps = [
    { id: 'welcome', title: 'Welcome', icon: '📡' },
    { id: 'device', title: 'Device Info', icon: '📋' },
    { id: 'location', title: 'Location', icon: '📍' },
    { id: 'review', title: 'Review', icon: '👁️' },
    { id: 'complete', title: 'Complete', icon: '🎉' }
  ];

  let cbsdSerialNumber = '';
  let fccId = '';
  let cbsdCategory: 'A' | 'B' = 'A';
  let latitude = 40.7128;
  let longitude = -74.006;
  let height = 10;
  let antennaGain = 5;

  function handleClose() {
    show = false;
    resetWizard();
    dispatch('close');
  }

  function resetWizard() {
    currentStep = 0;
    cbsdSerialNumber = '';
    fccId = '';
    cbsdCategory = 'A';
    latitude = 40.7128;
    longitude = -74.006;
    height = 10;
    antennaGain = 5;
    error = '';
    success = '';
  }

  function handleStepChange(event: CustomEvent<number>) {
    currentStep = event.detail;
  }

  function nextStep() {
    if (currentStep === 1) {
      if (!cbsdSerialNumber.trim()) {
        error = 'CBSD serial number is required';
        return;
      }
      if (!fccId.trim()) {
        error = 'FCC ID is required';
        return;
      }
    }
    if (currentStep === 2) {
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        error = 'Enter valid latitude (-90 to 90) and longitude (-180 to 180)';
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

  function submitDevice() {
    const payload: CBSDDevicePayload = {
      cbsdSerialNumber: cbsdSerialNumber.trim(),
      fccId: fccId.trim(),
      cbsdCategory,
      sasProviderId: 'google',
      latitude: Number(latitude),
      longitude: Number(longitude),
      height: Number(height),
      antennaGain: Number(antennaGain)
    };
    success = 'Device details ready. Adding to your list.';
    dispatch('saved', payload);
    currentStep = steps.length - 1;
  }

  $: tenantId = $currentTenant?.id;
</script>

<BaseWizard
  {show}
  title="📡 CBRS Device Registration Wizard"
  {steps}
  {currentStep}
  isLoading={false}
  {error}
  {success}
  on:close={handleClose}
  on:stepChange={handleStepChange}
>
  <div slot="content">
    {#if currentStep === 0}
      <div class="wizard-panel">
        <h3>Register a CBSD Device</h3>
        <p>This wizard will guide you through adding a Citizens Broadband Radio Service (CBRS) device to your inventory and optionally registering it with the SAS (Spectrum Access System).</p>
        <div class="info-box">
          <h4>You will provide:</h4>
          <ul>
            <li>CBSD serial number and FCC ID</li>
            <li>Device category (A = Indoor, B = Outdoor)</li>
            <li>Installation location (latitude, longitude, height, antenna gain)</li>
          </ul>
        </div>
        <p class="hint">Make sure you have a tenant selected. SAS provider is Google SAS (shared platform).</p>
      </div>
    {:else if currentStep === 1}
      <div class="wizard-panel">
        <h3>Device Information</h3>
        <div class="form-group">
          <label for="cbsd-serial">CBSD Serial Number <span class="required">*</span></label>
          <input
            id="cbsd-serial"
            type="text"
            bind:value={cbsdSerialNumber}
            placeholder="e.g., SN123456789"
          />
        </div>
        <div class="form-group">
          <label for="fcc-id">FCC ID <span class="required">*</span></label>
          <input
            id="fcc-id"
            type="text"
            bind:value={fccId}
            placeholder="e.g., ABC-123-XYZ"
          />
        </div>
        <div class="form-group">
          <label for="category">Category</label>
          <select id="category" bind:value={cbsdCategory}>
            <option value="A">Category A (Indoor, &lt; 1 W)</option>
            <option value="B">Category B (Outdoor, &gt; 1 W)</option>
          </select>
        </div>
        <div class="form-group">
          <label>SAS Provider</label>
          <div class="readonly-badge">🔵 Google SAS</div>
        </div>
      </div>
    {:else if currentStep === 2}
      <div class="wizard-panel">
        <h3>Installation Location</h3>
        <p>Enter the installation coordinates and antenna parameters.</p>
        <div class="form-row">
          <div class="form-group">
            <label for="lat">Latitude</label>
            <input id="lat" type="number" step="0.000001" bind:value={latitude} />
          </div>
          <div class="form-group">
            <label for="lon">Longitude</label>
            <input id="lon" type="number" step="0.000001" bind:value={longitude} />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="height">Height (m, AGL)</label>
            <input id="height" type="number" step="0.1" bind:value={height} />
          </div>
          <div class="form-group">
            <label for="gain">Antenna Gain (dBi)</label>
            <input id="gain" type="number" step="0.1" bind:value={antennaGain} />
          </div>
        </div>
      </div>
    {:else if currentStep === 3}
      <div class="wizard-panel">
        <h3>Review</h3>
        <div class="summary">
          <div class="summary-row"><span class="label">Serial:</span><span class="value">{cbsdSerialNumber || '—'}</span></div>
          <div class="summary-row"><span class="label">FCC ID:</span><span class="value">{fccId || '—'}</span></div>
          <div class="summary-row"><span class="label">Category:</span><span class="value">{cbsdCategory}</span></div>
          <div class="summary-row"><span class="label">Location:</span><span class="value">{latitude.toFixed(6)}, {longitude.toFixed(6)}</span></div>
          <div class="summary-row"><span class="label">Height:</span><span class="value">{height} m</span></div>
          <div class="summary-row"><span class="label">Antenna gain:</span><span class="value">{antennaGain} dBi</span></div>
        </div>
      </div>
    {:else if currentStep === 4}
      <div class="wizard-panel">
        <h3>🎉 Done</h3>
        <p>The device has been added to your list. You can register it with the SAS from the device list when ready.</p>
        <a href="/modules/cbrs-management" class="next-step-item">Back to CBRS Management →</a>
      </div>
    {/if}
  </div>

  <div slot="footer" let:currentStep let:nextStep let:prevStep let:handleClose let:isLoading>
    {#if currentStep > 0 && currentStep < steps.length - 1}
      <button class="wizard-btn-secondary" on:click={prevStep}>← Previous</button>
    {:else if currentStep === 0}
      <button class="wizard-btn-secondary" on:click={handleClose}>Cancel</button>
    {/if}
    <div class="footer-actions">
      {#if currentStep === 3}
        <button class="wizard-btn-primary" on:click={submitDevice}>Add Device</button>
      {:else if currentStep === 4}
        <button class="wizard-btn-primary" on:click={handleClose}>Done</button>
      {:else if currentStep < steps.length - 1}
        <button class="wizard-btn-primary" on:click={nextStep}>Next →</button>
      {/if}
    </div>
  </div>
</BaseWizard>

<style>
  .wizard-panel h3 { margin: 0 0 var(--spacing-md) 0; font-size: var(--font-size-2xl); color: var(--text-primary); }
  .wizard-panel p { margin: var(--spacing-sm) 0; color: var(--text-secondary); }
  .hint { font-size: var(--font-size-sm); color: var(--text-secondary); }
  .info-box { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--spacing-md); margin: var(--spacing-md) 0; }
  .info-box ul { margin: var(--spacing-sm) 0 0 0; padding-left: 1.25rem; }
  .form-group { margin: var(--spacing-md) 0; }
  .form-group label { display: block; margin-bottom: var(--spacing-sm); font-weight: 500; color: var(--text-primary); }
  .form-group input, .form-group select { width: 100%; padding: var(--spacing-sm) var(--spacing-md); border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--input-bg); color: var(--text-primary); }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); }
  .required { color: var(--danger-color, #dc2626); }
  .readonly-badge { padding: var(--spacing-sm) var(--spacing-md); background: var(--bg-tertiary); border-radius: var(--radius-md); font-size: var(--font-size-sm); color: var(--text-secondary); }
  .summary { margin: var(--spacing-md) 0; }
  .summary-row { display: flex; justify-content: space-between; padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color); }
  .summary-row .label { font-weight: 500; color: var(--text-secondary); }
  .summary-row .value { color: var(--text-primary); }
  .next-step-item { display: inline-block; margin-top: var(--spacing-md); padding: var(--spacing-sm) var(--spacing-md); background: var(--primary-color); color: var(--text-inverse); border-radius: var(--radius-md); text-decoration: none; }
  .footer-actions { display: flex; gap: var(--spacing-sm); }
</style>
