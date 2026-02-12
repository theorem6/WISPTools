<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import MainMenu from '../components/MainMenu.svelte';
  import TR069PCIChart from '../components/TR069PCIChart.svelte';
  import TR069EARFCNChart from '../components/TR069EARFCNChart.svelte';
  import TR069RSSIChart from '../components/TR069RSSIChart.svelte';
  import TR069SINRChart from '../components/TR069SINRChart.svelte';
  import TR069UptimeChart from '../components/TR069UptimeChart.svelte';
  import LTESignalChart from '../components/LTESignalChart.svelte';
  import { type TR069CellularMetrics } from '../lib/tr069MetricsService';
  import { loadCPEDevices, type CPEDevice } from '../lib/cpeDataService';
  import { currentTenant } from '$lib/stores/tenantStore';

  let cpeDevices: CPEDevice[] = [];
  let selectedDevices: string[] = [];
  let metricsMap: Map<string, TR069CellularMetrics[]> = new Map();
  let isLoading = true;
  let autoRefresh = true;
  let refreshInterval: number | null = null;
  let timeRange: '1h' | '6h' | '24h' | '7d' = '6h';

  onMount(async () => {
    cpeDevices = await loadCPEDevices();
    
    // Check URL for specific device
    const urlDeviceId = $page.url.searchParams.get('deviceId');
    if (urlDeviceId) {
      selectedDevices = [urlDeviceId];
    } else if (cpeDevices.length > 0) {
      // Default to first 3 devices
      selectedDevices = cpeDevices.slice(0, Math.min(3, cpeDevices.length)).map(d => d.id);
    }
    
    await loadAllMetrics();
    startAutoRefresh();
  });

  onDestroy(() => {
    stopAutoRefresh();
  });

  async function loadAllMetrics() {
    isLoading = true;
    
    try {
      const hours = timeRange === '1h' ? 1 : timeRange === '6h' ? 6 : timeRange === '24h' ? 24 : 168;
      
      if (!$currentTenant?.id) {
        console.error('No tenant selected');
        metricsMap = new Map();
        return;
      }
      
      // Get auth token
      const { authService } = await import('$lib/services/authService');
      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('Not authenticated');
      }
      
      const token = await authService.getAuthTokenForApi();
      
      // Load metrics for each selected device
      for (const deviceId of selectedDevices) {
        try {
          const response = await fetch(`/api/tr069/metrics?deviceId=${deviceId}&hours=${hours}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Tenant-ID': $currentTenant.id,
              'Content-Type': 'application/json'
            }
          });
          
          const data = await response.json();
          
          if (response.ok && data?.success && data?.metrics) {
            console.log(`✅ Loaded ${data.metrics.length} real metrics for device ${deviceId}`);
            metricsMap.set(deviceId, data.metrics);
          } else {
            console.warn(`⚠️ No metrics available for device ${deviceId}`);
            metricsMap.set(deviceId, []); // Empty array instead of fake data
          }
        } catch (error) {
          console.error(`Failed to load metrics for device ${deviceId}:`, error);
          metricsMap.set(deviceId, []); // Empty array on error
        }
      }
      
      metricsMap = new Map(metricsMap); // Trigger reactivity
    } catch (error) {
      console.error('Failed to load metrics:', error);
      metricsMap = new Map();
    } finally {
      isLoading = false;
    }
  }

  function startAutoRefresh() {
    if (autoRefresh && !refreshInterval) {
      refreshInterval = window.setInterval(loadAllMetrics, 30000);
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
    await loadAllMetrics();
  }

  function toggleDeviceSelection(deviceId: string) {
    if (selectedDevices.includes(deviceId)) {
      selectedDevices = selectedDevices.filter(id => id !== deviceId);
      metricsMap.delete(deviceId);
      metricsMap = new Map(metricsMap);
    } else {
      selectedDevices = [...selectedDevices, deviceId];
      loadAllMetrics();
    }
  }

  function selectAllDevices() {
    selectedDevices = cpeDevices.map(d => d.id);
    loadAllMetrics();
  }

  function deselectAllDevices() {
    selectedDevices = [];
    metricsMap.clear();
    metricsMap = new Map(metricsMap);
  }

  $: selectedCount = selectedDevices.length;
</script>

<svelte:head>
  <title>Graphs - ACS CPE Management</title>
  <meta name="description" content="Multi-device TR-069 monitoring graphs" />
</svelte:head>

<div class="graphs-page">
  <MainMenu />
  
  <!-- Page Header -->
  <div class="page-header">
    <div class="header-content">
      <div class="header-top">
        <a href="/dashboard" class="back-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          ← Back to Dashboard
        </a>
      </div>
      <h1 class="page-title">
        <span class="page-icon">📊</span>
        Multi-Device Graphs
      </h1>
      <p class="page-description">
        Compare TR-069 metrics across multiple CPE devices
      </p>
    </div>
    <div class="header-actions">
      <div class="time-range-selector">
        <button class="time-btn" class:active={timeRange === '1h'} on:click={() => handleTimeRangeChange('1h')}>1H</button>
        <button class="time-btn" class:active={timeRange === '6h'} on:click={() => handleTimeRangeChange('6h')}>6H</button>
        <button class="time-btn" class:active={timeRange === '24h'} on:click={() => handleTimeRangeChange('24h')}>24H</button>
        <button class="time-btn" class:active={timeRange === '7d'} on:click={() => handleTimeRangeChange('7d')}>7D</button>
      </div>
      <button class="btn btn-secondary" class:active={autoRefresh} on:click={toggleAutoRefresh}>
        {autoRefresh ? '⏸️' : '▶️'} Auto-Refresh
      </button>
      <button class="btn btn-primary" on:click={loadAllMetrics} disabled={isLoading}>
        {#if isLoading}
          <span class="spinner-sm"></span>
        {:else}
          🔄
        {/if}
        Refresh
      </button>
    </div>
  </div>

  <!-- Device Selector -->
  <div class="device-selector-bar">
    <div class="selector-header">
      <h3>Select Devices ({selectedCount} selected)</h3>
      <div class="selector-actions">
        <button class="btn-link" on:click={selectAllDevices}>Select All</button>
        <button class="btn-link" on:click={deselectAllDevices}>Deselect All</button>
      </div>
    </div>
    <div class="device-chips">
      {#each cpeDevices as device}
        <button
          class="device-chip"
          class:selected={selectedDevices.includes(device.id)}
          class:online={device.status === 'Online'}
          class:offline={device.status === 'Offline'}
          on:click={() => toggleDeviceSelection(device.id)}
        >
          <span class="chip-status"></span>
          <span class="chip-label">{device.manufacturer} - {device.id}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Graphs Content -->
  <div class="content">
    {#if isLoading}
      <div class="loading-container">
        <div class="spinner-large"></div>
        <p>Loading graphs for {selectedCount} device{selectedCount !== 1 ? 's' : ''}...</p>
      </div>
    {:else if selectedCount === 0}
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <h2>No Devices Selected</h2>
        <p>Select one or more CPE devices above to view their monitoring graphs</p>
      </div>
    {:else}
      {#each selectedDevices as deviceId}
        {@const deviceMetrics = metricsMap.get(deviceId)}
        {@const device = cpeDevices.find(d => d.id === deviceId)}
        
        {#if deviceMetrics && device}
          <div class="device-graphs-section">
            <div class="section-header">
              <h2>
                <span class="status-dot" class:online={device.status === 'Online'} class:offline={device.status === 'Offline'}></span>
                {device.manufacturer} - {device.id}
              </h2>
              <a href="/modules/acs-cpe-management/monitoring?deviceId={deviceId}" class="btn-link">
                View Full Monitoring →
              </a>
            </div>
            
            <div class="charts-grid">
              <TR069RSSIChart metrics={deviceMetrics} />
              <LTESignalChart metrics={deviceMetrics} title="RSRP/RSRQ" />
              <TR069SINRChart metrics={deviceMetrics} />
              <TR069PCIChart metrics={deviceMetrics} />
              <TR069EARFCNChart metrics={deviceMetrics} />
              <TR069UptimeChart metrics={deviceMetrics} />
            </div>
          </div>
        {/if}
      {/each}
    {/if}
  </div>
</div>

<style>
  .graphs-page {
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

  .device-selector-bar {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 1.5rem 2rem;
  }

  .selector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .selector-header h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-primary);
  }

  .selector-actions {
    display: flex;
    gap: 1rem;
  }

  .btn-link {
    background: none;
    border: none;
    color: var(--accent-color);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }

  .btn-link:hover {
    background: var(--bg-tertiary);
  }

  .device-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .device-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 9999px;
    border: 2px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .device-chip:hover {
    border-color: var(--accent-color);
    background: var(--bg-tertiary);
  }

  .device-chip.selected {
    border-color: var(--accent-color);
    background: var(--accent-color);
    color: white;
  }

  .chip-status {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6b7280;
  }

  .device-chip.selected.online .chip-status {
    background: #10b981;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
  }

  .device-chip.selected.offline .chip-status {
    background: #ef4444;
  }

  .content {
    padding: 2rem;
    max-width: 1600px;
    margin: 0 auto;
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

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-state h2 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }

  .empty-state p {
    margin: 0;
    color: var(--text-secondary);
  }

  .device-graphs-section {
    margin-bottom: 3rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
  }

  .section-header h2 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
  }

  .status-dot.online {
    background: #10b981;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
  }

  .status-dot.offline {
    background: #ef4444;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
    gap: 1.5rem;
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
    }

    .content {
      padding: 1rem;
    }

    .device-selector-bar {
      padding: 1rem;
    }

    .section-header {
      flex-direction: column;
      gap: 0.75rem;
      align-items: flex-start;
    }
  }
</style>