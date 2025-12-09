<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { browser, version as appVersion } from '$app/environment';
  import { get } from 'svelte/store';
  import { mapContext } from './mapContext';
  import { currentTenant } from '$lib/stores/tenantStore';
  import type { MapModuleMode } from './MapCapabilities';
  import type { MapLayerState } from './mapContext';

  export let mode: MapModuleMode = 'plan';

  let iframeEl: HTMLIFrameElement | null = null;
  let iframeWindow: Window | null = null;
  let iframeLoaded = false;
  let currentUrl = '';
  let currentNavKey = '';
  let mapState: MapLayerState = get(mapContext);

  let unsubscribe: (() => void) | undefined;
  const dispatch = createEventDispatcher();

  // Always use wisptools.io for iframe URLs
  const coverageMapHost = (() => {
    if (!browser) return '';
    
    const envHost = import.meta.env.VITE_COVERAGE_MAP_HOST;
    if (envHost && typeof envHost === 'string') {
      return envHost.replace(/\/$/, '');
    }
    
    // FORCE wisptools.io - it's already set up as the frontend
    console.log('[SharedMap] 🔵🔵🔵 Setting iframe host to wisptools.io');
    return 'https://wisptools.io';
  })();
  
  console.log('[SharedMap] 🔵🔵🔵 coverageMapHost:', coverageMapHost);

  const buildUrl = (state: MapLayerState = mapState) => {
    const params = new URLSearchParams();

    if (mode === 'plan') {
      params.set('mode', 'plan');
      params.set('hideStats', 'true');
      params.set('planMode', 'true');
    } else if (mode === 'deploy') {
      params.set('mode', 'deploy');
      params.set('deployMode', 'true');
    } else {
      params.set('hideStats', 'true');
    }

    const planId = state?.activePlan?.id;
    if (planId) {
      params.set('planId', planId);
    }

    params.set('appVersion', appVersion ?? 'dev');
    const query = params.toString();
    const path = query ? `/modules/coverage-map?${query}` : '/modules/coverage-map';
    return coverageMapHost ? `${coverageMapHost}${path}` : path;
  };

  const buildNavigationKey = (state: MapLayerState = mapState) => {
    return `${mode}|${state?.activePlan?.id ?? ''}`;
  };

  const navigateIframe = (nextUrl: string) => {
    if (!iframeEl) return;
    currentUrl = nextUrl;
    iframeLoaded = false;
    console.log('[SharedMap] 🔵🔵🔵 Setting iframe src to:', nextUrl);
    iframeEl.src = nextUrl;
  };

  const postStateToIframe = (targetWindow: Window | null = iframeWindow) => {
    if (!targetWindow) return;

    try {
      const activePlan = mapState.activePlan;
      const activePlanSummary = activePlan
        ? {
            id: activePlan.id ?? activePlan._id ?? null,
            name: activePlan.name ?? null,
            status: activePlan.status ?? null,
            tenantId: activePlan.tenantId ?? null
          }
        : null;

      // Only send marketing addresses if the plan is visible on the map
      const marketing = activePlan?.marketing;
      const isPlanVisible = activePlan?.showOnMap !== false; // Default to true if undefined
      const activePlanMarketing = marketing && isPlanVisible
        ? {
            targetRadiusMiles: marketing.targetRadiusMiles ?? null,
            lastRunAt: marketing.lastRunAt ? new Date(marketing.lastRunAt).toISOString() : null,
            lastResultCount: marketing.lastResultCount ?? null,
            lastBoundingBox: marketing.lastBoundingBox ?? null,
            lastCenter: marketing.lastCenter ?? null,
            // IMPORTANT: Send ALL addresses from the plan (not limited like the discovery API response)
            // All addresses are merged and saved to the database, so the plan contains the complete set
            addresses: Array.isArray(marketing.addresses) ? marketing.addresses : []
          }
        : null;

      // Get tenant ID from store to pass to iframe
      const tenantId = get(currentTenant)?.id || null;
      
      targetWindow.postMessage(
        {
          source: 'shared-map',
          type: 'state-update',
          payload: {
            mode,
            tenantId, // Pass tenantId so iframe can set it in localStorage
            state: {
              mode: mapState.mode,
              activePlanId: mapState.activePlan?.id ?? null,
              activePlan: activePlanSummary,
              activePlanMarketing,
              stagedSummary: mapState.stagedSummary,
              stagedFeatures: mapState.stagedFeatures,
              productionHardware: mapState.productionHardware,
              lastUpdated: mapState.lastUpdated,
              capabilities: mapState.capabilities
            }
          }
        },
        '*'
      );
    } catch (err) {
      console.error('[SharedMap] Failed to post state to iframe:', err);
    }
  };

  const handleLoad = () => {
    iframeLoaded = true;
    iframeWindow = iframeEl?.contentWindow ?? null;
    postStateToIframe();
  };

  const requestCurrentExtent = () => {
    if (!iframeWindow) return;
    try {
      iframeWindow.postMessage(
        {
          source: 'shared-map',
          type: 'request-extent'
        },
        '*'
      );
    } catch (err) {
      console.error('[SharedMap] Failed to request extent from iframe:', err);
    }
  };

  const handleMessage = (event: MessageEvent) => {
    const { source, type } = event.data || {};
    if (source !== 'coverage-map') return;

    if (type === 'request-state') {
      const replyTarget = (event.source as Window) || iframeWindow;
      postStateToIframe(replyTarget);
    } else if (type === 'view-extent' && event.data?.payload) {
      dispatch('viewExtent', event.data.payload);
    } else if (type === 'rectangle-drawn') {
      // Forward rectangle-drawn messages to parent window (plan page)
      console.log('[SharedMap] Forwarding rectangle-drawn message to parent:', event.data);
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          source: 'coverage-map',
          type: 'rectangle-drawn',
          detail: event.data.detail
        }, '*');
        console.log('[SharedMap] Rectangle-drawn message forwarded to parent window');
      }
    } else if (type === 'asset-click') {
      // Forward asset-click messages (for right-click handling on sectors, towers, etc.)
      // The detail is in event.data.detail (not event.data itself)
      const assetClickDetail = event.data.detail || event.data;
      console.log('[SharedMap] 🔵 Forwarding asset-click message:', { 
        type, 
        detail: assetClickDetail,
        hasDetail: !!assetClickDetail,
        detailKeys: assetClickDetail ? Object.keys(assetClickDetail) : []
      });
      
      // Dispatch as a CustomEvent with the detail
      window.dispatchEvent(new CustomEvent('asset-click', {
        detail: assetClickDetail
      }));
      
      // Also forward to parent if we're in a nested iframe
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          source: 'coverage-map',
          type: 'asset-click',
          detail: assetClickDetail
        }, '*');
      }
    } else if (type === 'object-action') {
      // Handle object-action messages - we're already in the Deploy/Plan module context
      console.log('[SharedMap] 🔥 Received object-action message from iframe:', event.data);
      
      // For view-inventory, directly call the global handler (most reliable)
      if (event.data.action === 'view-inventory' && event.data.data?.tower) {
        console.log('[SharedMap] 🔥🔥🔥 Calling global handler for view-inventory directly');
        try {
          if (typeof (window as any).__deployHandleViewInventory === 'function') {
            (window as any).__deployHandleViewInventory(event.data.data.tower);
            console.log('[SharedMap] 🔥🔥🔥✅ Global handler called successfully');
          } else {
            console.warn('[SharedMap] ❌ Global handler not found on window');
          }
        } catch (err) {
          console.error('[SharedMap] ❌ Error calling global handler:', err);
        }
      }
      
      // Also dispatch a custom event for other handlers to catch
      const customEvent = new CustomEvent('iframe-object-action', {
        detail: {
          objectId: event.data.objectId,
          action: event.data.action,
          data: event.data.data,
          allowed: true
        }
      });
      window.dispatchEvent(customEvent);
      console.log('[SharedMap] 🔥✅ Dispatched iframe-object-action event');
      
      // Also forward to parent if we're in a nested iframe (fallback)
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          source: 'coverage-map',
          type: 'object-action',
          objectId: event.data.objectId,
          action: event.data.action,
          data: event.data.data
        }, '*');
        console.log('[SharedMap] 🔥✅ Also forwarded to parent window (nested iframe case)');
      }
    }
  };

  const handleRequestExtentEvent = () => {
    requestCurrentExtent();
  };

  onMount(() => {
    window.addEventListener('message', handleMessage);
    window.addEventListener('request-map-extent', handleRequestExtentEvent);

    unsubscribe = mapContext.subscribe(state => {
      mapState = state;
      const navKey = buildNavigationKey(state);
      const nextUrl = buildUrl(state);
      if (navKey !== currentNavKey || !currentUrl) {
        currentNavKey = navKey;
        navigateIframe(nextUrl);
      } else {
        postStateToIframe();
      }
    });

    currentNavKey = buildNavigationKey(mapState);
    navigateIframe(buildUrl(mapState));
  });

  onDestroy(() => {
    window.removeEventListener('message', handleMessage);
    window.removeEventListener('request-map-extent', handleRequestExtentEvent);
    unsubscribe?.();
  });

  $: if (iframeEl) {
    const nextUrl = buildUrl(mapState);
    const navKey = buildNavigationKey(mapState);
    if (navKey !== currentNavKey) {
      currentNavKey = navKey;
      navigateIframe(nextUrl);
    } else if (iframeLoaded) {
      postStateToIframe();
    }
  }

  $: if (mode && iframeLoaded) {
    postStateToIframe();
  }
  
  // Explicitly watch for activePlan and marketing addresses changes to ensure map refreshes
  // This ensures the map refreshes when marketing addresses change after wizard completion
  $: marketingAddressCount = mapState?.activePlan?.marketing?.addresses?.length ?? 0;
  $: activePlanId = mapState?.activePlan?.id ?? null;
  $: lastUpdatedTimestamp = mapState?.lastUpdated?.getTime() ?? 0;
  $: if (iframeLoaded && activePlanId && lastUpdatedTimestamp > 0) {
    // Post state to iframe whenever activePlan changes, marketing addresses are updated, or lastUpdated changes
    postStateToIframe();
  }
</script>

<div class="shared-map">
  <iframe
    bind:this={iframeEl}
    class="coverage-map-iframe"
    title={`${mode} map`}
    loading="lazy"
    allow="geolocation"
    on:load={handleLoad}
  />

  {#if !iframeLoaded}
    <div class="shared-map__loading">
      <div class="spinner" />
      <span>Loading map…</span>
    </div>
  {/if}
</div>

<style>
  .shared-map {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: var(--border-radius-lg);
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.15);
    background: var(--bg-primary, #0f172a);
  }

  .coverage-map-iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }

  .shared-map__loading {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 64, 175, 0.75));
    color: #e2e8f0;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 3px solid rgba(148, 163, 184, 0.25);
    border-top-color: #38bdf8;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
