<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { mapContext } from './mapContext';
  import type { MapModuleMode } from './MapCapabilities';

  export let mode: MapModuleMode = 'plan';

  let iframeEl: HTMLIFrameElement | null = null;
  let iframeLoaded = false;
  let currentUrl = '';
  let mapState = get(mapContext);

  let unsubscribe: (() => void) | undefined;

  const buildUrl = () => {
    const params = new URLSearchParams();

    if (mode === 'plan') {
      params.set('hideStats', 'true');
      params.set('planMode', 'true');
    } else if (mode === 'deploy') {
      params.set('deployMode', 'true');
    } else {
      params.set('hideStats', 'true');
    }

    const planId = mapState?.activePlan?.id;
    if (planId) {
      params.set('planId', planId);
    }

    const query = params.toString();
    return query ? `/modules/coverage-map?${query}` : '/modules/coverage-map';
  };

  const updateIframeSrc = (force = false) => {
    if (!iframeEl) return;
    const nextUrl = buildUrl();
    if (force || nextUrl !== currentUrl) {
      currentUrl = nextUrl;
      iframeLoaded = false;
      iframeEl.src = nextUrl;
    }
  };

  const handleLoad = () => {
    iframeLoaded = true;
  };

  onMount(() => {
    unsubscribe = mapContext.subscribe(state => {
      mapState = state;
      updateIframeSrc();
    });

    updateIframeSrc(true);
  });

  onDestroy(() => {
    unsubscribe?.();
  });

  $: if (iframeEl) {
    updateIframeSrc();
  }

  $: if (mode) {
    updateIframeSrc();
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
