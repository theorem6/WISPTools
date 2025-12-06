<script lang="ts">
  import ECharts from '$lib/components/ECharts.svelte';
  import type { EChartsOption } from 'echarts';
  import type { TR069CellularMetrics } from '../lib/tr069MetricsService';

  export let metrics: TR069CellularMetrics[] = [];
  export let title: string = 'Signal Strength';

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
          return params.map((p: any) => {
            const unit = p.seriesName.includes('RSRP') ? 'dBm' : 'dB';
            return `${p.seriesName}: ${typeof p.value === 'number' ? p.value.toFixed(1) : 'N/A'} ${unit}`;
          }).join('<br/>');
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
    yAxis: [
      {
        type: 'value',
        name: 'RSRP (dBm)',
        nameLocation: 'middle',
        nameGap: 50,
        nameTextStyle: { color: '#3b82f6', fontSize: 11 },
        position: 'left',
        min: -100,
        max: -60,
        axisLabel: { color: '#9ca3af', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { lineStyle: { color: 'rgba(75, 85, 99, 0.2)' } }
      },
      {
        type: 'value',
        name: 'RSRQ (dB)',
        nameLocation: 'middle',
        nameGap: 60,
        nameTextStyle: { color: '#10b981', fontSize: 11 },
        position: 'right',
        min: -15,
        max: -5,
        axisLabel: { color: '#9ca3af', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: 'RSRP (dBm)',
        type: 'line',
        yAxisIndex: 0,
        data: metrics.map((m) => m.rsrp),
        itemStyle: { color: '#3b82f6' },
        areaStyle: { color: 'rgba(59, 130, 246, 0.1)' },
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2 }
      },
      {
        name: 'RSRQ (dB)',
        type: 'line',
        yAxisIndex: 1,
        data: metrics.map((m) => m.rsrq),
        itemStyle: { color: '#10b981' },
        areaStyle: { color: 'rgba(16, 185, 129, 0.1)' },
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2 }
      }
    ]
  } satisfies EChartsOption;
</script>

<div class="chart-container">
  <h3 class="chart-title">{title}</h3>
  <div class="chart-wrapper">
    <ECharts option={option} height={300} theme="dark" />
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
</style>
