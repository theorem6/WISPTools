<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import * as echarts from 'echarts';
  import type { EChartsOption } from 'echarts';
  import type { ChartConfiguration } from '$lib/chartSetup';

  // Support both Chart.js style configs (for backward compatibility) and new ECharts options
  export let config: ChartConfiguration | EChartsOption;
  export let height: number = 300;
  export let theme: string | object = 'dark';

  let chartContainer: HTMLDivElement;
  let chart: echarts.ECharts | null = null;
  let mounted = false;
  let option: EChartsOption | null = null;

  // Convert Chart.js config to ECharts option (for backward compatibility during migration)
  function convertChartJSConfig(chartConfig: any): EChartsOption | null {
    if (!chartConfig || !chartConfig.data || !chartConfig.data.labels) {
      return null;
    }

    // Check if it's already an ECharts option
    if (chartConfig.xAxis || chartConfig.yAxis || chartConfig.series) {
      return chartConfig as EChartsOption;
    }

    // Convert Chart.js config to ECharts
    const labels = chartConfig.data.labels || [];
    const datasets = chartConfig.data.datasets || [];
    const scales = chartConfig.options?.scales || {};
    
    // Check for dual Y-axes
    const hasY1 = datasets.some((d: any) => d.yAxisID === 'y1');
    const yScale = scales.y || {};
    const y1Scale = scales.y1 || {};
    
    // Convert labels to timestamps if they look like dates
    const timeLabels = labels.map((label: string) => {
      const date = new Date(label);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
      return label;
    });

    const isTimeAxis = typeof timeLabels[0] === 'number';

    // Build Y-axis array (support dual axes)
    const yAxes: any[] = [{
      type: 'value',
      name: yScale.title?.text || undefined,
      nameLocation: yScale.title?.display ? 'middle' : undefined,
      nameGap: yScale.title?.display ? (hasY1 ? 60 : 50) : undefined,
      nameTextStyle: { color: yScale.title?.color || '#94a3b8', fontSize: 11 },
      position: yScale.position || 'left',
      min: yScale.min,
      max: yScale.max,
      axisLabel: {
        color: '#9ca3af',
        fontSize: 11,
        formatter: yScale.ticks?.callback 
          ? (value: any) => {
              try {
                return yScale.ticks.callback(value);
              } catch {
                return value;
              }
            }
          : undefined
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { 
        show: yScale.grid?.display !== false && yScale.grid?.drawOnChartArea !== false,
        lineStyle: { color: 'rgba(255,255,255,0.05)' }
      }
    }];

    if (hasY1 && y1Scale) {
      yAxes.push({
        type: 'value',
        name: y1Scale.title?.text || undefined,
        nameLocation: y1Scale.title?.display ? 'middle' : undefined,
        nameGap: y1Scale.title?.display ? 60 : undefined,
        nameTextStyle: { color: y1Scale.title?.color || '#94a3b8', fontSize: 11 },
        position: y1Scale.position || 'right',
        min: y1Scale.min,
        max: y1Scale.max,
        axisLabel: {
          color: '#9ca3af',
          fontSize: 11,
          formatter: y1Scale.ticks?.callback 
            ? (value: any) => {
                try {
                  return y1Scale.ticks.callback(value);
                } catch {
                  return value;
                }
              }
            : undefined
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { 
          show: y1Scale.grid?.drawOnChartArea !== false,
          lineStyle: { color: 'rgba(255,255,255,0.05)' }
        }
      });
    }

    const series = datasets.map((dataset: any, idx: number) => {
      const data = timeLabels.map((label: any, i: number) => {
        const value = dataset.data?.[i];
        return isTimeAxis ? [label, value] : value;
      });

      // Handle per-point colors
      const hasPointColors = Array.isArray(dataset.pointBackgroundColor) || Array.isArray(dataset.borderColor);
      
      return {
        name: dataset.label || `Series ${idx + 1}`,
        type: 'line',
        yAxisIndex: dataset.yAxisID === 'y1' ? 1 : 0,
        data: data,
        smooth: dataset.tension && dataset.tension > 0,
        step: dataset.stepped === 'before' ? 'start' : dataset.stepped === 'after' ? 'end' : undefined,
        itemStyle: {
          color: (params: any) => {
            if (hasPointColors) {
              const color = dataset.pointBackgroundColor?.[params.dataIndex] || dataset.borderColor?.[params.dataIndex];
              if (color) return color;
            }
            return dataset.borderColor || dataset.pointBackgroundColor || undefined;
          }
        },
        areaStyle: dataset.fill ? {
          color: Array.isArray(dataset.backgroundColor) 
            ? (params: any) => dataset.backgroundColor[params.dataIndex] || 'rgba(0, 0, 0, 0.1)'
            : dataset.backgroundColor || 'rgba(0, 0, 0, 0.1)'
        } : undefined,
        lineStyle: {
          width: dataset.borderWidth || 2,
          color: Array.isArray(dataset.borderColor) 
            ? undefined  // Let itemStyle handle it
            : dataset.borderColor
        },
        symbol: dataset.pointRadius === 0 ? 'none' : 'circle',
        symbolSize: (params: any) => {
          if (Array.isArray(dataset.pointRadius)) {
            return dataset.pointRadius[params.dataIndex] || 4;
          }
          return dataset.pointRadius || 4;
        }
      };
    });

    const xScale = scales.x || {};

    return {
      grid: { top: hasY1 ? 50 : 40, right: hasY1 ? 80 : 30, bottom: 50, left: 60 },
      legend: {
        show: chartConfig.options?.plugins?.legend?.display !== false,
        top: 10,
        textStyle: { color: '#9ca3af' }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: chartConfig.options?.plugins?.tooltip?.backgroundColor || 'rgba(15, 23, 42, 0.95)',
        borderColor: chartConfig.options?.plugins?.tooltip?.borderColor || 'rgba(59, 130, 246, 0.3)',
        borderWidth: chartConfig.options?.plugins?.tooltip?.borderWidth || 1,
        textStyle: { 
          color: chartConfig.options?.plugins?.tooltip?.bodyColor || '#cbd5e1' 
        },
        formatter: (params: any) => {
          // Use Chart.js custom tooltip callback if provided
          if (chartConfig.options?.plugins?.tooltip?.callbacks) {
            const callbacks = chartConfig.options.plugins.tooltip.callbacks;
            if (callbacks.title) {
              // Title callback
              try {
                const titles = callbacks.title([{ dataIndex: params[0]?.dataIndex || 0, label: params[0]?.axisValue || '' }]);
                return titles;
              } catch (e) {
                console.warn('Tooltip title callback error:', e);
              }
            }
            // Label callbacks handled per series
          }
          // Default ECharts formatter
          return undefined;
        }
      },
      xAxis: {
        type: isTimeAxis ? 'time' : 'category',
        boundaryGap: false,
        data: isTimeAxis ? undefined : labels,
        axisLabel: {
          color: '#9ca3af',
          fontSize: 10,
          rotate: xScale.ticks?.maxRotation || 0
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { 
          show: xScale.grid?.display !== false,
          lineStyle: { color: 'rgba(255,255,255,0.05)' }
        }
      },
      yAxis: hasY1 ? yAxes : yAxes[0],
      series: series
    };
  }

  onMount(async () => {
    mounted = true;
    await tick();
    initChart();
  });

  onDestroy(() => {
    mounted = false;
    destroyChart();
  });

  function initChart() {
    if (!chartContainer || !mounted) {
      return;
    }

    try {
      chart = echarts.init(chartContainer, theme);

      if (config) {
        option = convertChartJSConfig(config);
        if (option) {
          chart.setOption(option, true);
        }
      }

      window.addEventListener('resize', handleResize);
    } catch (error) {
      console.error('[Chart] Failed to initialize:', error);
    }
  }

  function destroyChart() {
    if (chart) {
      try {
        window.removeEventListener('resize', handleResize);
        chart.dispose();
      } catch (error) {
        console.error('[Chart] Error disposing:', error);
      }
      chart = null;
    }
  }

  function handleResize() {
    if (chart) {
      chart.resize();
    }
  }

  // Update chart when config changes
  $: if (chart && config && mounted) {
    try {
      option = convertChartJSConfig(config);
      if (option) {
        chart.setOption(option, true);
      }
    } catch (error) {
      console.error('[Chart] Failed to update:', error);
    }
  }
</script>

<div 
  bind:this={chartContainer} 
  style="width: 100%; height: {height}px;"
  class="chart-container"
></div>

<style>
  .chart-container {
    position: relative;
  }
</style>
