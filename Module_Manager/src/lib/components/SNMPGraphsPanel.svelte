<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import { auth } from '$lib/firebase';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { API_CONFIG } from '$lib/config/api';
  
  Chart.register(...registerables);
  
  let isLoading = true;
  let error = '';
  let devices: any[] = [];
  let selectedDevice: any = null;
  let timeRange = '24h'; // Default to 24 hours
  let pingMetrics: any = null;
  let snmpMetrics: any = null;
  let pingStats: any = null;
  
  // Chart references
  let pingUptimeChartCanvas: HTMLCanvasElement;
  let pingResponseChartCanvas: HTMLCanvasElement;
  let cpuChartCanvas: HTMLCanvasElement;
  let memoryChartCanvas: HTMLCanvasElement;
  let throughputChartCanvas: HTMLCanvasElement;
  let pingUptimeChart: Chart | null = null;
  let pingResponseChart: Chart | null = null;
  let cpuChart: Chart | null = null;
  let memoryChart: Chart | null = null;
  let throughputChart: Chart | null = null;
  
  let refreshInterval: any = null;
  let chartsInitialized = false;
  
  // Reactive: Re-initialize charts when canvas elements become available
  $: if (selectedDevice && pingMetrics && !chartsInitialized) {
    // Wait for canvas elements to be mounted
    setTimeout(async () => {
      await tick();
      if (pingUptimeChartCanvas || cpuChartCanvas) {
        console.log('[SNMP Graphs] Canvas elements detected, re-initializing charts...');
        initCharts();
        chartsInitialized = true;
      }
    }, 200);
  }
  
  // Convert timeRange to hours for API
  function getHours(): number {
    switch (timeRange) {
      case '1h': return 1;
      case '24h': return 24;
      case '7d': return 168;
      case '30d': return 720;
      default: return 24;
    }
  }
  
  onMount(async () => {
    await loadDevices();
    refreshInterval = setInterval(loadDevices, 60000); // Refresh every minute
  });
  
  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    pingUptimeChart?.destroy();
    pingResponseChart?.destroy();
    cpuChart?.destroy();
    memoryChart?.destroy();
    throughputChart?.destroy();
  });
  
  async function loadDevices() {
    if (!$currentTenant?.id) return;
    
    try {
      const user = auth().currentUser;
      if (!user) {
        error = 'Not authenticated';
        isLoading = false;
        return;
      }
      
      const token = await user.getIdToken();
      
      // Load devices from new monitoring graphs endpoint (includes both inventory and network equipment)
      const response = await fetch(`${API_CONFIG.PATHS.MONITORING_GRAPHS}/devices`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        devices = data.devices || [];
        isLoading = false;
        error = '';
        
        console.log(`[SNMP Graphs] Loaded ${devices.length} devices for graphing`, devices);
        
        // Auto-select first device if none selected
        if (!selectedDevice && devices.length > 0) {
          console.log(`[SNMP Graphs] Auto-selecting first device:`, devices[0]);
          selectDevice(devices[0]);
        } else if (selectedDevice) {
          // Refresh selected device if it's still in the list
          const refreshed = devices.find((d: any) => d.id === selectedDevice.id);
          if (refreshed) {
            console.log(`[SNMP Graphs] Refreshing selected device:`, refreshed);
            selectedDevice = refreshed;
            await loadDeviceMetrics();
          } else {
            console.log(`[SNMP Graphs] Selected device not found in list, auto-selecting first`);
            selectDevice(devices[0]);
          }
        }
      } else {
        const errorText = await response.text();
        console.error('[SNMP Graphs] Failed to load devices:', response.status, errorText);
        error = `Failed to load devices: ${response.status} ${response.statusText}`;
        isLoading = false;
        devices = [];
      }
    } catch (err: any) {
      console.error('[SNMP Graphs] Error loading devices:', err);
      if (err.message?.includes('Failed to fetch') || err.message?.includes('network')) {
        error = 'Backend server is not reachable. Please check if the monitoring service is running.';
      } else {
        error = `Failed to load devices: ${err.message || 'Unknown error'}`;
      }
      isLoading = false;
      devices = [];
    }
  }
  
  async function selectDevice(device: any) {
    console.log(`[SNMP Graphs] Selecting device:`, device);
    selectedDevice = device;
    await loadDeviceMetrics();
  }
  
  async function loadDeviceMetrics() {
    if (!selectedDevice || !$currentTenant?.id) {
      console.log(`[SNMP Graphs] Cannot load metrics - selectedDevice:`, selectedDevice, 'tenant:', $currentTenant?.id);
      return;
    }
    
    console.log(`[SNMP Graphs] Loading metrics for device:`, selectedDevice.id, selectedDevice.name);
    
    try {
      const user = auth().currentUser;
      if (!user) {
        console.log(`[SNMP Graphs] No authenticated user`);
        return;
      }
      
      const token = await user.getIdToken();
      const deviceId = selectedDevice.id;
      const hours = getHours();
      
      console.log(`[SNMP Graphs] Device capabilities - hasPing: ${selectedDevice.hasPing}, hasSNMP: ${selectedDevice.hasSNMP}, ipAddress: ${selectedDevice.ipAddress}`);
      
      // Load ping metrics if device has ping capability
      if (selectedDevice.hasPing && selectedDevice.ipAddress) {
        console.log(`[SNMP Graphs] Fetching ping metrics for device ${deviceId}...`);
        try {
          const pingResponse = await fetch(
            `${API_CONFIG.PATHS.MONITORING_GRAPHS}/ping/${deviceId}?hours=${hours}`, 
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'X-Tenant-ID': $currentTenant.id
              }
            }
          );
          
          if (pingResponse.ok) {
            const pingData = await pingResponse.json();
            console.log('[SNMP Graphs] Ping data received:', {
              hasData: !!pingData.data,
              labelsCount: pingData.data?.labels?.length || 0,
              datasetsCount: pingData.data?.datasets?.length || 0,
              stats: pingData.stats
            });
            pingMetrics = pingData.data || null;
            pingStats = pingData.stats || null;
          } else {
            const errorText = await pingResponse.text();
            console.error('[SNMP Graphs] Ping metrics request failed:', pingResponse.status, errorText);
          }
        } catch (err) {
          console.error('Failed to load ping metrics:', err);
        }
      }
      
      // Load SNMP metrics if device has SNMP capability
      if (selectedDevice.hasSNMP) {
        try {
          const snmpResponse = await fetch(
            `${API_CONFIG.PATHS.MONITORING_GRAPHS}/snmp/${deviceId}?hours=${hours}`, 
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'X-Tenant-ID': $currentTenant.id
              }
            }
          );
          
          if (snmpResponse.ok) {
            const snmpData = await snmpResponse.json();
            snmpMetrics = snmpData.data || null;
          }
        } catch (err) {
          console.error('Failed to load SNMP metrics:', err);
        }
      }
      
      console.log(`[SNMP Graphs] Metrics loaded - pingMetrics: ${!!pingMetrics}, snmpMetrics: ${!!snmpMetrics}`);
      
      // Wait for DOM to update before initializing charts
      await tick();
      
      // Reset initialization flag
      chartsInitialized = false;
      
      // Add small delay to ensure canvas elements are mounted
      setTimeout(() => {
        initCharts();
        chartsInitialized = true;
      }, 200);
    } catch (err) {
      console.error('[SNMP Graphs] Failed to load device metrics:', err);
    }
  }
  
  function initCharts() {
    console.log(`[SNMP Graphs] Initializing charts - hasPing: ${selectedDevice?.hasPing}, pingMetrics: ${!!pingMetrics}, hasSNMP: ${selectedDevice?.hasSNMP}, snmpMetrics: ${!!snmpMetrics}`);
    
    // Check if canvas elements are available
    const canvasCheck = {
      pingUptime: !!pingUptimeChartCanvas,
      pingResponse: !!pingResponseChartCanvas,
      cpu: !!cpuChartCanvas,
      memory: !!memoryChartCanvas,
      throughput: !!throughputChartCanvas
    };
    console.log(`[SNMP Graphs] Canvas elements available:`, canvasCheck);
    
    // Destroy existing charts
    pingUptimeChart?.destroy();
    pingResponseChart?.destroy();
    cpuChart?.destroy();
    memoryChart?.destroy();
    throughputChart?.destroy();
    
    // Initialize ping charts
    if (selectedDevice?.hasPing && pingMetrics) {
      console.log(`[SNMP Graphs] Initializing ping charts...`);
      try {
        initPingCharts();
      } catch (err) {
        console.error('[SNMP Graphs] Error initializing ping charts:', err);
      }
    } else {
      console.log(`[SNMP Graphs] Skipping ping charts - hasPing: ${selectedDevice?.hasPing}, pingMetrics: ${!!pingMetrics}`);
    }
    
    // Initialize SNMP charts
    if (selectedDevice?.hasSNMP && snmpMetrics) {
      console.log(`[SNMP Graphs] Initializing SNMP charts...`);
      try {
        initSNMPCharts();
      } catch (err) {
        console.error('[SNMP Graphs] Error initializing SNMP charts:', err);
      }
    } else {
      console.log(`[SNMP Graphs] Skipping SNMP charts - hasSNMP: ${selectedDevice?.hasSNMP}, snmpMetrics: ${!!snmpMetrics}`);
    }
  }
  
  function initPingCharts() {
    console.log(`[SNMP Graphs] initPingCharts called - pingMetrics:`, !!pingMetrics, 'labels:', pingMetrics?.labels?.length);
    
    if (!pingMetrics || !pingMetrics.labels || pingMetrics.labels.length === 0) {
      console.log(`[SNMP Graphs] initPingCharts aborted - no valid pingMetrics`);
      return;
    }
    
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' as const },
      animation: { duration: 750, easing: 'easeInOutQuart' as const },
      plugins: {
        legend: { display: true, labels: { color: '#94a3b8', usePointStyle: true } },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f1f5f9',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#9ca3af', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }
        },
        x: {
          ticks: { color: '#9ca3af', maxRotation: 45, font: { size: 10 }, maxTicksLimit: 12 },
          grid: { color: 'rgba(255,255,255,0.05)', display: false }
        }
      }
    };
    
    // Ping Uptime Chart (Status: 1=Online, 0=Offline)
    if (pingUptimeChartCanvas && pingMetrics.datasets && pingMetrics.datasets.length > 1) {
      const statusDataset = pingMetrics.datasets.find((d: any) => d.label.includes('Status'));
      if (statusDataset) {
        try {
          console.log(`[SNMP Graphs] Creating ping uptime chart with ${statusDataset.data.length} data points`);
          pingUptimeChart = new Chart(pingUptimeChartCanvas, {
          type: 'line',
          data: {
            labels: pingMetrics.labels.map((l: string) => {
              const d = new Date(l);
              return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
            }),
            datasets: [{
              ...statusDataset,
              borderColor: statusDataset.data.map((v: number) => v === 1 ? '#22c55e' : '#ef4444'),
              backgroundColor: statusDataset.data.map((v: number) => v === 1 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'),
              fill: true,
              pointRadius: 2,
              pointHoverRadius: 5,
              tension: 0.1
            }]
          },
          options: {
            ...chartOptions,
            scales: {
              ...chartOptions.scales,
              y: {
                ...chartOptions.scales.y,
                max: 1,
                min: 0,
                ticks: {
                  ...chartOptions.scales.y.ticks,
                  stepSize: 1,
                  callback: function(value) {
                    return value === 1 ? 'Online' : 'Offline';
                  }
                }
              }
            }
          }
        });
        console.log(`[SNMP Graphs] Ping uptime chart created successfully`);
        } catch (err) {
          console.error('[SNMP Graphs] Error creating ping uptime chart:', err);
        }
      } else {
        console.log(`[SNMP Graphs] Status dataset not found in ping metrics`);
      }
    } else {
      console.log(`[SNMP Graphs] Cannot create ping uptime chart - canvas: ${!!pingUptimeChartCanvas}, datasets: ${pingMetrics.datasets?.length || 0}`);
    }
    
    // Ping Response Time Chart
    if (pingResponseChartCanvas && pingMetrics.datasets) {
      const responseTimeDataset = pingMetrics.datasets.find((d: any) => d.label.includes('Response Time'));
      if (responseTimeDataset && responseTimeDataset.data.some((v: any) => v !== null)) {
        try {
          console.log(`[SNMP Graphs] Creating ping response time chart with ${responseTimeDataset.data.length} data points`);
          pingResponseChart = new Chart(pingResponseChartCanvas, {
          type: 'line',
          data: {
            labels: pingMetrics.labels.map((l: string) => {
              const d = new Date(l);
              return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
            }),
            datasets: [{
              ...responseTimeDataset,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              fill: true,
              tension: 0.3,
              pointRadius: 2,
              pointHoverRadius: 5
            }]
          },
          options: {
            ...chartOptions,
            scales: {
              ...chartOptions.scales,
              y: {
                ...chartOptions.scales.y,
                title: {
                  display: true,
                  text: 'Response Time (ms)',
                  color: '#94a3b8',
                  font: { size: 11 }
                }
              }
            }
          }
        });
      }
    }
  }
  
  function initSNMPCharts() {
    if (!snmpMetrics || !snmpMetrics.labels || snmpMetrics.labels.length === 0) return;
    
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' as const },
      animation: { duration: 750, easing: 'easeInOutQuart' as const },
      plugins: {
        legend: { display: false, labels: { color: '#94a3b8' } },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f1f5f9',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#9ca3af', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }
        },
        x: {
          ticks: { color: '#9ca3af', maxRotation: 45, font: { size: 10 }, maxTicksLimit: 12 },
          grid: { color: 'rgba(255,255,255,0.05)', display: false }
        }
      }
    };
    
    // CPU Chart
    if (cpuChartCanvas && snmpMetrics.datasets) {
      const cpuDataset = snmpMetrics.datasets.find((d: any) => d.label.includes('CPU'));
      if (cpuDataset && cpuDataset.data.some((v: any) => v !== null)) {
        cpuChart = new Chart(cpuChartCanvas, {
          type: 'line',
          data: {
            labels: snmpMetrics.labels.map((l: string) => {
              const d = new Date(l);
              return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
            }),
            datasets: [{
              ...cpuDataset,
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              pointHoverRadius: 4
            }]
          },
          options: {
            ...chartOptions,
            scales: {
              ...chartOptions.scales,
              y: {
                ...chartOptions.scales.y,
                max: 100,
                title: {
                  display: true,
                  text: 'CPU Usage (%)',
                  color: '#94a3b8',
                  font: { size: 11 }
                }
              }
            }
          }
        });
      }
    }
    
    // Memory Chart
    if (memoryChartCanvas && snmpMetrics.datasets) {
      const memoryDataset = snmpMetrics.datasets.find((d: any) => d.label.includes('Memory'));
      if (memoryDataset && memoryDataset.data.some((v: any) => v !== null)) {
        memoryChart = new Chart(memoryChartCanvas, {
          type: 'line',
          data: {
            labels: snmpMetrics.labels.map((l: string) => {
              const d = new Date(l);
              return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
            }),
            datasets: [{
              ...memoryDataset,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              pointHoverRadius: 4
            }]
          },
          options: {
            ...chartOptions,
            scales: {
              ...chartOptions.scales,
              y: {
                ...chartOptions.scales.y,
                max: 100,
                title: {
                  display: true,
                  text: 'Memory Usage (%)',
                  color: '#94a3b8',
                  font: { size: 11 }
                }
              }
            }
          }
        });
      }
    }
    
    // Throughput Chart
    if (throughputChartCanvas && snmpMetrics.datasets) {
      const throughputDatasets = snmpMetrics.datasets.filter((d: any) => 
        d.label.includes('Throughput') || d.label.includes('In') || d.label.includes('Out')
      );
      if (throughputDatasets.length > 0) {
        throughputChart = new Chart(throughputChartCanvas, {
          type: 'line',
          data: {
            labels: snmpMetrics.labels.map((l: string) => {
              const d = new Date(l);
              return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
            }),
            datasets: throughputDatasets.map((dataset: any, idx: number) => ({
              ...dataset,
              borderColor: idx === 0 ? '#8b5cf6' : '#ec4899',
              backgroundColor: idx === 0 ? 'rgba(139, 92, 246, 0.1)' : 'rgba(236, 72, 153, 0.1)',
              fill: false,
              tension: 0.3,
              pointRadius: 0,
              pointHoverRadius: 4
            }))
          },
          options: {
            ...chartOptions,
            plugins: {
              ...chartOptions.plugins,
              legend: {
                display: true,
                position: 'top',
                labels: { color: '#94a3b8', usePointStyle: true }
              }
            },
            scales: {
              ...chartOptions.scales,
              y: {
                ...chartOptions.scales.y,
                title: {
                  display: true,
                  text: 'Bytes',
                  color: '#94a3b8',
                  font: { size: 11 }
                }
              }
            }
          }
        });
      }
    }
  }
  
  function getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'online':
      case 'active': return 'status-online';
      case 'offline':
      case 'inactive': return 'status-offline';
      default: return 'status-warning';
    }
  }
  
  function formatUptimePercent(percent: number): string {
    if (percent === null || percent === undefined) return 'N/A';
    return `${percent.toFixed(2)}%`;
  }
</script>

<div class="snmp-graphs-panel">
  {#if isLoading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading devices...</p>
    </div>
  {:else if error}
    <div class="no-devices error">
      <p>⚠️ {error}</p>
      <p class="hint">Please check your connection and try refreshing the page</p>
    </div>
  {:else if devices.length === 0}
    <div class="no-devices">
      <p>📊 No devices available for monitoring</p>
      <p class="hint">Deploy devices with IP addresses to enable ping monitoring, or enable graphs on discovered SNMP devices</p>
    </div>
  {:else}
    <div class="panel-layout">
      <!-- Device List Sidebar -->
      <div class="device-sidebar">
        <h3>📡 Devices</h3>
        <div class="device-list">
          {#each devices as device}
            <button 
              class="device-item {selectedDevice?.id === device.id ? 'selected' : ''}"
              on:click={() => selectDevice(device)}
            >
              <span class="device-status {getStatusColor(device.status || 'unknown')}"></span>
              <div class="device-info">
                <span class="device-name">{device.name || 'Unknown'}</span>
                <span class="device-details">
                  <span class="device-ip">{device.ipAddress || 'N/A'}</span>
                  {#if device.manufacturer}
                    <span class="device-manufacturer"> • {device.manufacturer}</span>
                  {/if}
                  <div class="device-capabilities">
                    {#if device.hasPing}
                      <span class="capability ping">Ping</span>
                    {/if}
                    {#if device.hasSNMP}
                      <span class="capability snmp">SNMP</span>
                    {/if}
                  </div>
                </span>
              </div>
            </button>
          {/each}
        </div>
      </div>
      
      <!-- Graphs Area -->
      <div class="graphs-area">
        {#if selectedDevice}
          <div class="device-header">
            <div>
              <h2>{selectedDevice.name || 'Device'}</h2>
              <div class="device-subtitle">
                <span class="ip">{selectedDevice.ipAddress || 'No IP'}</span>
                {#if selectedDevice.manufacturer}
                  <span class="manufacturer"> • {selectedDevice.manufacturer}</span>
                {/if}
                {#if pingStats}
                  <span class="uptime-badge {pingStats.current_status === 'online' ? 'online' : 'offline'}">
                    {pingStats.uptime_percent} uptime
                  </span>
                {/if}
              </div>
            </div>
            <div class="time-selector">
              <button class="{timeRange === '1h' ? 'active' : ''}" on:click={() => { timeRange = '1h'; loadDeviceMetrics(); }}>1H</button>
              <button class="{timeRange === '24h' ? 'active' : ''}" on:click={() => { timeRange = '24h'; loadDeviceMetrics(); }}>24H</button>
              <button class="{timeRange === '7d' ? 'active' : ''}" on:click={() => { timeRange = '7d'; loadDeviceMetrics(); }}>7D</button>
              <button class="{timeRange === '30d' ? 'active' : ''}" on:click={() => { timeRange = '30d'; loadDeviceMetrics(); }}>30D</button>
            </div>
          </div>
          
          <!-- Ping Stats -->
          {#if pingStats}
            <div class="quick-stats">
              <div class="stat">
                <span class="stat-label">Current Status</span>
                <span class="stat-value {pingStats.current_status === 'online' ? 'status-online' : 'status-offline'}">
                  {pingStats.current_status || 'Unknown'}
                </span>
              </div>
              <div class="stat">
                <span class="stat-label">Uptime</span>
                <span class="stat-value">{formatUptimePercent(pingStats.uptime_percent)}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Avg Response</span>
                <span class="stat-value">{pingStats.avg_response_time_ms ? `${pingStats.avg_response_time_ms.toFixed(1)}ms` : 'N/A'}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Failed Pings</span>
                <span class="stat-value">{pingStats.failed || 0} / {pingStats.total || 0}</span>
              </div>
            </div>
          {/if}
          
          <!-- Charts Grid -->
          <div class="charts-grid">
            {#if selectedDevice.hasPing}
              <div class="chart-card">
                <h4>🟢 Ping Uptime</h4>
                <div class="chart-container">
                  <canvas bind:this={pingUptimeChartCanvas}></canvas>
                </div>
              </div>
              <div class="chart-card">
                <h4>⏱️ Ping Response Time</h4>
                <div class="chart-container">
                  <canvas bind:this={pingResponseChartCanvas}></canvas>
                </div>
              </div>
            {/if}
            
            {#if selectedDevice.hasSNMP}
              <div class="chart-card">
                <h4>💻 CPU Usage</h4>
                <div class="chart-container">
                  <canvas bind:this={cpuChartCanvas}></canvas>
                </div>
              </div>
              <div class="chart-card">
                <h4>🧠 Memory Usage</h4>
                <div class="chart-container">
                  <canvas bind:this={memoryChartCanvas}></canvas>
                </div>
              </div>
              <div class="chart-card wide">
                <h4>🌐 Network Throughput</h4>
                <div class="chart-container">
                  <canvas bind:this={throughputChartCanvas}></canvas>
                </div>
              </div>
            {/if}
          </div>
          
          {#if !selectedDevice.hasPing && !selectedDevice.hasSNMP}
            <div class="no-data-message">
              <p>📊 No monitoring data available for this device</p>
              <p class="hint">Device needs an IP address for ping monitoring or SNMP configuration for SNMP metrics</p>
            </div>
          {/if}
        {:else}
          <div class="no-selection">
            <p>👈 Select a device to view metrics</p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .snmp-graphs-panel {
    height: 100%;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: #e2e8f0;
    overflow: hidden;
  }
  
  .loading, .no-devices, .no-selection {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #64748b;
    gap: 1rem;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(59, 130, 246, 0.3);
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .hint {
    font-size: 0.875rem;
    color: #475569;
  }
  
  .no-devices.error {
    color: #f87171;
  }
  
  .no-devices.error p {
    font-size: 1.1rem;
    font-weight: 500;
  }
  
  .panel-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    height: 100%;
  }
  
  .device-sidebar {
    background: rgba(0,0,0,0.3);
    border-right: 1px solid rgba(255,255,255,0.1);
    padding: 1rem;
    overflow-y: auto;
  }
  
  .device-sidebar h3 {
    margin: 0 0 1rem;
    font-size: 1rem;
    color: #94a3b8;
  }
  
  .device-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .device-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: rgba(255,255,255,0.05);
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }
  
  .device-item:hover {
    background: rgba(255,255,255,0.1);
  }
  
  .device-item.selected {
    background: rgba(59, 130, 246, 0.2);
    border-color: #3b82f6;
  }
  
  .device-status {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  
  .status-online { background: #22c55e; box-shadow: 0 0 8px rgba(34, 197, 94, 0.5); }
  .status-offline { background: #ef4444; }
  .status-warning { background: #f59e0b; }
  
  .device-info {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex: 1;
  }
  
  .device-name {
    font-weight: 500;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .device-ip {
    font-size: 0.75rem;
    color: #64748b;
    font-family: monospace;
  }
  
  .device-capabilities {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }
  
  .capability {
    font-size: 0.65rem;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-weight: 500;
  }
  
  .capability.ping {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
  }
  
  .capability.snmp {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
  }
  
  .graphs-area {
    padding: 1.5rem;
    overflow-y: auto;
  }
  
  .device-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    padding-top: 1rem;
  }
  
  .device-header h2 {
    margin: 0 0 0.25rem 0;
    font-size: 1.5rem;
    color: #f1f5f9;
  }
  
  .device-subtitle {
    font-size: 0.875rem;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .uptime-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }
  
  .uptime-badge.online {
    background: rgba(34, 197, 94, 0.2);
    color: #34d399;
  }
  
  .uptime-badge.offline {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }
  
  .time-selector {
    display: flex;
    gap: 0.5rem;
  }
  
  .time-selector button {
    padding: 0.5rem 1rem;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
  }
  
  .time-selector button:hover {
    background: rgba(255,255,255,0.1);
  }
  
  .time-selector button.active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: white;
  }
  
  .quick-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .stat {
    background: rgba(255,255,255,0.05);
    padding: 1rem;
    border-radius: 8px;
    text-align: center;
  }
  
  .stat-label {
    display: block;
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }
  
  .stat-value {
    font-size: 1.1rem;
    font-weight: 600;
    color: #f1f5f9;
  }
  
  .stat-value.status-online { color: #22c55e; }
  .stat-value.status-offline { color: #ef4444; }
  
  .charts-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
  
  .chart-card {
    background: rgba(255,255,255,0.05);
    border-radius: 12px;
    padding: 1rem;
  }
  
  .chart-card.wide {
    grid-column: 1 / -1;
  }
  
  .chart-card h4 {
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
    color: #94a3b8;
  }
  
  .chart-container {
    height: 200px;
    position: relative;
  }
  
  .no-data {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #64748b;
    font-size: 0.875rem;
  }
  
  .no-data-message {
    grid-column: 1 / -1;
    text-align: center;
    padding: 3rem 2rem;
    color: #64748b;
    background: rgba(255,255,255,0.05);
    border-radius: 12px;
    margin: 2rem 0;
  }
  
  @media (max-width: 768px) {
    .panel-layout {
      grid-template-columns: 1fr;
    }
    
    .device-sidebar {
      max-height: 200px;
    }
    
    .charts-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

