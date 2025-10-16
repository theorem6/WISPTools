<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { auth } from '$lib/firebase';
  import EmailSettings from './components/EmailSettings.svelte';
  
  // Monitoring API endpoint
  const MONITORING_API = import.meta.env.VITE_HSS_API_URL || 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy';
  
  let tenantId = '';
  let activeTab = 'overview';
  let loading = true;
  
  // Dashboard data
  let dashboardData: any = null;
  let metrics: any = {};
  let serviceHealth: any[] = [];
  let activeAlerts: any[] = [];
  let alertRules: any[] = [];
  let auditLogs: any[] = [];
  
  // Filters
  let alertSeverityFilter = 'all';
  let alertSourceFilter = 'all';
  let timeRange = '24h';
  
  // Auto-refresh
  let refreshInterval: any = null;
  
  onMount(async () => {
    const user = auth.currentUser;
    if (user) {
      tenantId = user.uid;
    }
    
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
      const response = await fetch(`${MONITORING_API}/monitoring/dashboard`, {
        headers: {
          'x-tenant-id': tenantId
        }
      });
      
      if (response.ok) {
        dashboardData = await response.json();
        metrics = dashboardData.metrics;
        serviceHealth = dashboardData.service_health;
        activeAlerts = dashboardData.active_alerts;
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      loading = false;
    }
  }
  
  async function loadAlertRules() {
    try {
      const response = await fetch(`${MONITORING_API}/monitoring/alert-rules`, {
        headers: {
          'x-tenant-id': tenantId
        }
      });
      
      if (response.ok) {
        alertRules = await response.json();
      }
    } catch (error) {
      console.error('Error loading alert rules:', error);
    }
  }
  
  async function loadAuditLogs() {
    try {
      const response = await fetch(`${MONITORING_API}/monitoring/audit-logs?limit=50`, {
        headers: {
          'x-tenant-id': tenantId
        }
      });
      
      if (response.ok) {
        auditLogs = await response.json();
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
    }
  }
  
  async function acknowledgeAlert(alertId: string) {
    try {
      const response = await fetch(`${MONITORING_API}/monitoring/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({ notes: 'Acknowledged by user' })
      });
      
      if (response.ok) {
        await loadDashboard();
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  }
  
  async function resolveAlert(alertId: string) {
    try {
      const response = await fetch(`${MONITORING_API}/monitoring/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({ notes: 'Resolved by user' })
      });
      
      if (response.ok) {
        await loadDashboard();
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  }
  
  async function initializeDefaultAlerts() {
    try {
      const response = await fetch(`${MONITORING_API}/monitoring/initialize-alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        }
      });
      
      if (response.ok) {
        await loadAlertRules();
        alert('Default alert rules created successfully!');
      }
    } catch (error) {
      console.error('Error initializing alerts:', error);
    }
  }
  
  function getSeverityColor(severity: string) {
    const colors = {
      'info': '#3b82f6',
      'warning': '#f59e0b',
      'error': '#ef4444',
      'critical': '#dc2626'
    };
    return colors[severity] || '#64748b';
  }
  
  function getServiceStatusColor(status: string) {
    const colors = {
      'healthy': '#10b981',
      'degraded': '#f59e0b',
      'down': '#ef4444',
      'unknown': '#64748b'
    };
    return colors[status] || '#64748b';
  }
  
  $: filteredAlerts = activeAlerts.filter(alert => {
    if (alertSeverityFilter !== 'all' && alert.severity !== alertSeverityFilter) return false;
    if (alertSourceFilter !== 'all' && alert.source !== alertSourceFilter) return false;
    return true;
  });
</script>

<div class="monitoring-page">
  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <button class="back-button" on:click={() => window.location.href = '/dashboard'}>
        ← Back to Dashboard
      </button>
      <div>
        <h1>🔍 Monitoring & Alerts</h1>
        <p>Real-time system monitoring and alerting across all modules</p>
      </div>
    </div>
    <button class="btn-refresh" on:click={loadDashboard}>
      🔄 Refresh
    </button>
  </div>

  <!-- Tabs -->
  <div class="tabs">
    <button 
      class="tab" 
      class:active={activeTab === 'overview'}
      on:click={() => activeTab = 'overview'}
    >
      📊 Overview
    </button>
    <button 
      class="tab" 
      class:active={activeTab === 'alerts'}
      on:click={() => { activeTab = 'alerts'; loadAlertRules(); }}
    >
      🚨 Active Alerts ({activeAlerts.length})
    </button>
    <button 
      class="tab" 
      class:active={activeTab === 'rules'}
      on:click={() => { activeTab = 'rules'; loadAlertRules(); }}
    >
      ⚙️ Alert Rules
    </button>
    <button 
      class="tab" 
      class:active={activeTab === 'audit'}
      on:click={() => { activeTab = 'audit'; loadAuditLogs(); }}
    >
      📋 Audit Log
    </button>
    <button 
      class="tab" 
      class:active={activeTab === 'email'}
      on:click={() => activeTab = 'email'}
    >
      📧 Email Settings
    </button>
  </div>

  <!-- Content -->
  {#if loading}
    <div class="loading">Loading monitoring data...</div>
  {:else if activeTab === 'overview'}
    <!-- Overview Tab -->
    <div class="overview">
      <!-- Summary Cards -->
      <div class="summary-cards">
        <div class="card critical">
          <div class="card-icon">🚨</div>
          <div class="card-content">
            <div class="card-value">{dashboardData?.summary?.critical_alerts || 0}</div>
            <div class="card-label">Critical Alerts</div>
          </div>
        </div>
        
        <div class="card warning">
          <div class="card-icon">⚠️</div>
          <div class="card-content">
            <div class="card-value">{dashboardData?.summary?.total_alerts || 0}</div>
            <div class="card-label">Total Active Alerts</div>
          </div>
        </div>
        
        <div class="card">
          <div class="card-icon">🖥️</div>
          <div class="card-content">
            <div class="card-value">{dashboardData?.summary?.services_down || 0}</div>
            <div class="card-label">Services Down</div>
          </div>
        </div>
      </div>

      <!-- Service Health -->
      <div class="section">
        <h2>🏥 Service Health</h2>
        <div class="service-grid">
          {#each serviceHealth as service}
            <div class="service-card" style="border-left: 4px solid {getServiceStatusColor(service.status)}">
              <div class="service-header">
                <span class="service-name">{service.service_name}</span>
                <span class="service-status" style="color: {getServiceStatusColor(service.status)}">
                  {service.status?.toUpperCase() || 'UNKNOWN'}
                </span>
              </div>
              {#if service.response_time_ms}
                <div class="service-metric">Response: {service.response_time_ms}ms</div>
              {/if}
              {#if service.error_message}
                <div class="service-error">{service.error_message}</div>
              {/if}
              <div class="service-time">
                Checked: {service.checked_at ? new Date(service.checked_at).toLocaleTimeString() : 'Never'}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Module Metrics -->
      <div class="metrics-grid">
        <!-- HSS Metrics -->
        <div class="metric-card">
          <h3>🔐 HSS Metrics</h3>
          <div class="metric-list">
            <div class="metric-item">
              <span class="metric-label">Active Subscribers</span>
              <span class="metric-value">{metrics.hss?.active_subscribers || 0}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Total Subscribers</span>
              <span class="metric-value">{metrics.hss?.total_subscribers || 0}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Recent Authentications</span>
              <span class="metric-value">{metrics.hss?.recent_authentications || 0}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Auth Failure Rate</span>
              <span class="metric-value">{metrics.hss?.auth_failure_rate?.toFixed(2) || 0}%</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">MME Connections</span>
              <span class="metric-value">{metrics.hss?.mme_connections || 0}</span>
            </div>
          </div>
        </div>

        <!-- GenieACS Metrics -->
        <div class="metric-card">
          <h3>📡 GenieACS Metrics</h3>
          <div class="metric-list">
            <div class="metric-item">
              <span class="metric-label">Total Devices</span>
              <span class="metric-value">{metrics.genieacs?.total_devices || 0}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Online Devices</span>
              <span class="metric-value">{metrics.genieacs?.online_devices || 0}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Offline Devices</span>
              <span class="metric-value">{metrics.genieacs?.offline_devices || 0}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Faulty Devices</span>
              <span class="metric-value">{metrics.genieacs?.faulty_devices || 0}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Fault Rate</span>
              <span class="metric-value">{metrics.genieacs?.fault_rate?.toFixed(2) || 0}%</span>
            </div>
          </div>
        </div>

        <!-- CBRS Metrics -->
        <div class="metric-card">
          <h3>📻 CBRS Metrics</h3>
          <div class="metric-list">
            <div class="metric-item">
              <span class="metric-label">Total CBSDs</span>
              <span class="metric-value">{metrics.cbrs?.total_cbsds || 0}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Active Grants</span>
              <span class="metric-value">{metrics.cbrs?.active_grants || 0}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Heartbeat Failure Rate</span>
              <span class="metric-value">{metrics.cbrs?.heartbeat_failure_rate?.toFixed(2) || 0}%</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Available Spectrum</span>
              <span class="metric-value">{metrics.cbrs?.available_spectrum_mhz || 0} MHz</span>
            </div>
          </div>
        </div>
      </div>
    </div>

  {:else if activeTab === 'alerts'}
    <!-- Active Alerts Tab -->
    <div class="alerts-tab">
      <div class="filters">
        <select bind:value={alertSeverityFilter}>
          <option value="all">All Severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="critical">Critical</option>
        </select>
        
        <select bind:value={alertSourceFilter}>
          <option value="all">All Sources</option>
          <option value="hss">HSS</option>
          <option value="genieacs">GenieACS</option>
          <option value="cbrs">CBRS</option>
          <option value="api">API</option>
          <option value="system">System</option>
        </select>
      </div>

      {#if filteredAlerts.length === 0}
        <div class="empty-state">
          ✅ No active alerts - All systems operational!
        </div>
      {:else}
        <div class="alert-list">
          {#each filteredAlerts as alert}
            <div class="alert-item" style="border-left: 4px solid {getSeverityColor(alert.severity)}">
              <div class="alert-header">
                <span class="alert-severity" style="background: {getSeverityColor(alert.severity)}">
                  {alert.severity.toUpperCase()}
                </span>
                <span class="alert-source">{alert.source}</span>
                <span class="alert-time">
                  {new Date(alert.first_triggered).toLocaleString()}
                </span>
              </div>
              
              <div class="alert-body">
                <h4>{alert.rule_name}</h4>
                <p>{alert.message}</p>
                {#if alert.current_value !== undefined}
                  <div class="alert-details">
                    Current: <strong>{alert.current_value}</strong> | 
                    Threshold: <strong>{alert.threshold}</strong>
                  </div>
                {/if}
              </div>
              
              <div class="alert-actions">
                {#if alert.status === 'firing'}
                  <button class="btn-ack" on:click={() => acknowledgeAlert(alert.alert_id)}>
                    ✓ Acknowledge
                  </button>
                  <button class="btn-resolve" on:click={() => resolveAlert(alert.alert_id)}>
                    ✅ Resolve
                  </button>
                {:else if alert.status === 'acknowledged'}
                  <span class="status-badge">Acknowledged</span>
                  <button class="btn-resolve" on:click={() => resolveAlert(alert.alert_id)}>
                    ✅ Resolve
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

  {:else if activeTab === 'rules'}
    <!-- Alert Rules Tab -->
    <div class="rules-tab">
      <div class="section-header">
        <h2>⚙️ Alert Rules</h2>
        <button class="btn-primary" on:click={initializeDefaultAlerts}>
          ➕ Initialize Default Rules
        </button>
      </div>

      {#if alertRules.length === 0}
        <div class="empty-state">
          <p>No alert rules configured.</p>
          <button class="btn-primary" on:click={initializeDefaultAlerts}>
            ➕ Create Default Alert Rules
          </button>
        </div>
      {:else}
        <div class="rules-list">
          {#each alertRules as rule}
            <div class="rule-card">
              <div class="rule-header">
                <span class="rule-name">{rule.name}</span>
                <span class="rule-enabled">
                  {rule.enabled ? '✅ Enabled' : '⏸️ Disabled'}
                </span>
              </div>
              
              <div class="rule-details">
                <span class="rule-badge">{rule.source}</span>
                <span class="rule-badge" style="background: {getSeverityColor(rule.severity)}">
                  {rule.severity}
                </span>
              </div>
              
              <p class="rule-description">{rule.description || 'No description'}</p>
              
              <div class="rule-condition">
                <code>{rule.metric_name} {rule.operator} {rule.threshold}</code>
                for {rule.duration_seconds}s
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

  {:else if activeTab === 'audit'}
    <!-- Audit Log Tab -->
    <div class="audit-tab">
      <h2>📋 Audit Log</h2>
      
      {#if auditLogs.length === 0}
        <div class="empty-state">No audit logs found.</div>
      {:else}
        <div class="audit-list">
          {#each auditLogs as log}
            <div class="audit-item">
              <div class="audit-time">{new Date(log.timestamp).toLocaleString()}</div>
              <div class="audit-details">
                <span class="audit-user">{log.user_email || log.user_id}</span>
                <span class="audit-action">{log.action}</span>
                <span class="audit-resource">{log.resource_type}</span>
                {#if log.resource_id}
                  <span class="audit-id">({log.resource_id})</span>
                {/if}
              </div>
              {#if log.module}
                <span class="audit-module">{log.module}</span>
              {/if}
              <span class="audit-status" class:success={log.status === 'success'} class:failure={log.status === 'failure'}>
                {log.status}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
    
  {:else if activeTab === 'email'}
    <!-- Email Settings Tab -->
    <EmailSettings {tenantId} API_URL={MONITORING_API} />
  {/if}
</div>

<style>
  .monitoring-page {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }

  .header-left {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .back-button {
    background: none;
    border: 1px solid var(--border-color);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--text-secondary);
    width: fit-content;
    transition: all 0.2s;
  }

  .back-button:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--brand-primary);
  }

  .header h1 {
    margin: 0;
    font-size: 2rem;
  }

  .header p {
    color: var(--text-secondary);
    margin: 0.5rem 0 0 0;
  }

  .btn-refresh {
    padding: 0.75rem 1.5rem;
    background: var(--brand-primary);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }

  .tabs {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    border-bottom: 2px solid var(--border-color);
  }

  .tab {
    padding: 1rem 1.5rem;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    cursor: pointer;
    font-weight: 500;
    color: var(--text-secondary);
    transition: all 0.2s;
  }

  .tab.active {
    color: var(--brand-primary);
    border-bottom-color: var(--brand-primary);
  }

  .summary-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .card {
    background: var(--card-bg);
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .card.critical {
    border-color: #dc2626;
    background: rgba(220, 38, 38, 0.05);
  }

  .card.warning {
    border-color: #f59e0b;
    background: rgba(245, 158, 11, 0.05);
  }

  .card-icon {
    font-size: 2.5rem;
  }

  .card-value {
    font-size: 2rem;
    font-weight: 700;
  }

  .card-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .section {
    margin: 2rem 0;
  }

  .section h2 {
    margin-bottom: 1rem;
  }

  .service-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }

  .service-card {
    background: var(--card-bg);
    padding: 1rem;
    border-radius: 6px;
    border: 1px solid var(--border-color);
  }

  .service-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .service-name {
    font-weight: 600;
  }

  .service-status {
    font-size: 0.75rem;
    font-weight: 700;
  }

  .service-metric, .service-time {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .service-error {
    color: #ef4444;
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 1.5rem;
    margin-top: 2rem;
  }

  .metric-card {
    background: var(--card-bg);
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .metric-card h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
  }

  .metric-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .metric-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem;
    background: var(--bg-secondary);
    border-radius: 4px;
  }

  .metric-label {
    color: var(--text-secondary);
  }

  .metric-value {
    font-weight: 600;
    color: var(--brand-primary);
  }

  .filters {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .filters select {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--card-bg);
  }

  .alert-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .alert-item {
    background: var(--card-bg);
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .alert-header {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    align-items: center;
  }

  .alert-severity {
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 700;
    color: white;
  }

  .alert-source {
    padding: 0.25rem 0.75rem;
    background: var(--bg-tertiary);
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .alert-time {
    margin-left: auto;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .alert-body h4 {
    margin: 0 0 0.5rem 0;
  }

  .alert-body p {
    margin: 0;
    color: var(--text-secondary);
  }

  .alert-details {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-tertiary);
  }

  .alert-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .btn-ack, .btn-resolve {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .btn-ack {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-resolve {
    background: #10b981;
    color: white;
  }

  .status-badge {
    padding: 0.5rem 1rem;
    background: var(--bg-tertiary);
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .rules-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1rem;
  }

  .rule-card {
    background: var(--card-bg);
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .rule-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .rule-name {
    font-weight: 600;
    font-size: 1.1rem;
  }

  .rule-details {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .rule-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
  }

  .rule-condition {
    margin-top: 1rem;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.875rem;
  }

  .audit-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .audit-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--card-bg);
    border-radius: 6px;
    border: 1px solid var(--border-color);
  }

  .audit-time {
    font-size: 0.875rem;
    color: var(--text-secondary);
    min-width: 180px;
  }

  .audit-details {
    flex: 1;
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .audit-user {
    font-weight: 600;
  }

  .audit-action {
    padding: 0.25rem 0.5rem;
    background: var(--bg-tertiary);
    border-radius: 4px;
    font-size: 0.75rem;
  }

  .audit-status {
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .audit-status.success {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }

  .audit-status.failure {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-secondary);
  }

  .loading {
    text-align: center;
    padding: 4rem;
    font-size: 1.2rem;
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .summary-cards, .metrics-grid, .service-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

