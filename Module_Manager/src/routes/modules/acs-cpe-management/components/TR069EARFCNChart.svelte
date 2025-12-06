<script lang="ts">
  import ECharts from '$lib/components/ECharts.svelte';
  import type { EChartsOption } from 'echarts';
  import type { TR069CellularMetrics } from '../lib/tr069MetricsService';
  import { getLTEBandName } from '../lib/tr069MetricsService';

  export let metrics: TR069CellularMetrics[] = [];

  // Detect EARFCN/Band changes
  $: earfcnChanges = metrics.map((m, i) => {
    if (i === 0) return false;
    return m.earfcn !== metrics[i - 1].earfcn;
  });

  $: option = {
    grid: { top: 50, right: 80, bottom: 50, left: 70 },
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
        if (Array.isArray(params)) {
          const idx = params[0]?.dataIndex ?? 0;
          const earfcnParam = params.find((p: any) => p.seriesName === 'EARFCN');
          const bandParam = params.find((p: any) => p.seriesName === 'LTE Band');
          const changed = earfcnChanges[idx];
          const label = changed ? `${params[0].axisValue} (Frequency Change)` : params[0].axisValue;
          let result = label;
          if (earfcnParam) {
            const band = metrics[idx]?.band ?? 0;
            result += `<br/>EARFCN: ${earfcnParam.value}<br/>Band: ${getLTEBandName(band)}`;
          }
          if (bandParam) {
            result += `<br/>Band: ${getLTEBandName(bandParam.value / 1000)}`;
          }
          return result;
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
        return earfcnChanges[i] ? `${label} 📡` : label;
      }),
      axisLabel: {
        color: '#9ca3af',
        fontSize: 10,
        rotate: 45
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        name: 'EARFCN',
        nameLocation: 'middle',
        nameGap: 50,
        nameTextStyle: { color: '#ec4899', fontSize: 11 },
        position: 'left',
        axisLabel: { color: '#9ca3af', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { lineStyle: { color: 'rgba(75, 85, 99, 0.2)' } }
      },
      {
        type: 'value',
        name: 'Band',
        nameLocation: 'middle',
        nameGap: 60,
        nameTextStyle: { color: '#f59e0b', fontSize: 11 },
        position: 'right',
        axisLabel: { 
          color: '#9ca3af', 
          fontSize: 11,
          formatter: (value: number) => `Band ${value / 1000}`
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: 'EARFCN',
        type: 'line',
        yAxisIndex: 0,
        step: 'start',
        data: metrics.map((m, i) => ({
          value: m.earfcn,
          itemStyle: {
            color: earfcnChanges[i] ? '#ef4444' : '#ec4899'
          },
          symbolSize: earfcnChanges[i] ? 8 : 6
        })),
        areaStyle: {
          color: (params: any) => {
            const idx = params.dataIndex;
            return earfcnChanges[idx] ? 'rgba(239, 68, 68, 0.3)' : 'rgba(236, 72, 153, 0.1)';
          }
        },
        lineStyle: { width: 2 }
      },
      {
        name: 'LTE Band',
        type: 'line',
        yAxisIndex: 1,
        step: 'start',
        data: metrics.map((m) => m.band * 1000), // Scale for visibility
        itemStyle: { color: '#f59e0b' },
        lineStyle: { width: 2 }
      }
    ]
  } satisfies EChartsOption;

  $: frequencyChanges = earfcnChanges.filter(Boolean).length;
  $: currentEARFCN = metrics.length > 0 ? metrics[metrics.length - 1].earfcn : 0;
  $: currentBand = metrics.length > 0 ? metrics[metrics.length - 1].band : 0;
</script>

<div class="chart-container">
  <div class="chart-header">
    <h3 class="chart-title">EARFCN & Band Tracking</h3>
    {#if frequencyChanges > 0}
      <span class="change-badge">
        📡 {frequencyChanges} frequency change{frequencyChanges > 1 ? 's' : ''}
      </span>
    {/if}
  </div>
  <div class="chart-wrapper">
    <ECharts option={option} height={300} theme="dark" />
  </div>
  <div class="chart-info">
    <span class="info-item">📡 Current EARFCN: {currentEARFCN}</span>
    <span class="info-item">📻 {getLTEBandName(currentBand)}</span>
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

  .change-badge {
    background: rgba(236, 72, 153, 0.1);
    color: #ec4899;
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
