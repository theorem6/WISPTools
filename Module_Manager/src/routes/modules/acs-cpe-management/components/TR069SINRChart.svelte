<script lang="ts">
  import { Line } from 'svelte-chartjs';
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
    type ChartOptions
  } from 'chart.js';
  import type { TR069CellularMetrics } from '../lib/tr069MetricsService';
  import { getSINRQuality } from '../lib/tr069MetricsService';

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

  // Color segments based on SINR quality
  $: segmentColors = metrics.map(m => {
    const quality = getSINRQuality(m.sinr);
    return quality.color;
  });

  $: chartData = {
    labels: metrics.map(m => {
      const time = new Date(m.timestamp);
      return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }),
    datasets: [
      {
        label: 'SINR (dB)',
        data: metrics.map(m => m.sinr),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 8,
        pointBackgroundColor: segmentColors,
        segment: {
          borderColor: (ctx) => {
            const idx = ctx.p0DataIndex;
            if (idx >= metrics.length) return '#8b5cf6';
            const sinr = metrics[idx].sinr;
            if (sinr >= 20) return '#10b981';
            if (sinr >= 13) return '#3b82f6';
            if (sinr >= 0) return '#f59e0b';
            return '#ef4444';
          }
        }
      }
    ]
  };

  const options: ChartOptions<'line'> = {
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
            const sinr = context.parsed.y;
            const quality = getSINRQuality(sinr);
            return [
              `SINR: ${sinr.toFixed(1)} dB`,
              `Quality: ${quality.label}`
            ];
          }
        }
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: 'SINR (dB)',
          color: 'rgb(156, 163, 175)'
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.2)'
        },
        ticks: {
          color: 'rgb(156, 163, 175)'
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
  };

  $: avgSINR = metrics.length > 0 
    ? (metrics.reduce((sum, m) => sum + m.sinr, 0) / metrics.length).toFixed(1)
    : '0';

  $: currentSINR = metrics.length > 0 ? metrics[metrics.length - 1].sinr : 0;
  $: currentQuality = getSINRQuality(currentSINR);
</script>

<div class="chart-container">
  <div class="chart-header">
    <h3 class="chart-title">SINR - Signal Quality (TR-069)</h3>
    <span class="quality-badge" style="background: {currentQuality.color}20; color: {currentQuality.color};">
      {currentQuality.label}
    </span>
  </div>
  <div class="chart-wrapper">
    <Line data={chartData} options={options} />
  </div>
  <div class="chart-info">
    <span class="info-item">📊 Current: {currentSINR.toFixed(1)} dB</span>
    <span class="info-item">📈 Average: {avgSINR} dB</span>
    <span class="info-item">
      📋 Path: <code>Device.Cellular.Interface.1.SINR</code>
    </span>
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

  .quality-badge {
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

  .info-item code {
    background: var(--bg-tertiary);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: monospace;
    font-size: 0.75rem;
  }
</style>

