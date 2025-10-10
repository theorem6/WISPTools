<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, type ChartConfiguration } from 'chart.js';

  export let config: ChartConfiguration;
  export let height: number = 300;

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  onMount(() => {
    if (canvas) {
      chart = new Chart(canvas, config);
    }
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
    }
  });

  // Update chart when config changes
  $: if (chart && config) {
    chart.data = config.data;
    if (config.options) {
      chart.options = config.options;
    }
    chart.update();
  }
</script>

<canvas bind:this={canvas} style="max-height: {height}px;"></canvas>

