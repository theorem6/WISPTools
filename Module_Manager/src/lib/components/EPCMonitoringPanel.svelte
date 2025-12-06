<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ECharts from '$lib/components/ECharts.svelte';
  import type { EChartsOption } from 'echarts';
  import { auth } from '$lib/firebase';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { API_CONFIG } from '$lib/config/api';
  
  export let epc: any = null;
  export let onClose: () => void = () => {};
  
  let isLoading = false;
  let error = '';
  let success = '';
  let serviceStatus: any = null;
  let statusHistory: any[] = [];
  let commandHistory: any[] = [];
  
  // ECharts options
  let cpuChartOption: EChartsOption | null = null;
  let memoryChartOption: EChartsOption | null = null;
  let diskChartOption: EChartsOption | null = null;
  
  // Required services
  const SERVICES = [
    { id: 'open5gs-mmed', name: 'MME', description: 'Mobility Management Entity' },
    { id: 'open5gs-sgwcd', name: 'SGW-C', description: 'Serving Gateway Control' },
    { id: 'open5gs-sgwud', name: 'SGW-U', description: 'Serving Gateway User Plane' },
    { id: 'open5gs-smfd', name: 'SMF', description: 'Session Management Function' },
    { id: 'open5gs-upfd', name: 'UPF', description: 'User Plane Function' },
    { id: 'snmpd', name: 'SNMP', description: 'SNMP Agent' }
  ];
  
  onMount(async () => {
    await loadStatus();
    await loadStatusHistory();
    await loadCommandHistory();
    initCharts();
  });
  
  onDestroy(() => {
    // Charts are managed by Chart component
  });
  
  async function loadStatus() {
    if (!epc?.epc_id && !epc?.epcId) return;
    
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const epcId = epc.epc_id || epc.epcId;
      
      const response = await fetch(`${API_CONFIG.BASE}/epc/${epcId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant?.id || ''
        }
      });
      
      if (response.ok) {
        serviceStatus = await response.json();
      }
    } catch (err) {
      console.error('Failed to load status:', err);
    }
  }
  
  async function loadStatusHistory() {
    if (!epc?.epc_id && !epc?.epcId) return;
    
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const epcId = epc.epc_id || epc.epcId;
      
      const response = await fetch(`${API_CONFIG.BASE}/epc/${epcId}/status/history?hours=6&limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant?.id || ''
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.history && data.history.length > 0) {
          statusHistory = data.history.map(h => ({
            timestamp: new Date(h.timestamp),
            cpu: h.cpu ?? 0,
            memory: h.memory ?? 0,
            disk: h.disk ?? 0
          }));
        } else {
          // No data yet - show placeholder
          const now = Date.now();
          statusHistory = Array.from({ length: 5 }, (_, i) => ({
            timestamp: new Date(now - (4 - i) * 60000),
            cpu: 0,
            memory: 0,
            disk: 0
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load status history:', err);
      // Use empty data on error
      const now = Date.now();
      statusHistory = Array.from({ length: 5 }, (_, i) => ({
        timestamp: new Date(now - (4 - i) * 60000),
        cpu: 0,
        memory: 0,
        disk: 0
      }));
    }
  }
  
  async function loadCommandHistory() {
    if (!epc?.epc_id && !epc?.epcId) return;
    
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const epcId = epc.epc_id || epc.epcId;
      
      const response = await fetch(`${API_CONFIG.BASE}/epc/${epcId}/commands/history?limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant?.id || ''
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        commandHistory = data.commands || [];
      }
    } catch (err) {
      console.error('Failed to load command history:', err);
    }
  }
  
  function initCharts() {
    if (statusHistory.length === 0) {
      cpuChartOption = null;
      memoryChartOption = null;
      diskChartOption = null;
      return;
    }
    
    const timestamps = statusHistory.map(s => new Date(s.timestamp).getTime());
    
    // Common chart configuration
    const commonConfig = {
      grid: { top: 20, right: 30, bottom: 40, left: 50 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        textStyle: { color: '#cbd5e1' },
        axisPointer: { lineStyle: { color: 'rgba(59, 130, 246, 0.5)' } }
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
        min: 0,
        max: 100,
        axisLabel: {
          color: '#9ca3af',
          fontSize: 11,
          formatter: '{value}%'
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
      }
    };
    
    // CPU Chart
    cpuChartOption = {
      ...commonConfig,
      series: [{
        name: 'CPU %',
        type: 'line',
        data: timestamps.map((time, idx) => [time, statusHistory[idx].cpu]),
        itemStyle: { color: '#3b82f6' },
        areaStyle: { color: 'rgba(59, 130, 246, 0.2)' },
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2 }
      }]
    };
    
    // Memory Chart
    memoryChartOption = {
      ...commonConfig,
      series: [{
        name: 'Memory %',
        type: 'line',
        data: timestamps.map((time, idx) => [time, statusHistory[idx].memory]),
        itemStyle: { color: '#10b981' },
        areaStyle: { color: 'rgba(16, 185, 129, 0.2)' },
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2 }
      }]
    };
    
    // Disk Chart
    diskChartOption = {
      ...commonConfig,
      series: [{
        name: 'Disk %',
        type: 'line',
        data: timestamps.map((time, idx) => [time, statusHistory[idx].disk]),
        itemStyle: { color: '#f59e0b' },
        areaStyle: { color: 'rgba(245, 158, 11, 0.2)' },
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2 }
      }]
    };
  }
  
  async function refreshAll() {
    isLoading = true;
    await Promise.all([
      loadStatus(),
      loadStatusHistory(),
      loadCommandHistory()
    ]);
    initCharts();
    isLoading = false;
  }
  
  async function sendServiceCommand(action: string, services: string[] = ['all']) {
    if (!epc?.epc_id && !epc?.epcId) return;
    
    isLoading = true;
    error = '';
    success = '';
    
    try {
      const user = auth().currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();
      const epcId = epc.epc_id || epc.epcId;
      
      const response = await fetch(`${API_CONFIG.BASE}/epc/${epcId}/service/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant?.id || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ services })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        success = `${action.charAt(0).toUpperCase() + action.slice(1)} command queued. Will execute on next check-in.`;
        await loadCommandHistory();
      } else {
        error = data.error || 'Failed to send command';
      }
    } catch (err: any) {
      error = err.message || 'Failed to send command';
    } finally {
      isLoading = false;
    }
  }
  
  async function sendRebootCommand() {
    if (!confirm('Are you sure you want to reboot this EPC device? This will cause a brief service interruption.')) {
      return;
    }
    
    isLoading = true;
    error = '';
    success = '';
    
    try {
      const user = auth().currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();
      const epcId = epc.epc_id || epc.epcId;
      
      const response = await fetch(`${API_CONFIG.BASE}/epc/commands`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant?.id || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          epc_id: epcId,
          command_type: 'reboot'
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        success = 'Reboot command queued. Device will reboot on next check-in.';
        await loadCommandHistory();
      } else {
        error = data.error || 'Failed to send reboot command';
      }
    } catch (err: any) {
      error = err.message || 'Failed to send command';
    } finally {
      isLoading = false;
    }
  }
  
  function formatUptime(seconds: number | null | undefined): string {
    if (!seconds || seconds <= 0) return 'N/A';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
  
  function getStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'inactive': return 'text-gray-400';
      case 'failed': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  }
  
  function getStatusIcon(status: string): string {
    switch (status) {
      case 'active': return '🟢';
      case 'inactive': return '⚪';
      case 'failed': return '🔴';
      case 'not-found': return '❓';
      default: return '🟡';
    }
  }
</script>

<div class="epc-monitoring-panel">
  <div class="panel-header">
    <div class="header-info">
      <h2>{epc?.site_name || epc?.name || 'EPC Device'}</h2>
      <span class="device-code">{epc?.device_code || 'N/A'}</span>
    </div>
    <div class="header-actions">
      <button class="refresh-btn" on:click={refreshAll} disabled={isLoading} title="Refresh">
        {#if isLoading}⏳{:else}🔄{/if}
      </button>
      <button class="close-btn" on:click={onClose}>✕</button>
    </div>
  </div>
  
  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}
  
  {#if success}
    <div class="alert alert-success">{success}</div>
  {/if}
  
  <div class="panel-content">
    <!-- System Overview -->
    <div class="section">
      <h3>📊 System Overview</h3>
      <div class="system-stats">
        <div class="stat-card">
          <span class="stat-label">Status</span>
          <span class="stat-value status-{epc?.status || 'offline'}">
            {epc?.status === 'online' ? '🟢 Online' : '🔴 Offline'}
          </span>
        </div>
        <div class="stat-card">
          <span class="stat-label">IP Address</span>
          <span class="stat-value">{epc?.ip_address || epc?.ipAddress || 'Unknown'}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">CPU Usage</span>
          <span class="stat-value">{serviceStatus?.system?.cpu_percent ?? 'N/A'}%</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Memory Usage</span>
          <span class="stat-value">
            {serviceStatus?.system?.memory_percent ?? 'N/A'}%
            {#if serviceStatus?.system?.memory_used_mb && serviceStatus?.system?.memory_total_mb}
              ({serviceStatus.system.memory_used_mb}MB / {serviceStatus.system.memory_total_mb}MB)
            {/if}
          </span>
        </div>
        <div class="stat-card">
          <span class="stat-label">System Uptime</span>
          <span class="stat-value">{formatUptime(serviceStatus?.system?.uptime_seconds)}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Last Check-in</span>
          <span class="stat-value">
            {#if epc?.last_seen}
              {new Date(epc.last_seen).toLocaleString()}
            {:else}
              Never
            {/if}
          </span>
        </div>
      </div>
    </div>
    
    <!-- Service Status -->
    <div class="section">
      <h3>🔧 Services</h3>
      <div class="services-grid">
        {#each SERVICES as svc}
          {@const status = serviceStatus?.services?.[svc.id]}
          <div class="service-card">
            <div class="service-header">
              <span class="service-icon">{getStatusIcon(status?.status || 'unknown')}</span>
              <span class="service-name">{svc.name}</span>
            </div>
            <div class="service-details">
              <span class="service-desc">{svc.description}</span>
              <span class="service-uptime">Uptime: {formatUptime(status?.uptime_seconds)}</span>
              {#if status?.memory_mb}
                <span class="service-memory">Memory: {status.memory_mb} MB</span>
              {/if}
            </div>
            <div class="service-actions">
              <button 
                class="btn-sm btn-start" 
                on:click={() => sendServiceCommand('start', [svc.id])}
                disabled={isLoading}
                title="Start Service"
              >▶</button>
              <button 
                class="btn-sm btn-stop" 
                on:click={() => sendServiceCommand('stop', [svc.id])}
                disabled={isLoading}
                title="Stop Service"
              >⏹</button>
              <button 
                class="btn-sm btn-restart" 
                on:click={() => sendServiceCommand('restart', [svc.id])}
                disabled={isLoading}
                title="Restart Service"
              >🔄</button>
            </div>
          </div>
        {/each}
      </div>
      
      <div class="bulk-actions">
        <button class="btn btn-primary" on:click={() => sendServiceCommand('restart')} disabled={isLoading}>
          🔄 Restart All Services
        </button>
        <button class="btn btn-danger" on:click={sendRebootCommand} disabled={isLoading}>
          ⚡ Reboot Device
        </button>
      </div>
    </div>
    
    <!-- Performance Graphs -->
    <div class="section">
      <h3>📈 Performance Metrics</h3>
      <div class="charts-grid">
        <div class="chart-card">
          <h4>CPU Usage</h4>
          <div class="chart-container">
            {#if cpuChartOption}
              <ECharts option={cpuChartOption} height={200} theme="dark" />
            {:else}
              <div class="chart-placeholder">No data available</div>
            {/if}
          </div>
          <div class="chart-current">
            Current: {serviceStatus?.system?.cpu_percent ?? 'N/A'}%
          </div>
        </div>
        <div class="chart-card">
          <h4>Memory Usage</h4>
          <div class="chart-container">
            {#if memoryChartOption}
              <ECharts option={memoryChartOption} height={200} theme="dark" />
            {:else}
              <div class="chart-placeholder">No data available</div>
            {/if}
          </div>
          <div class="chart-current">
            Current: {serviceStatus?.system?.memory_percent ?? 'N/A'}%
            ({serviceStatus?.system?.memory_used_mb ?? 0}/{serviceStatus?.system?.memory_total_mb ?? 0} MB)
          </div>
        </div>
        <div class="chart-card">
          <h4>Disk Usage</h4>
          <div class="chart-container">
            {#if diskChartOption}
              <ECharts option={diskChartOption} height={200} theme="dark" />
            {:else}
              <div class="chart-placeholder">No data available</div>
            {/if}
          </div>
          <div class="chart-current">
            Current: {serviceStatus?.system?.disk_percent ?? 'N/A'}%
            ({serviceStatus?.system?.disk_used_gb ?? 0}/{serviceStatus?.system?.disk_total_gb ?? 0} GB)
          </div>
        </div>
      </div>
    </div>
    
    <!-- Command History -->
    <div class="section">
      <h3>📜 Recent Commands</h3>
      {#if commandHistory.length === 0}
        <p class="no-data">No commands sent yet</p>
      {:else}
        <div class="command-list">
          {#each commandHistory as cmd}
            <div class="command-item status-{cmd.status}">
              <div class="command-info">
                <span class="command-type">{cmd.command_type}</span>
                {#if cmd.action}
                  <span class="command-action">{cmd.action}</span>
                {/if}
                <span class="command-time">{new Date(cmd.created_at).toLocaleString()}</span>
              </div>
              <span class="command-status">{cmd.status}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .epc-monitoring-panel {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border-radius: 12px;
    color: #e2e8f0;
    max-height: 90vh;
    overflow-y: auto;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    position: sticky;
    top: 0;
    background: #1e293b;
    z-index: 10;
  }
  
  .header-info h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #f1f5f9;
  }
  
  .device-code {
    font-family: monospace;
    background: rgba(59, 130, 246, 0.2);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
    color: #60a5fa;
  }
  
  .header-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  
  .refresh-btn, .close-btn {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.5rem;
    transition: all 0.2s;
  }
  
  .refresh-btn:hover, .close-btn:hover {
    color: #f1f5f9;
  }
  
  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .alert {
    padding: 0.75rem 1rem;
    margin: 1rem;
    border-radius: 8px;
  }
  
  .alert-error {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid #ef4444;
    color: #fca5a5;
  }
  
  .alert-success {
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid #22c55e;
    color: #86efac;
  }
  
  .panel-content {
    padding: 1rem;
  }
  
  .section {
    margin-bottom: 2rem;
  }
  
  .section h3 {
    color: #f1f5f9;
    margin-bottom: 1rem;
    font-size: 1.1rem;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    padding-bottom: 0.5rem;
  }
  
  .system-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }
  
  .stat-card {
    background: rgba(255,255,255,0.05);
    padding: 1rem;
    border-radius: 8px;
    text-align: center;
  }
  
  .stat-label {
    display: block;
    font-size: 0.75rem;
    color: #94a3b8;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
  }
  
  .stat-value {
    font-size: 1rem;
    font-weight: 600;
    color: #f1f5f9;
  }
  
  .status-online { color: #22c55e; }
  .status-offline { color: #ef4444; }
  
  .services-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
  
  .service-card {
    background: rgba(255,255,255,0.05);
    border-radius: 8px;
    padding: 1rem;
    border: 1px solid rgba(255,255,255,0.1);
  }
  
  .service-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  
  .service-icon {
    font-size: 1rem;
  }
  
  .service-name {
    font-weight: 600;
    color: #f1f5f9;
  }
  
  .service-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: #94a3b8;
    margin-bottom: 0.75rem;
  }
  
  .service-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .btn-sm {
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }
  
  .btn-start {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }
  
  .btn-stop {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
  
  .btn-restart {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }
  
  .btn-sm:hover {
    transform: scale(1.1);
  }
  
  .btn-sm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
  
  .bulk-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }
  
  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: #3b82f6;
    color: white;
  }
  
  .btn-primary:hover {
    background: #2563eb;
  }
  
  .btn-danger {
    background: #ef4444;
    color: white;
  }
  
  .btn-danger:hover {
    background: #dc2626;
  }
  
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }
  
  .chart-card {
    background: rgba(255,255,255,0.05);
    border-radius: 8px;
    padding: 1rem;
  }
  
  .chart-card h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.9rem;
    color: #94a3b8;
  }
  
  .chart-container {
    height: 200px;
    position: relative;
  }
  
  .chart-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #64748b;
    font-size: 0.875rem;
  }
  
  .chart-current {
    text-align: center;
    font-size: 0.875rem;
    color: #94a3b8;
    margin-top: 0.5rem;
  }
  
  .command-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .command-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255,255,255,0.05);
    padding: 0.75rem 1rem;
    border-radius: 6px;
    border-left: 3px solid;
  }
  
  .command-item.status-pending { border-color: #f59e0b; }
  .command-item.status-sent { border-color: #3b82f6; }
  .command-item.status-completed { border-color: #22c55e; }
  .command-item.status-failed { border-color: #ef4444; }
  
  .command-info {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  
  .command-type {
    font-weight: 600;
    color: #f1f5f9;
  }
  
  .command-action {
    background: rgba(255,255,255,0.1);
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
  }
  
  .command-time {
    font-size: 0.75rem;
    color: #64748b;
  }
  
  .command-status {
    font-size: 0.75rem;
    text-transform: uppercase;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background: rgba(255,255,255,0.1);
  }
  
  .no-data {
    color: #64748b;
    text-align: center;
    padding: 2rem;
  }
</style>

