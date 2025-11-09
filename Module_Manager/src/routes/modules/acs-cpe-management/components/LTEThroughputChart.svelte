<script lang="ts">
  import Chart from '$lib/components/data-display/Chart.svelte';
  import type { ChartConfiguration } from '$lib/chartSetup';
  import type { TooltipItem } from 'chart.js';
  import type { TR069CellularMetrics } from '../lib/tr069MetricsService';

  export let metrics: TR069CellularMetrics[] = [];

  const tooltipLabel = (context: TooltipItem<'line'>): string => {
    const label = context.dataset.label ?? '';
    const value = context.parsed.y;
    const formatted = typeof value === 'number' ? value.toFixed(2) : 'N/A';
    return `${label}: ${formatted} Mbps`;
  };

  $: config = {
    type: 'line' as const,
    data: {
      labels: metrics.map((m) => {
        const time = new Date(m.timestamp);
        return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      }),
      datasets: [
        {
          label: 'Download (Mbps)',
          data: metrics.map((m) => m.throughputDL ?? 0),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          tension: 0.4,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 6
        },
        {
          label: 'Upload (Mbps)',
          data: metrics.map((m) => m.throughputUL ?? 0),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          tension: 0.4,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index' as const,
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
            label: tooltipLabel
          }
        }
      },
      scales: {
        y: {
          title: {
            display: true,
            text: 'Throughput (Mbps)',
            color: 'rgb(156, 163, 175)'
          },
          grid: {
            color: 'rgba(75, 85, 99, 0.2)'
          },
          ticks: {
            color: 'rgb(156, 163, 175)'
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
  } satisfies ChartConfiguration<'line'>;
</script>

<div class="chart-container">
  <h3 class="chart-title">Network Throughput</h3>
  <div class="chart-wrapper">
    <Chart {config} height={300} />
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

