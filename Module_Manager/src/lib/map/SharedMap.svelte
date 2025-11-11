<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { browser, version as appVersion } from '$app/environment';
  import { get } from 'svelte/store';
  import { mapContext } from './mapContext';
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

  const coverageMapHost = (() => {
    if (!browser) return '';

    const envHost = import.meta.env.VITE_COVERAGE_MAP_HOST;
    if (envHost && typeof envHost === 'string') {
      return envHost.replace(/\/$/, '');
    }

    const origin = window.location.origin;
    if (origin.includes('wisptools.io')) {
      return 'https://wisptools-production.web.app';
    }

    return origin;
  })();

  const buildUrl = (state: MapLayerState = mapState) => {
    const params = new URLSearchParams();

    if (mode === 'plan') {
      params.set('hideStats', 'true');
      params.set('planMode', 'true');
    } else if (mode === 'deploy') {
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
    iframeEl.src = nextUrl;
  };

  const postStateToIframe = (targetWindow: Window | null = iframeWindow) => {
    if (!targetWindow) return;

    try {
      targetWindow.postMessage(
        {
          source: 'shared-map',
          type: 'state-update',
          payload: {
            mode,
            state: {
              mode: mapState.mode,
              activePlanId: mapState.activePlan?.id ?? null,
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

  const handleMessage = (event: MessageEvent) => {
    const { source, type } = event.data || {};
    if (source !== 'coverage-map') return;

    if (type === 'request-state') {
      const replyTarget = (event.source as Window) || iframeWindow;
      postStateToIframe(replyTarget);
    } else if (type === 'view-extent' && event.data?.payload) {
      dispatch('viewExtent', event.data.payload);
    }
  };

  onMount(() => {
    window.addEventListener('message', handleMessage);

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
