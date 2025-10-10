<script lang="ts">
  import Chart from '$lib/components/Chart.svelte';
  import type { ChartConfiguration } from '$lib/chartSetup';
  import type { TR069CellularMetrics } from '../lib/tr069MetricsService';

  export let metrics: TR069CellularMetrics[] = [];

  // Detect PCI changes (handovers)
  $: pciChanges = metrics.map((m, i) => {
    if (i === 0) return false;
    return m.pci !== metrics[i - 1].pci;
  });

  $: config = {
    type: 'line',
    data: {
    labels: metrics.map((m, i) => {
      const time = new Date(m.timestamp);
      const label = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return pciChanges[i] ? `${label} 🔄` : label;
    }),
    datasets: [
      {
        label: 'Physical Cell ID (PCI)',
        data: metrics.map(m => m.pci),
        borderColor: '#8b5cf6',
        backgroundColor: pciChanges.map(changed => 
          changed ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.1)'
        ),
        pointBackgroundColor: pciChanges.map(changed => 
          changed ? '#ef4444' : '#8b5cf6'
        ),
        pointRadius: pciChanges.map(changed => changed ? 6 : 3),
        pointHoverRadius: 8,
        stepped: 'before', // Show as step chart since PCI is discrete
        borderWidth: 2
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
            const pci = context.parsed.y;
            const mod3 = pci % 3;
            const mod6 = pci % 6;
            const mod30 = pci % 30;
            return [
              `PCI: ${pci}`,
              `Mod3: ${mod3}`,
              `Mod6: ${mod6}`,
              `Mod30: ${mod30}`
            ];
          },
          title: (contexts) => {
            const idx = contexts[0].dataIndex;
            if (pciChanges[idx]) {
              return `${contexts[0].label} (Handover)`;
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
          text: 'Physical Cell ID',
          color: 'rgb(156, 163, 175)'
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.2)'
        },
        ticks: {
          color: 'rgb(156, 163, 175)',
          stepSize: 50
        },
        min: 0,
        max: 503
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
    <Chart {config} height={300} />
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

