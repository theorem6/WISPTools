<script lang="ts">
  import ECharts from '$lib/components/ECharts.svelte';
  import type { EChartsOption } from 'echarts';
  import type { TR069CellularMetrics } from '../lib/tr069MetricsService';
  import { formatUptime } from '../lib/tr069MetricsService';

  export let metrics: TR069CellularMetrics[] = [];

  // Detect reboots (uptime drops)
  $: reboots = metrics.map((m, i) => {
    if (i === 0) return false;
    return m.uptime < metrics[i - 1].uptime;
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
          const hours = params[0].value;
          const seconds = hours * 3600;
          const label = reboots[idx] ? `${params[0].axisValue} (Device Reboot)` : params[0].axisValue;
          return `${label}<br/>Uptime: ${formatUptime(seconds)}`;
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
        return reboots[i] ? `${label} ⚠️` : label;
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
      name: 'Uptime (hours)',
      nameLocation: 'middle',
      nameGap: 50,
      nameTextStyle: { color: '#9ca3af', fontSize: 11 },
      min: 0,
      axisLabel: { 
        color: '#9ca3af', 
        fontSize: 11,
        formatter: '{value}h'
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(75, 85, 99, 0.2)' } }
    },
    series: [
      {
        name: 'Uptime (hours)',
        type: 'line',
        data: metrics.map((m, i) => ({
          value: m.uptime / 3600,
          itemStyle: {
            color: reboots[i] ? '#ef4444' : '#10b981'
          },
          symbolSize: reboots[i] ? 8 : 4
        })),
        areaStyle: { color: 'rgba(16, 185, 129, 0.2)' },
        smooth: true,
        lineStyle: { width: 2 }
      }
    ]
  } satisfies EChartsOption;

  $: rebootCount = reboots.filter(Boolean).length;
  $: currentUptime = metrics.length > 0 ? metrics[metrics.length - 1].uptime : 0;
</script>

<div class="chart-container">
  <div class="chart-header">
    <h3 class="chart-title">Device Uptime (Device.DeviceInfo.UpTime)</h3>
    {#if rebootCount > 0}
      <span class="reboot-badge">
        ⚠️ {rebootCount} reboot{rebootCount > 1 ? 's' : ''} detected
      </span>
    {/if}
  </div>
  <div class="chart-wrapper">
    <ECharts option={option} height={300} theme="dark" />
  </div>
  <div class="chart-info">
    <span class="info-item">⏱️ Current Uptime: {formatUptime(currentUptime)}</span>
    <span class="info-item">🔄 Reboots: {rebootCount}</span>
    <span class="info-item">📊 Availability: {((1 - rebootCount / metrics.length) * 100).toFixed(2)}%</span>
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

  .reboot-badge {
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
    flex-wrap: wrap;
  }

  .info-item {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
</style>
