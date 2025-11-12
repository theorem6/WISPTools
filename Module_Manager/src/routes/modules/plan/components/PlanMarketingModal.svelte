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
    newlyAdded?: number;
    totalUniqueAddresses?: number;
    previousCount?: number;
    totalRuns?: number;
  } | null;

  const steps = ['Select Algorithms', 'Review & Run'];

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

  $: currentExtentKey = latestExtent?.boundingBox ? boundingBoxKey(latestExtent.boundingBox) : null;
  $: pendingExtentChange =
    !isLoading &&
    lastRunExtentKey !== null &&
    currentExtentKey !== null &&
    currentExtentKey !== lastRunExtentKey;

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
        totalCandidates: plan.marketing.totalUniqueAddresses ?? plan.marketing.addresses?.length ?? 0,
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
        algorithmStats: plan.marketing.algorithmStats ?? undefined,
        newlyAdded: plan.marketing.lastRunNewAddresses ?? undefined,
        totalUniqueAddresses: plan.marketing.totalUniqueAddresses ?? plan.marketing.addresses?.length ?? 0,
        previousCount:
          plan.marketing.totalUniqueAddresses !== undefined && plan.marketing.lastRunNewAddresses !== undefined
            ? Math.max(plan.marketing.totalUniqueAddresses - plan.marketing.lastRunNewAddresses, 0)
            : undefined,
        totalRuns: plan.marketing.totalRuns ?? undefined
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

  let lastRunExtentKey = plan.marketing?.lastBoundingBox ? boundingBoxKey(plan.marketing.lastBoundingBox) : null;
  let pendingExtentChange = false;
  let currentExtentKey: string | null = latestExtent?.boundingBox ? boundingBoxKey(latestExtent.boundingBox) : null;

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

  function boundingBoxKey(box?: { west: number; south: number; east: number; north: number } | null): string | null {
    if (!box) return null;
    const values = [box.west, box.south, box.east, box.north];
    if (values.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
      return null;
    }
    return values.map(value => Number(value).toFixed(5)).join('|');
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
    console.log('[PlanMarketingModal] Discover addresses clicked (map-centric mode)', {
      planId: plan?.id,
      advancedOptions,
      hasMapExtent,
      mapExtent: latestExtent
    });

    error = null;
    info = null;

    if (!tenantId) {
      error = 'Select a tenant before running marketing discovery.';
      isLoading = false;
      return;
    }

    const extentForRun = latestExtent ?? extentAtOpen;
    
    if (!extentForRun?.boundingBox || !extentForRun?.center) {
      error = 'Unable to determine map bounds. Please zoom the map to define the search area.';
      isLoading = false;
      return;
    }

    isLoading = true;
    info = 'Discovering addresses from map view...';

    const previousSavedCount =
      plan.marketing?.totalUniqueAddresses ?? plan.marketing?.addresses?.length ?? 0;
    const previousTotalRuns = plan.marketing?.totalRuns ?? 0;

    try {
      // Use map extent directly (clone so we don't mutate shared reference)
      let boundingBox = { ...extentForRun.boundingBox };
      const center = extentForRun.center;
      
      // Auto-constrain bounding box to balanced square footprint (max 50 mile radius)
      const boxSpan = computeSpanMiles({ center, boundingBox });
      if (boxSpan) {
        const maxSpan = Math.max(boxSpan.width, boxSpan.height);
        const minSpan = Math.min(boxSpan.width, boxSpan.height);
        let targetRadius = Math.min(maxSpan / 2, 50);
        const adjustments: string[] = [];

        if (maxSpan / 2 > 50) {
          console.log('[PlanMarketingModal] Bounding box too large, auto-constraining to 50x50 miles', {
            originalSpan: boxSpan,
            maxSpan
          });
          adjustments.push('Map view was too large; constrained search area to 50×50 miles centered on the map.');
        }

        // Normalize rectangle to a square so sampling covers full area evenly
        const differenceMiles = Math.abs(boxSpan.width - boxSpan.height);
        if (differenceMiles > 0.5) {
          console.log('[PlanMarketingModal] Normalizing search area to square footprint', {
            originalSpan: boxSpan,
            targetRadius
          });
          adjustments.push('Search area normalized to a square so sampling is even in all directions.');
        }

        if (adjustments.length > 0) {
          boundingBox = computeBoundingBox(center.lat, center.lon, targetRadius);
          info = adjustments.join(' ');
        }

        // Calculate radius from adjusted bounding box
        const adjustedSpan = computeSpanMiles({ center, boundingBox });
        const adjustedMaxSpan = adjustedSpan ? Math.max(adjustedSpan.width, adjustedSpan.height) : maxSpan;
        targetRadius = Math.min(adjustedMaxSpan / 2, 50);
        radiusMiles = targetRadius;
      } else {
        // Fallback radius calculation if span could not be derived
        const derivedRadius = deriveRadiusFromExtent({ center, boundingBox }) ?? 25;
        radiusMiles = Math.min(derivedRadius, 50);
      }

      console.log('[PlanMarketingModal] Calling discoverMarketingAddresses API', {
        planId: plan.id,
        boundingBox,
        radiusMiles,
        center,
        algorithms: selectedAlgorithms
      });

      const response = await planService.discoverMarketingAddresses(plan.id, {
        boundingBox,
        radiusMiles,
        center,
        options: {
          advancedOptions,
          viewExtent: extentForRun,
          algorithms: selectedAlgorithms
        }
      });

      console.log('[PlanMarketingModal] Discovery API response received', {
        addressCount: response.addresses?.length || 0,
        sampleAddresses: response.addresses?.slice(0, 3),
        summary: response.summary,
        responseKeys: Object.keys(response || {})
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
      const runtimeSpan = computeSpanMiles({ center, boundingBox });
      const totalSaved = summary?.totalUniqueAddresses ?? results.length;
      const newlyAdded = summary?.newlyAdded ?? Math.max(totalSaved - previousSavedCount, 0);
      const totalRuns = summary?.totalRuns ?? previousTotalRuns + 1;

      lastRunExtentKey = boundingBoxKey(boundingBox);
      pendingExtentChange = false;
      
      console.log('[PlanMarketingModal] Discovery completed successfully', {
        totalSaved,
        newlyAdded,
        previousSavedCount,
        totalRuns,
        hasSummary: !!summary,
        runtimeSpan,
        sampleResults: results.slice(0, 3),
        planMarketingAddressesLength: plan.marketing?.addresses?.length
      });
      
      if (totalSaved === 0) {
        info = 'No addresses found in current map view. Try zooming in or moving to a different area.';
      } else if (newlyAdded === 0) {
        info = `No new addresses detected in this view. ${totalSaved} saved leads remain available.`;
      } else if (runtimeSpan) {
        info = `Added ${newlyAdded} new addresses (${totalSaved} total saved) across ~${runtimeSpan.width.toFixed(1)} × ${runtimeSpan.height.toFixed(1)} miles.`;
      } else {
        info = `Added ${newlyAdded} new addresses (${totalSaved} total saved) for the current map view.`;
      }

      // Update the plan object locally to reflect the new marketing data
      // This will sync to the map via SharedMap without reloading everything
      plan = {
        ...plan,
        marketing: {
          ...plan.marketing,
          addresses: results,
          lastRunAt: new Date().toISOString(),
          lastResultCount: totalSaved,
          lastBoundingBox: boundingBox,
          lastCenter: center,
          algorithms: selectedAlgorithms,
          algorithmStats: summary?.algorithmStats,
          totalUniqueAddresses: totalSaved,
          totalRuns,
          lastRunNewAddresses: newlyAdded
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

  function getTotalSavedAddresses(): number {
    if (summary?.totalUniqueAddresses !== undefined) return summary.totalUniqueAddresses;
    if (plan.marketing?.totalUniqueAddresses !== undefined) return plan.marketing.totalUniqueAddresses;
    if (Array.isArray(plan.marketing?.addresses)) return plan.marketing.addresses.length;
    return results.length;
  }

  function getNewlyAddedThisRun(): number {
    if (summary?.newlyAdded !== undefined) return summary.newlyAdded;
    if (plan.marketing?.lastRunNewAddresses !== undefined) return plan.marketing.lastRunNewAddresses;
    return 0;
  }

  function getTotalRunCount(): number {
    if (summary?.totalRuns !== undefined) return summary.totalRuns;
    if (plan.marketing?.totalRuns !== undefined) return plan.marketing.totalRuns;
    return plan.marketing?.lastRunAt ? 1 : 0;
  }

  function getAllSavedAddresses(): PlanMarketingAddress[] {
    if (Array.isArray(plan.marketing?.addresses) && plan.marketing.addresses.length > 0) {
      return plan.marketing.addresses;
    }
    return results;
  }

  function exportAddresses(addresses: PlanMarketingAddress[], filenameSuffix: string) {
    if (!addresses.length) return;

    const headers = [
      'Address',
      'City',
      'State',
      'PostalCode',
      'Country',
      'Latitude',
      'Longitude',
      'Source',
      'DiscoveredAt'
    ];
    const rows = addresses.map(entry => [
      entry.addressLine1 ?? '',
      entry.city ?? '',
      entry.state ?? '',
      entry.postalCode ?? '',
      entry.country ?? '',
      entry.latitude ?? '',
      entry.longitude ?? '',
      entry.source ?? '',
      entry.discoveredAt
        ? (() => {
            const parsed = new Date(entry.discoveredAt);
            return Number.isNaN(parsed.valueOf()) ? entry.discoveredAt : parsed.toISOString();
          })()
        : ''
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safePlanName = plan.name ? plan.name.replace(/\s+/g, '_') : 'marketing-addresses';
    link.href = url;
    link.setAttribute('download', `${safePlanName}-${filenameSuffix}-${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function downloadLatestCsv() {
    if (!results.length) return;
    exportAddresses(results, 'latest-run');
  }

  function downloadAllCsv() {
    const addresses = getAllSavedAddresses();
    if (!addresses.length) return;
    exportAddresses(addresses, 'all-addresses');
  }

  $: hasMapExtent = Boolean(latestExtent?.boundingBox && latestExtent?.center);
  $: canAdvance =
    currentStep === 0
      ? selectedAlgorithms.length > 0 && hasMapExtent
      : true;
  $: canRun =
    currentStep === steps.length - 1 && hasMapExtent && selectedAlgorithms.length > 0;

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
      <h2>📍 Find Addresses - {plan.name}</h2>
      <div class="header-actions">
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
            <h3>Select Algorithms & Search Area</h3>
            <p>Choose discovery methods and verify the map area. The search uses the visible map extent as the boundary.</p>
          </header>
          
          {#if !hasMapExtent}
            <div class="alert alert-warning">
              <strong>⚠️ Map extent not available.</strong> Please zoom the map to define the search area before continuing.
            </div>
          {:else if latestExtent?.boundingBox}
            <div class="extent-summary-prominent">
              <h4>📍 Search Area (from map view)</h4>
              <div class="extent-details">
                <span>
                  <strong>Bounds:</strong> lat {formatCoord(latestExtent.boundingBox.south, 4)} → {formatCoord(latestExtent.boundingBox.north, 4)},
                  lon {formatCoord(latestExtent.boundingBox.west, 4)} → {formatCoord(latestExtent.boundingBox.east, 4)}
                </span>
                {#if extentSpanMiles}
                  <span><strong>Span:</strong> {extentSpanMiles.width.toFixed(1)} × {extentSpanMiles.height.toFixed(1)} miles</span>
                  {#if Math.max(extentSpanMiles.width, extentSpanMiles.height) > 100}
                    <span class="extent-warning">⚠️ Large area - will be auto-constrained to 50×50 miles max</span>
                  {/if}
                {/if}
              </div>
            </div>
          {/if}
          
          <div class="options-grid">
            <fieldset class="algorithm-fieldset">
              <legend>Discovery Algorithms</legend>
              <p class="section-help">
                Select one or more address discovery strategies. Results are automatically deduplicated.
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
                <p class="algorithm-warning">⚠️ Select at least one algorithm before continuing.</p>
              {/if}
            </fieldset>
            
            <details class="advanced-options-toggle">
              <summary>Advanced Options (optional)</summary>
              <div class="advanced-options-content">
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
                </fieldset>
              </div>
            </details>
          </div>
        </section>
      {/if}

      {#if currentStep === 1}
        <section class="wizard-panel">
          <header>
            <h3>Review & Run Discovery</h3>
            <p>The system will: (1) Find OSM building centroids in map view → (2) Reverse geocode with ArcGIS → (3) Deduplicate → (4) Place markers</p>
          </header>
          
          <div class="review-grid">
            {#if latestExtent?.center}
              <div>
                <span class="label">Map Center</span>
                <span class="value">
                  {formatCoord(latestExtent.center.lat)}, {formatCoord(latestExtent.center.lon)}
                </span>
              </div>
            {/if}
            {#if extentSpanMiles}
              <div>
                <span class="label">Search Area</span>
                <span class="value">{extentSpanMiles.width.toFixed(1)} × {extentSpanMiles.height.toFixed(1)} mi</span>
              </div>
            {/if}
            <div>
              <span class="label">Algorithms</span>
              <span class="value">{selectedAlgorithms.length} selected</span>
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

          {#if pendingExtentChange}
            <div class="alert alert-reminder">
              Map view changed since the last run. Move the map to your next target area and run discovery again to capture it.
            </div>
          {/if}

          {#if !hasMapExtent}
            <div class="alert alert-warning">
              <strong>⚠️ Map extent not available.</strong> Please zoom the map to define the search area before running discovery.
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
                <span class="label">New This Run</span>
                <span class="value">{summary.newlyAdded ?? 0}</span>
              </div>
              <div class="summary-card">
                <span class="label">Saved Total</span>
                <span class="value">{summary.totalUniqueAddresses ?? getTotalSavedAddresses()}</span>
              </div>
              {#if getTotalRunCount()}
                <div class="summary-card">
                  <span class="label">Runs Completed</span>
                  <span class="value">{getTotalRunCount()}</span>
                </div>
              {/if}
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
                <li><strong>New this run:</strong> {getNewlyAddedThisRun()}</li>
                <li><strong>Total saved (all runs):</strong> {getTotalSavedAddresses()}</li>
                <li><strong>Geocoded this run:</strong> {summary?.geocodedCount ?? 0}</li>
                {#if getTotalRunCount()}
                  <li><strong>Runs completed:</strong> {getTotalRunCount()}</li>
                {/if}
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
            on:click={downloadLatestCsv}
            disabled={isLoading || results.length === 0}
          >
            ⬇️ Download This Run
          </button>
          <button
            class="btn-secondary"
            type="button"
            on:click={downloadAllCsv}
            disabled={isLoading || getAllSavedAddresses().length === 0}
          >
            ⬇️ Download All Addresses
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

  .extent-summary-prominent {
    background: rgba(14, 165, 233, 0.08);
    border: 1px solid rgba(14, 165, 233, 0.25);
    border-radius: var(--border-radius-sm);
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .extent-summary-prominent h4 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    color: var(--text-primary);
  }

  .extent-details {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .extent-warning {
    color: #f97316;
    font-weight: 600;
  }

  .advanced-options-toggle {
    grid-column: 1 / -1;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    padding: 0.75rem 1rem;
    background: rgba(148, 163, 184, 0.06);
  }

  .advanced-options-toggle summary {
    cursor: pointer;
    font-weight: 600;
    user-select: none;
    list-style: none;
  }

  .advanced-options-toggle summary::-webkit-details-marker {
    display: none;
  }

  .advanced-options-toggle summary::before {
    content: '▶';
    display: inline-block;
    margin-right: 0.5rem;
    transition: transform 0.2s;
  }

  .advanced-options-toggle[open] summary::before {
    transform: rotate(90deg);
  }

  .advanced-options-content {
    margin-top: 1rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
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

  .alert-info {
    background: rgba(59, 130, 246, 0.12);
    border: 1px solid rgba(59, 130, 246, 0.35);
    color: var(--text-primary);
    border-radius: var(--border-radius-sm);
    padding: 0.75rem 1rem;
  }

  .alert-error {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: var(--text-primary);
    border-radius: var(--border-radius-sm);
    padding: 0.75rem 1rem;
  }

  .alert-reminder {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.35);
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

