<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import MainMenu from '../components/MainMenu.svelte';
  import LTESignalChart from '../components/LTESignalChart.svelte';
  import LTEThroughputChart from '../components/LTEThroughputChart.svelte';
  import LTEUEConnectionChart from '../components/LTEUEConnectionChart.svelte';
  import LTEKPICards from '../components/LTEKPICards.svelte';
  import { generateLTEMetricsHistory, getCurrentLTEKPIs, type LTEMetrics, type LTEKPIs } from '../lib/lteMetricsService';

  let metrics: LTEMetrics[] = [];
  let kpis: LTEKPIs;
  let isLoading = true;
  let autoRefresh = true;
  let refreshInterval: number | null = null;
  let lastUpdate: Date | null = null;
  let timeRange: '1h' | '6h' | '24h' | '7d' = '24h';

  onMount(async () => {
    await loadMetrics();
    startAutoRefresh();
  });

  onDestroy(() => {
    stopAutoRefresh();
  });

  async function loadMetrics() {
    isLoading = true;
    
    try {
      // TODO: Replace with real API call to /api/lte/metrics
      const hours = timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : timeRange === '24h' ? 24 : 168;
      metrics = generateLTEMetricsHistory(hours);
      kpis = getCurrentLTEKPIs();
      lastUpdate = new Date();
    } catch (error) {
      console.error('Failed to load LTE metrics:', error);
    } finally {
      isLoading = false;
    }
  }

  function startAutoRefresh() {
    if (autoRefresh && !refreshInterval) {
      refreshInterval = window.setInterval(loadMetrics, 30000); // Refresh every 30 seconds
    }
  }

  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    if (autoRefresh) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  }

  async function handleTimeRangeChange(range: typeof timeRange) {
    timeRange = range;
    await loadMetrics();
  }
</script>

<svelte:head>
  <title>Network Monitoring - ACS CPE Management</title>
  <meta name="description" content="Real-time LTE/5G network monitoring and KPIs" />
</svelte:head>

<div class="monitoring-page">
  <MainMenu />
  
  <!-- Page Header -->
  <div class="page-header">
    <div class="header-content">
      <div class="header-top">
        <a href="/modules/acs-cpe-management" class="back-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to ACS CPE Management
        </a>
      </div>
      <h1 class="page-title">
        <span class="page-icon">📈</span>
        Network Monitoring
      </h1>
      <p class="page-description">
        Real-time LTE/5G performance metrics and KPIs
      </p>
    </div>
    <div class="header-actions">
      <div class="time-range-selector">
        <button 
          class="time-btn" 
          class:active={timeRange === '1h'}
          on:click={() => handleTimeRangeChange('1h')}
        >
          1H
        </button>
        <button 
          class="time-btn" 
          class:active={timeRange === '6h'}
          on:click={() => handleTimeRangeChange('6h')}
        >
          6H
        </button>
        <button 
          class="time-btn" 
          class:active={timeRange === '24h'}
          on:click={() => handleTimeRangeChange('24h')}
        >
          24H
        </button>
        <button 
          class="time-btn" 
          class:active={timeRange === '7d'}
          on:click={() => handleTimeRangeChange('7d')}
        >
          7D
        </button>
      </div>
      <button 
        class="btn btn-secondary" 
        class:active={autoRefresh}
        on:click={toggleAutoRefresh}
      >
        <span class="btn-icon">{autoRefresh ? '⏸️' : '▶️'}</span>
        {autoRefresh ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}
      </button>
      <button class="btn btn-primary" on:click={loadMetrics} disabled={isLoading}>
        {#if isLoading}
          <span class="spinner-sm"></span>
        {:else}
          <span class="btn-icon">🔄</span>
        {/if}
        Refresh
      </button>
    </div>
  </div>

  {#if lastUpdate}
    <div class="last-update">
      Last updated: {lastUpdate.toLocaleTimeString()}
    </div>
  {/if}

  <div class="content">
    {#if isLoading}
      <div class="loading-container">
        <div class="spinner-large"></div>
        <p>Loading network metrics...</p>
      </div>
    {:else}
      <!-- KPI Cards -->
      <LTEKPICards {kpis} />

      <!-- Charts Grid -->
      <div class="charts-grid">
        <LTESignalChart {metrics} title="Signal Strength (RSRP/RSRQ)" />
        <LTEThroughputChart {metrics} />
        <LTEUEConnectionChart {metrics} />
        <LTESINRChart {metrics} />
      </div>

      <!-- Network Health Summary -->
      <div class="health-summary">
        <h2>Network Health Summary</h2>
        <div class="summary-grid">
          <div class="summary-item">
            <span class="summary-label">Average RSRP:</span>
            <span class="summary-value">{(metrics.reduce((sum, m) => sum + m.rsrp, 0) / metrics.length).toFixed(1)} dBm</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Average SINR:</span>
            <span class="summary-value">{(metrics.reduce((sum, m) => sum + m.sinr, 0) / metrics.length).toFixed(1)} dB</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Peak Throughput DL:</span>
            <span class="summary-value">{Math.max(...metrics.map(m => m.throughputDL)).toFixed(1)} Mbps</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Peak UE Count:</span>
            <span class="summary-value">{Math.max(...metrics.map(m => m.ueCount))}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Avg PRB Utilization:</span>
            <span class="summary-value">{(metrics.reduce((sum, m) => sum + m.prbUtilization, 0) / metrics.length).toFixed(1)}%</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Network Availability:</span>
            <span class="summary-value">99.8%</span>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .monitoring-page {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
  }

  .back-button:hover {
    color: var(--accent-color);
    background: var(--bg-tertiary);
    border-color: var(--accent-color);
  }

  .back-button svg {
    flex-shrink: 0;
  }

  .header-top {
    margin-bottom: 1rem;
  }

  .page-header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 1.5rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-content {
    flex: 1;
  }

  .page-title {
    font-size: 1.875rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .page-icon {
    font-size: 2rem;
  }

  .page-description {
    margin: 0;
    color: var(--text-secondary);
  }

  .header-actions {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .time-range-selector {
    display: flex;
    gap: 0.25rem;
    background: var(--bg-tertiary);
    padding: 0.25rem;
    border-radius: 0.375rem;
  }

  .time-btn {
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 0.25rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .time-btn:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .time-btn.active {
    background: var(--accent-color);
    color: white;
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--border-color);
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--accent-color);
    color: white;
    border-color: var(--accent-color);
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-primary);
  }

  .btn-secondary.active {
    background: var(--accent-color);
    color: white;
    border-color: var(--accent-color);
  }

  .btn-icon {
    font-size: 1rem;
  }

  .last-update {
    padding: 0.75rem 2rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    text-align: right;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    gap: 1rem;
  }

  .spinner-large {
    width: 3rem;
    height: 3rem;
    border: 4px solid var(--border-color);
    border-top-color: var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner-sm {
    width: 1rem;
    height: 1rem;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .health-summary {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 2rem;
  }

  .health-summary h2 {
    margin: 0 0 1.5rem 0;
    font-size: 1.5rem;
    color: var(--text-primary);
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
  }

  .summary-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .summary-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .summary-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  @media (max-width: 1200px) {
    .charts-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .header-actions {
      flex-direction: column;
      width: 100%;
    }

    .time-range-selector {
      justify-content: center;
    }

    .btn {
      justify-content: center;
    }

    .content {
      padding: 1rem;
    }

    .summary-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

