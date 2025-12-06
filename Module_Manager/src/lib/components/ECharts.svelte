<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import * as echarts from 'echarts';
  import type { EChartsOption } from 'echarts';

  export let option: EChartsOption;
  export let height: number = 300;
  export let theme: string | object = 'dark'; // Can be 'light', 'dark', or custom theme object
  export let loading: boolean = false;

  let chartContainer: HTMLDivElement;
  let chart: echarts.ECharts | null = null;
  let mounted = false;

  // Initialize chart when mounted
  onMount(async () => {
    mounted = true;
    await tick();
    initChart();
  });

  // Cleanup on destroy
  onDestroy(() => {
    mounted = false;
    destroyChart();
  });

  function initChart() {
    if (!chartContainer || !mounted) {
      console.log('[ECharts] Skipping initialization - container:', !!chartContainer, 'mounted:', mounted);
      return;
    }

    try {
      // Initialize ECharts instance
      console.log('[ECharts] Initializing chart instance with theme:', theme);
      chart = echarts.init(chartContainer, theme);
      console.log('[ECharts] Chart instance created successfully');

      // Set initial option
      if (option) {
        chart.setOption(option, true);
        console.log('[ECharts] Chart option set');
      } else {
        console.log('[ECharts] No option provided yet');
      }

      // Handle window resize
      window.addEventListener('resize', handleResize);
    } catch (error) {
      console.error('[ECharts] Failed to initialize chart:', error);
    }
  }

  function destroyChart() {
    if (chart) {
      try {
        window.removeEventListener('resize', handleResize);
        chart.dispose();
      } catch (error) {
        console.error('[ECharts] Error disposing chart:', error);
      }
      chart = null;
    }
  }

  function handleResize() {
    if (chart) {
      chart.resize();
    }
  }

  // Update chart when option changes
  $: if (chart && option && mounted) {
    try {
      chart.setOption(option, true);
    } catch (error) {
      console.error('[ECharts] Failed to update chart:', error);
    }
  }

  // Handle loading state
  $: if (chart && mounted) {
    if (loading) {
      chart.showLoading('default', {
        text: 'Loading...',
        color: '#3b82f6',
        textColor: '#94a3b8',
        maskColor: 'rgba(15, 23, 42, 0.8)'
      });
    } else {
      chart.hideLoading();
    }
  }

  // Handle theme changes
  $: if (chart && theme && mounted) {
    destroyChart();
    initChart();
  }
</script>

<div 
  bind:this={chartContainer} 
  style="width: 100%; height: {height}px;"
  class="echarts-container"
></div>

<style>
  .echarts-container {
    position: relative;
  }
</style>

