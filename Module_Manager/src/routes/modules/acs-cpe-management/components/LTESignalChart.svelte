<script lang="ts">
  import { onMount } from 'svelte';
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

  // Register Chart.js components
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
  export let title: string = 'Signal Strength';

  $: chartData = {
    labels: metrics.map(m => {
      const time = new Date(m.timestamp);
      return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }),
    datasets: [
      {
        label: 'RSRP (dBm)',
        data: metrics.map(m => m.rsrp),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 2,
        pointHoverRadius: 6
      },
      {
        label: 'RSRQ (dB)',
        data: metrics.map(m => m.rsrq),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
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
        titleColor: 'rgb(243, 244, 246)',
        bodyColor: 'rgb(209, 213, 219)',
        borderColor: 'rgb(75, 85, 99)',
        borderWidth: 1,
        padding: 12,
        displayColors: true
      }
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'RSRP (dBm)',
          color: '#3b82f6'
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.2)'
        },
        ticks: {
          color: 'rgb(156, 163, 175)'
        },
        min: -100,
        max: -60
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'RSRQ (dB)',
          color: '#10b981'
        },
        grid: {
          drawOnChartArea: false
        },
        ticks: {
          color: 'rgb(156, 163, 175)'
        },
        min: -15,
        max: -5
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
  <h3 class="chart-title">{title}</h3>
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

