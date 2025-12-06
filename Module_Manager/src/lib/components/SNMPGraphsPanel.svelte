<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ECharts from '$lib/components/ECharts.svelte';
  import type { EChartsOption } from 'echarts';
  import { auth } from '$lib/firebase';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { API_CONFIG } from '$lib/config/api';
  
  let isLoading = true;
  let error = '';
  let devices: any[] = [];
  let selectedDevice: any = null;
  let timeRange = '24h';
  let pingMetrics: any = null;
  let snmpMetrics: any = null;
  let pingStats: any = null;
  
  // ECharts options for each chart
  let pingUptimeOption: EChartsOption | null = null;
  let pingResponseOption: EChartsOption | null = null;
  let cpuOption: EChartsOption | null = null;
  let memoryOption: EChartsOption | null = null;
  let throughputOption: EChartsOption | null = null;
  
  let refreshInterval: any = null;
  
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
    console.log('[SNMPGraphsPanel] Component mounted, initializing ECharts graphs...');
    await loadDevices();
    refreshInterval = setInterval(loadDevices, 60000);
    console.log('[SNMPGraphsPanel] Initialization complete');
  });
  
  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
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
        
        console.log('[SNMPGraphsPanel] Loaded devices:', devices.length);
        if (!selectedDevice && devices.length > 0) {
          console.log('[SNMPGraphsPanel] Auto-selecting first device:', devices[0].name || devices[0].id);
          selectDevice(devices[0]);
        } else if (selectedDevice) {
          const refreshed = devices.find((d: any) => d.id === selectedDevice.id);
          if (refreshed) {
            console.log('[SNMPGraphsPanel] Refreshing selected device:', refreshed.name || refreshed.id);
            selectedDevice = refreshed;
            await loadDeviceMetrics();
          } else {
            console.log('[SNMPGraphsPanel] Selected device not found, selecting first device');
            selectDevice(devices[0]);
          }
        } else {
          console.log('[SNMPGraphsPanel] No devices available to select');
        }
      } else {
        const errorText = await response.text();
        console.error('[SNMP Graphs] Failed to load devices:', response.status, errorText);
        error = `Failed to load devices: ${response.status}`;
        isLoading = false;
        devices = [];
      }
    } catch (err: any) {
      console.error('[SNMP Graphs] Error loading devices:', err);
      error = err.message?.includes('Failed to fetch') 
        ? 'Backend server is not reachable. Please check if the monitoring service is running.'
        : `Failed to load devices: ${err.message || 'Unknown error'}`;
      isLoading = false;
      devices = [];
    }
  }
  
  async function selectDevice(device: any) {
    console.log('[SNMPGraphsPanel] Selecting device:', device.name || device.id, 'hasPing:', device.hasPing, 'hasSNMP:', device.hasSNMP);
    selectedDevice = device;
    // Reset chart options
    pingUptimeOption = null;
    pingResponseOption = null;
    cpuOption = null;
    memoryOption = null;
    throughputOption = null;
    await loadDeviceMetrics();
  }
  
  async function loadDeviceMetrics() {
    if (!selectedDevice || !$currentTenant?.id) return;
    
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const deviceId = selectedDevice.id;
      const hours = getHours();
      
      // Load ping metrics
      if (selectedDevice.hasPing && selectedDevice.ipAddress) {
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
            console.log('[SNMPGraphsPanel] Ping data received:', {
              deviceId: deviceId,
              hasData: !!pingData.data,
              labelsCount: pingData.data?.labels?.length || 0,
              datasetsCount: pingData.data?.datasets?.length || 0,
              stats: pingData.stats,
              hours: hours
            });
            pingMetrics = pingData.data || null;
            pingStats = pingData.stats || null;
            updatePingCharts();
          } else {
            const errorText = await pingResponse.text();
            console.error('[SNMPGraphsPanel] Ping metrics request failed:', pingResponse.status, errorText);
          }
        } catch (err) {
          console.error('Failed to load ping metrics:', err);
        }
      }
      
      // Load SNMP metrics
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
            console.log('[SNMPGraphsPanel] SNMP data received:', {
              hasData: !!snmpData.data,
              labelsCount: snmpData.data?.labels?.length || 0,
              datasetsCount: snmpData.data?.datasets?.length || 0
            });
            snmpMetrics = snmpData.data || null;
            updateSNMPCharts();
          } else {
            const errorText = await snmpResponse.text();
            console.error('[SNMPGraphsPanel] SNMP metrics request failed:', snmpResponse.status, errorText);
          }
        } catch (err) {
          console.error('Failed to load SNMP metrics:', err);
        }
      }
    } catch (err) {
      console.error('[SNMP Graphs] Failed to load device metrics:', err);
    }
  }
  
  function updatePingCharts() {
    console.log('[SNMPGraphsPanel] updatePingCharts called, pingMetrics:', !!pingMetrics, 'labels:', pingMetrics?.labels?.length || 0);
    if (!pingMetrics || !pingMetrics.labels || pingMetrics.labels.length === 0) {
      console.log('[SNMPGraphsPanel] No ping metrics data, clearing chart options');
      pingUptimeOption = null;
      pingResponseOption = null;
      return;
    }
    
    const labels = pingMetrics.labels.map((l: string) => new Date(l).getTime());
    
    // Ping Uptime Chart
    const statusDataset = pingMetrics.datasets?.find((d: any) => 
      d.label && (d.label.includes('Status') || d.label.includes('status'))
    );
    
    if (statusDataset && statusDataset.data && statusDataset.data.length > 0) {
      const data = labels.map((time: number, idx: number) => [time, statusDataset.data[idx]]);
      const colors = statusDataset.data.map((v: number) => v === 1 ? '#22c55e' : '#ef4444');
      
      pingUptimeOption = {
        grid: { top: 20, right: 30, bottom: 40, left: 50 },
        xAxis: {
          type: 'time',
          boundaryGap: false,
          axisLabel: {
            color: '#9ca3af',
            fontSize: 10,
            rotate: 45
          },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          splitLine: { show: false }
        },
        yAxis: {
          type: 'value',
          min: 0,
          max: 1,
          interval: 1,
          axisLabel: {
            color: '#9ca3af',
            fontSize: 11,
            formatter: (value: number) => value === 1 ? 'Online' : 'Offline'
          },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          borderWidth: 1,
          textStyle: { color: '#cbd5e1' },
          axisPointer: { lineStyle: { color: 'rgba(59, 130, 246, 0.5)' } }
        },
        series: [{
          name: 'Status',
          type: 'line',
          data: data,
          itemStyle: {
            color: (params: any) => colors[params.dataIndex]
          },
          areaStyle: {
            color: (params: any) => {
              const value = statusDataset.data[params.dataIndex];
              return value === 1 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)';
            }
          },
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { width: 2 }
        }]
      };
      console.log('[SNMPGraphsPanel] Ping uptime chart option created');
    } else {
      console.log('[SNMPGraphsPanel] No status dataset found, clearing uptime chart');
      pingUptimeOption = null;
    }
    
    // Ping Response Time Chart
    const responseTimeDataset = pingMetrics.datasets?.find((d: any) => 
      d.label && (d.label.includes('Response Time') || d.label.includes('ResponseTime') || d.label.includes('response'))
    );
    
    if (responseTimeDataset && responseTimeDataset.data && responseTimeDataset.data.some((v: any) => v !== null && v !== undefined)) {
      const data = labels.map((time: number, idx: number) => [
        time,
        responseTimeDataset.data[idx] !== null && responseTimeDataset.data[idx] !== undefined 
          ? responseTimeDataset.data[idx] 
          : null
      ]);
      
      pingResponseOption = {
        grid: { top: 20, right: 30, bottom: 40, left: 60 },
        xAxis: {
          type: 'time',
          boundaryGap: false,
          axisLabel: {
            color: '#9ca3af',
            fontSize: 10,
            rotate: 45
          },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          splitLine: { show: false }
        },
        yAxis: {
          type: 'value',
          name: 'Response Time (ms)',
          nameLocation: 'middle',
          nameGap: 50,
          nameTextStyle: { color: '#94a3b8', fontSize: 11 },
          axisLabel: { color: '#9ca3af', fontSize: 11 },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          borderWidth: 1,
          textStyle: { color: '#cbd5e1' },
          axisPointer: { lineStyle: { color: 'rgba(59, 130, 246, 0.5)' } }
        },
        series: [{
          name: 'Response Time',
          type: 'line',
          data: data,
          itemStyle: { color: '#3b82f6' },
          areaStyle: { color: 'rgba(59, 130, 246, 0.15)' },
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { width: 2 }
        }]
      };
      console.log('[SNMPGraphsPanel] Ping response time chart option created');
    } else {
      console.log('[SNMPGraphsPanel] No response time dataset found, clearing response chart');
      pingResponseOption = null;
    }
  }
  
  function updateSNMPCharts() {
    console.log('[SNMPGraphsPanel] updateSNMPCharts called, snmpMetrics:', !!snmpMetrics, 'labels:', snmpMetrics?.labels?.length || 0);
    if (!snmpMetrics || !snmpMetrics.labels || snmpMetrics.labels.length === 0) {
      console.log('[SNMPGraphsPanel] No SNMP metrics data, clearing chart options');
      cpuOption = null;
      memoryOption = null;
      throughputOption = null;
      return;
    }
    
    const labels = snmpMetrics.labels.map((l: string) => new Date(l).getTime());
    
    // CPU Chart
    const cpuDataset = snmpMetrics.datasets?.find((d: any) => 
      d.label && (d.label.includes('CPU') || d.label.includes('cpu'))
    );
    
    if (cpuDataset && cpuDataset.data && cpuDataset.data.some((v: any) => v !== null && v !== undefined)) {
      const data = labels.map((time: number, idx: number) => [
        time,
        cpuDataset.data[idx] !== null && cpuDataset.data[idx] !== undefined 
          ? cpuDataset.data[idx] 
          : null
      ]);
      
      cpuOption = {
        grid: { top: 20, right: 30, bottom: 40, left: 60 },
        xAxis: {
          type: 'time',
          boundaryGap: false,
          axisLabel: {
            color: '#9ca3af',
            fontSize: 10,
            rotate: 45
          },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          splitLine: { show: false }
        },
        yAxis: {
          type: 'value',
          min: 0,
          max: 100,
          name: 'CPU Usage (%)',
          nameLocation: 'middle',
          nameGap: 50,
          nameTextStyle: { color: '#94a3b8', fontSize: 11 },
          axisLabel: { color: '#9ca3af', fontSize: 11 },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          borderWidth: 1,
          textStyle: { color: '#cbd5e1' },
          axisPointer: { lineStyle: { color: 'rgba(59, 130, 246, 0.5)' } }
        },
        series: [{
          name: 'CPU Usage',
          type: 'line',
          data: data,
          itemStyle: { color: '#ef4444' },
          areaStyle: { color: 'rgba(239, 68, 68, 0.15)' },
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 }
        }]
      };
      console.log('[SNMPGraphsPanel] CPU chart option created');
    } else {
      console.log('[SNMPGraphsPanel] No CPU dataset found, clearing CPU chart');
      cpuOption = null;
    }
    
    // Memory Chart
    const memoryDataset = snmpMetrics.datasets?.find((d: any) => 
      d.label && (d.label.includes('Memory') || d.label.includes('memory') || d.label.includes('RAM'))
    );
    
    if (memoryDataset && memoryDataset.data && memoryDataset.data.some((v: any) => v !== null && v !== undefined)) {
      const data = labels.map((time: number, idx: number) => [
        time,
        memoryDataset.data[idx] !== null && memoryDataset.data[idx] !== undefined 
          ? memoryDataset.data[idx] 
          : null
      ]);
      
      memoryOption = {
        grid: { top: 20, right: 30, bottom: 40, left: 60 },
        xAxis: {
          type: 'time',
          boundaryGap: false,
          axisLabel: {
            color: '#9ca3af',
            fontSize: 10,
            rotate: 45
          },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          splitLine: { show: false }
        },
        yAxis: {
          type: 'value',
          min: 0,
          max: 100,
          name: 'Memory Usage (%)',
          nameLocation: 'middle',
          nameGap: 50,
          nameTextStyle: { color: '#94a3b8', fontSize: 11 },
          axisLabel: { color: '#9ca3af', fontSize: 11 },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          borderWidth: 1,
          textStyle: { color: '#cbd5e1' },
          axisPointer: { lineStyle: { color: 'rgba(59, 130, 246, 0.5)' } }
        },
        series: [{
          name: 'Memory Usage',
          type: 'line',
          data: data,
          itemStyle: { color: '#3b82f6' },
          areaStyle: { color: 'rgba(59, 130, 246, 0.15)' },
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 }
        }]
      };
      console.log('[SNMPGraphsPanel] Memory chart option created');
    } else {
      console.log('[SNMPGraphsPanel] No memory dataset found, clearing memory chart');
      memoryOption = null;
    }
    
    // Throughput Chart
    const throughputDatasets = snmpMetrics.datasets?.filter((d: any) => 
      d.label && (d.label.includes('Throughput') || d.label.includes('throughput') || 
                  d.label.includes('In') || d.label.includes('Out') || d.label.includes('Network'))
    );
    
    if (throughputDatasets && throughputDatasets.length > 0) {
      const colors = ['#8b5cf6', '#ec4899'];
      const series = throughputDatasets.map((dataset: any, idx: number) => {
        const data = labels.map((time: number, dataIdx: number) => [
          time,
          dataset.data[dataIdx] !== null && dataset.data[dataIdx] !== undefined 
            ? dataset.data[dataIdx] 
            : null
        ]);
        
        return {
          name: dataset.label || `Series ${idx + 1}`,
          type: 'line',
          data: data,
          itemStyle: { color: colors[idx % colors.length] },
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 }
        };
      });
      
      throughputOption = {
        grid: { top: 40, right: 30, bottom: 40, left: 60 },
        legend: {
          top: 10,
          textStyle: { color: '#94a3b8' },
          icon: 'circle'
        },
        xAxis: {
          type: 'time',
          boundaryGap: false,
          axisLabel: {
            color: '#9ca3af',
            fontSize: 10,
            rotate: 45
          },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          splitLine: { show: false }
        },
        yAxis: {
          type: 'value',
          name: 'Bytes',
          nameLocation: 'middle',
          nameGap: 50,
          nameTextStyle: { color: '#94a3b8', fontSize: 11 },
          axisLabel: { color: '#9ca3af', fontSize: 11 },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          borderWidth: 1,
          textStyle: { color: '#cbd5e1' },
          axisPointer: { lineStyle: { color: 'rgba(59, 130, 246, 0.5)' } }
        },
        series: series
      };
      console.log('[SNMPGraphsPanel] Throughput chart option created with', series.length, 'series');
    } else {
      console.log('[SNMPGraphsPanel] No throughput datasets found, clearing throughput chart');
      throughputOption = null;
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
          
          <div class="charts-grid">
            {#if selectedDevice.hasPing}
              {#if pingUptimeOption}
                <div class="chart-card">
                  <h4>🟢 Ping Uptime</h4>
                  <div class="chart-container">
                    <ECharts option={pingUptimeOption} height={200} theme="dark" loading={!pingMetrics} />
                  </div>
                </div>
              {:else if isLoading}
                <div class="chart-card">
                  <h4>🟢 Ping Uptime</h4>
                  <div class="chart-container">
                    <div class="chart-loading">Loading ping data...</div>
                  </div>
                </div>
              {/if}
              {#if pingResponseOption}
                <div class="chart-card">
                  <h4>⏱️ Ping Response Time</h4>
                  <div class="chart-container">
                    <ECharts option={pingResponseOption} height={200} theme="dark" loading={!pingMetrics} />
                  </div>
                </div>
              {:else if isLoading}
                <div class="chart-card">
                  <h4>⏱️ Ping Response Time</h4>
                  <div class="chart-container">
                    <div class="chart-loading">Loading ping data...</div>
                  </div>
                </div>
              {/if}
            {/if}
            
            {#if selectedDevice.hasSNMP}
              {#if cpuOption}
                <div class="chart-card">
                  <h4>💻 CPU Usage</h4>
                  <div class="chart-container">
                    <ECharts option={cpuOption} height={200} theme="dark" loading={!snmpMetrics} />
                  </div>
                </div>
              {:else if isLoading}
                <div class="chart-card">
                  <h4>💻 CPU Usage</h4>
                  <div class="chart-container">
                    <div class="chart-loading">Loading SNMP data...</div>
                  </div>
                </div>
              {/if}
              {#if memoryOption}
                <div class="chart-card">
                  <h4>🧠 Memory Usage</h4>
                  <div class="chart-container">
                    <ECharts option={memoryOption} height={200} theme="dark" loading={!snmpMetrics} />
                  </div>
                </div>
              {:else if isLoading}
                <div class="chart-card">
                  <h4>🧠 Memory Usage</h4>
                  <div class="chart-container">
                    <div class="chart-loading">Loading SNMP data...</div>
                  </div>
                </div>
              {/if}
              {#if throughputOption}
                <div class="chart-card wide">
                  <h4>🌐 Network Throughput</h4>
                  <div class="chart-container">
                    <ECharts option={throughputOption} height={200} theme="dark" loading={!snmpMetrics} />
                  </div>
                </div>
              {:else if isLoading}
                <div class="chart-card wide">
                  <h4>🌐 Network Throughput</h4>
                  <div class="chart-container">
                    <div class="chart-loading">Loading SNMP data...</div>
                  </div>
                </div>
              {/if}
            {/if}
          </div>
          
          {#if selectedDevice.hasPing || selectedDevice.hasSNMP}
            {#if (!pingUptimeOption && !pingResponseOption && !cpuOption && !memoryOption && !throughputOption) && !isLoading}
              <div class="no-data-message">
                <p>📊 No monitoring data available yet</p>
                <p class="hint">
                  {#if selectedDevice.hasPing && selectedDevice.hasSNMP}
                    {#if !pingUptimeOption && !pingResponseOption && !cpuOption && !memoryOption}
                      <span>Waiting for ping and SNMP data collection...</span><br/>
                      <span style="font-size: 0.85rem; opacity: 0.8;">• Ping data: Collected every 60 seconds</span><br/>
                      <span style="font-size: 0.85rem; opacity: 0.8;">• SNMP data: Collected every 5 minutes</span><br/>
                      <span style="font-size: 0.85rem; opacity: 0.8;">• Check back in a few minutes for data to appear</span>
                    {:else if !pingUptimeOption && !pingResponseOption}
                      <span>Ping monitoring is collecting data...</span><br/>
                      <span style="font-size: 0.85rem; opacity: 0.8;">SNMP metrics are available. Ping data will appear once collected.</span>
                    {:else}
                      <span>SNMP monitoring is collecting data...</span><br/>
                      <span style="font-size: 0.85rem; opacity: 0.8;">Ping data is available. SNMP metrics will appear once collected.</span>
                    {/if}
                  {:else if selectedDevice.hasPing && !pingUptimeOption && !pingResponseOption}
                    <span>Ping monitoring is collecting data...</span><br/>
                    <span style="font-size: 0.85rem; opacity: 0.8;">• Devices are pinged every 60 seconds</span><br/>
                    <span style="font-size: 0.85rem; opacity: 0.8;">• Data will appear within the next few minutes</span><br/>
                    <span style="font-size: 0.85rem; opacity: 0.8;">• If no data appears, verify the IP address is reachable</span>
                  {:else if selectedDevice.hasSNMP && !cpuOption && !memoryOption && !throughputOption}
                    <span>SNMP metrics are being collected...</span><br/>
                    <span style="font-size: 0.85rem; opacity: 0.8;">• SNMP polling occurs every 5 minutes</span><br/>
                    <span style="font-size: 0.85rem; opacity: 0.8;">• Data will appear once the next poll completes</span><br/>
                    <span style="font-size: 0.85rem; opacity: 0.8;">• Verify SNMP community and version are configured correctly</span>
                  {:else}
                    Monitoring data is being collected. Data will appear once metrics are available.
                  {/if}
                </p>
              </div>
            {/if}
          {:else}
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

<!-- Include all the styles from the original component -->
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
  
  .chart-loading {
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
  
  .no-data-message p {
    margin: 0.5rem 0;
    line-height: 1.6;
  }
  
  .no-data-message .hint {
    margin-top: 1rem;
    font-size: 0.9rem;
    line-height: 1.8;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
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

