<script lang="ts">
  import { onMount } from 'svelte';
  import MainMenu from '../components/MainMenu.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';

  interface AlertRule {
    rule_id: string;
    name: string;
    metric_name: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    threshold: number;
    severity: 'info' | 'warning' | 'error' | 'critical';
    duration_seconds: number;
    cooldown_minutes: number;
    enabled: boolean;
    device_filter?: any;
  }

  interface Alert {
    alert_id: string;
    rule_name: string;
    message: string;
    severity: string;
    status: string;
    device_id?: string;
    device_name?: string;
    current_value?: number;
    first_triggered: Date;
    last_triggered: Date;
  }

  let rules: AlertRule[] = [];
  let alerts: Alert[] = [];
  let isLoading = false;
  let showCreateModal = false;
  let showEditModal = false;
  let selectedRule: AlertRule | null = null;
  let error = '';
  let success = '';

  // Form state
  let formData: Partial<AlertRule> = {
    name: '',
    metric_name: 'device_offline',
    operator: 'lt',
    threshold: 0,
    severity: 'warning',
    duration_seconds: 300,
    cooldown_minutes: 15,
    enabled: true
  };

  onMount(async () => {
    await loadRules();
    await loadAlerts();
  });

  async function loadRules() {
    if (!$currentTenant?.id) return;
    
    isLoading = true;
    error = '';
    try {
      const user = authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      
      const token = await authService.getAuthTokenForApi();
      
      const response = await fetch('/api/tr069/alerts/rules', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        rules = data.rules || [];
      } else {
        error = data.error || 'Failed to load alert rules';
      }
    } catch (err: any) {
      console.error('Failed to load alert rules:', err);
      error = err.message || 'Failed to load alert rules';
    } finally {
      isLoading = false;
    }
  }

  async function loadAlerts() {
    if (!$currentTenant?.id) return;
    
    try {
      const user = authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      
      const token = await authService.getAuthTokenForApi();
      
      const response = await fetch('/api/tr069/alerts', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        alerts = data.alerts || [];
      }
    } catch (err: any) {
      console.error('Failed to load alerts:', err);
    }
  }

  function openCreateModal() {
    formData = {
      name: '',
      metric_name: 'device_offline',
      operator: 'lt',
      threshold: 0,
      severity: 'warning',
      duration_seconds: 300,
      cooldown_minutes: 15,
      enabled: true
    };
    showCreateModal = true;
  }

  function openEditModal(rule: AlertRule) {
    selectedRule = rule;
    formData = { ...rule };
    showEditModal = true;
  }

  async function saveRule() {
    if (!formData.name?.trim()) {
      error = 'Rule name is required';
      return;
    }

    if (!$currentTenant?.id) {
      error = 'No tenant selected';
      return;
    }

    error = '';
    success = '';
    isLoading = true;

    try {
      const user = authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      
      const token = await authService.getAuthTokenForApi();
      
      const endpoint = selectedRule 
        ? `/api/tr069/alerts/rules/${selectedRule.rule_id}`
        : '/api/tr069/alerts/rules';
      
      const response = await fetch(endpoint, {
        method: selectedRule ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        success = selectedRule ? 'Alert rule updated successfully' : 'Alert rule created successfully';
        showCreateModal = false;
        showEditModal = false;
        selectedRule = null;
        await loadRules();
        setTimeout(() => success = '', 3000);
      } else {
        error = data.error || 'Failed to save alert rule';
      }
    } catch (err: any) {
      console.error('Failed to save alert rule:', err);
      error = err.message || 'Failed to save alert rule';
    } finally {
      isLoading = false;
    }
  }

  async function deleteRule(rule: AlertRule) {
    if (!confirm(`Delete alert rule "${rule.name}"? This cannot be undone.`)) {
      return;
    }

    if (!$currentTenant?.id) {
      error = 'No tenant selected';
      return;
    }

    error = '';
    isLoading = true;

    try {
      const user = authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      
      const token = await authService.getAuthTokenForApi();
      
      const response = await fetch(`/api/tr069/alerts/rules/${rule.rule_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        success = 'Alert rule deleted successfully';
        await loadRules();
        setTimeout(() => success = '', 3000);
      } else {
        error = data.error || 'Failed to delete alert rule';
      }
    } catch (err: any) {
      console.error('Failed to delete alert rule:', err);
      error = err.message || 'Failed to delete alert rule';
    } finally {
      isLoading = false;
    }
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'error': return '#f59e0b';
      case 'warning': return '#fbbf24';
      case 'info': return '#3b82f6';
      default: return '#6b7280';
    }
  }
</script>

<svelte:head>
  <title>Alert Rules - ACS CPE Management</title>
</svelte:head>

<div class="alerts-page">
  <MainMenu />
  
  <div class="page-header">
    <div class="header-content">
      <a href="/modules/acs-cpe-management" class="back-button">← Back to ACS Management</a>
      <h1>🚨 Alert Rules</h1>
      <p>Configure alerts for ACS device monitoring</p>
    </div>
    <button class="btn btn-primary" on:click={openCreateModal}>
      ➕ Create Alert Rule
    </button>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if success}
    <div class="alert alert-success">{success}</div>
  {/if}

  <!-- Active Alerts -->
  {#if alerts.length > 0}
    <div class="alerts-section">
      <h2>Active Alerts ({alerts.length})</h2>
      <div class="alerts-list">
        {#each alerts as alert}
          <div class="alert-item" style="border-left-color: {getSeverityColor(alert.severity)}">
            <div class="alert-header">
              <span class="alert-severity" style="color: {getSeverityColor(alert.severity)}">
                {alert.severity.toUpperCase()}
              </span>
              <span class="alert-time">{new Date(alert.first_triggered).toLocaleString()}</span>
            </div>
            <div class="alert-message">{alert.message}</div>
            {#if alert.device_name}
              <div class="alert-device">Device: {alert.device_name}</div>
            {/if}
            {#if alert.current_value !== undefined}
              <div class="alert-value">Current Value: {alert.current_value}</div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Alert Rules -->
  {#if isLoading && rules.length === 0}
    <div class="loading">Loading alert rules...</div>
  {:else if rules.length === 0}
    <div class="empty-state">
      <p>No alert rules found. Create your first alert rule to get started.</p>
      <button class="btn btn-primary" on:click={openCreateModal}>Create Alert Rule</button>
    </div>
  {:else}
    <div class="rules-grid">
      {#each rules as rule}
        <div class="rule-card" class:disabled={!rule.enabled}>
          <div class="rule-header">
            <h3>{rule.name}</h3>
            <div class="rule-actions">
              <button class="btn-icon" on:click={() => openEditModal(rule)} title="Edit">✏️</button>
              <button class="btn-icon danger" on:click={() => deleteRule(rule)} title="Delete">🗑️</button>
            </div>
          </div>
          
          <div class="rule-meta">
            <span class="meta-item">Metric: {rule.metric_name}</span>
            <span class="meta-item">Operator: {rule.operator}</span>
            <span class="meta-item">Threshold: {rule.threshold}</span>
            <span class="meta-item severity" style="color: {getSeverityColor(rule.severity)}">
              Severity: {rule.severity}
            </span>
          </div>

          <div class="rule-status">
            {rule.enabled ? '✅ Enabled' : '⏸️ Disabled'}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Create/Edit Modal -->
{#if showCreateModal || showEditModal}
  <div class="modal-overlay" on:click={() => { showCreateModal = false; showEditModal = false; }}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>{selectedRule ? 'Edit Alert Rule' : 'Create Alert Rule'}</h2>
        <button class="close-btn" on:click={() => { showCreateModal = false; showEditModal = false; }}>×</button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label>Rule Name *</label>
          <input type="text" bind:value={formData.name} placeholder="e.g., Device Offline Alert" />
        </div>

        <div class="form-group">
          <label>Metric *</label>
          <select bind:value={formData.metric_name}>
            <option value="device_offline">Device Offline</option>
            <option value="parameter_RSSI">RSSI</option>
            <option value="parameter_RSRP">RSRP</option>
            <option value="parameter_SINR">SINR</option>
            <option value="parameter_RSRQ">RSRQ</option>
          </select>
        </div>

        <div class="form-group">
          <label>Operator *</label>
          <select bind:value={formData.operator}>
            <option value="gt">Greater Than (&gt;)</option>
            <option value="lt">Less Than (&lt;)</option>
            <option value="eq">Equals (=)</option>
            <option value="gte">Greater Than or Equal (&gt;=)</option>
            <option value="lte">Less Than or Equal (&lt;=)</option>
          </select>
        </div>

        <div class="form-group">
          <label>Threshold *</label>
          <input type="number" bind:value={formData.threshold} />
        </div>

        <div class="form-group">
          <label>Severity *</label>
          <select bind:value={formData.severity}>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div class="form-group">
          <label>Duration (seconds)</label>
          <input type="number" bind:value={formData.duration_seconds} />
          <small>How long condition must be true before alerting</small>
        </div>

        <div class="form-group">
          <label>Cooldown (minutes)</label>
          <input type="number" bind:value={formData.cooldown_minutes} />
          <small>Minimum time between alerts for same condition</small>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={() => { showCreateModal = false; showEditModal = false; }}>Cancel</button>
        <button class="btn btn-primary" on:click={saveRule} disabled={isLoading || !formData.name?.trim()}>
          {isLoading ? 'Saving...' : selectedRule ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .alerts-page {
    min-height: 100vh;
    background: var(--bg-primary);
    padding: 2rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }

  .back-button {
    color: var(--brand-primary);
    text-decoration: none;
    margin-bottom: 0.5rem;
    display: inline-block;
  }

  .alerts-section {
    margin-bottom: 2rem;
  }

  .alerts-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .alert-item {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-left-width: 4px;
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .alert-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .alert-severity {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .alert-time {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .alert-message {
    font-weight: 500;
    margin-bottom: 0.5rem;
  }

  .alert-device,
  .alert-value {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .rules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .rule-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .rule-card.disabled {
    opacity: 0.6;
  }

  .rule-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .rule-header h3 {
    margin: 0;
    font-size: 1.25rem;
  }

  .rule-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    font-size: 1.25rem;
    opacity: 0.7;
  }

  .btn-icon:hover {
    opacity: 1;
  }

  .btn-icon.danger:hover {
    color: #ef4444;
  }

  .rule-meta {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 1rem;
  }

  .rule-status {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: var(--card-bg);
    border-radius: 0.5rem;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-body {
    padding: 1.5rem;
    flex: 1;
  }

  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
  }

  .form-group small {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .alert {
    padding: 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
  }

  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .alert-success {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
  }
</style>
