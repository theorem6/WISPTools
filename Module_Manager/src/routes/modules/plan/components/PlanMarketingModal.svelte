<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { coverageMapService } from '../../coverage-map/lib/coverageMapService.mongodb';
  import { planService, type PlanMarketingAddress, type PlanProject } from '$lib/services/planService';
  import { currentTenant } from '$lib/stores/tenantStore';

  const dispatch = createEventDispatcher();

  export let plan: PlanProject;

  let isLoading = false;
  let error: string | null = null;
  let info: string | null = null;

  const tenantId = $currentTenant?.id;

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
  let summary: {
    totalCandidates: number;
    geocodedCount: number;
    radiusMiles: number;
    boundingBox: { west: number; south: number; east: number; north: number };
    center?: { lat: number; lon: number };
  } | null = plan.marketing
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

  function closeModal() {
    dispatch('close');
  }

  function normalizeNumber(value: string | number | undefined): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (!value) return null;
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

  async function resolveCoordinates(): Promise<{ lat: number; lon: number } | null> {
    let lat = normalizeNumber(latitudeInput);
    let lon = normalizeNumber(longitudeInput);

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
        center: resolved
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
</script>

<div
  class="modal-overlay"
  role="presentation"
  aria-hidden="true"
  tabindex="-1"
  on:click={() => {
    closeModal();
  }}
>
  <div
    class="modal-content marketing-modal"
    role="dialog"
    aria-modal="true"
    aria-label={`Marketing discovery for ${plan.name}`}
    tabindex="0"
    on:click|stopPropagation
  >
    <div class="modal-header">
      <h2>📣 Marketing Discovery - {plan.name}</h2>
      <button class="close-btn" type="button" on:click={closeModal} aria-label="Close marketing modal">✕</button>
    </div>

    <div class="modal-body">
      <div class="inputs">
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

      <div class="actions-row">
        <button class="btn-primary" type="button" on:click={discoverAddresses} disabled={isLoading}>
          {isLoading ? 'Discovering…' : 'Discover Addresses'}
        </button>
        <div class="spacer"></div>
        <button class="btn-secondary" type="button" on:click={downloadCsv} disabled={!results.length}>
          ⬇️ Download CSV
        </button>
      </div>

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
                {summary.center.lat.toFixed(4)}, {summary.center.lon.toFixed(4)}
              </span>
            </div>
          {/if}
        </div>
      {/if}

      <div class="results">
        {#if results.length === 0}
          <p class="placeholder">No marketing addresses discovered yet. Run a search to populate this list.</p>
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
                  <td>{result.latitude !== undefined ? result.latitude.toFixed(5) : '—'}</td>
                  <td>{result.longitude !== undefined ? result.longitude.toFixed(5) : '—'}</td>
                  <td>{result.source || '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" type="button" on:click={closeModal} disabled={isLoading}>Close</button>
      <button class="btn-primary" type="button" on:click={discoverAddresses} disabled={isLoading}>
        {isLoading ? 'Discovering…' : 'Discover Addresses'}
      </button>
    </div>
  </div>
</div>

<style>
  .marketing-modal {
    width: min(960px, 100%);
  }

  .modal-body {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .inputs {
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

  .actions-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .actions-row .spacer {
    flex: 1;
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
    background: rgba(148, 163, 184, 0.1);
  }

  .placeholder {
    color: var(--text-secondary);
  }
</style>

