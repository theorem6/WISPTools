<script lang="ts">
  import Chart from '$lib/components/data-display/Chart.svelte';
  import type { ChartConfiguration } from '$lib/chartSetup';
  import type { TooltipItem } from 'chart.js';
  import type { TR069CellularMetrics } from '../lib/tr069MetricsService';
  import { getLTEBandName } from '../lib/tr069MetricsService';

  export let metrics: TR069CellularMetrics[] = [];

  // Detect EARFCN/Band changes
  $: earfcnChanges = metrics.map((m, i) => {
    if (i === 0) return false;
    return m.earfcn !== metrics[i - 1].earfcn;
  });

  const tooltipLabel = (context: TooltipItem<'line'>): string | string[] => {
    if (context.datasetIndex === 0) {
      const value = context.parsed.y;
      const idx = context.dataIndex;
      const band = metrics[idx]?.band ?? 0;
      return [
        `EARFCN: ${typeof value === 'number' ? value : 'N/A'}`,
        `Band: ${getLTEBandName(band)}`
      ];
    }
    const bandValue = typeof context.parsed.y === 'number' ? context.parsed.y / 1000 : 0;
    return getLTEBandName(bandValue);
  };

  const tooltipTitle = (contexts: TooltipItem<'line'>[]): string => {
    const context = contexts[0];
    const idx = context.dataIndex;
    const baseLabel = context.label ?? '';
    return earfcnChanges[idx] ? `${baseLabel} (Frequency Change)` : baseLabel;
  };

  const bandTickFormatter = (value: string | number): string => {
    const numeric = typeof value === 'number' ? value : Number(value);
    return `Band ${numeric / 1000}`;
  };

  $: config = {
    type: 'line' as const,
    data: {
      labels: metrics.map((m, i) => {
        const time = new Date(m.timestamp);
        const label = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return earfcnChanges[i] ? `${label} 📡` : label;
      }),
      datasets: [
        {
          label: 'EARFCN',
          data: metrics.map((m) => m.earfcn),
          borderColor: '#ec4899',
          backgroundColor: earfcnChanges.map((changed) =>
            changed ? 'rgba(239, 68, 68, 0.3)' : 'rgba(236, 72, 153, 0.1)'
          ),
          pointBackgroundColor: earfcnChanges.map((changed) =>
            changed ? '#ef4444' : '#ec4899'
          ),
          pointRadius: earfcnChanges.map((changed) => (changed ? 6 : 3)),
          pointHoverRadius: 8,
          stepped: 'before' as const,
          borderWidth: 2
        },
        {
          label: 'LTE Band',
          data: metrics.map((m) => m.band * 1000), // Scale for visibility
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          pointRadius: 2,
          pointHoverRadius: 6,
          stepped: 'before' as const,
          borderWidth: 2,
          yAxisID: 'y1'
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
            label: tooltipLabel,
            title: tooltipTitle
          }
        }
      },
      scales: {
        y: {
          title: {
            display: true,
            text: 'EARFCN',
            color: '#ec4899'
          },
          grid: {
            color: 'rgba(75, 85, 99, 0.2)'
          },
          ticks: {
            color: 'rgb(156, 163, 175)'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Band',
            color: '#f59e0b'
          },
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            color: 'rgb(156, 163, 175)',
            callback: bandTickFormatter
          }
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
    <Chart {config} height={300} />
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

