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

  export let metrics: any[] = [];

  $: config: ChartConfiguration = {
    type: 'line',
    data: {
    labels: metrics.map(m => {
      const time = new Date(m.timestamp);
      return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }),
    datasets: [
      {
        label: 'Connected UEs',
        data: metrics.map(m => m.ueCount),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        tension: 0.4,
        fill: true,
        pointRadius: 2,
        pointHoverRadius: 6
      },
      {
        label: 'PRB Utilization (%)',
        data: metrics.map(m => m.prbUtilization),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
        fill: false,
        pointRadius: 2,
        pointHoverRadius: 6,
        yAxisID: 'y1'
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
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (label.includes('%')) {
              return `${label}: ${value.toFixed(1)}%`;
            }
            return `${label}: ${Math.round(value)}`;
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
          text: 'Connected UEs',
          color: '#8b5cf6'
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.2)'
        },
        ticks: {
          color: 'rgb(156, 163, 175)'
        },
        beginAtZero: true
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'PRB Utilization (%)',
          color: '#f59e0b'
        },
        grid: {
          drawOnChartArea: false
        },
        ticks: {
          color: 'rgb(156, 163, 175)'
        },
        min: 0,
        max: 100
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
  <h3 class="chart-title">UE Connections & Resource Utilization</h3>
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

