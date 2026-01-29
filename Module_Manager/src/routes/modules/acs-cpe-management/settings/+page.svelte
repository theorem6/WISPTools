<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { tenantService } from '$lib/services/tenantService';
  import { authService } from '$lib/services/authService';
  import type { Tenant, TenantSettings } from '$lib/models/tenant';

  let isLoading = true;
  let tenant: Tenant | null = null;
  let tenantId = '';
  let tenantName = '';
  let error = '';
  let success = '';
  let isSaving = false;
  let activeTab = 'devices';

  // Editable settings
  let settings: TenantSettings | null = null;
  let cwmpUrl = '';
  let genieacsApiUrl = '';

  onMount(async () => {
    if (!browser) return;

    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      await goto('/login');
      return;
    }

    // Check if user is system admin
    const { isPlatformAdmin } = await import('$lib/services/adminService');
    const isAdmin = isPlatformAdmin(currentUser.email || '');

    tenantId = localStorage.getItem('selectedTenantId') || '';
    tenantName = localStorage.getItem('selectedTenantName') || '';

    // System admins don't need a tenant selected
    if (!tenantId && !isAdmin) {
      error = 'No tenant selected';
      setTimeout(() => goto('/tenant-selector'), 2000);
      return;
    }

    // Load tenant data (if tenant is selected)
    if (tenantId) {
      try {
        const result = await tenantService.getTenant(tenantId);
        tenant = result.tenant;
        if (!tenant) {
          error = 'Tenant not found';
          return;
        }

        // Initialize settings
        settings = { ...tenant.settings };
        
        // Load TR069 configuration to get latest CWMP URL
        const { apiService } = await import('$lib/services/apiService');
        const configResult = await apiService.getTR069Config();
        if (configResult.success && configResult.data?.config) {
          cwmpUrl = configResult.data.config.cwmpUrl || tenant.cwmpUrl || '';
          genieacsApiUrl = configResult.data.config.genieacsApiUrl || '';
        } else {
          // Fallback to tenant's stored CWMP URL
          cwmpUrl = tenant.cwmpUrl || '';
        }
      } catch (err: any) {
        error = err.message || 'Failed to load tenant';
      } finally {
        isLoading = false;
      }
    } else {
      // Admin without tenant selected - show message
      error = 'System Admin: Please select a tenant to view/edit settings';
      isLoading = false;
    }
  });

  async function saveSettings() {
    if (!settings) return;

    error = '';
    success = '';
    isSaving = true;

    try {
      const result = await tenantService.updateTenantSettings(tenantId, settings);
      if (result.success) {
        success = 'ACS settings saved successfully!';
        const r = await tenantService.getTenant(tenantId);
        tenant = r.tenant;
      } else {
        error = result.error || 'Failed to save settings';
      }
    } catch (err: any) {
      error = err.message || 'Failed to save settings';
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="acs-settings-page">
  <div class="page-header">
    <div>
      <button class="back-btn" on:click={() => goto('/modules/acs-cpe-management')}>
        ← Back to ACS Management
      </button>
      <h1>⚙️ ACS Settings</h1>
      <p class="subtitle">{tenantName} - Device Management Configuration</p>
    </div>
  </div>

  {#if error}
    <div class="error-message">
      <span>⚠️</span>
      <span>{error}</span>
      <button class="dismiss-btn" on:click={() => error = ''}>✕</button>
    </div>
  {/if}

  {#if success}
    <div class="success-message">
      <span>✅</span>
      <span>{success}</span>
      <button class="dismiss-btn" on:click={() => success = ''}>✕</button>
    </div>
  {/if}

  {#if isLoading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading settings...</p>
    </div>
  {:else if settings}
    <div class="settings-container">
      <div class="tabs">
        <button 
          class="tab" 
          class:active={activeTab === 'devices'}
          on:click={() => activeTab = 'devices'}
        >
          Device Management
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'monitoring'}
          on:click={() => activeTab = 'monitoring'}
        >
          Monitoring & Analytics
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'authentication'}
          on:click={() => activeTab = 'authentication'}
        >
          Authentication
        </button>
      </div>

      {#if activeTab === 'devices'}
        <div class="settings-panel">
          <h2>Device Management Settings</h2>
          <p class="panel-subtitle">Configure how devices are managed and monitored</p>

          <div class="form-group">
            <label for="inform-interval">Device Inform Interval (seconds)</label>
            <input
              id="inform-interval"
              type="number"
              bind:value={settings.informInterval}
              min="60"
              max="3600"
            />
            <p class="help-text">How often devices check in with the ACS (60-3600 seconds)</p>
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" bind:checked={settings.enableAutoDiscovery} />
              Enable Auto Discovery
            </label>
            <p class="help-text">Automatically discover and register new devices when they connect</p>
          </div>

          <div class="form-group">
            <label for="data-retention">Data Retention Period (days)</label>
            <input
              id="data-retention"
              type="number"
              bind:value={settings.dataRetentionDays}
              min="7"
              max="365"
            />
            <p class="help-text">How long to keep historical device data (7-365 days)</p>
          </div>

          <button class="btn-primary" on:click={saveSettings} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Device Settings'}
          </button>
        </div>
      {/if}

      {#if activeTab === 'monitoring'}
        <div class="settings-panel">
          <h2>Monitoring & Analytics Settings</h2>
          <p class="panel-subtitle">Configure monitoring features for your devices</p>

          <div class="form-group">
            <label>
              <input type="checkbox" bind:checked={settings.enablePCIMonitoring} />
              Enable PCI Monitoring
            </label>
            <p class="help-text">Monitor LTE Physical Cell ID values and detect conflicts</p>
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" bind:checked={settings.enablePerformanceMonitoring} />
              Enable Performance Monitoring
            </label>
            <p class="help-text">Track device performance metrics (signal, throughput, etc.)</p>
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" bind:checked={settings.emailNotifications} />
              Enable Email Notifications
            </label>
            <p class="help-text">Send email alerts for device faults and issues</p>
          </div>

          {#if settings.emailNotifications}
            <div class="form-group">
              <label for="notification-emails">Notification Email Addresses</label>
              <textarea
                id="notification-emails"
                bind:value={settings.notificationEmails}
                placeholder="admin@example.com, tech@example.com"
                rows="3"
              ></textarea>
              <p class="help-text">Comma-separated list of email addresses</p>
            </div>
          {/if}

          <button class="btn-primary" on:click={saveSettings} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Monitoring Settings'}
          </button>
        </div>
      {/if}

      {#if activeTab === 'authentication'}
        <div class="settings-panel">
          <h2>ACS Authentication Settings</h2>
          <p class="panel-subtitle">Configure authentication for CPE device connections</p>

          <div class="auth-box">
            <div class="form-group">
              <label>
                <input type="checkbox" bind:checked={settings.requireAuth} />
                Require Device Authentication
              </label>
              <p class="help-text">Devices must provide valid credentials to connect to ACS</p>
            </div>

            <div class="credentials-section" class:disabled={!settings?.requireAuth}>
              <h3>Connection Credentials</h3>
              <p class="credentials-note">Configure these credentials in your CPE devices</p>

              <div class="credentials-grid">
                <div class="form-group">
                  <label for="acs-user">ACS Username</label>
                  <input
                    id="acs-user"
                    type="text"
                    bind:value={settings.acsUsername}
                    disabled={!settings?.requireAuth}
                    placeholder="admin"
                  />
                </div>

                <div class="form-group">
                  <label for="acs-pass">ACS Password</label>
                  <div class="password-field">
                    <input
                      id="acs-pass"
                      type="text"
                      bind:value={settings.acsPassword}
                      disabled={!settings?.requireAuth}
                      placeholder="••••••••"
                    />
                    <button 
                      class="generate-btn"
                      on:click={() => {
                        if (!settings) return;
                        settings.acsPassword = Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16);
                      }}
                      disabled={!settings?.requireAuth}
                      title="Generate random password"
                    >
                      🔄
                    </button>
                  </div>
                </div>
              </div>

              <div class="credential-display">
                <h4>Device Configuration:</h4>
                <div class="config-item">
                  <strong>ACS URL (CWMP):</strong>
                  <code class="cwmp-url">{cwmpUrl || tenant?.cwmpUrl || 'Loading...'}</code>
                  {#if cwmpUrl || tenant?.cwmpUrl}
                    <button 
                      class="copy-btn"
                      on:click={() => {
                        const url = cwmpUrl || tenant?.cwmpUrl || '';
                        navigator.clipboard?.writeText(url);
                        success = 'CWMP URL copied to clipboard!';
                        setTimeout(() => success = '', 3000);
                      }}
                      title="Copy CWMP URL"
                    >
                      📋 Copy
                    </button>
                  {/if}
                </div>
                {#if genieacsApiUrl}
                  <div class="config-item">
                    <strong>GenieACS NBI API:</strong>
                    <code>{genieacsApiUrl}</code>
                  </div>
                {/if}
                {#if settings.requireAuth}
                  <div class="config-item">
                    <strong>Username:</strong>
                    <code>{settings.acsUsername}</code>
                  </div>
                  <div class="config-item">
                    <strong>Password:</strong>
                    <code>{settings.acsPassword}</code>
                  </div>
                {:else}
                  <div class="config-item">
                    <strong>Authentication:</strong>
                    <span class="no-auth">Not Required</span>
                  </div>
                {/if}
              </div>
            </div>
          </div>

          <button class="btn-primary" on:click={saveSettings} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Authentication Settings'}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .acs-settings-page {
    min-height: 100vh;
    background: var(--bg-primary);
    padding: 2rem;
  }

  .page-header {
    max-width: 1200px;
    margin: 0 auto 2rem;
  }

  .back-btn {
    background: none;
    border: none;
    color: var(--brand-primary);
    cursor: pointer;
    font-size: 0.875rem;
    margin-bottom: 1rem;
    padding: 0.5rem 0;
  }

  .back-btn:hover {
    text-decoration: underline;
  }

  h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: var(--text-secondary);
  }

  .error-message, .success-message {
    max-width: 1200px;
    margin: 0 auto 1.5rem;
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .error-message {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .success-message {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  .dismiss-btn {
    margin-left: auto;
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
  }

  .dismiss-btn:hover {
    opacity: 1;
  }

  .loading {
    max-width: 1200px;
    margin: 4rem auto;
    text-align: center;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(124, 58, 237, 0.2);
    border-top-color: var(--brand-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .settings-container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  .tab {
    padding: 0.75rem 1.5rem;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .tab:hover {
    background: var(--bg-secondary);
  }

  .tab.active {
    background: var(--brand-primary);
    color: white;
    border-color: var(--brand-primary);
  }

  .settings-panel {
    background: var(--card-bg);
    border-radius: 1rem;
    padding: 2rem;
    border: 1px solid var(--border-color);
  }

  .settings-panel h2 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .panel-subtitle {
    color: var(--text-secondary);
    margin-bottom: 2rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .form-group input[type="number"],
  .form-group input[type="text"],
  .form-group textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .form-group input[type="checkbox"] {
    margin-right: 0.5rem;
  }

  .help-text {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .btn-primary {
    padding: 0.875rem 2rem;
    background: var(--brand-primary);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--brand-primary-hover);
    transform: translateY(-2px);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .auth-box {
    background: rgba(124, 58, 237, 0.05);
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .credentials-section {
    margin-top: 1.5rem;
  }

  .credentials-section.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .credentials-section h3 {
    font-size: 1.125rem;
    margin-bottom: 0.5rem;
  }

  .credentials-note {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }

  .credentials-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .password-field {
    display: flex;
    gap: 0.5rem;
  }

  .password-field input {
    flex: 1;
  }

  .generate-btn {
    padding: 0.75rem 1rem;
    background: var(--brand-primary);
    color: white;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 1.25rem;
  }

  .generate-btn:hover:not(:disabled) {
    background: var(--brand-primary-hover);
  }

  .generate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .credential-display {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .credential-display h4 {
    margin-bottom: 1rem;
    font-size: 1rem;
  }

  .config-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-color);
    gap: 0.75rem;
  }

  .config-item:last-child {
    border-bottom: none;
  }

  .config-item strong {
    color: var(--text-secondary);
    font-size: 0.875rem;
    min-width: 150px;
  }

  .config-item code {
    flex: 1;
    background: var(--bg-secondary);
    padding: 0.5rem 0.75rem;
    border-radius: 0.25rem;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    color: var(--brand-primary);
    word-break: break-all;
  }

  .config-item code.cwmp-url {
    font-weight: 600;
  }

  .copy-btn {
    padding: 0.5rem 1rem;
    background: var(--brand-primary);
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .copy-btn:hover {
    background: var(--brand-primary-hover);
    transform: translateY(-1px);
  }

  .no-auth {
    color: var(--text-secondary);
    font-style: italic;
  }

  @media (max-width: 768px) {
    .acs-settings-page {
      padding: 1rem;
    }

    .tabs {
      flex-direction: column;
    }

    .tab {
      width: 100%;
    }

    .credentials-grid {
      grid-template-columns: 1fr;
    }
  }
</style>