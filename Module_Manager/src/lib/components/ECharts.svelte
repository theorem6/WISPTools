<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import * as echarts from 'echarts';
  import type { EChartsOption } from 'echarts';

  export let option: EChartsOption | null = null;
  export let height: number = 300;
  export let theme: string | object = 'dark'; // Can be 'light', 'dark', or custom theme object
  export let loading: boolean = false;

  let chartContainer: HTMLDivElement;
  let chart: echarts.ECharts | null = null;
  let mounted = false;
  let currentTheme: string | object = theme;
  let isInitializing = false;
  let initTimeout: ReturnType<typeof setTimeout> | null = null;

  // Initialize chart when mounted
  onMount(async () => {
    mounted = true;
    await tick();
    initChart();
  });

  // Cleanup on destroy
  onDestroy(() => {
    mounted = false;
    if (initTimeout) {
      clearTimeout(initTimeout);
      initTimeout = null;
    }
    if (updateTimeout) {
      clearTimeout(updateTimeout);
      updateTimeout = null;
    }
    destroyChart();
  });

  function initChart() {
    if (!chartContainer || !mounted || isInitializing) {
      return;
    }

    // If chart already exists, don't re-initialize - just update the option
    if (chart) {
      if (option) {
        try {
          chart.setOption(option, false);
        } catch (error) {
          console.error('[ECharts] Failed to update existing chart:', error);
        }
      }
      return;
    }

    isInitializing = true;

    try {
      // Initialize ECharts instance
      chart = echarts.init(chartContainer, theme);
      currentTheme = theme;

      // Set initial option
      if (option) {
        chart.setOption(option, true);
      }

      // Handle window resize
      window.addEventListener('resize', handleResize);
    } catch (error) {
      console.error('[ECharts] Failed to initialize chart:', error);
      chart = null;
    } finally {
      isInitializing = false;
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

  // Update chart when option changes - only update, don't re-initialize
  // Use a debounce to prevent rapid-fire updates
  let updateTimeout: ReturnType<typeof setTimeout> | null = null;
  
  $: if (chart && option && mounted && !isInitializing) {
    // Clear any pending update
    if (updateTimeout) {
      clearTimeout(updateTimeout);
      updateTimeout = null;
    }
    
    // Debounce updates to batch rapid changes
    updateTimeout = setTimeout(() => {
      if (chart && option && mounted && !isInitializing) {
        try {
          // Use notMerge: false to update incrementally instead of replacing
          // This allows smooth updates without full re-initialization
          chart.setOption(option, false);
        } catch (error: any) {
          console.error('[ECharts] Failed to update chart:', error);
          // If update fails because chart was disposed, mark it as null
          if (error?.message?.includes('disposed') || error?.message?.includes('not initialized')) {
            chart = null;
            // Re-initialization will happen via the reactive statement below
          }
        }
      }
      updateTimeout = null;
    }, 50);
  }

  // Handle theme changes - only re-initialize if theme actually changed
  // Compare theme values properly (handle both string and object themes)
  $: if (chart && mounted) {
    const themeChanged = typeof theme === 'string' && typeof currentTheme === 'string'
      ? theme !== currentTheme
      : JSON.stringify(theme) !== JSON.stringify(currentTheme);
    
    if (themeChanged) {
      destroyChart();
      // Chart will be re-initialized by the reactive statement below
    }
  }

  // Re-initialize if chart doesn't exist but option is available
  // This handles both initial mount and re-initialization after theme change
  // Use debouncing to prevent multiple initializations from rapid reactive updates
  $: if (!chart && option && mounted && chartContainer && !isInitializing) {
    // Clear any pending initialization
    if (initTimeout) {
      clearTimeout(initTimeout);
      initTimeout = null;
    }
    // Use a small delay to batch multiple reactive triggers and prevent race conditions
    initTimeout = setTimeout(() => {
      // Double-check conditions haven't changed during the delay
      if (!chart && option && mounted && chartContainer && !isInitializing) {
        initChart();
      }
      initTimeout = null;
    }, 10);
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

