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

  $: config = {
    type: 'line',
    data: {
    labels: metrics.map(m => {
      const time = new Date(m.timestamp);
      return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }),
    datasets: [
      {
        label: 'RSSI (dBm)',
        data: metrics.map(m => m.rssi),
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.2)',
        tension: 0.4,
        fill: true,
        pointRadius: 2,
        pointHoverRadius: 6
      },
      {
        label: 'RSCP (dBm)',
        data: metrics.map(m => m.rscp),
        borderColor: '#14b8a6',
        backgroundColor: 'rgba(20, 184, 166, 0.1)',
        tension: 0.4,
        fill: false,
        pointRadius: 2,
        pointHoverRadius: 6
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
            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} dBm`;
          }
        }
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: 'Signal Strength (dBm)',
          color: 'rgb(156, 163, 175)'
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.2)'
        },
        ticks: {
          color: 'rgb(156, 163, 175)'
        },
        min: -110,
        max: -40
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
</script>

<div class="chart-container">
  <h3 class="chart-title">RSSI & RSCP (TR-069 Parameters)</h3>
  <div class="chart-wrapper">
    <Chart {config} height={300} />
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

