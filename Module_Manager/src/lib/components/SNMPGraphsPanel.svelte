<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import { auth } from '$lib/firebase';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { API_CONFIG } from '$lib/config/api';
  
  Chart.register(...registerables);
  
  let isLoading = true;
  let error = '';
  let devices: any[] = [];
  let selectedDevice: any = null;
  let timeRange = '1h';
  let metricsData: any[] = [];
  
  // Chart references
  let cpuChartCanvas: HTMLCanvasElement;
  let memoryChartCanvas: HTMLCanvasElement;
  let throughputChartCanvas: HTMLCanvasElement;
  let uptimeChartCanvas: HTMLCanvasElement;
  let cpuChart: Chart | null = null;
  let memoryChart: Chart | null = null;
  let throughputChart: Chart | null = null;
  let uptimeChart: Chart | null = null;
  
  let refreshInterval: any = null;
  
  onMount(async () => {
    await loadDevices();
    refreshInterval = setInterval(loadDevices, 60000); // Refresh every minute
  });
  
  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    cpuChart?.destroy();
    memoryChart?.destroy();
    throughputChart?.destroy();
    uptimeChart?.destroy();
  });
  
  async function loadDevices() {
    if (!$currentTenant?.id) return;
    
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      
      const response = await fetch(`${API_CONFIG.PATHS.SNMP_MONITORING}/devices`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        devices = data.devices || data || [];
        isLoading = false;
        
        // Auto-select first device if none selected
        if (!selectedDevice && devices.length > 0) {
          selectDevice(devices[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load SNMP devices:', err);
      error = 'Failed to load devices';
      isLoading = false;
    }
  }
  
  async function selectDevice(device: any) {
    selectedDevice = device;
    await loadDeviceMetrics();
  }
  
  async function loadDeviceMetrics() {
    if (!selectedDevice || !$currentTenant?.id) return;
    
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const deviceId = selectedDevice._id || selectedDevice.id;
      
      const response = await fetch(
        `${API_CONFIG.PATHS.SNMP_MONITORING}/metrics/${deviceId}?timeRange=${timeRange}`, 
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': $currentTenant.id
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        metricsData = data.dataPoints || [];
        initCharts();
      }
    } catch (err) {
      console.error('Failed to load device metrics:', err);
    }
  }
  
  function initCharts() {
    // Destroy existing charts
    cpuChart?.destroy();
    memoryChart?.destroy();
    throughputChart?.destroy();
    uptimeChart?.destroy();
    
    // If no data, show empty state - don't create charts
    if (metricsData.length === 0) {
      cpuChart = null;
      memoryChart = null;
      throughputChart = null;
      uptimeChart = null;
      return;
    }
    
    // Format labels based on time range for better readability
    const labels = metricsData.map(m => {
      const d = new Date(m.timestamp);
      if (timeRange === '1h') {
        return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
      } else if (timeRange === '24h') {
        return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:00`;
      } else {
        return `${d.getMonth() + 1}/${d.getDate()}`;
      }
    });
    
    // Professional time-series chart options
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index' as const
      },
      animation: {
        duration: 750,
        easing: 'easeInOutQuart' as const
      },
      plugins: {
        legend: { 
          display: false,
          labels: {
            color: '#94a3b8',
            usePointStyle: true,
            padding: 15
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f1f5f9',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function(context: any) {
              const value = context.parsed.y;
              if (value === null || value === undefined) return 'No data';
              return `${context.dataset.label}: ${value.toFixed(2)}${context.dataset.label.includes('%') ? '%' : context.dataset.label.includes('MB') ? ' MB' : context.dataset.label.includes('GB') ? ' GB' : ''}`;
            }
          }
        },
        title: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { 
            color: '#9ca3af', 
            font: { size: 11 },
            precision: 1
          },
          grid: { 
            color: 'rgba(255,255,255,0.05)',
            drawBorder: false
          },
          border: {
            color: 'rgba(255,255,255,0.1)'
          }
        },
        x: {
          ticks: { 
            color: '#9ca3af', 
            maxRotation: 45,
            minRotation: 0,
            font: { size: 10 }, 
            maxTicksLimit: 12
          },
          grid: { 
            color: 'rgba(255,255,255,0.05)',
            display: false
          },
          border: {
            color: 'rgba(255,255,255,0.1)'
          }
        }
      }
    };
    
    // Filter out null/undefined values and configure Chart.js to skip them
    const cpuData = metricsData.map(m => {
      const val = m.metrics?.cpuUsage;
      return val !== null && val !== undefined ? val : null;
    });
    const memoryData = metricsData.map(m => {
      const val = m.metrics?.memoryUsage;
      return val !== null && val !== undefined ? val : null;
    });
    const inOctetsData = metricsData.map(m => {
      const val = m.metrics?.interfaceInOctets;
      return val !== null && val !== undefined ? val : null;
    });
    const outOctetsData = metricsData.map(m => {
      const val = m.metrics?.interfaceOutOctets;
      return val !== null && val !== undefined ? val : null;
    });
    
    // Check if we have any real data
    const hasCpuData = cpuData.some(v => v !== null);
    const hasMemoryData = memoryData.some(v => v !== null);
    const hasNetworkData = inOctetsData.some(v => v !== null) || outOctetsData.some(v => v !== null);
    
    if (cpuChartCanvas) {
      if (hasCpuData) {
        cpuChart = new Chart(cpuChartCanvas, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'CPU Usage (%)',
              data: cpuData,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              pointHoverRadius: 4,
              borderWidth: 2,
              spanGaps: false // Don't connect points across null gaps
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
                  text: 'Usage %',
                  color: '#94a3b8',
                  font: { size: 11 }
                }
              } 
            } 
          }
        });
      } else {
        // Show "No Data" message instead of empty chart
        const ctx = cpuChartCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, cpuChartCanvas.width, cpuChartCanvas.height);
          ctx.fillStyle = '#64748b';
          ctx.font = '14px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText('No CPU data available', cpuChartCanvas.width / 2, cpuChartCanvas.height / 2);
        }
      }
    }
    
    if (memoryChartCanvas) {
      if (hasMemoryData) {
        memoryChart = new Chart(memoryChartCanvas, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Memory Usage (%)',
              data: memoryData,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              pointHoverRadius: 4,
              borderWidth: 2,
              spanGaps: false
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
                  text: 'Usage %',
                  color: '#94a3b8',
                  font: { size: 11 }
                }
              } 
            } 
          }
        });
      } else {
        const ctx = memoryChartCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, memoryChartCanvas.width, memoryChartCanvas.height);
          ctx.fillStyle = '#64748b';
          ctx.font = '14px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText('No Memory data available', memoryChartCanvas.width / 2, memoryChartCanvas.height / 2);
        }
      }
    }
    
    if (throughputChartCanvas) {
      if (hasNetworkData) {
        throughputChart = new Chart(throughputChartCanvas, {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'In (bytes)',
                data: inOctetsData,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                fill: false,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                borderWidth: 2,
                spanGaps: false
              },
              {
                label: 'Out (bytes)',
                data: outOctetsData,
                borderColor: '#ec4899',
                backgroundColor: 'rgba(236, 72, 153, 0.1)',
                fill: false,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                borderWidth: 2,
                spanGaps: false
              }
            ]
          },
          options: {
            ...chartOptions,
            plugins: { 
              ...chartOptions.plugins, 
              legend: { 
                display: true, 
                position: 'top', 
                labels: { 
                  color: '#94a3b8',
                  usePointStyle: true,
                  padding: 12
                } 
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
      } else {
        const ctx = throughputChartCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, throughputChartCanvas.width, throughputChartCanvas.height);
          ctx.fillStyle = '#64748b';
          ctx.font = '14px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText('No Network data available', throughputChartCanvas.width / 2, throughputChartCanvas.height / 2);
        }
      }
    }
  }
  
  function formatUptime(seconds: number): string {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
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
</script>

<div class="snmp-graphs-panel">
  {#if isLoading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading SNMP devices...</p>
    </div>
  {:else if devices.length === 0}
    <div class="no-devices">
      <p>📊 No SNMP devices found</p>
      <p class="hint">Add SNMP-enabled devices in the Hardware module</p>
    </div>
  {:else}
    <div class="panel-layout">
      <!-- Device List Sidebar -->
      <div class="device-sidebar">
        <h3>📡 SNMP Devices</h3>
        <div class="device-list">
          {#each devices as device}
            <button 
              class="device-item {selectedDevice?.id === device.id || selectedDevice?._id === device._id ? 'selected' : ''}"
              on:click={() => selectDevice(device)}
            >
              <span class="device-status {getStatusColor(device.status)}"></span>
              <div class="device-info">
                <span class="device-name">{device.name || device.hostname || 'Unknown'}</span>
                <span class="device-ip">{device.ip_address || device.management_ip || 'N/A'}</span>
              </div>
            </button>
          {/each}
        </div>
      </div>
      
      <!-- Graphs Area -->
      <div class="graphs-area">
        {#if selectedDevice}
          <div class="device-header">
            <h2>{selectedDevice.name || 'Device'}</h2>
            <div class="time-selector">
              <button class="{timeRange === '1h' ? 'active' : ''}" on:click={() => { timeRange = '1h'; loadDeviceMetrics(); }}>1H</button>
              <button class="{timeRange === '24h' ? 'active' : ''}" on:click={() => { timeRange = '24h'; loadDeviceMetrics(); }}>24H</button>
              <button class="{timeRange === '7d' ? 'active' : ''}" on:click={() => { timeRange = '7d'; loadDeviceMetrics(); }}>7D</button>
            </div>
          </div>
          
          <!-- Quick Stats -->
          <div class="quick-stats">
            <div class="stat">
              <span class="stat-label">Status</span>
              <span class="stat-value {getStatusColor(selectedDevice.status)}">{selectedDevice.status || 'Unknown'}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Type</span>
              <span class="stat-value">{selectedDevice.type || selectedDevice.device_type || 'N/A'}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Uptime</span>
              <span class="stat-value">{formatUptime(metricsData[metricsData.length - 1]?.metrics?.uptime)}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Temperature</span>
              <span class="stat-value">{metricsData[metricsData.length - 1]?.metrics?.temperature ?? 'N/A'}°C</span>
            </div>
          </div>
          
          <!-- Charts Grid -->
          {#if metricsData.length === 0}
            <div class="no-data-message">
              <p>📊 No metrics data available for this device</p>
              <p class="hint">SNMP polling needs to collect data before graphs will appear</p>
            </div>
          {:else}
            <div class="charts-grid">
              <div class="chart-card">
                <h4>CPU Usage</h4>
                <div class="chart-container">
                  <canvas bind:this={cpuChartCanvas}></canvas>
                </div>
              </div>
              <div class="chart-card">
                <h4>Memory Usage</h4>
                <div class="chart-container">
                  <canvas bind:this={memoryChartCanvas}></canvas>
                </div>
              </div>
              <div class="chart-card wide">
                <h4>Network Throughput (Interface)</h4>
                <div class="chart-container">
                  <canvas bind:this={throughputChartCanvas}></canvas>
                </div>
              </div>
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
  
  .no-data-message {
    grid-column: 1 / -1;
    text-align: center;
    padding: 3rem 2rem;
    color: #64748b;
    background: rgba(255,255,255,0.05);
    border-radius: 12px;
    margin: 2rem 0;
  }
  
  .no-data-message p {
    margin: 0.5rem 0;
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
  
  .graphs-area {
    padding: 1.5rem;
    overflow-y: auto;
  }
  
  .device-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  
  .device-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #f1f5f9;
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
    height: 180px;
    position: relative;
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

