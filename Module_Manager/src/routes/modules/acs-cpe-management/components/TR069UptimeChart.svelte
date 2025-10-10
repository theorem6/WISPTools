<script lang="ts">
  import Chart from '$lib/components/Chart.svelte';
  import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    CategoryScale,
    Filler,
    type ChartConfiguration
  } from 'chart.js';
  import type { TR069CellularMetrics } from '../lib/tr069MetricsService';
  import { formatUptime } from '../lib/tr069MetricsService';

  ChartJS.register(
    Title,
    Tooltip,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    CategoryScale,
    Filler
  );

  export let metrics: TR069CellularMetrics[] = [];

  // Detect reboots (uptime drops)
  $: reboots = metrics.map((m, i) => {
    if (i === 0) return false;
    return m.uptime < metrics[i - 1].uptime;
  });

  $: config: ChartConfiguration = {
    type: 'line',
    data: {
    labels: metrics.map((m, i) => {
      const time = new Date(m.timestamp);
      const label = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return reboots[i] ? `${label} ⚠️` : label;
    }),
    datasets: [
      {
        label: 'Uptime (hours)',
        data: metrics.map(m => m.uptime / 3600), // Convert seconds to hours
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        tension: 0.3,
        fill: true,
        pointRadius: reboots.map(r => r ? 6 : 2),
        pointBackgroundColor: reboots.map(r => r ? '#ef4444' : '#10b981'),
        pointHoverRadius: 8
      }
    ]
    },
    options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: 'rgb(156, 163, 175)',
          usePointStyle: true,
          padding: 15
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        callbacks: {
          label: (context) => {
            const seconds = context.parsed.y * 3600;
            return `Uptime: ${formatUptime(seconds)}`;
          },
          title: (contexts) => {
            const idx = contexts[0].dataIndex;
            if (reboots[idx]) {
              return `${contexts[0].label} (Device Reboot)`;
            }
            return contexts[0].label;
          }
        }
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: 'Uptime (hours)',
          color: 'rgb(156, 163, 175)'
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.2)'
        },
        ticks: {
          color: 'rgb(156, 163, 175)',
          callback: (value) => {
            return `${value}h`;
          }
        },
        beginAtZero: true
      },
      x: {
        grid: {
          color: 'rgba(75, 85, 99, 0.1)'
        },
        ticks: {
          color: 'rgb(156, 163, 175)',
          maxRotation: 45,
          minRotation: 45
        }
      }
    }
    }
  };

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
    <Chart {config} height={300} />
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

