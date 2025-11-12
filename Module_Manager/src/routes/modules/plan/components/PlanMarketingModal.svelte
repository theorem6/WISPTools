<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { coverageMapService } from '../../coverage-map/lib/coverageMapService.mongodb';
  import { planService, type PlanMarketingAddress, type PlanProject } from '$lib/services/planService';
  import { currentTenant } from '$lib/stores/tenantStore';

  const dispatch = createEventDispatcher();

  export let plan: PlanProject;

  interface MapExtentData {
    center?: { lat: number; lon: number };
    boundingBox?: { west: number; south: number; east: number; north: number };
    spans?: { latSpan: number; lonSpan: number };
    scale?: number | null;
    zoom?: number | null;
  }

  export let mapExtent: MapExtentData | null = null;

let extentAtOpen: MapExtentData | null = null;

let latestExtent: MapExtentData | null = null;
$: {
  // Always use current mapExtent when available, otherwise keep existing extentAtOpen
  if (mapExtent) {
    extentAtOpen = cloneMapExtent(mapExtent);
    latestExtent = cloneMapExtent(mapExtent);
  } else if (extentAtOpen) {
    latestExtent = extentAtOpen;
  }
}
$: extentSpanMiles = computeSpanMiles(latestExtent);

  type Summary = {
    totalCandidates: number;
    geocodedCount: number;
    radiusMiles: number;
    boundingBox: { west: number; south: number; east: number; north: number };
    center?: { lat: number; lon: number };
    algorithmsUsed?: string[];
    rawCandidateCount?: number;
    dedupedCount?: number;
    algorithmStats?: Record<string, unknown>;
  } | null;

  const steps = ['Define Service Area', 'Advanced Options', 'Review & Run'];

const ALGORITHM_OPTIONS = [
    {
      id: 'osm_buildings',
      label: 'OpenStreetMap Building Footprints',
      description: 'Pulls building centroids from OpenStreetMap and reverse-geocodes the top matches.'
    },
    {
      id: 'arcgis_address_points',
      label: 'ArcGIS Address Points',
      description: 'Uses Esri World Geocoding service to return residential and parcel address points.'
    },
    {
      id: 'arcgis_places',
      label: 'ArcGIS Places & Amenities',
      description: 'Targets nearby places of interest (schools, businesses, amenities) for marketing outreach.'
    }
  ] as const;

  const DEFAULT_ALGORITHMS = ['osm_buildings', 'arcgis_address_points'];

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

  const derivedCenterLat =
    plan.marketing?.lastCenter?.lat ??
    plan.location?.latitude ??
    latestExtent?.center?.lat;
  const derivedCenterLon =
    plan.marketing?.lastCenter?.lon ??
    plan.location?.longitude ??
    latestExtent?.center?.lon;

  let latitudeInput = formatNumericInput(derivedCenterLat, 6);
  let longitudeInput = formatNumericInput(derivedCenterLon, 6);

  const derivedRadius = deriveRadiusFromExtent(latestExtent);
  let radiusMiles = normalizeRadius(
    plan.marketing?.targetRadiusMiles,
    derivedRadius ?? 5
  );

let results: PlanMarketingAddress[] = [];
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
        center: plan.marketing.lastCenter,
        algorithmsUsed: Array.isArray(plan.marketing.algorithms) ? [...plan.marketing.algorithms] : undefined,
        algorithmStats: plan.marketing.algorithmStats ?? undefined
      }
      : latestExtent?.boundingBox
      ? {
          totalCandidates: 0,
          geocodedCount: 0,
          radiusMiles,
          boundingBox: latestExtent.boundingBox,
          center: latestExtent.center,
          algorithmsUsed: undefined,
          algorithmStats: undefined
        }
      : null;

  let selectedAlgorithms: string[] = [];
  let initializedAlgorithms = false;
  let selectedAlgorithmLabels: string[] = [];

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
    // Reset wizard state
    currentStep = 0;
    results = [];
    summary = null;
    error = null;
    info = null;
    isLoading = false;
    // Reset extent to current map extent
    if (mapExtent) {
      extentAtOpen = cloneMapExtent(mapExtent);
      latestExtent = cloneMapExtent(mapExtent);
    }
    // Reset coordinates to use current map extent or plan location
    const extent = latestExtent ?? extentAtOpen;
    if (extent?.center) {
      latitudeInput = formatNumericInput(extent.center.lat, 6);
      longitudeInput = formatNumericInput(extent.center.lon, 6);
    } else if (plan.location?.latitude && plan.location?.longitude) {
      latitudeInput = formatNumericInput(plan.location.latitude, 6);
      longitudeInput = formatNumericInput(plan.location.longitude, 6);
    }
    // Reset radius to derived value from extent
    const derivedRadius = deriveRadiusFromExtent(extent);
    if (derivedRadius !== null) {
      radiusMiles = normalizeRadius(derivedRadius, 5);
    }
    initializeAlgorithms();
  });

  function initializeAlgorithms() {
    if (initializedAlgorithms) return;
    const existing = Array.isArray(plan.marketing?.algorithms)
      ? plan.marketing.algorithms.filter((id) => ALGORITHM_OPTIONS.some(option => option.id === id))
      : [];
    selectedAlgorithms = existing.length ? existing : [...DEFAULT_ALGORITHMS];
    initializedAlgorithms = true;
  }

  function toggleAlgorithm(id: string) {
    if (selectedAlgorithms.includes(id)) {
      selectedAlgorithms = selectedAlgorithms.filter((alg) => alg !== id);
    } else {
      selectedAlgorithms = [...selectedAlgorithms, id];
    }
  }

  function algorithmLabel(id: string): string {
    const match = ALGORITHM_OPTIONS.find(option => option.id === id);
    return match ? match.label : id;
  }

  $: if (!initializedAlgorithms && plan) {
    initializeAlgorithms();
  }

  $: selectedAlgorithmLabels = selectedAlgorithms.map((id) => algorithmLabel(id));

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

  function cloneMapExtent(extent: MapExtentData | null): MapExtentData | null {
    if (!extent) return null;
    return {
      center: extent.center ? { ...extent.center } : undefined,
      boundingBox: extent.boundingBox ? { ...extent.boundingBox } : undefined,
      spans: extent.spans ? { ...extent.spans } : undefined,
      scale: extent.scale ?? null,
      zoom: extent.zoom ?? null
    };
  }

  function computeSpanMiles(extent: MapExtentData | null): { width: number; height: number } | null {
    if (!extent?.boundingBox) return null;
    const { north, south, east, west } = extent.boundingBox;
    const centerLat = extent.center?.lat ?? (north + south) / 2;
    const milesPerLat = 69.0;
    const milesPerLon = Math.cos((centerLat * Math.PI) / 180) * 69.172 || 69.172;
    const height = Math.abs(north - south) * milesPerLat;
    const width = Math.abs(east - west) * Math.abs(milesPerLon);
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      return null;
    }
    return {
      width,
      height
    };
  }

  function deriveRadiusFromExtent(extent: MapExtentData | null): number | null {
    if (!extent?.boundingBox) return null;
    const { north, south, east, west } = extent.boundingBox;
    const centerLat = extent.center?.lat ?? (north + south) / 2;
    const milesPerLat = 69.0;
    const milesPerLon = Math.cos((centerLat * Math.PI) / 180) * 69.172 || 69.172;
    const latRadius = (Math.abs(north - south) * milesPerLat) / 2;
    const lonRadius = (Math.abs(east - west) * Math.abs(milesPerLon)) / 2;
    const candidate = Math.max(latRadius, lonRadius);
    // Enforce 50 mile maximum radius
    const clamped = Math.min(candidate, 50);
    return Number.isFinite(clamped) && clamped > 0 ? clamped : null;
  }

  function normalizeRadius(value: unknown, fallback: number): number {
    const numeric = Number(value);
    const base = Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
    const clamped = Math.max(base, 0.25);
    return Number(clamped.toFixed(2));
  }

  function formatNumericInput(value: unknown, fractionDigits = 6): string {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return '';
    }
    return numeric.toFixed(fractionDigits);
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
    const latValue = formatNumericInput(plan.location.latitude, 6);
    const lonValue = formatNumericInput(plan.location.longitude, 6);
    latitudeInput = latValue || latitudeInput;
    longitudeInput = lonValue || longitudeInput;
    info = 'Using project location coordinates.';
    error = null;
    console.log('[PlanMarketingModal] Using plan location', {
      latitudeInput,
      longitudeInput
    });
  }

  function clearCoordinates() {
    latitudeInput = '';
    longitudeInput = '';
    info = null;
    error = null;
  }

  function useExtentCenter() {
    const extent = latestExtent ?? extentAtOpen;
    if (!extent?.center) return;
    latitudeInput = formatNumericInput(extent.center.lat, 6);
    longitudeInput = formatNumericInput(extent.center.lon, 6);
    info = 'Using current map view center coordinates.';
    error = null;
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
      advancedOptions,
      coordinatesReady,
      hasAddressOrCoordinates,
      addressSearch,
      latitudeInput,
      longitudeInput
    });

    error = null;
    info = null;

    if (!tenantId) {
      error = 'Select a tenant before running marketing discovery.';
      isLoading = false;
      return;
    }

    if (!hasAddressOrCoordinates) {
      error = 'Provide latitude & longitude or enter an address to resolve coordinates.';
      isLoading = false;
      return;
    }

    const extentForRun = latestExtent ?? extentAtOpen;
    // Use bounding box from map extent - enforce 50 mile max
    const derivedRadius = deriveRadiusFromExtent(extentForRun) ?? 5;
    radiusMiles = Math.min(normalizeRadius(radiusMiles, derivedRadius), 50);

    isLoading = true;
    info = 'Discovering candidate addresses...';

    try {
      const resolved = await resolveCoordinates();
      if (!resolved) {
        throw new Error('Provide latitude & longitude or a searchable address.');
      }

      // ALWAYS use bounding box from map extent, not computed radius
      let boundingBox = extentForRun?.boundingBox;
      
      if (!boundingBox) {
        // Fallback: compute bounding box but enforce 50 mile max
        const maxRadius = Math.min(radiusMiles, 50);
        boundingBox = computeBoundingBox(resolved.lat, resolved.lon, maxRadius);
      }
      
      if (!boundingBox) {
        throw new Error('Unable to determine map bounds. Please zoom the map to define the search area.');
      }
      
      // Auto-constrain bounding box to 50x50 miles maximum centered on map view
      const boxSpan = computeSpanMiles({ center: resolved, boundingBox });
      if (boxSpan) {
        const maxSpan = Math.max(boxSpan.width, boxSpan.height);
        if (maxSpan / 2 > 50) {
          // Constrain to 50 miles from center instead of blocking
          console.log('[PlanMarketingModal] Bounding box too large, auto-constraining to 50x50 miles', {
            originalSpan: boxSpan,
            maxSpan
          });
          
          // Recompute bounding box centered on resolved coordinates with 50 mile radius
          boundingBox = computeBoundingBox(resolved.lat, resolved.lon, 50);
          
          info = 'Map view was too large. Auto-constrained search area to 50×50 miles centered on your location.';
        }
      }

      console.log('[PlanMarketingModal] Calling discoverMarketingAddresses API', {
        planId: plan.id,
        boundingBox,
        radiusMiles,
        center: resolved,
        algorithms: selectedAlgorithms
      });

      const response = await planService.discoverMarketingAddresses(plan.id, {
        boundingBox,
        radiusMiles,
        center: resolved,
        options: {
          advancedOptions,
          viewExtent: extentForRun ?? { center: resolved, boundingBox },
          algorithms: selectedAlgorithms
        }
      });

      console.log('[PlanMarketingModal] Discovery API response received', {
        addressCount: response.addresses?.length || 0,
        summary: response.summary,
        fullResponse: response
      });

      if (!response) {
        throw new Error('No response from discovery API');
      }

      if (!Array.isArray(response.addresses)) {
        console.error('[PlanMarketingModal] Invalid addresses in response:', response);
        throw new Error('Invalid response format: addresses is not an array');
      }

      results = response.addresses;
      summary = response.summary;
      const runtimeSpan = computeSpanMiles(extentForRun ?? { center: resolved, boundingBox });
      const leadCount = results.length;
      
      console.log('[PlanMarketingModal] Discovery completed successfully', {
        leadCount,
        hasSummary: !!summary,
        runtimeSpan
      });
      
      if (leadCount === 0) {
        info = 'No addresses found in the specified area. Try adjusting the search radius or location.';
      } else if (runtimeSpan) {
        info = `Saved ${leadCount} marketing leads across ~${runtimeSpan.width.toFixed(1)} × ${runtimeSpan.height.toFixed(1)} miles. View them on the map under Marketing Leads.`;
      } else {
        info = `Saved ${leadCount} marketing leads for the current map view. View them on the map under Marketing Leads.`;
      }

      // Update the plan object locally to reflect the new marketing data
      // This will sync to the map via SharedMap without reloading everything
      plan = {
        ...plan,
        marketing: {
          ...plan.marketing,
          addresses: results,
          lastRunAt: new Date().toISOString(),
          lastResultCount: leadCount,
          lastBoundingBox: boundingBox,
          lastCenter: resolved,
          algorithms: selectedAlgorithms,
          algorithmStats: summary?.algorithmStats
        }
      };
      
      // Dispatch update event so parent can sync to map
      dispatch('updated', plan);
      
      // Also fetch the updated plan from backend to ensure consistency
      // But do it in the background without blocking
      fetchUpdatedPlan().catch(err => {
        console.warn('[PlanMarketingModal] Background plan refresh failed:', err);
      });
    } catch (err: any) {
      console.error('Marketing discovery failed:', err);
      error = err?.message || 'Failed to discover addresses.';
      info = null;
    } finally {
      isLoading = false;
    }
  }

  function downloadCsv() {
    const exportRows =
      results.length > 0
        ? results
        : Array.isArray(plan.marketing?.addresses)
        ? plan.marketing?.addresses ?? []
        : [];

    if (!exportRows.length) return;

    const headers = ['Address', 'City', 'State', 'PostalCode', 'Country', 'Latitude', 'Longitude', 'Source'];
    const rows = exportRows.map(entry => [
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
  $: hasAddressOrCoordinates = coordinatesReady || (addressSearch && addressSearch.trim().length > 0);
  $: canAdvance =
    currentStep === 0
      ? Boolean(radiusMiles && radiusMiles > 0)
      : currentStep === 1
        ? selectedAlgorithms.length > 0
        : true;
  $: canRun =
    currentStep === steps.length - 1 && radiusMiles > 0 && hasAddressOrCoordinates && selectedAlgorithms.length > 0;

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
        <button
          class="btn-tertiary mini"
          type="button"
          on:click={usePlanLocation}
          disabled={isLoading || !plan.location}
        >
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
        {#if latestExtent?.center}
          <button type="button" class="btn-tertiary" on:click={useExtentCenter} disabled={isLoading}>
            Use map center
          </button>
        {/if}
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
      {#if latestExtent?.boundingBox}
        <div class="extent-summary">
          <span>
            Map bounds: lat {formatCoord(latestExtent.boundingBox.south, 4)} → {formatCoord(latestExtent.boundingBox.north, 4)},
            lon {formatCoord(latestExtent.boundingBox.west, 4)} → {formatCoord(latestExtent.boundingBox.east, 4)}
          </span>
          {#if extentSpanMiles}
            <span>Approx. span: {extentSpanMiles.width.toFixed(1)} × {extentSpanMiles.height.toFixed(1)} mi</span>
          {/if}
        </div>
      {/if}
        </section>
      {/if}

      {#if currentStep === 1}
        <section class="wizard-panel">
          <header>
            <h3>Advanced Options</h3>
            <p>Tune geocoding, grouping, and deduplication behaviour. These settings mirror the FTTH wizard.</p>
          </header>
          <div class="options-grid">
            <fieldset class="algorithm-fieldset">
              <legend>Discovery Algorithms</legend>
              <p class="section-help">
                Select one or more address discovery strategies. The wizard will combine results and remove duplicates automatically.
              </p>
              {#each ALGORITHM_OPTIONS as option}
                <label class="algorithm-option">
                  <input
                    type="checkbox"
                    checked={selectedAlgorithms.includes(option.id)}
                    on:change={() => toggleAlgorithm(option.id)}
                  />
                  <span class="option-body">
                    <span class="option-label">{option.label}</span>
                    <span class="option-description">{option.description}</span>
                  </span>
                </label>
              {/each}
              {#if selectedAlgorithms.length === 0}
                <p class="algorithm-warning">Select at least one algorithm before continuing.</p>
              {/if}
            </fieldset>
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

          {#if !hasAddressOrCoordinates}
            <div class="alert alert-warning">
              Provide latitude and longitude or enter an address to resolve coordinates before running discovery.
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
            {#if summary.algorithmsUsed?.length}
              <div class="summary-card full-width">
                <span class="label">Algorithms Used</span>
                <ul class="algorithm-list">
                  {#each summary.algorithmsUsed as algId}
                    <li>{algorithmLabel(algId)}</li>
                  {/each}
                </ul>
              </div>
            {/if}
            </div>
          {/if}

          <div class="results">
            <div class="results-note">
              <p>
                Addresses discovered in this run are saved with the plan and rendered on the coverage map as
                marketing leads. Review them from the map or export the CSV once the run completes.
              </p>
              <ul>
                <li><strong>Leads saved:</strong> {summary?.totalCandidates ?? 0}</li>
                <li><strong>Geocoded:</strong> {summary?.geocodedCount ?? 0}</li>
                {#if summary?.algorithmStats}
                  {#each Object.entries(summary.algorithmStats) as [algId, stats]}
                    <li>
                      <strong>{algorithmLabel(algId)}:</strong>
                      {stats?.produced ?? 0} candidates ({stats?.geocoded ?? 0} geocoded)
                    </li>
                  {/each}
                {/if}
                {#if plan.marketing?.lastRunAt}
                  <li><strong>Last run:</strong> {new Date(plan.marketing.lastRunAt).toLocaleString()}</li>
                {/if}
              </ul>
            </div>
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
          <button
            class="btn-secondary"
            type="button"
            on:click={downloadCsv}
            disabled={
              isLoading ||
              (!results.length && !(plan.marketing?.addresses && plan.marketing.addresses.length > 0))
            }
          >
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

  .extent-summary {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
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

  .section-help {
    font-size: 0.8rem;
    line-height: 1.4;
    color: var(--text-secondary);
    margin: -0.35rem 0 0;
  }

  .algorithm-fieldset {
    grid-column: 1 / -1;
  }

  .algorithm-option {
    align-items: flex-start;
  }

  .algorithm-option input[type='checkbox'] {
    margin-top: 0.2rem;
  }

  .algorithm-option .option-body {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .algorithm-option .option-label {
    font-weight: 600;
    color: var(--text-primary);
  }

  .algorithm-option .option-description {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .algorithm-warning {
    font-size: 0.8rem;
    color: #f97316;
    margin: -0.35rem 0 0;
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

.summary-card.full-width {
  grid-column: 1 / -1;
}

.algorithm-list {
  margin: 0.5rem 0 0;
  padding-left: 1.2rem;
  display: grid;
  gap: 0.25rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

  .results {
    margin-top: 1rem;
  }

  .results-note {
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    padding: 1rem 1.25rem;
    background: rgba(15, 23, 42, 0.35);
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .results-note ul {
    margin: 0.75rem 0 0;
    padding-left: 1.1rem;
    display: grid;
    gap: 0.35rem;
  }

  .results-note li {
    list-style: disc;
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

