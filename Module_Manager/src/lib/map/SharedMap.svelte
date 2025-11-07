<script lang="ts">
  import { onMount } from 'svelte';
  import { mapContext } from './mapContext';
  import type { MapModuleMode } from './MapCapabilities';

  export let mode: MapModuleMode = 'plan';

  let canvas: HTMLDivElement;
  let initialized = false;
  let currentState;

  const unsubscribe = mapContext.subscribe(state => {
    currentState = state;
    if (initialized) {
      renderState();
    }
  });

  onMount(() => {
    initialized = true;
    renderState();
    return () => {
      initialized = false;
      unsubscribe();
    };
  });

  function renderState() {
    if (!canvas) return;
    canvas.setAttribute('data-mode', currentState?.mode || mode);
    canvas.setAttribute('data-staged-count', String(currentState?.stagedSummary?.total || 0));
    canvas.setAttribute('data-production-count', String(currentState?.productionHardware?.length || 0));
  }
</script>

<div class="shared-map" bind:this={canvas}>
  <div class="shared-map__overlay">
    <h3>{mode.toUpperCase()} MODE</h3>
    <p>{currentState?.productionHardware?.length || 0} production assets loaded</p>
    <p>{currentState?.stagedSummary?.total || 0} staged features</p>
    {#if currentState?.isLoading}
      <div class="shared-map__loading">Loading map data…</div>
    {/if}
    {#if currentState?.error}
      <div class="shared-map__error">{currentState.error}</div>
    {/if}
  </div>
</div>

<style>
  .shared-map {
    position: relative;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at center, rgba(59, 130, 246, 0.2), rgba(15, 23, 42, 0.9));
    border-radius: var(--border-radius-lg);
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .shared-map__overlay {
    background: rgba(2, 6, 23, 0.6);
    color: var(--text-primary, #e2e8f0);
    padding: 1.5rem 2rem;
    border-radius: var(--border-radius-md);
    text-align: center;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(8px);
  }

  .shared-map__overlay h3 {
    margin: 0 0 0.5rem;
    letter-spacing: 0.2em;
  }

  .shared-map__overlay p {
    margin: 0.25rem 0;
  }

  .shared-map__loading {
    margin-top: 1rem;
    color: #38bdf8;
  }

  .shared-map__error {
    margin-top: 0.75rem;
    color: #f87171;
  }
</style>


