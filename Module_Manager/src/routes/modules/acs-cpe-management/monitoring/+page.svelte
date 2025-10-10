<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import MainMenu from '../components/MainMenu.svelte';
  import LTESignalChart from '../components/LTESignalChart.svelte';
  import TR069PCIChart from '../components/TR069PCIChart.svelte';
  import TR069EARFCNChart from '../components/TR069EARFCNChart.svelte';
  import TR069RSSIChart from '../components/TR069RSSIChart.svelte';
  import TR069SINRChart from '../components/TR069SINRChart.svelte';
  import TR069UptimeChart from '../components/TR069UptimeChart.svelte';
  import LTEKPICards from '../components/LTEKPICards.svelte';
  import { generateTR069MetricsHistory, type TR069CellularMetrics } from '../lib/tr069MetricsService';
  import { getCurrentLTEKPIs, type LTEKPIs } from '../lib/lteMetricsService';
  import { loadCPEDevices, type CPEDevice } from '../lib/cpeDataService';

  let metrics: TR069CellularMetrics[] = [];
  let kpis: LTEKPIs;
  let isLoading = true;
  let autoRefresh = true;
  let refreshInterval: number | null = null;
  let lastUpdate: Date | null = null;
  let timeRange: '1h' | '6h' | '24h' | '7d' = '24h';
  
  // Device selection
  let cpeDevices: CPEDevice[] = [];
  let selectedDeviceId: string = '';
  let selectedDevice: CPEDevice | null = null;

  onMount(async () => {
    // Load available CPE devices
    cpeDevices = await loadCPEDevices();
    
    // Check if deviceId is in URL query params
    const urlDeviceId = $page.url.searchParams.get('deviceId');
    if (urlDeviceId) {
      selectedDeviceId = urlDeviceId;
    } else if (cpeDevices.length > 0) {
      // Default to first device
      selectedDeviceId = cpeDevices[0].id;
    }
    
    await loadMetrics();
    startAutoRefresh();
  });

  onDestroy(() => {
    stopAutoRefresh();
  });

  async function loadMetrics() {
    if (!selectedDeviceId) return;
    
    isLoading = true;
    
    try {
      // TODO: Replace with real API call to /api/tr069/metrics?deviceId={selectedDeviceId}&hours={hours}
      // This would query GenieACS/MongoDB for historical parameter values for specific device
      console.log(`Loading TR-069 metrics for device: ${selectedDeviceId}`);
      
      const hours = timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : timeRange === '24h' ? 24 : 168;
      metrics = generateTR069MetricsHistory(hours, selectedDeviceId);
      kpis = getCurrentLTEKPIs();
      lastUpdate = new Date();
      
      // Find selected device details
      selectedDevice = cpeDevices.find(d => d.id === selectedDeviceId) || null;
    } catch (error) {
      console.error('Failed to load TR-069 metrics:', error);
    } finally {
      isLoading = false;
    }
  }
  
  async function handleDeviceChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    selectedDeviceId = target.value;
    await loadMetrics();
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
  
  // Watch for selectedDeviceId changes
  $: if (selectedDeviceId) {
    loadMetrics();
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
        CPE Device Monitoring (TR-069)
      </h1>
      <p class="page-description">
        {#if selectedDevice}
          Monitoring: {selectedDevice.manufacturer} - {selectedDevice.id}
        {:else}
          Select a CPE device to view real-time TR-069 metrics
        {/if}
      </p>
    </div>
    <div class="header-actions">
      <!-- Device Selector -->
      <div class="device-selector">
        <label for="device-select" class="selector-label">Select CPE:</label>
        <select 
          id="device-select" 
          bind:value={selectedDeviceId} 
          on:change={handleDeviceChange}
          class="device-select"
        >
          {#each cpeDevices as device}
            <option value={device.id}>
              {device.manufacturer} - {device.id} ({device.status})
            </option>
          {/each}
        </select>
      </div>
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

  {#if lastUpdate && selectedDevice}
    <div class="last-update">
      <span class="device-status" class:online={selectedDevice.status === 'Online'} class:offline={selectedDevice.status === 'Offline'}>
        {selectedDevice.status}
      </span>
      <span>•</span>
      <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
      {#if selectedDevice.location}
        <span>•</span>
        <span>📍 {selectedDevice.location.latitude.toFixed(4)}, {selectedDevice.location.longitude.toFixed(4)}</span>
      {/if}
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

      <!-- TR-069 Cellular Parameters Section -->
      <div class="section-header">
        <h2>TR-069 Cellular Interface Metrics - {selectedDevice ? selectedDevice.id : 'No Device Selected'}</h2>
        <p class="section-description">
          Real-time monitoring of Device.Cellular.Interface parameters from selected CPE device
        </p>
      </div>

      <!-- Charts Grid -->
      <div class="charts-grid">
        <TR069RSSIChart {metrics} />
        <LTESignalChart metrics={metrics} title="RSRP/RSRQ (TR-069)" />
        <TR069SINRChart {metrics} />
        <TR069PCIChart {metrics} />
        <TR069EARFCNChart {metrics} />
        <TR069UptimeChart {metrics} />
      </div>

      <!-- Network Health Summary -->
      <div class="health-summary">
        <h2>TR-069 Network Summary</h2>
        <div class="summary-grid">
          <div class="summary-item">
            <span class="summary-label">Average RSSI:</span>
            <span class="summary-value">{(metrics.reduce((sum, m) => sum + m.rssi, 0) / metrics.length).toFixed(1)} dBm</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Average RSRP:</span>
            <span class="summary-value">{(metrics.reduce((sum, m) => sum + m.rsrp, 0) / metrics.length).toFixed(1)} dBm</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Average SINR:</span>
            <span class="summary-value">{(metrics.reduce((sum, m) => sum + m.sinr, 0) / metrics.length).toFixed(1)} dB</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Current PCI:</span>
            <span class="summary-value">{metrics.length > 0 ? metrics[metrics.length - 1].pci : 'N/A'}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Current EARFCN:</span>
            <span class="summary-value">{metrics.length > 0 ? metrics[metrics.length - 1].earfcn : 'N/A'}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Connection Status:</span>
            <span class="summary-value">{metrics.length > 0 ? metrics[metrics.length - 1].status : 'Unknown'}</span>
          </div>
        </div>
        
        <div class="tr069-info">
          <h3>📋 TR-069 Parameter Paths</h3>
          <div class="path-grid">
            <code>Device.Cellular.Interface.1.RSSI</code>
            <code>Device.Cellular.Interface.1.RSRP</code>
            <code>Device.Cellular.Interface.1.RSRQ</code>
            <code>Device.Cellular.Interface.1.SINR</code>
            <code>Device.Cellular.Interface.1.X_VENDOR_PhysicalCellID</code>
            <code>Device.Cellular.Interface.1.X_VENDOR_EARFCN</code>
            <code>Device.DeviceInfo.UpTime</code>
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

  .device-selector {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .selector-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .device-select {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.875rem;
    cursor: pointer;
    min-width: 250px;
  }

  .device-select:hover {
    border-color: var(--accent-color);
  }

  .device-select:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .last-update {
    padding: 0.75rem 2rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .device-status {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .device-status.online {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }

  .device-status.offline {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
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

  .section-header {
    margin: 2rem 0 1.5rem 0;
  }

  .section-header h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .section-description {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.95rem;
  }

  .tr069-info {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border-color);
  }

  .tr069-info h3 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    color: var(--text-primary);
  }

  .path-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 0.75rem;
  }

  .path-grid code {
    background: var(--bg-tertiary);
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    font-family: monospace;
    font-size: 0.875rem;
    color: var(--accent-color);
    border: 1px solid var(--border-color);
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
      gap: 0.75rem;
    }

    .device-selector {
      flex-direction: column;
      align-items: stretch;
      width: 100%;
    }

    .device-select {
      width: 100%;
      min-width: auto;
    }

    .time-range-selector {
      justify-content: center;
      width: 100%;
    }

    .btn {
      justify-content: center;
      width: 100%;
    }

    .last-update {
      flex-direction: column;
      gap: 0.5rem;
      align-items: flex-start;
      padding: 0.75rem 1rem;
    }

    .content {
      padding: 1rem;
    }

    .summary-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

