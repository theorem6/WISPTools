<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { auth } from '$lib/firebase';
  import { authService } from '$lib/services/authService';
  
  export let tenantId: string;
  export let HSS_API: string;
  export let epcId: string; // Can be 'all' or specific epc_id
  
  let dashboardData: any = null;
  let metricsHistory: any[] = [];
  let subscriberRoster: any[] = [];
  let attachDetachEvents: any[] = [];
  let loading = true;
  let activeTab = 'overview';
  let refreshInterval: any = null;
  let timeRange = '24h';
  
  // Filters
  let apnFilter = 'all';
  let cellIdFilter = 'all';
  let statusFilter = 'all';
  
  onMount(async () => {
    await loadDashboard();
    
    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(loadDashboard, 30000);
  });
  
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
  
  async function loadDashboard() {
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await authService.getAuthTokenForApi();
      const url = epcId === 'all'
        ? `${HSS_API}/api/dashboard`
        : `${HSS_API}/api/dashboard?epc_id=${epcId}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (response.ok) {
        dashboardData = await response.json();
      }
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
    } finally {
      loading = false;
    }
  }
  
  async function loadMetricsHistory() {
    if (!epcId || epcId === 'all') return;
    
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await authService.getAuthTokenForApi();
      const response = await fetch(`${HSS_API}/api/metrics/history?epc_id=${epcId}&granularity=hour`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        metricsHistory = data.metrics || [];
      }
    } catch (err: any) {
      console.error('Error loading metrics history:', err);
    }
  }
  
  async function loadSubscriberRoster() {
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await authService.getAuthTokenForApi();
      const url = epcId === 'all'
        ? `${HSS_API}/api/subscribers/roster?limit=100`
        : `${HSS_API}/api/subscribers/roster?epc_id=${epcId}&limit=100`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        subscriberRoster = data.sessions || [];
      }
    } catch (err: any) {
      console.error('Error loading roster:', err);
    }
  }
  
  async function loadAttachDetachEvents() {
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await authService.getAuthTokenForApi();
      const url = epcId === 'all'
        ? `${HSS_API}/api/events/attach-detach?hours=48&limit=100`
        : `${HSS_API}/api/events/attach-detach?epc_id=${epcId}&hours=48&limit=100`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        attachDetachEvents = data.events || [];
      }
    } catch (err: any) {
      console.error('Error loading events:', err);
    }
  }
  
  function switchTab(tab: string) {
    activeTab = tab;
    
    if (tab === 'metrics' && metricsHistory.length === 0) {
      loadMetricsHistory();
    } else if (tab === 'roster' && subscriberRoster.length === 0) {
      loadSubscriberRoster();
    } else if (tab === 'events' && attachDetachEvents.length === 0) {
      loadAttachDetachEvents();
    }
  }
  
  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      'online': '#10b981',
      'offline': '#ef4444',
      'registered': '#3b82f6',
      'error': '#f59e0b',
      'attached': '#10b981',
      'detached': '#6b7280',
      'running': '#10b981',
      'stopped': '#ef4444'
    };
    return colors[status] || '#6b7280';
  }
  
  // Get unique APNs and Cell IDs for filters
  $: uniqueAPNs = subscriberRoster
    .map(s => s.apn)
    .filter((v, i, a) => v && a.indexOf(v) === i);
  
  $: uniqueCellIds = subscriberRoster
    .map(s => s.cellid)
    .filter((v, i, a) => v && a.indexOf(v) === i);
  
  // Filter roster
  $: filteredRoster = subscriberRoster.filter(session => {
    if (apnFilter !== 'all' && session.apn !== apnFilter) return false;
    if (cellIdFilter !== 'all' && session.cellid !== cellIdFilter) return false;
    if (statusFilter !== 'all' && session.status !== statusFilter) return false;
    return true;
  });
</script>

<div class="epc-monitor">
  {#if loading && !dashboardData}
    <div class="loading">Loading monitoring data...</div>
  {:else}
    <!-- Tab Navigation -->
    <div class="monitor-tabs">
      <button 
        class:active={activeTab === 'overview'}
        on:click={() => switchTab('overview')}
      >
        📊 Overview
      </button>
      <button 
        class:active={activeTab === 'roster'}
        on:click={() => switchTab('roster')}
      >
        👥 Subscriber Roster
      </button>
      <button 
        class:active={activeTab === 'events'}
        on:click={() => switchTab('events')}
      >
        📝 Attach/Detach Events
      </button>
      {#if epcId !== 'all'}
        <button 
          class:active={activeTab === 'metrics'}
          on:click={() => switchTab('metrics')}
        >
          📈 Metrics History
        </button>
      {/if}
      <button class="refresh-btn" on:click={loadDashboard}>
        🔄 Refresh
      </button>
    </div>
    
    <!-- Overview Tab -->
    {#if activeTab === 'overview'}
      <div class="overview">
        <!-- Summary Stats -->
        <div class="stats-grid">
          <div class="stat-card primary">
            <div class="stat-icon">🌐</div>
            <div class="stat-content">
              <div class="stat-value">{dashboardData?.summary?.online_epcs || 0}</div>
              <div class="stat-label">EPCs Online</div>
            </div>
          </div>
          
          <div class="stat-card success">
            <div class="stat-icon">👥</div>
            <div class="stat-content">
              <div class="stat-value">{dashboardData?.summary?.active_sessions || 0}</div>
              <div class="stat-label">Active Sessions</div>
            </div>
          </div>
          
          <div class="stat-card info">
            <div class="stat-icon">📥</div>
            <div class="stat-content">
              <div class="stat-value">{dashboardData?.summary?.recent_attaches || 0}</div>
              <div class="stat-label">Attaches (1h)</div>
            </div>
          </div>
          
          <div class="stat-card warning">
            <div class="stat-icon">📤</div>
            <div class="stat-content">
              <div class="stat-value">{dashboardData?.summary?.recent_detaches || 0}</div>
              <div class="stat-label">Detaches (1h)</div>
            </div>
          </div>
        </div>
        
        <!-- EPC Sites Overview -->
        {#if dashboardData?.epcs && dashboardData.epcs.length > 0}
          <div class="section">
            <h3>EPC Sites Status</h3>
            <div class="epcs-list">
              {#each dashboardData.epcs as epc}
                <div class="epc-overview-card">
                  <div class="epc-overview-header">
                    <div>
                      <h4>{epc.site_name}</h4>
                      <div class="epc-id">{epc.epc_id}</div>
                    </div>
                    <div class="status-dot" style="background: {getStatusColor(epc.status)}"></div>
                  </div>
                  
                  {#if epc.latest_metrics}
                    <div class="metrics-grid">
                      <div class="metric-item">
                        <div class="metric-label">Active Sessions</div>
                        <div class="metric-value">{epc.latest_metrics.subscribers?.active_sessions || 0}</div>
                      </div>
                      
                      <div class="metric-item">
                        <div class="metric-label">CPU</div>
                        <div class="metric-value">{epc.latest_metrics.system?.cpu_percent || 0}%</div>
                      </div>
                      
                      <div class="metric-item">
                        <div class="metric-label">Memory</div>
                        <div class="metric-value">{epc.latest_metrics.system?.memory_percent || 0}%</div>
                      </div>
                      
                      <div class="metric-item">
                        <div class="metric-label">IP Pool</div>
                        <div class="metric-value">{epc.latest_metrics.ogstun_pool?.utilization_percent || 0}%</div>
                      </div>
                    </div>
                    
                    <!-- Component Status -->
                    {#if epc.latest_metrics.components}
                      <div class="components">
                        {#each Object.entries(epc.latest_metrics.components) as [component, status]}
                          <span class="component-badge" style="background: {getStatusColor(String(status))}">
                            {component}: {String(status)}
                          </span>
                        {/each}
                      </div>
                    {/if}
                  {:else}
                    <div class="no-metrics">No metrics data available</div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
        
        <!-- Active Alerts -->
        {#if dashboardData?.alerts && dashboardData.alerts.length > 0}
          <div class="section">
            <h3>🚨 Active Alerts</h3>
            <div class="alerts-list">
              {#each dashboardData.alerts as alert}
                <div class="alert-item severity-{alert.severity}">
                  <div class="alert-header">
                    <span class="alert-severity">{alert.severity.toUpperCase()}</span>
                    <span class="alert-time">{new Date(alert.timestamp).toLocaleString()}</span>
                  </div>
                  <div class="alert-message">{alert.message}</div>
                  <div class="alert-epc">EPC: {alert.epc_id}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
    
    <!-- Subscriber Roster Tab -->
    {#if activeTab === 'roster'}
      <div class="roster">
        <div class="roster-header">
          <h3>👥 Enhanced Subscriber Roster</h3>
          <div class="roster-filters">
            <label>
              <span>APN:</span>
              <select bind:value={apnFilter}>
                <option value="all">All</option>
                {#each uniqueAPNs as apn}
                  <option value={apn}>{apn}</option>
                {/each}
              </select>
            </label>
            
            <label>
              <span>Cell ID:</span>
              <select bind:value={cellIdFilter}>
                <option value="all">All</option>
                {#each uniqueCellIds as cellId}
                  <option value={cellId}>{cellId}</option>
                {/each}
              </select>
            </label>
            
            <label>
              <span>Status:</span>
              <select bind:value={statusFilter}>
                <option value="all">All</option>
                <option value="attached">Attached</option>
                <option value="detached">Detached</option>
              </select>
            </label>
            
            <button class="btn-refresh" on:click={loadSubscriberRoster}>
              🔄 Refresh
            </button>
          </div>
        </div>
        
        {#if filteredRoster.length === 0}
          <div class="empty-state">
            <p>No subscriber sessions found</p>
          </div>
        {:else}
          <div class="table-container">
            <table class="roster-table">
              <thead>
                <tr>
                  <th>IMSI</th>
                  <th>Status</th>
                  <th>APN</th>
                  <th>Cell ID</th>
                  <th>Allocated IP</th>
                  <th>Attached At</th>
                  <th>Last Activity</th>
                  <th>Data Usage</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredRoster as session}
                  <tr>
                    <td class="mono">{session.imsi}</td>
                    <td>
                      <span class="status-badge" style="background: {getStatusColor(session.status)}">
                        {session.status}
                      </span>
                    </td>
                    <td>{session.apn || '-'}</td>
                    <td>{session.cellid || '-'}</td>
                    <td class="mono">{session.allocated_ip || '-'}</td>
                    <td>{new Date(session.attached_at).toLocaleString()}</td>
                    <td>{session.last_activity ? new Date(session.last_activity).toLocaleString() : '-'}</td>
                    <td>{session.data_usage?.total_bytes ? formatBytes(session.data_usage.total_bytes) : '0 B'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          
          <div class="roster-summary">
            Showing {filteredRoster.length} of {subscriberRoster.length} sessions
          </div>
        {/if}
      </div>
    {/if}
    
    <!-- Attach/Detach Events Tab -->
    {#if activeTab === 'events'}
      <div class="events">
        <div class="events-header">
          <h3>📝 Attach/Detach Events (Last 48 Hours)</h3>
          <button class="btn-refresh" on:click={loadAttachDetachEvents}>
            🔄 Refresh
          </button>
        </div>
        
        {#if attachDetachEvents.length === 0}
          <div class="empty-state">
            <p>No events found</p>
          </div>
        {:else}
          <!-- Event Timeline -->
          <div class="timeline">
            {#each attachDetachEvents as event}
              <div class="timeline-item event-{event.event_type}">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="event-header">
                    <span class="event-type">{event.event_type.toUpperCase()}</span>
                    <span class="event-time">{new Date(event.timestamp).toLocaleString()}</span>
                  </div>
                  <div class="event-details">
                    <span class="event-imsi">IMSI: {event.imsi}</span>
                    {#if event.apn}
                      <span class="event-apn">APN: {event.apn}</span>
                    {/if}
                    {#if event.cellid}
                      <span class="event-cell">Cell: {event.cellid}</span>
                    {/if}
                    {#if event.session_duration_seconds}
                      <span class="event-duration">Duration: {formatDuration(event.session_duration_seconds)}</span>
                    {/if}
                    {#if event.data_usage_bytes}
                      <span class="event-data">Data: {formatBytes(event.data_usage_bytes)}</span>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
    
    <!-- Metrics History Tab -->
    {#if activeTab === 'metrics' && epcId !== 'all'}
      <div class="metrics-history">
        <div class="metrics-header">
          <h3>📈 Metrics History</h3>
          <button class="btn-refresh" on:click={loadMetricsHistory}>
            🔄 Refresh
          </button>
        </div>
        
        {#if metricsHistory.length === 0}
          <div class="empty-state">
            <p>Loading metrics history...</p>
          </div>
        {:else}
          <div class="charts">
            <div class="chart-card">
              <h4>Active Sessions Over Time</h4>
              <div class="simple-chart">
                {#each metricsHistory.slice(-24) as metric, i}
                  <div class="chart-bar" style="height: {(metric.subscribers?.active_sessions || 0) * 10}px">
                    <div class="chart-tooltip">
                      {metric.subscribers?.active_sessions || 0} sessions
                      <br />
                      {new Date(metric.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
            
            <div class="chart-card">
              <h4>System Resources</h4>
              <div class="resource-chart">
                {#if metricsHistory.length > 0}
                  {@const latest = metricsHistory[metricsHistory.length - 1]}
                  <div class="resource-bar">
                    <div class="resource-label">CPU</div>
                    <div class="resource-progress">
                      <div class="resource-fill" style="width: {latest.system?.cpu_percent || 0}%"></div>
                    </div>
                    <div class="resource-value">{latest.system?.cpu_percent || 0}%</div>
                  </div>
                  
                  <div class="resource-bar">
                    <div class="resource-label">Memory</div>
                    <div class="resource-progress">
                      <div class="resource-fill" style="width: {latest.system?.memory_percent || 0}%"></div>
                    </div>
                    <div class="resource-value">{latest.system?.memory_percent || 0}%</div>
                  </div>
                  
                  <div class="resource-bar">
                    <div class="resource-label">Disk</div>
                    <div class="resource-progress">
                      <div class="resource-fill" style="width: {latest.system?.disk_percent || 0}%"></div>
                    </div>
                    <div class="resource-value">{latest.system?.disk_percent || 0}%</div>
                  </div>
                  
                  <div class="resource-bar">
                    <div class="resource-label">IP Pool</div>
                    <div class="resource-progress">
                      <div class="resource-fill" style="width: {latest.ogstun_pool?.utilization_percent || 0}%"></div>
                    </div>
                    <div class="resource-value">{latest.ogstun_pool?.utilization_percent || 0}%</div>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<script context="module" lang="ts">
  export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
  
  export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
</script>

<style>
  .epc-monitor {
    padding: 0;
  }
  
  .monitor-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 2rem;
    border-bottom: 2px solid #e5e7eb;
    flex-wrap: wrap;
  }
  
  .monitor-tabs button {
    padding: 0.75rem 1.5rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-weight: 500;
    color: #6b7280;
    transition: all 0.2s;
    margin-bottom: -2px;
  }
  
  .monitor-tabs button.active {
    color: #2563eb;
    border-bottom-color: #2563eb;
  }
  
  .monitor-tabs button:hover {
    color: #1d4ed8;
  }
  
  .refresh-btn {
    margin-left: auto;
    background: #f3f4f6 !important;
    border: 1px solid #e5e7eb !important;
    border-radius: 6px !important;
  }
  
  .loading, .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .stat-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .stat-card.primary { border-left: 4px solid #2563eb; }
  .stat-card.success { border-left: 4px solid #10b981; }
  .stat-card.info { border-left: 4px solid #06b6d4; }
  .stat-card.warning { border-left: 4px solid #f59e0b; }
  
  .stat-icon {
    font-size: 2rem;
  }
  
  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
  }
  
  .stat-label {
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: #6b7280;
  }
  
  .section {
    margin-bottom: 2rem;
  }
  
  .section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
  }
  
  .epcs-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }
  
  .epc-overview-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1rem;
  }
  
  .epc-overview-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #f3f4f6;
  }
  
  .epc-overview-header h4 {
    margin: 0 0 0.25rem 0;
    font-size: 1rem;
  }
  
  .epc-id {
    font-size: 0.75rem;
    color: #9ca3af;
    font-family: monospace;
  }
  
  .status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }
  
  .metric-item {
    display: flex;
    flex-direction: column;
  }
  
  .metric-label {
    font-size: 0.75rem;
    color: #6b7280;
  }
  
  .metric-value {
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .components {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .component-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    color: white;
  }
  
  .no-metrics {
    text-align: center;
    padding: 1rem;
    color: #9ca3af;
    font-size: 0.875rem;
  }
  
  .alerts-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .alert-item {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1rem;
    border-left-width: 4px;
  }
  
  .alert-item.severity-critical { border-left-color: #ef4444; }
  .alert-item.severity-error { border-left-color: #f59e0b; }
  .alert-item.severity-warning { border-left-color: #fbbf24; }
  .alert-item.severity-info { border-left-color: #3b82f6; }
  
  .alert-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  
  .alert-severity {
    font-weight: 600;
    font-size: 0.75rem;
  }
  
  .alert-time {
    font-size: 0.75rem;
    color: #6b7280;
  }
  
  .alert-message {
    margin-bottom: 0.5rem;
  }
  
  .alert-epc {
    font-size: 0.75rem;
    color: #9ca3af;
    font-family: monospace;
  }
  
  /* Roster */
  .roster-header {
    margin-bottom: 1.5rem;
  }
  
  .roster-header h3 {
    margin: 0 0 1rem 0;
  }
  
  .roster-filters {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .roster-filters label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }
  
  .roster-filters select {
    padding: 0.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
  }
  
  .btn-refresh {
    padding: 0.5rem 1rem;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    cursor: pointer;
  }
  
  .table-container {
    overflow-x: auto;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
  }
  
  .roster-table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .roster-table th {
    background: #f9fafb;
    padding: 0.75rem;
    text-align: left;
    font-size: 0.875rem;
    font-weight: 600;
    border-bottom: 2px solid #e5e7eb;
  }
  
  .roster-table td {
    padding: 0.75rem;
    border-bottom: 1px solid #f3f4f6;
    font-size: 0.875rem;
  }
  
  .roster-table tr:hover {
    background: #f9fafb;
  }
  
  .mono {
    font-family: 'Courier New', monospace;
    font-size: 0.8125rem;
  }
  
  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    color: white;
    font-weight: 600;
  }
  
  .roster-summary {
    margin-top: 1rem;
    text-align: center;
    color: #6b7280;
    font-size: 0.875rem;
  }
  
  /* Events Timeline */
  .events-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  
  .events-header h3 {
    margin: 0;
  }
  
  .timeline {
    position: relative;
    padding-left: 2rem;
  }
  
  .timeline-item {
    position: relative;
    margin-bottom: 1.5rem;
  }
  
  .timeline-marker {
    position: absolute;
    left: -2rem;
    top: 0.25rem;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid #e5e7eb;
  }
  
  .timeline-item.event-attach .timeline-marker {
    background: #10b981;
    border-color: #10b981;
  }
  
  .timeline-item.event-detach .timeline-marker {
    background: #ef4444;
    border-color: #ef4444;
  }
  
  .timeline-item:not(:last-child)::before {
    content: '';
    position: absolute;
    left: -1.4375rem;
    top: 1rem;
    bottom: -1.5rem;
    width: 2px;
    background: #e5e7eb;
  }
  
  .timeline-content {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1rem;
  }
  
  .event-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  
  .event-type {
    font-weight: 600;
    font-size: 0.75rem;
  }
  
  .timeline-item.event-attach .event-type {
    color: #10b981;
  }
  
  .timeline-item.event-detach .event-type {
    color: #ef4444;
  }
  
  .event-time {
    font-size: 0.75rem;
    color: #6b7280;
  }
  
  .event-details {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.875rem;
    color: #4b5563;
  }
  
  .event-imsi {
    font-family: monospace;
    font-weight: 500;
  }
  
  /* Metrics History */
  .metrics-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  
  .metrics-header h3 {
    margin: 0;
  }
  
  .charts {
    display: grid;
    gap: 1.5rem;
  }
  
  .chart-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
  }
  
  .chart-card h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
  }
  
  .simple-chart {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 150px;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 4px;
  }
  
  .chart-bar {
    flex: 1;
    background: #2563eb;
    border-radius: 2px 2px 0 0;
    min-height: 2px;
    position: relative;
    transition: all 0.2s;
  }
  
  .chart-bar:hover {
    background: #1d4ed8;
  }
  
  .chart-tooltip {
    display: none;
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    white-space: nowrap;
    margin-bottom: 0.5rem;
  }
  
  .chart-bar:hover .chart-tooltip {
    display: block;
  }
  
  .resource-chart {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .resource-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .resource-label {
    min-width: 80px;
    font-size: 0.875rem;
    font-weight: 500;
  }
  
  .resource-progress {
    flex: 1;
    height: 24px;
    background: #f3f4f6;
    border-radius: 12px;
    overflow: hidden;
  }
  
  .resource-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981 0%, #3b82f6 50%, #ef4444 100%);
    transition: width 0.3s;
  }
  
  .resource-value {
    min-width: 50px;
    text-align: right;
    font-weight: 600;
  }
  
  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .epcs-list {
      grid-template-columns: 1fr;
    }
    
    .monitor-tabs {
      overflow-x: auto;
    }
  }
</style>

