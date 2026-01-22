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

  // Single step wizard - no algorithm selection needed
  const steps = ['Review & Run'];

  // Only use building footprint algorithms - these return centroids inside buildings
  // Do not use arcgis_address_points as it can return address points on roads/intersections
  const DEFAULT_ALGORITHMS = ['microsoft_footprints', 'osm_buildings'];
  
  // Remove algorithm options - always use default algorithms
  const ALGORITHM_OPTIONS = [] as const;

  let isLoading = false;
  let error: string | null = null;
  let info: string | null = null;
  let currentStep = 0;
  let lastSearchSpan: { widthMiles: number; heightMiles: number } | null = null;

  let tenantId: string | undefined;
  $: tenantId = $currentTenant?.id;

  let addressSearch =
    plan.location?.addressLine1 && plan.location?.city && plan.location?.state
      ? `${plan.location.addressLine1}, ${plan.location.city}, ${plan.location.state}`
      : plan.location?.addressLine1 ?? '';

  // Location lookup for wizard
  let locationLookup = '';
  let isLookingUpLocation = false;
  let locationLookupError: string | null = null;

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

  // Track the extent key from the last successful run
  // Make it reactive to plan updates so it stays in sync
  let lastRunExtentKey: string | null = null;
  $: {
    const planLastBbox = plan.marketing?.lastBoundingBox;
    if (planLastBbox) {
      const key = boundingBoxKey(planLastBbox);
      if (key) {
        lastRunExtentKey = key;
      }
    }
  }

  // Only show pending change warning if extent changed significantly (more than 0.01 degrees)
  function boundingBoxChangedSignificantly(
    box1: { west: number; south: number; east: number; north: number } | null | undefined,
    box2: { west: number; south: number; east: number; north: number } | null | undefined
  ): boolean {
    if (!box1 || !box2) return box1 !== box2;
    const threshold = 0.01; // ~1.1 km
    return (
      Math.abs(box1.west - box2.west) > threshold ||
      Math.abs(box1.east - box2.east) > threshold ||
      Math.abs(box1.south - box2.south) > threshold ||
      Math.abs(box1.north - box2.north) > threshold
    );
  }

  $: currentExtentKey = latestExtent?.boundingBox ? boundingBoxKey(latestExtent.boundingBox) : null;
  $: pendingExtentChange =
    !isLoading &&
    lastRunExtentKey !== null &&
    latestExtent?.boundingBox &&
    plan.marketing?.lastBoundingBox &&
    boundingBoxChangedSignificantly(latestExtent.boundingBox, plan.marketing.lastBoundingBox);

  // Always use default algorithms - no selection needed
  let selectedAlgorithms: string[] = DEFAULT_ALGORITHMS;
  let initializedAlgorithms = true; // Always initialized with fixed algorithms
  let selectedAlgorithmLabels: string[] = ['Microsoft Building Footprints', 'OSM Building Footprints'];

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
    // Reset wizard state - start at step 0 (which is now the only step)
    currentStep = 0;
    results = [];
    // Don't reset summary - keep it so buildings cumulate properly
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
    // Always use default algorithms - no selection needed
    selectedAlgorithms = [...DEFAULT_ALGORITHMS];
    initializedAlgorithms = true;
  }

  function algorithmLabel(id: string): string {
    if (id === 'microsoft_footprints') return 'Microsoft Building Footprints';
    if (id === 'osm_buildings') return 'OSM Building Footprints';
    if (id === 'arcgis_address_points') return 'ArcGIS Address Points';
    if (id === 'arcgis_building_footprints') return 'ArcGIS Building Footprints';
    if (id === 'arcgis_places') return 'ArcGIS Places';
    return id;
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

  function describeSpan(span: { widthMiles: number; heightMiles: number } | null): string | null {
    if (!span) return null;
    return `${span.widthMiles.toFixed(2)} × ${span.heightMiles.toFixed(2)} miles`;
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
      mapExtent: mapExtent,
      latestExtent: latestExtent,
      extentAtOpen: extentAtOpen
    });

    error = null;
    info = null;

    if (!tenantId) {
      error = 'Select a tenant before running marketing discovery.';
      isLoading = false;
      return;
    }

    // Request current extent from map when button is clicked
    window.dispatchEvent(new CustomEvent('request-map-extent'));
    
    // Wait for the extent update to propagate (longer wait to ensure we get the latest)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // CRITICAL: Lock the extent NOW before any map changes can occur
    // Use the current latestExtent at button click time - this prevents issues if map zooms out during discovery
    // If latestExtent is not available, use extentAtOpen as fallback
    const extentForRun = latestExtent ? cloneMapExtent(latestExtent) : (extentAtOpen ? cloneMapExtent(extentAtOpen) : null);
    
    if (!extentForRun?.boundingBox || !extentForRun?.center) {
      error = 'Unable to determine map bounds. Please zoom the map to define the search area.';
      isLoading = false;
      return;
    }

    // Lock the bounding box and center - don't use reactive latestExtent during the API call
    const lockedBoundingBox = { ...extentForRun.boundingBox };
    const lockedCenter = { ...extentForRun.center };

    console.log('[PlanMarketingModal] Locked extent for discovery (prevents map zoom changes):', {
      boundingBox: lockedBoundingBox,
      center: lockedCenter,
      extentSource: latestExtent ? 'latestExtent' : 'extentAtOpen',
      timestamp: new Date().toISOString()
    });

    isLoading = true;
    info = 'Discovering addresses from map view...';
    error = null;
    // Don't clear summary - keep previous data so buildings cumulate properly
    // Clear results for this run only
    results = [];

    const previousSavedCount =
      plan.marketing?.totalUniqueAddresses ?? plan.marketing?.addresses?.length ?? 0;
    const previousTotalRuns = plan.marketing?.totalRuns ?? 0;

    try {
      // Use the locked extent (not reactive latestExtent) to prevent map zoom-out from affecting discovery
      const boundingBox = lockedBoundingBox;
      const center = lockedCenter;

      const spanMiles = computeSpanMiles({ center, boundingBox });
      if (spanMiles) {
        lastSearchSpan = { widthMiles: spanMiles.width, heightMiles: spanMiles.height };
        const maxSpan = Math.max(spanMiles.width, spanMiles.height);
        radiusMiles = Math.min(Math.max(maxSpan / 2, 0.25), 50);
      } else {
        lastSearchSpan = null;
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
      
      // Map backend response fields to frontend summary structure
      // Backend returns: { total, geocoded, new, prev, runs, truncated, shown }
      // Frontend expects: { totalCandidates, geocodedCount, newlyAdded, totalRuns, totalUniqueAddresses, ... }
      const backendSummary = response.summary || {};
      const backendStats = response.stats || {};
      
      // Calculate total candidates from algorithm stats (sum of all produced)
      let totalCandidatesFromStats = 0;
      if (backendStats && typeof backendStats === 'object') {
        for (const [algId, stats] of Object.entries(backendStats)) {
          if (stats && typeof stats === 'object' && 'produced' in stats) {
            totalCandidatesFromStats += Number(stats.produced) || 0;
          }
        }
      }
      
      // Backend sends geocoded count which is the TOTAL geocoded addresses across ALL runs
      // This is more accurate than counting from results (which might be truncated to 5000)
      // Backend has access to all addresses in the database, not just the response subset
      const totalGeocodedCount = backendSummary.geocoded ?? 0;
      
      // Calculate geocoded count from results as a sanity check (only if results are not truncated)
      const actualGeocodedCountFromResults = results.filter(addr => addr && addr.addressLine1 && addr.addressLine1.trim().length > 0).length;
      
      // Use backend count as primary source (it has the full database count)
      // Only use results count if backend count is missing AND results are not truncated
      const finalGeocodedCount = totalGeocodedCount > 0 
        ? totalGeocodedCount 
        : (backendSummary.truncated ? totalGeocodedCount : actualGeocodedCountFromResults);
      
      // Update summary with new run data - CUMULATE the totalUniqueAddresses from backend
      // Backend returns the actual total from database which includes all previous runs
      // This is the cumulated total across all runs, not just this run
      const newTotalUniqueAddresses = backendSummary.total ?? (summary?.totalUniqueAddresses ?? previousSavedCount);
      const newGeocodedCount = finalGeocodedCount;
      
      summary = {
        totalCandidates: (totalCandidatesFromStats || backendSummary?.total) ?? (summary?.totalCandidates ?? 0) + results.length,
        geocodedCount: newGeocodedCount, // Total geocoded addresses across all runs (from backend)
        newlyAdded: backendSummary.new ?? 0,
        totalUniqueAddresses: newTotalUniqueAddresses, // Use backend total (cumulated from database across all runs)
        totalRuns: backendSummary.runs ?? previousTotalRuns + 1,
        previousCount: backendSummary.prev ?? previousSavedCount,
        truncated: backendSummary.truncated ?? false,
        shown: backendSummary.shown ?? results.length,
        radiusMiles: radiusMiles,
        boundingBox: boundingBox,
        center: center,
        algorithmsUsed: selectedAlgorithms,
        algorithmStats: backendStats
      };
      
      const runtimeSpan = computeSpanMiles({ center, boundingBox });
      // Use summary.totalUniqueAddresses (from backend, cumulated across all runs) - this is the real total
      const totalSaved = summary.totalUniqueAddresses ?? previousSavedCount;
      const newlyAdded = summary.newlyAdded ?? Math.max(totalSaved - previousSavedCount, 0);
      const totalRuns = summary.totalRuns ?? previousTotalRuns + 1;

      // Update lastRunExtentKey - but don't set it directly, let the reactive statement handle it
      // This ensures it stays in sync with the plan's marketing data
      
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
      
      const fallbackSpanDescription = describeSpan(lastSearchSpan);
      const defaultAreaSuffix = fallbackSpanDescription ? ` Search area ≈ ${fallbackSpanDescription}.` : '';

      if (totalSaved === 0) {
        info = `No addresses found in current map view. Try zooming in or moving to a different area.${defaultAreaSuffix}`.trim();
      } else if (newlyAdded === 0) {
        info = `No new addresses detected in this view. ${totalSaved} saved leads remain available.${defaultAreaSuffix}`.trim();
      } else if (runtimeSpan) {
        info = `Added ${newlyAdded} new addresses (${totalSaved} total saved) across ~${runtimeSpan.width.toFixed(2)} × ${runtimeSpan.height.toFixed(2)} miles.`;
      } else {
        info = `Added ${newlyAdded} new addresses (${totalSaved} total saved) for the current map view.${defaultAreaSuffix}`.trim();
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
      
      // Reset loading state FIRST - before any async operations
      // This ensures buttons are re-enabled immediately after discovery completes
      // CRITICAL: Set isLoading to false BEFORE dispatch to ensure UI updates immediately
      isLoading = false;
      
      // Ensure info is set to final message (already set above, but ensure it's not "Discovering...")
      if (!info || info.includes('Discovering')) {
        // Fallback: set info to a completion message if it wasn't set properly
        if (totalSaved === 0) {
          info = `No addresses found in current map view.`;
        } else if (newlyAdded === 0) {
          info = `No new addresses detected. ${totalSaved} saved leads available.`;
        } else {
          info = `Added ${newlyAdded} new addresses (${totalSaved} total saved).`;
        }
      }
      
      // Dispatch update event so parent can sync to map
      dispatch('updated', plan);
      
      // Also fetch the updated plan from backend to ensure consistency
      // But do it in the background without blocking (and don't set isLoading = true)
      try {
        const refreshed = await planService.getPlan(plan.id);
        if (refreshed) {
          plan = refreshed;
          dispatch('updated', refreshed);
          // Update lastRunExtentKey after plan refresh - the reactive statement will handle it
          console.log('[PlanMarketingModal] Plan refreshed, lastBoundingBox:', refreshed.marketing?.lastBoundingBox);
        }
      } catch (refreshErr) {
        console.warn('[PlanMarketingModal] Background plan refresh failed (non-critical):', refreshErr);
        // Don't fail the whole operation if refresh fails - the local update is enough
        // isLoading is already false, so buttons stay enabled
      }
    } catch (err: any) {
      console.error('[PlanMarketingModal] Marketing discovery failed:', err);
      isLoading = false;
      error = err?.message || 'Failed to discover addresses. Please try again.';
      info = null;
      results = [];
      summary = null;
      // Reset state to prevent wizard from being in broken state
      try {
        // Try to refresh plan to get back to known good state
        const refreshed = await planService.getPlan(plan.id).catch(() => null);
        if (refreshed) {
          plan = refreshed;
        }
      } catch (recoveryErr) {
        console.warn('[PlanMarketingModal] Failed to recover plan state:', recoveryErr);
      }
    }
  }

  function getTotalSavedAddresses(): number {
    // Prioritize summary (from latest run) - it has the cumulated total from backend
    if (summary?.totalUniqueAddresses !== undefined) return summary.totalUniqueAddresses;
    // Fall back to plan.marketing.totalUniqueAddresses (from database)
    if (plan.marketing?.totalUniqueAddresses !== undefined) return plan.marketing.totalUniqueAddresses;
    // Last resort: count addresses array (might be truncated in response)
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
    // Get addresses from plan or results
    const allAddresses = Array.isArray(plan.marketing?.addresses) && plan.marketing.addresses.length > 0
      ? plan.marketing.addresses
      : results;
    
    // Filter out addresses without address information (no addressLine1)
    return allAddresses.filter((addr) => {
      return addr && addr.addressLine1 && addr.addressLine1.trim().length > 0;
    });
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
  $: canAdvance = true; // No longer need to check algorithms since they're always set
  $: canRun = hasMapExtent; // Only need map extent to run

  function formatCoord(value: number | string | undefined, fractionDigits = 5): string {
    if (value === undefined || value === null) return '—';
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(fractionDigits) : '—';
  }

  async function handleLocationLookup() {
    const input = locationLookup.trim();
    if (!input) {
      locationLookupError = 'Please enter a location to search for.';
      return;
    }

    isLookingUpLocation = true;
    locationLookupError = null;

    try {
      // Try to parse as coordinates first (format: lat, lng)
      const coordMatch = input.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
      let lat: number | null = null;
      let lon: number | null = null;

      if (coordMatch) {
        lat = parseFloat(coordMatch[1]);
        lon = parseFloat(coordMatch[2]);
        
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          // Valid coordinates - center map
          await centerMapOnLocation(lat, lon);
          locationLookup = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
          isLookingUpLocation = false;
          return;
        } else {
          locationLookupError = 'Invalid coordinates. Latitude must be -90 to 90, longitude -180 to 180.';
          isLookingUpLocation = false;
          return;
        }
      }

      // Use ArcGIS geocoding service for addresses/cities/states/zip
      const response = await fetch(
        `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?` +
        `singleLine=${encodeURIComponent(input)}` +
        `&f=json` +
        `&maxLocations=1`
      );

      if (!response.ok) {
        throw new Error('Geocoding service unavailable');
      }

      const data = await response.json();

      if (data.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];
        lat = candidate.location.y;
        lon = candidate.location.x;
        const address = candidate.address || input;
        
        // Center map on the location
        await centerMapOnLocation(lat, lon);
        
        // Update location lookup with the found address
        locationLookup = address;
        
        // Update project location if plan exists
        if (plan?.id && lat && lon) {
          try {
            await planService.updatePlan(plan.id, {
              location: {
                ...plan.location,
                latitude: lat,
                longitude: lon,
                addressLine1: address.split(',')[0] || address,
                city: candidate.attributes?.City || plan.location?.city,
                state: candidate.attributes?.Region || plan.location?.state,
                postalCode: candidate.attributes?.Postal || plan.location?.postalCode
              }
            });
            console.log('[PlanMarketingModal] Updated project location from lookup:', { lat, lon, address });
          } catch (err) {
            console.warn('[PlanMarketingModal] Failed to update project location:', err);
            // Don't show error to user - location lookup succeeded even if update failed
          }
        }
      } else {
        locationLookupError = 'Location not found. Try: "New York, NY", "10001", or coordinates like "40.7128, -74.0060"';
      }
    } catch (err: any) {
      console.error('[PlanMarketingModal] Location lookup error:', err);
      locationLookupError = err.message || 'Failed to lookup location. Please try again.';
    } finally {
      isLookingUpLocation = false;
    }
  }

  async function centerMapOnLocation(lat: number, lon: number) {
    // Send message to map to center on location
    window.dispatchEvent(new CustomEvent('center-map-on-location', {
      detail: { lat, lon, zoom: 14 }
    }));
    
    // Wait a bit for map to center, then request new extent
    await new Promise(resolve => setTimeout(resolve, 1000));
    window.dispatchEvent(new CustomEvent('request-map-extent'));
    
    // Wait for extent to update
    await new Promise(resolve => setTimeout(resolve, 500));
  }
</script>

<div class="marketing-backdrop" role="presentation" aria-hidden="false">
  <div
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
            <h3>Review & Run Discovery</h3>
            <p>The system will: (1) Find building footprints in map view → (2) Calculate centroids → (3) Reverse geocode with ArcGIS → (4) Deduplicate → (5) Place markers</p>
          </header>
          
          <!-- Combined information from both steps -->
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
              <span class="value">{selectedAlgorithmLabels.join(', ')}</span>
            </div>
          </div>
          
          {#if latestExtent?.boundingBox && extentSpanMiles}
            <div class="extent-summary-prominent" style="margin-top: 1rem;">
              <h4>📍 Search Area Details</h4>
              <div class="extent-details">
                <span>
                  <strong>Bounds:</strong> lat {formatCoord(latestExtent.boundingBox.south, 4)} → {formatCoord(latestExtent.boundingBox.north, 4)},
                  lon {formatCoord(latestExtent.boundingBox.west, 4)} → {formatCoord(latestExtent.boundingBox.east, 4)}
                </span>
                <span><strong>Span:</strong> {extentSpanMiles.width.toFixed(1)} × {extentSpanMiles.height.toFixed(1)} miles</span>
                {#if Math.max(extentSpanMiles.width, extentSpanMiles.height) > 100}
                  <span class="extent-warning">⚠️ Large area - will be auto-constrained to 50×50 miles max</span>
                {/if}
              </div>
            </div>
          {/if}

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
            disabled={isLoading || (!results.length && !summary)}
          >
            ⬇️ Download This Run
          </button>
          <button
            class="btn-secondary"
            type="button"
            on:click={downloadAllCsv}
            disabled={isLoading || (!getAllSavedAddresses().length && !getTotalSavedAddresses())}
          >
            ⬇️ Download All Addresses
          </button>
        </div>
      {/if}
    </div>
  </div>
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

