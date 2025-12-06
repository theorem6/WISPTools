<script lang="ts">
  import ECharts from '$lib/components/ECharts.svelte';
  import type { EChartsOption } from 'echarts';
  import type { TR069CellularMetrics } from '../lib/tr069MetricsService';

  export let metrics: TR069CellularMetrics[] = [];

  // Detect PCI changes (handovers)
  $: pciChanges = metrics.map((m, i) => {
    if (i === 0) return false;
    return m.pci !== metrics[i - 1].pci;
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
          const idx = params[0].dataIndex;
          const value = params[0].value;
          const changed = pciChanges[idx];
          const mod3 = value % 3;
          const mod6 = value % 6;
          const mod30 = value % 30;
          const label = changed ? `${params[0].axisValue} (Handover)` : params[0].axisValue;
          return `${label}<br/>PCI: ${value}<br/>Mod3: ${mod3}<br/>Mod6: ${mod6}<br/>Mod30: ${mod30}`;
        }
        return '';
      }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: metrics.map((m, i) => {
        const time = new Date(m.timestamp);
        const label = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return pciChanges[i] ? `${label} 🔄` : label;
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
      name: 'Physical Cell ID',
      nameLocation: 'middle',
      nameGap: 50,
      nameTextStyle: { color: '#9ca3af', fontSize: 11 },
      min: 0,
      max: 503,
      interval: 50,
      axisLabel: { color: '#9ca3af', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(75, 85, 99, 0.2)' } }
    },
    series: [
      {
        name: 'Physical Cell ID (PCI)',
        type: 'line',
        step: 'start',
        data: metrics.map((m, i) => ({
          value: m.pci,
          itemStyle: {
            color: pciChanges[i] ? '#ef4444' : '#8b5cf6'
          },
          symbolSize: pciChanges[i] ? 8 : 6
        })),
        areaStyle: {
          color: (params: any) => {
            const idx = params.dataIndex;
            return pciChanges[idx] ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.1)';
          }
        },
        lineStyle: { width: 2 }
      }
    ]
  } satisfies EChartsOption;

  $: handoverCount = pciChanges.filter(Boolean).length;
</script>

<div class="chart-container">
  <div class="chart-header">
    <h3 class="chart-title">Physical Cell ID (PCI) Tracking</h3>
    {#if handoverCount > 0}
      <span class="handover-badge">
        🔄 {handoverCount} handover{handoverCount > 1 ? 's' : ''}
      </span>
    {/if}
  </div>
  <div class="chart-wrapper">
    <ECharts option={option} height={300} theme="dark" />
  </div>
  <div class="chart-info">
    <span class="info-item">📍 Current PCI: {metrics.length > 0 ? metrics[metrics.length - 1].pci : 'N/A'}</span>
    <span class="info-item">📶 Handovers detected: {handoverCount}</span>
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

  .handover-badge {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
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
  }

  .info-item {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
</style>
