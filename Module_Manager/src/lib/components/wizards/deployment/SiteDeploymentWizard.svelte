<script lang="ts">
  /**
   * Site Deployment Wizard
   * Guides users through creating a new tower/site (location, details, contacts).
   */
  import { createEventDispatcher } from 'svelte';
  import BaseWizard from '../BaseWizard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';

  export let show = false;
  const dispatch = createEventDispatcher<{ close: void }>();
  export let initialLatitude: number | null = null;
  export let initialLongitude: number | null = null;

  let currentStep = 0;
  let isLoading = false;
  let error = '';
  let success = '';

  const steps = [
    { id: 'welcome', title: 'Welcome', icon: '📍' },
    { id: 'location', title: 'Location', icon: '🗺️' },
    { id: 'details', title: 'Site Details', icon: '📋' },
    { id: 'contacts', title: 'Contacts', icon: '📞' },
    { id: 'complete', title: 'Complete', icon: '🎉' }
  ];

  let searchAddress = '';
  let isSearching = false;
  let siteName = '';
  let siteType: 'tower' | 'noc' | 'warehouse' | 'rooftop' | 'monopole' | 'other' = 'tower';
  let latitude = initialLatitude ?? 0;
  let longitude = initialLongitude ?? 0;
  let address = '';
  let city = '';
  let state = '';
  let zipCode = '';
  let height = 100;
  let fccId = '';
  let towerOwner = '';
  let towerContactName = '';
  let towerContactPhone = '';
  let towerContactEmail = '';
  let siteContactName = '';
  let siteContactPhone = '';
  let siteContactEmail = '';
  let gateCode = '';
  let accessInstructions = '';
  let safetyNotes = '';
  let createdSiteId: string | null = null;

  $: if (initialLatitude != null) latitude = initialLatitude;
  $: if (initialLongitude != null) longitude = initialLongitude;

  async function geocodeAddress() {
    if (!searchAddress.trim()) {
      error = 'Enter an address to search';
      return;
    }
    isSearching = true;
    error = '';
    try {
      const { coverageMapService } = await import('../../../../routes/modules/coverage-map/lib/coverageMapService.mongodb');
      const result = await coverageMapService.geocodeAddress(searchAddress);
      if (result) {
        latitude = result.latitude;
        longitude = result.longitude;
        address = searchAddress;
      } else {
        error = 'Address not found. Try a different search.';
      }
    } catch (err: any) {
      error = err.message || 'Geocoding failed';
    } finally {
      isSearching = false;
    }
  }

  function handleClose() {
    show = false;
    resetWizard();
    dispatch('close');
  }

  function resetWizard() {
    currentStep = 0;
    searchAddress = '';
    siteName = '';
    siteType = 'tower';
    latitude = initialLatitude ?? 0;
    longitude = initialLongitude ?? 0;
    address = '';
    city = '';
    state = '';
    zipCode = '';
    height = 100;
    fccId = '';
    towerOwner = '';
    towerContactName = '';
    towerContactPhone = '';
    towerContactEmail = '';
    siteContactName = '';
    siteContactPhone = '';
    siteContactEmail = '';
    gateCode = '';
    accessInstructions = '';
    safetyNotes = '';
    createdSiteId = null;
    error = '';
    success = '';
  }

  function handleStepChange(event: CustomEvent<number>) {
    currentStep = event.detail;
  }

  function nextStep() {
    if (currentStep === 1 && !latitude && !longitude) {
      error = 'Set location (search address or enter coordinates)';
      return;
    }
    if (currentStep === 2) {
      if (!siteName.trim()) {
        error = 'Site name is required';
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

  async function createSite() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) {
      error = 'No tenant selected';
      return;
    }
    isLoading = true;
    error = '';
    try {
      const { coverageMapService } = await import('../../../../routes/modules/coverage-map/lib/coverageMapService.mongodb');
      const siteData: any = {
        name: siteName.trim(),
        type: [siteType],
        location: { latitude, longitude },
        height,
        status: 'active'
      };
      if (address?.trim()) siteData.location.address = address.trim();
      if (city?.trim()) siteData.location.city = city.trim();
      if (state?.trim()) siteData.location.state = state.trim();
      if (zipCode?.trim()) siteData.location.zipCode = zipCode.trim();
      if (fccId?.trim()) siteData.fccId = fccId.trim();
      if (towerOwner?.trim()) siteData.towerOwner = towerOwner.trim();
      if (gateCode?.trim()) siteData.gateCode = gateCode.trim();
      if (accessInstructions?.trim()) siteData.accessInstructions = accessInstructions.trim();
      if (safetyNotes?.trim()) siteData.safetyNotes = safetyNotes.trim();
      if (towerContactName?.trim()) {
        siteData.towerContact = {
          name: towerContactName.trim(),
          phone: towerContactPhone?.trim() || '',
          email: towerContactEmail?.trim() || ''
        };
      }
      if (siteContactName?.trim()) {
        siteData.siteContact = {
          name: siteContactName.trim(),
          phone: siteContactPhone?.trim() || '',
          email: siteContactEmail?.trim() || ''
        };
      }
      const site = await coverageMapService.createTowerSite(tenantId, siteData);
      createdSiteId = (site as any).id ?? (site as any)._id ?? null;
      success = 'Site created successfully!';
      currentStep = steps.length - 1;
    } catch (err: any) {
      error = err.message || 'Failed to create site';
    } finally {
      isLoading = false;
    }
  }
</script>

<BaseWizard
  {show}
  title="📍 Site Deployment Wizard"
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
        <h3>Add a New Site</h3>
        <p>This wizard guides you through creating a new tower, NOC, warehouse, or other site.</p>
        <div class="info-box">
          <h4>You will:</h4>
          <ul>
            <li>Set location (address search or coordinates)</li>
            <li>Enter site name and type</li>
            <li>Optionally add contact and access details</li>
          </ul>
        </div>
      </div>
    {:else if currentStep === 1}
      <div class="wizard-panel">
        <h3>Location</h3>
        <div class="form-group">
          <label>Search address</label>
          <div class="input-row">
            <input type="text" bind:value={searchAddress} placeholder="Street, city, state" disabled={isLoading} />
            <button type="button" class="btn-small" on:click={geocodeAddress} disabled={isSearching || !searchAddress.trim()}>
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
        <div class="or-divider">or enter coordinates</div>
        <div class="form-row">
          <div class="form-group">
            <label>Latitude</label>
            <input type="number" step="0.000001" bind:value={latitude} disabled={isLoading} />
          </div>
          <div class="form-group">
            <label>Longitude</label>
            <input type="number" step="0.000001" bind:value={longitude} disabled={isLoading} />
          </div>
        </div>
        {#if latitude || longitude}
          <div class="info-box success">
            <p>Location: {latitude.toFixed(6)}, {longitude.toFixed(6)}</p>
          </div>
        {/if}
      </div>
    {:else if currentStep === 2}
      <div class="wizard-panel">
        <h3>Site Details</h3>
        <div class="form-group">
          <label>Site name <span class="required">*</span></label>
          <input type="text" bind:value={siteName} placeholder="e.g. Tower 1, Main NOC" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Site type</label>
          <select bind:value={siteType} disabled={isLoading}>
            <option value="tower">Tower</option>
            <option value="noc">NOC</option>
            <option value="warehouse">Warehouse</option>
            <option value="rooftop">Rooftop</option>
            <option value="monopole">Monopole</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label>Height (ft)</label>
          <input type="number" bind:value={height} min="0" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Address</label>
          <input type="text" bind:value={address} placeholder="Street address" disabled={isLoading} />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>City</label>
            <input type="text" bind:value={city} disabled={isLoading} />
          </div>
          <div class="form-group">
            <label>State</label>
            <input type="text" bind:value={state} disabled={isLoading} />
          </div>
          <div class="form-group">
            <label>ZIP</label>
            <input type="text" bind:value={zipCode} disabled={isLoading} />
          </div>
        </div>
        <div class="form-group">
          <label>FCC ID (optional)</label>
          <input type="text" bind:value={fccId} placeholder="FCC registration" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Tower owner (optional)</label>
          <input type="text" bind:value={towerOwner} disabled={isLoading} />
        </div>
      </div>
    {:else if currentStep === 3}
      <div class="wizard-panel">
        <h3>Contacts & Access</h3>
        <p class="hint">Optional. You can skip or fill later.</p>
        <div class="form-group">
          <label>Tower contact</label>
          <input type="text" bind:value={towerContactName} placeholder="Name" disabled={isLoading} />
          <input type="text" bind:value={towerContactPhone} placeholder="Phone" disabled={isLoading} />
          <input type="email" bind:value={towerContactEmail} placeholder="Email" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Site contact</label>
          <input type="text" bind:value={siteContactName} placeholder="Name" disabled={isLoading} />
          <input type="text" bind:value={siteContactPhone} placeholder="Phone" disabled={isLoading} />
          <input type="email" bind:value={siteContactEmail} placeholder="Email" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Gate code</label>
          <input type="text" bind:value={gateCode} disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Access instructions</label>
          <textarea bind:value={accessInstructions} rows="2" disabled={isLoading}></textarea>
        </div>
        <div class="form-group">
          <label>Safety notes</label>
          <textarea bind:value={safetyNotes} rows="2" disabled={isLoading}></textarea>
        </div>
      </div>
    {:else if currentStep === 4}
      <div class="wizard-panel">
        {#if success}
          <h3>🎉 Site created</h3>
          <p>{success}</p>
          <div class="info-box success">
            <p><strong>{siteName}</strong> · {siteType}</p>
            <p>{latitude.toFixed(6)}, {longitude.toFixed(6)}</p>
          </div>
          <a href="/modules/deploy" class="next-step-item">View in Deploy module →</a>
        {:else}
          <h3>Review & create</h3>
          <div class="summary-row"><span class="label">Name</span><span class="value">{siteName}</span></div>
          <div class="summary-row"><span class="label">Type</span><span class="value">{siteType}</span></div>
          <div class="summary-row"><span class="label">Location</span><span class="value">{latitude.toFixed(6)}, {longitude.toFixed(6)}</span></div>
          {#if address}<div class="summary-row"><span class="label">Address</span><span class="value">{address}</span></div>{/if}
          <button type="button" class="wizard-btn-primary" on:click={createSite} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create site'}
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
  .wizard-panel p { color: var(--text-secondary); margin: var(--spacing-sm) 0; }
  .hint { font-size: var(--font-size-sm); color: var(--text-secondary); }
  .info-box { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--spacing-md); margin: var(--spacing-md) 0; color: var(--text-primary); }
  .info-box.success { background: var(--success-light); border-color: var(--success-color); }
  .info-box ul { margin: var(--spacing-sm) 0 0 0; padding-left: 1.25rem; }
  .form-group { margin: var(--spacing-md) 0; }
  .form-group label { display: block; margin-bottom: var(--spacing-sm); font-weight: var(--font-weight-medium); color: var(--text-primary); }
  .form-group input, .form-group textarea, .form-group select { width: 100%; padding: var(--spacing-sm) var(--spacing-md); border: 1px solid var(--border-color); border-radius: var(--radius-md); font-size: var(--font-size-sm); background: var(--input-bg); color: var(--text-primary); }
  .form-group input + input, .form-group input + .form-group input { margin-top: var(--spacing-sm); }
  .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--spacing-md); }
  .input-row { display: flex; gap: var(--spacing-sm); }
  .input-row input { flex: 1; }
  .or-divider { text-align: center; margin: var(--spacing-md) 0; font-weight: var(--font-weight-medium); color: var(--text-secondary); }
  .required { color: var(--danger-color); }
  .btn-small { padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-md); border: none; font-size: var(--font-size-sm); cursor: pointer; background: var(--primary-color); color: var(--text-inverse); }
  .btn-small:disabled { opacity: 0.5; cursor: not-allowed; }
  .summary-row { display: flex; justify-content: space-between; padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
  .summary-row .label { color: var(--text-secondary); }
  .next-step-item { display: inline-block; margin-top: var(--spacing-md); padding: var(--spacing-sm) var(--spacing-md); background: var(--primary-color); color: var(--text-inverse); border-radius: var(--radius-md); text-decoration: none; }
  .footer-actions { display: flex; gap: var(--spacing-sm); }
</style>
