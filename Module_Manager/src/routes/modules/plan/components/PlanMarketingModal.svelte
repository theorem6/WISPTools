<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { coverageMapService } from '../../coverage-map/lib/coverageMapService.mongodb';
  import { planService, type PlanMarketingAddress, type PlanProject } from '$lib/services/planService';
  import { currentTenant } from '$lib/stores/tenantStore';

  const dispatch = createEventDispatcher();

  export let plan: PlanProject;

  type Summary = {
    totalCandidates: number;
    geocodedCount: number;
    radiusMiles: number;
    boundingBox: { west: number; south: number; east: number; north: number };
    center?: { lat: number; lon: number };
  } | null;

  const steps = ['Define Service Area', 'Advanced Options', 'Review & Run'];

  let isLoading = false;
  let error: string | null = null;
  let info: string | null = null;
  let currentStep = 0;

  let tenantId: string | undefined;
  $: tenantId = $currentTenant?.id;

  let addressSearch =
    plan.location?.addressLine1 && plan.location?.city && plan.location?.state
      ? `${plan.location.addressLine1}, ${plan.location.city}, ${plan.location.state}`
      : plan.location?.addressLine1 ?? '';
  let latitudeInput =
    plan.marketing?.lastCenter?.lat?.toString() ??
    plan.location?.latitude?.toString() ??
    '';
  let longitudeInput =
    plan.marketing?.lastCenter?.lon?.toString() ??
    plan.location?.longitude?.toString() ??
    '';
  let radiusMiles = plan.marketing?.targetRadiusMiles ?? 5;

  let results: PlanMarketingAddress[] = plan.marketing?.addresses ?? [];
  let summary: Summary = plan.marketing
    ? {
        totalCandidates: plan.marketing.addresses?.length ?? 0,
        geocodedCount: plan.marketing.addresses?.length ?? 0,
        radiusMiles: plan.marketing.targetRadiusMiles ?? radiusMiles,
        boundingBox: plan.marketing.lastBoundingBox ?? {
          west: plan.location?.longitude ?? 0,
          east: plan.location?.longitude ?? 0,
          south: plan.location?.latitude ?? 0,
          north: plan.location?.latitude ?? 0
        },
        center: plan.marketing.lastCenter
      }
    : null;

  let advancedOptions = {
    forceReverse: false,
    reverse: {
      batchSize: 20,
      perRequestTimeoutMs: 7000,
      overallTimeoutMs: 30000
    },
    grouping: {
      useOsmId: true,
      highPrecision: false
    },
    dedup: {
      mergeHalfAddresses: true,
      halfPenalty: 3,
      clientDedupDistanceMeters: 10
    }
  };

  onMount(() => {
    console.log('[PlanMarketingModal] Wizard opened', { planId: plan?.id, planName: plan?.name });
    currentStep = results.length ? 2 : 0;
  });

  function closeModal() {
    dispatch('close');
  }

  function normalizeNumber(value: string | number | undefined): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (!value?.toString().trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function computeBoundingBox(lat: number, lon: number, radius: number) {
    const latRange = radius / 69.0;
    const lonRange = radius / (Math.cos((lat * Math.PI) / 180) * 69.172);
    return {
      west: lon - lonRange,
      east: lon + lonRange,
      south: lat - latRange,
      north: lat + latRange
    };
  }

  function goToStep(target: number) {
    if (target < 0 || target >= steps.length) return;
    if (target > currentStep && !canAdvance) return;
    if (isLoading) return;
    currentStep = target;
  }

  function nextStep() {
    console.log('[PlanMarketingModal] Next step requested', { currentStep, canAdvance });
    if (currentStep < steps.length - 1 && canAdvance) {
      currentStep += 1;
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      currentStep -= 1;
    }
  }

  function usePlanLocation() {
    if (!plan.location) return;
    const parts = [
      plan.location.addressLine1,
      plan.location.city,
      plan.location.state
    ].filter(Boolean);
    if (parts.length) {
      addressSearch = parts.join(', ');
    }
    latitudeInput = plan.location.latitude?.toString() ?? latitudeInput;
    longitudeInput = plan.location.longitude?.toString() ?? longitudeInput;
    console.log('[PlanMarketingModal] Using plan location', {
      latitudeInput,
      longitudeInput
    });
  }

  function clearCoordinates() {
    latitudeInput = '';
    longitudeInput = '';
  }

  async function geocodeFromAddress() {
    if (!addressSearch) return;
    try {
      isLoading = true;
      error = null;
      info = 'Resolving address…';
      const result = await coverageMapService.geocodeAddress(addressSearch);
      if (result && typeof result.latitude === 'number' && typeof result.longitude === 'number') {
        latitudeInput = result.latitude.toFixed(6);
        longitudeInput = result.longitude.toFixed(6);
        info = `Resolved coordinates to ${latitudeInput}, ${longitudeInput}`;
        console.log('[PlanMarketingModal] Geocode success', { latitudeInput, longitudeInput });
      } else {
        throw new Error('Could not resolve the provided address.');
      }
    } catch (geoErr: any) {
      console.warn('Marketing modal geocode failed:', geoErr);
      error = geoErr?.message || 'Failed to resolve address.';
      info = null;
    } finally {
      isLoading = false;
    }
  }

  async function resolveCoordinates(): Promise<{ lat: number; lon: number } | null> {
    const lat = normalizeNumber(latitudeInput);
    const lon = normalizeNumber(longitudeInput);

    if (lat !== null && lon !== null) {
      return { lat, lon };
    }

    if (!addressSearch || !tenantId) {
      return null;
    }

    try {
      const result = await coverageMapService.geocodeAddress(addressSearch);
      if (result && typeof result.latitude === 'number' && typeof result.longitude === 'number') {
        latitudeInput = result.latitude.toFixed(6);
        longitudeInput = result.longitude.toFixed(6);
        return { lat: result.latitude, lon: result.longitude };
      }
    } catch (geoErr) {
      console.warn('Marketing modal geocode failed:', geoErr);
    }

    return null;
  }

  async function fetchUpdatedPlan() {
    try {
      const refreshed = await planService.getPlan(plan.id);
      if (refreshed) {
        plan = refreshed;
        dispatch('updated', refreshed);
      }
    } catch (err) {
      console.warn('Failed to refresh plan after marketing discovery:', err);
    }
  }

  async function discoverAddresses() {
    console.log('[PlanMarketingModal] Discover addresses clicked', {
      planId: plan?.id,
      radiusMiles,
      advancedOptions
    });

    error = null;
    info = null;

    if (!tenantId) {
      error = 'Select a tenant before running marketing discovery.';
      return;
    }

    if (!radiusMiles || radiusMiles <= 0) {
      error = 'Enter a valid radius in miles.';
      return;
    }

    isLoading = true;
    info = 'Discovering candidate addresses...';

    try {
      const resolved = await resolveCoordinates();
      if (!resolved) {
        throw new Error('Provide latitude & longitude or a searchable address.');
      }

      const boundingBox = computeBoundingBox(resolved.lat, resolved.lon, radiusMiles);

      const response = await planService.discoverMarketingAddresses(plan.id, {
        boundingBox,
        radiusMiles,
        center: resolved,
        options: {
          advancedOptions
        }
      });

      results = response.addresses;
      summary = response.summary;
      info = `Mapped ${results.length} address candidates.`;

      await fetchUpdatedPlan();
    } catch (err: any) {
      console.error('Marketing discovery failed:', err);
      error = err?.message || 'Failed to discover addresses.';
      info = null;
    } finally {
      isLoading = false;
    }
  }

  function downloadCsv() {
    if (!results.length) return;
    const headers = ['Address', 'City', 'State', 'PostalCode', 'Country', 'Latitude', 'Longitude', 'Source'];
    const rows = results.map(entry => [
      entry.addressLine1 ?? '',
      entry.city ?? '',
      entry.state ?? '',
      entry.postalCode ?? '',
      entry.country ?? '',
      entry.latitude ?? '',
      entry.longitude ?? '',
      entry.source ?? ''
    ]);
    const csv = [headers, ...rows]
      .map(columns =>
        columns
          .map(value => `"${String(value).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${plan.name.replace(/\s+/g, '_')}-marketing-addresses.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  $: coordinatesReady =
    normalizeNumber(latitudeInput) !== null && normalizeNumber(longitudeInput) !== null;
  $: canAdvance =
    currentStep === 0
      ? Boolean(radiusMiles && radiusMiles > 0)
      : true;
  $: canRun = currentStep === steps.length - 1 && radiusMiles > 0 && coordinatesReady;

  function formatCoord(value: number | string | undefined, fractionDigits = 5): string {
    if (value === undefined || value === null) return '—';
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(fractionDigits) : '—';
  }
</script>

<div class="marketing-backdrop" role="presentation" aria-hidden="false">
  <section
    class="marketing-panel"
    role="dialog"
    aria-modal="false"
    aria-label={`Marketing discovery for ${plan.name}`}
    tabindex="0"
  >
    <div class="modal-header">
      <h2>📣 Find Addresses - {plan.name}</h2>
      <div class="header-actions">
        <button class="btn-tertiary mini" type="button" on:click={usePlanLocation} disabled={isLoading}>
          Use plan location
        </button>
        <button class="close-btn" type="button" on:click={closeModal} aria-label="Close marketing wizard">
          ✕
        </button>
      </div>
    </div>

    <div class="modal-body">
      <nav class="wizard-steps" aria-label="Marketing discovery steps">
        {#each steps as step, index}
          <button
            type="button"
            class="wizard-step"
            class:active={index === currentStep}
            class:complete={index < currentStep}
            on:click={() => goToStep(index)}
            disabled={index > currentStep || isLoading}
            aria-current={index === currentStep ? 'step' : undefined}
          >
            <span class="step-index">{index + 1}</span>
            <span class="step-label">{step}</span>
          </button>
        {/each}
      </nav>

      {#if currentStep === 0}
        <section class="wizard-panel">
          <header>
            <h3>Define Service Area</h3>
            <p>Start by centering the search area and choosing a marketing radius around the location.</p>
          </header>
          <div class="form-grid">
            <div class="form-group">
              <label for="marketing-address">Search Address (optional)</label>
              <input
                id="marketing-address"
                type="text"
                bind:value={addressSearch}
                placeholder="Use address to resolve coordinates"
                disabled={isLoading}
              />
            </div>
            <div class="coordinate-row">
              <div class="form-group">
                <label for="marketing-latitude">Latitude</label>
                <input
                  id="marketing-latitude"
                  type="text"
                  bind:value={latitudeInput}
                  placeholder="e.g., 34.12345"
                  disabled={isLoading}
                />
              </div>
              <div class="form-group">
                <label for="marketing-longitude">Longitude</label>
                <input
                  id="marketing-longitude"
                  type="text"
                  bind:value={longitudeInput}
                  placeholder="-118.12345"
                  disabled={isLoading}
                />
              </div>
              <div class="form-group radius-field">
                <label for="marketing-radius">Radius (miles)</label>
                <input
                  id="marketing-radius"
                  type="number"
                  min="0.5"
                  step="0.5"
                  bind:value={radiusMiles}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
          <div class="support-actions">
            <button type="button" class="btn-tertiary" on:click={clearCoordinates} disabled={isLoading}>
              Clear coordinates
            </button>
            <button
              type="button"
              class="btn-secondary"
              on:click={geocodeFromAddress}
              disabled={isLoading || !addressSearch}
            >
              Resolve coordinates from address
            </button>
          </div>
        </section>
      {/if}

      {#if currentStep === 1}
        <section class="wizard-panel">
          <header>
            <h3>Advanced Options</h3>
            <p>Tune geocoding, grouping, and deduplication behaviour. These settings mirror the FTTH wizard.</p>
          </header>
          <div class="options-grid">
            <fieldset>
              <legend>Reverse Geocoding</legend>
              <label>
                <span>Force server reverse geocoding</span>
                <input type="checkbox" bind:checked={advancedOptions.forceReverse} />
              </label>
              <label>
                <span>Server batch size</span>
                <input
                  type="number"
                  min="5"
                  max="50"
                  step="5"
                  bind:value={advancedOptions.reverse.batchSize}
                />
              </label>
              <label>
                <span>Per-request timeout (ms)</span>
                <input
                  type="number"
                  min="2000"
                  max="15000"
                  step="500"
                  bind:value={advancedOptions.reverse.perRequestTimeoutMs}
                />
              </label>
              <label>
                <span>Overall timeout (ms)</span>
                <input
                  type="number"
                  min="10000"
                  max="60000"
                  step="1000"
                  bind:value={advancedOptions.reverse.overallTimeoutMs}
                />
              </label>
            </fieldset>
            <fieldset>
              <legend>Grouping</legend>
              <label>
                <input type="checkbox" bind:checked={advancedOptions.grouping.useOsmId} />
                <span>Prefer OSM ids for grouping</span>
              </label>
              <label>
                <input type="checkbox" bind:checked={advancedOptions.grouping.highPrecision} />
                <span>High-precision coordinate grouping</span>
              </label>
            </fieldset>
            <fieldset>
              <legend>Deduplication</legend>
              <label>
                <span>Client dedup distance (m)</span>
                <input
                  type="number"
                  min="0"
                  max="30"
                  step="1"
                  bind:value={advancedOptions.dedup.clientDedupDistanceMeters}
                />
              </label>
              <label>
                <input type="checkbox" bind:checked={advancedOptions.dedup.mergeHalfAddresses} />
                <span>Merge half-addresses (e.g. "½")</span>
              </label>
              <label>
                <span>Half-address penalty</span>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="1"
                  bind:value={advancedOptions.dedup.halfPenalty}
                />
              </label>
            </fieldset>
          </div>
        </section>
      {/if}

      {#if currentStep === 2}
        <section class="wizard-panel">
          <header>
            <h3>Review & Run</h3>
            <p>Confirm the run parameters, then launch discovery. Results will populate below the wizard.</p>
          </header>
          <div class="review-grid">
            <div>
              <span class="label">Center Coordinates</span>
              <span class="value">
                {#if coordinatesReady}
                  {formatCoord(latitudeInput)}, {formatCoord(longitudeInput)}
                {:else}
                  —
                {/if}
              </span>
            </div>
            <div>
              <span class="label">Radius</span>
              <span class="value">{radiusMiles} mi</span>
            </div>
            <div>
              <span class="label">Server batch size</span>
              <span class="value">{advancedOptions.reverse.batchSize}</span>
            </div>
            <div>
              <span class="label">Dedup distance</span>
              <span class="value">{advancedOptions.dedup.clientDedupDistanceMeters} m</span>
            </div>
          </div>

          {#if error}
            <div class="alert alert-error">
              <strong>Error:</strong> {error}
            </div>
          {/if}

          {#if info}
            <div class="alert alert-info">
              {info}
            </div>
          {/if}

          {#if !coordinatesReady}
            <div class="alert alert-warning">
              Provide latitude and longitude or resolve them from an address before running discovery.
            </div>
          {/if}

          {#if summary}
            <div class="summary-grid">
              <div class="summary-card">
                <span class="label">Total Candidates</span>
                <span class="value">{summary.totalCandidates}</span>
              </div>
              <div class="summary-card">
                <span class="label">Geocoded</span>
                <span class="value">{summary.geocodedCount}</span>
              </div>
              <div class="summary-card">
                <span class="label">Radius</span>
                <span class="value">{summary.radiusMiles} mi</span>
              </div>
              {#if summary.center}
                <div class="summary-card">
                  <span class="label">Center</span>
                  <span class="value">
                    {formatCoord(summary.center.lat, 4)}, {formatCoord(summary.center.lon, 4)}
                  </span>
                </div>
              {/if}
            </div>
          {/if}

          <div class="results">
            {#if results.length === 0}
              <p class="placeholder">
                No marketing addresses discovered yet. Run a search to populate this list.
              </p>
            {:else}
              <table>
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>City</th>
                    <th>State</th>
                    <th>Postal</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {#each results as result, index (result.latitude ?? index)}
                    <tr>
                      <td>{result.addressLine1 || '—'}</td>
                      <td>{result.city || '—'}</td>
                      <td>{result.state || '—'}</td>
                      <td>{result.postalCode || '—'}</td>
                      <td>{formatCoord(result.latitude)}</td>
                      <td>{formatCoord(result.longitude)}</td>
                      <td>{result.source || '—'}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          </div>
        </section>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" type="button" on:click={closeModal} disabled={isLoading}>
        Cancel
      </button>

      {#if currentStep > 0}
        <button class="btn-tertiary" type="button" on:click={prevStep} disabled={isLoading}>
          Back
        </button>
      {/if}

      {#if currentStep < steps.length - 1}
        <button class="btn-primary" type="button" on:click={nextStep} disabled={!canAdvance || isLoading}>
          Next
        </button>
      {:else}
        <div class="run-actions">
          <button class="btn-primary" type="button" on:click={discoverAddresses} disabled={!canRun || isLoading}>
            {isLoading ? 'Discovering…' : results.length ? 'Re-run Discovery' : 'Run Discovery'}
          </button>
          <button class="btn-secondary" type="button" on:click={downloadCsv} disabled={!results.length || isLoading}>
            ⬇️ Download CSV
          </button>
        </div>
      {/if}
    </div>
  </section>
</div>

<style>
  .marketing-backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    padding: 1.5rem;
    pointer-events: none;
    z-index: 50;
  }

  .marketing-panel {
    pointer-events: auto;
    width: min(480px, 95vw);
    max-height: 90vh;
    background: var(--modal-surface-background, var(--bg-secondary));
    border: 1px solid var(--modal-surface-border, var(--border-color));
    border-radius: var(--border-radius-md);
    box-shadow: var(--modal-surface-shadow, 0 28px 60px rgba(15, 23, 42, 0.45));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    backdrop-filter: blur(8px);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
    background: linear-gradient(
      135deg,
      rgba(14, 165, 233, 0.12),
      rgba(14, 165, 233, 0)
    );
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .modal-body {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    overflow-y: auto;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    justify-content: flex-end;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .wizard-steps {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .wizard-steps button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: 9999px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    transition: all 0.2s ease;
  }

  .wizard-steps button .step-index {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 9999px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    font-weight: 600;
  }

  .wizard-steps button.active {
    border-color: var(--accent-primary);
    background: rgba(14, 165, 233, 0.12);
    color: var(--text-primary);
  }

  .wizard-steps button.active .step-index {
    background: var(--accent-primary);
    color: white;
  }

  .wizard-steps button.complete {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }

  .wizard-panel {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .wizard-panel header h3 {
    margin: 0;
    font-size: 1.1rem;
  }

  .wizard-panel header p {
    margin: 0.25rem 0 0;
    color: var(--text-secondary);
  }

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .coordinate-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .radius-field {
    max-width: 180px;
  }

  .form-group label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .form-group input {
    width: 100%;
  }

  .support-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .options-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
  }

  fieldset {
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background: rgba(148, 163, 184, 0.06);
  }

  fieldset label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  fieldset legend {
    font-weight: 600;
    padding: 0 0.25rem;
  }

  .review-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .review-grid .label {
    display: block;
    font-size: 0.75rem;
    text-transform: uppercase;
    color: var(--text-secondary);
    margin-bottom: 0.25rem;
  }

  .review-grid .value {
    font-weight: 600;
    color: var(--text-primary);
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
  }

  .summary-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .summary-card .label {
    font-size: 0.75rem;
    text-transform: uppercase;
    color: var(--text-secondary);
  }

  .summary-card .value {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .results table {
    width: 100%;
    border-collapse: collapse;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    overflow: hidden;
  }

  .results th,
  .results td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }

  .results tbody tr:nth-child(odd) {
    background: rgba(148, 163, 184, 0.08);
  }

  .placeholder {
    color: var(--text-secondary);
  }

  .run-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .btn-tertiary {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    transition: all 0.2s ease;
  }

  .btn-tertiary:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }

  .btn-tertiary.mini {
    padding: 0.35rem 0.6rem;
    font-size: 0.8rem;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 6px;
  }

  .close-btn:hover {
    background: rgba(148, 163, 184, 0.16);
  }

  .alert-warning {
    background: rgba(234, 179, 8, 0.12);
    border: 1px solid rgba(234, 179, 8, 0.35);
    color: var(--text-primary);
    border-radius: var(--border-radius-sm);
    padding: 0.75rem 1rem;
  }

  @media (max-width: 900px) {
    .marketing-backdrop {
      justify-content: center;
      padding: 1rem;
    }

    .marketing-panel {
      width: min(520px, 100%);
      max-height: 88vh;
    }
  }

  @media (max-width: 640px) {
    .modal-header,
    .modal-body,
    .modal-footer {
      padding: 1rem;
    }

    .header-actions {
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .wizard-steps {
      justify-content: center;
    }
  }
</style>

