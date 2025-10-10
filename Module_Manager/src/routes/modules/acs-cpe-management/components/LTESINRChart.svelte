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
  import type { LTEMetrics } from '../lib/lteMetricsService';

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

  export let metrics: LTEMetrics[] = [];

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
        pointRadius: 2,
        pointHoverRadius: 6
      },
      {
        label: 'CQI',
        data: metrics.map(m => m.cqi),
        borderColor: '#ec4899',
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
        tension: 0.4,
        fill: false,
        pointRadius: 2,
        pointHoverRadius: 6,
        yAxisID: 'y1'
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
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (label === 'CQI') {
              return `${label}: ${Math.round(value)}`;
            }
            return `${label}: ${value.toFixed(1)} dB`;
          }
        }
      }
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'SINR (dB)',
          color: '#8b5cf6'
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
          text: 'CQI',
          color: '#ec4899'
        },
        grid: {
          drawOnChartArea: false
        },
        ticks: {
          color: 'rgb(156, 163, 175)',
          stepSize: 1
        },
        min: 0,
        max: 15
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
</script>

<div class="chart-container">
  <h3 class="chart-title">Signal Quality (SINR & CQI)</h3>
  <div class="chart-wrapper">
    <Line data={chartData} options={options} />
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

