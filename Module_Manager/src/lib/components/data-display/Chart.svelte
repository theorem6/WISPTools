<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, type ChartConfiguration } from '$lib/chartSetup';

  export let config: ChartConfiguration;
  export let height: number = 300;

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;
  let error: string = '';
  let mounted = false;

  onMount(() => {
    mounted = true;
    createChart();
  });

  onDestroy(() => {
    mounted = false;
    destroyChart();
  });

  function createChart() {
    try {
      if (!canvas) {
        console.error('Canvas element not found');
        error = 'Canvas element not initialized';
        return;
      }

      // Ensure canvas has dimensions
      if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) {
        console.warn('Canvas has zero dimensions, retrying...');
        setTimeout(createChart, 100);
        return;
      }

      console.log('Creating chart with config:', config);
      chart = new Chart(canvas, config);
      console.log('Chart created successfully');
      error = '';
    } catch (e) {
      console.error('Failed to create chart:', e);
      error = e instanceof Error ? e.message : 'Unknown error';
    }
  }

  function destroyChart() {
    if (chart) {
      try {
        chart.destroy();
      } catch (e) {
        console.error('Error destroying chart:', e);
      }
      chart = null;
    }
  }

  // Update chart when config changes
  $: if (chart && config && mounted) {
    try {
      // Destroy and recreate for major config changes
      destroyChart();
      createChart();
    } catch (e) {
      console.error('Failed to update chart:', e);
      error = e instanceof Error ? e.message : 'Update failed';
    }
  }
</script>

{#if error}
  <div class="chart-error">
    ⚠️ Chart Error: {error}
    <br><small>Check console for details</small>
  </div>
{:else}
  <div class="chart-container" style="height: {height}px;">
    <canvas bind:this={canvas}></canvas>
  </div>
{/if}

<style>
  .chart-container {
    position: relative;
    width: 100%;
  }

  canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }

  .chart-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    color: #ef4444;
    padding: 1.5rem;
    border-radius: 0.5rem;
    text-align: center;
    min-height: 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .chart-error small {
    margin-top: 0.5rem;
    opacity: 0.7;
  }
</style>

