<script lang="ts">
  import ECharts from '$lib/components/ECharts.svelte';
  import type { EChartsOption } from 'echarts';
  import type { TR069CellularMetrics } from '../lib/tr069MetricsService';
  import { getSINRQuality } from '../lib/tr069MetricsService';

  export let metrics: TR069CellularMetrics[] = [];

  // Color segments based on SINR quality
  $: segmentColors = metrics.map(m => {
    const quality = getSINRQuality(m.sinr);
    return quality.color;
  });

  $: option = {
    grid: { top: 50, right: 30, bottom: 50, left: 70 },
    legend: {
      top: 10,
      textStyle: { color: '#9ca3af' },
      icon: 'circle'
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      borderColor: 'rgba(59, 130, 246, 0.3)',
      borderWidth: 1,
      textStyle: { color: '#cbd5e1' },
      axisPointer: { lineStyle: { color: 'rgba(59, 130, 246, 0.5)' } },
      formatter: (params: any) => {
        if (Array.isArray(params) && params[0]) {
          const value = params[0].value;
          const quality = getSINRQuality(value);
          return `${params[0].axisValue}<br/>SINR: ${value.toFixed(1)} dB<br/>Quality: ${quality.label}`;
        }
        return '';
      }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: metrics.map((m) => {
        const time = new Date(m.timestamp);
        return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      }),
      axisLabel: {
        color: '#9ca3af',
        fontSize: 10,
        rotate: 45
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      name: 'SINR (dB)',
      nameLocation: 'middle',
      nameGap: 50,
      nameTextStyle: { color: '#9ca3af', fontSize: 11 },
      axisLabel: { color: '#9ca3af', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(75, 85, 99, 0.2)' } }
    },
    series: [
      {
        name: 'SINR (dB)',
        type: 'line',
        data: metrics.map((m, i) => ({
          value: m.sinr,
          itemStyle: { color: segmentColors[i] }
        })),
        areaStyle: { color: 'rgba(139, 92, 246, 0.2)' },
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { 
          width: 2,
          color: (params: any) => segmentColors[params.dataIndex] || '#8b5cf6'
        }
      }
    ]
  } satisfies EChartsOption;

  $: avgSINR = metrics.length > 0 
    ? (metrics.reduce((sum, m) => sum + m.sinr, 0) / metrics.length).toFixed(1)
    : '0';

  $: currentSINR = metrics.length > 0 ? metrics[metrics.length - 1].sinr : 0;
  $: currentQuality = getSINRQuality(currentSINR);
</script>

<div class="chart-container">
  <div class="chart-header">
    <h3 class="chart-title">SINR - Signal Quality (TR-069)</h3>
    <span class="quality-badge" style="background: {currentQuality.color}20; color: {currentQuality.color};">
      {currentQuality.label}
    </span>
  </div>
  <div class="chart-wrapper">
    <ECharts option={option} height={300} theme="dark" />
  </div>
  <div class="chart-info">
    <span class="info-item">📊 Current: {currentSINR.toFixed(1)} dB</span>
    <span class="info-item">📈 Average: {avgSINR} dB</span>
    <span class="info-item">
      📋 Path: <code>Device.Cellular.Interface.1.SINR</code>
    </span>
  </div>
</div>

<style>
  .chart-container {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .chart-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .quality-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .chart-wrapper {
    height: 300px;
    position: relative;
  }

  .chart-info {
    display: flex;
    gap: 2rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
    flex-wrap: wrap;
  }

  .info-item {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .info-item code {
    background: var(--bg-tertiary);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: monospace;
    font-size: 0.75rem;
  }
</style>
