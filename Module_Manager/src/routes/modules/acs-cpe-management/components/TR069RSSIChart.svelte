<script lang="ts">
  import ECharts from '$lib/components/ECharts.svelte';
  import type { EChartsOption } from 'echarts';
  import type { TR069CellularMetrics } from '../lib/tr069MetricsService';

  export let metrics: TR069CellularMetrics[] = [];

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
      axisPointer: { lineStyle: { color: 'rgba(59, 130, 246, 0.5)' } }
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
      name: 'Signal Strength (dBm)',
      nameLocation: 'middle',
      nameGap: 50,
      nameTextStyle: { color: '#9ca3af', fontSize: 11 },
      min: -110,
      max: -40,
      axisLabel: { color: '#9ca3af', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(75, 85, 99, 0.2)' } }
    },
    series: [
      {
        name: 'RSSI (dBm)',
        type: 'line',
        data: metrics.map((m) => m.rssi),
        itemStyle: { color: '#06b6d4' },
        areaStyle: { color: 'rgba(6, 182, 212, 0.2)' },
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2 }
      },
      {
        name: 'RSCP (dBm)',
        type: 'line',
        data: metrics.map((m) => m.rscp),
        itemStyle: { color: '#14b8a6' },
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2 }
      }
    ]
  } satisfies EChartsOption;
</script>

<div class="chart-container">
  <h3 class="chart-title">RSSI & RSCP (TR-069 Parameters)</h3>
  <div class="chart-wrapper">
    <ECharts option={option} height={300} theme="dark" />
  </div>
  <div class="chart-legend-info">
    <div class="legend-item">
      <span class="legend-dot" style="background: #06b6d4;"></span>
      <span>RSSI: Received Signal Strength Indicator</span>
    </div>
    <div class="legend-item">
      <span class="legend-dot" style="background: #14b8a6;"></span>
      <span>RSCP: Received Signal Code Power</span>
    </div>
  </div>
</div>

<style>
  .chart-container {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .chart-title {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .chart-wrapper {
    height: 300px;
    position: relative;
  }

  .chart-legend-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>
