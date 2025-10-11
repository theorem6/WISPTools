<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { tenantService } from '$lib/services/tenantService';
  import { authService } from '$lib/services/authService';
  import { isPlatformAdmin } from '$lib/services/adminService';
  import type { Tenant, TenantSettings, TenantLimits } from '$lib/models/tenant';

  let isLoading = true;
  let tenant: Tenant | null = null;
  let currentUser: any = null;
  let tenantId: string = '';
  let activeTab = 'general';
  let error = '';
  let success = '';
  let isSaving = false;
  let isAdmin = false;

  // Editable fields
  let displayName = '';
  let contactEmail = '';
  let contactPhone = '';
  let settings: TenantSettings | null = null;
  let limits: TenantLimits | null = null;

  onMount(async () => {
    if (!browser) return;

    currentUser = authService.getCurrentUser();
    if (!currentUser) {
      await goto('/login');
      return;
    }

    // Get selected tenant from localStorage
    tenantId = localStorage.getItem('selectedTenantId') || '';
    if (!tenantId) {
      await goto('/tenant-selector');
      return;
    }

    // Check if user is platform admin
    isAdmin = isPlatformAdmin(currentUser.email);
    console.log('Is platform admin:', isAdmin);

    // Load tenant data
    try {
      tenant = await tenantService.getTenant(tenantId);
      if (!tenant) {
        error = 'Tenant not found';
        return;
      }

      // Check permissions: Platform admin OR tenant owner/admin
      if (!isAdmin) {
        const role = await tenantService.getUserRole(currentUser.uid, tenantId);
        console.log('User role in tenant:', role);
        
        if (role !== 'owner' && role !== 'admin') {
          error = 'You do not have permission to access tenant settings';
          setTimeout(() => goto('/dashboard'), 2000);
          return;
        }
      } else {
        console.log('Platform admin access granted - full permissions');
      }

      // Initialize editable fields
      displayName = tenant.displayName;
      contactEmail = tenant.contactEmail;
      contactPhone = tenant.contactPhone || '';
      settings = { ...tenant.settings };
      limits = { ...tenant.limits };
    } catch (err: any) {
      error = err.message || 'Failed to load tenant';
    } finally {
      isLoading = false;
    }
  });

  async function saveGeneralSettings() {
    error = '';
    success = '';
    isSaving = true;

    try {
      // Update tenant basic info in Firestore
      const { updateDoc, doc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('$lib/firebase');
      
      await updateDoc(doc(db(), 'tenants', tenantId), {
        displayName: displayName,
        contactEmail: contactEmail,
        contactPhone: contactPhone || null,
        updatedAt: serverTimestamp()
      });
      
      success = 'General settings saved successfully!';
      
      // Reload tenant data
      tenant = await tenantService.getTenant(tenantId);
    } catch (err: any) {
      error = err.message || 'Failed to save settings';
    } finally {
      isSaving = false;
    }
  }

  async function saveDeviceSettings() {
    if (!settings) return;
    
    error = '';
    success = '';
    isSaving = true;

    try {
      const result = await tenantService.updateTenantSettings(tenantId, settings);
      if (result.success) {
        success = 'Device settings saved successfully!';
        // Reload tenant data
        tenant = await tenantService.getTenant(tenantId);
      } else {
        error = result.error || 'Failed to save settings';
      }
    } catch (err: any) {
      error = err.message || 'Failed to save settings';
    } finally {
      isSaving = false;
    }
  }

  async function saveLimits() {
    if (!limits) return;
    
    error = '';
    success = '';
    isSaving = true;

    try {
      const result = await tenantService.updateTenantLimits(tenantId, limits);
      if (result.success) {
        success = 'Limits updated successfully!';
        // Reload tenant data
        tenant = await tenantService.getTenant(tenantId);
      } else {
        error = result.error || 'Failed to update limits';
      }
    } catch (err: any) {
      error = err.message || 'Failed to update limits';
    } finally {
      isSaving = false;
    }
  }

  function copyToClipboard(text: string) {
    if (browser) {
      navigator.clipboard.writeText(text);
      success = 'Copied to clipboard!';
      setTimeout(() => success = '', 2000);
    }
  }
</script>

<div class="tenant-admin-page">
  <div class="admin-header">
    <div>
      <button class="back-btn" on:click={() => goto('/dashboard')}>
        ← Back to Dashboard
      </button>
      <h1>🏢 Tenant Settings</h1>
      {#if tenant}
        <p class="tenant-name">{tenant.displayName}</p>
      {/if}
    </div>
  </div>

  {#if isLoading}
    <div class="loading-container">
      <div class="spinner-large"></div>
      <p>Loading tenant settings...</p>
    </div>
  {:else if error && !tenant}
    <div class="error-container">
      <span class="error-icon">⚠️</span>
      <h2>Error</h2>
      <p>{error}</p>
    </div>
  {:else if tenant}
    <div class="admin-container">
      <div class="tabs">
        <button 
          class="tab" 
          class:active={activeTab === 'general'}
          on:click={() => activeTab = 'general'}
        >
          General
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'devices'}
          on:click={() => activeTab = 'devices'}
        >
          Device Settings
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'connection'}
          on:click={() => activeTab === 'connection'}
        >
          Connection
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'limits'}
          on:click={() => activeTab = 'limits'}
        >
          Limits & Quotas
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'users'}
          on:click={() => activeTab = 'users'}
        >
          Users
        </button>
      </div>

  {#if success}
    <div class="success-message">
      <span class="success-icon">✅</span>
      <span>{success}</span>
      <button class="dismiss-btn" on:click={() => success = ''}>✕</button>
    </div>
  {/if}

  {#if error && tenant}
    <div class="error-message">
      <span class="error-icon">⚠️</span>
      <span>{error}</span>
      <button class="dismiss-btn" on:click={() => error = ''}>✕</button>
    </div>
  {/if}

      {#if activeTab === 'general'}
        <div class="settings-panel">
          <h2>General Settings</h2>
          
          <div class="form-group">
            <label>Organization Name</label>
            <input type="text" bind:value={displayName} />
          </div>

          <div class="form-group">
            <label>Contact Email</label>
            <input type="email" bind:value={contactEmail} />
          </div>

          <div class="form-group">
            <label>Contact Phone</label>
            <input type="tel" bind:value={contactPhone} />
          </div>

          <div class="form-group">
            <label>Status</label>
            <div class="status-badge status-{tenant.status}">{tenant.status}</div>
          </div>

          <div class="form-group">
            <label>Created</label>
            <p class="read-only">{new Date(tenant.createdAt).toLocaleString()}</p>
          </div>

          <button class="btn-primary" on:click={saveGeneralSettings} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save General Settings'}
          </button>
        </div>
      {/if}

      {#if activeTab === 'devices' && settings}
        <div class="settings-panel">
          <h2>Device Management Settings</h2>
          
          <div class="form-group">
            <label>Inform Interval (seconds)</label>
            <input type="number" bind:value={settings.informInterval} min="60" max="3600" />
            <p class="help-text">How often devices report to the ACS (60-3600 seconds)</p>
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" bind:checked={settings.enableAutoDiscovery} />
              Enable Auto Discovery
            </label>
            <p class="help-text">Automatically discover new devices when they connect</p>
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" bind:checked={settings.enablePCIMonitoring} />
              Enable PCI Monitoring
            </label>
            <p class="help-text">Monitor LTE PCI values and detect conflicts</p>
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" bind:checked={settings.enablePerformanceMonitoring} />
              Enable Performance Monitoring
            </label>
            <p class="help-text">Track device performance metrics</p>
          </div>

          <div class="form-group">
            <label>Data Retention (days)</label>
            <input type="number" bind:value={settings.dataRetentionDays} min="7" max="365" />
            <p class="help-text">How long to keep historical data (7-365 days)</p>
          </div>

          <button class="btn-primary" on:click={saveDeviceSettings} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Device Settings'}
          </button>
        </div>
      {/if}

      {#if activeTab === 'connection'}
        <div class="settings-panel">
          <h2>Connection Information</h2>
          
          <div class="info-box">
            <h3>CWMP Connection URL</h3>
            <div class="url-display">
              <code>{tenant.cwmpUrl}</code>
              <button class="copy-btn" on:click={() => copyToClipboard(tenant.cwmpUrl)}>
                📋 Copy
              </button>
            </div>
            <p class="help-text">Configure this URL in your TR-069 devices as the ACS URL</p>
          </div>

          <div class="info-box">
            <h3>Tenant Subdomain</h3>
            <code class="subdomain-display">{tenant.subdomain}</code>
            <p class="help-text">Unique identifier for your organization</p>
          </div>

          <div class="info-box">
            <h3>Connection Instructions</h3>
            <ol class="instructions">
              <li>Access your device's TR-069 configuration</li>
              <li>Set ACS URL to: <code>{tenant.cwmpUrl}</code></li>
              <li>Set ACS Username (if required)</li>
              <li>Set ACS Password (if required)</li>
              <li>Save and reboot the device</li>
              <li>Device should appear in your device list within 5 minutes</li>
            </ol>
          </div>
        </div>
      {/if}

      {#if activeTab === 'limits' && limits}
        <div class="settings-panel">
          <h2>Limits & Quotas</h2>
          <p class="subtitle">Current plan limits for your organization</p>
          
          <div class="limits-grid">
            <div class="limit-card">
              <h3>Max Devices</h3>
              <div class="limit-value">{limits.maxDevices}</div>
              <input type="number" bind:value={limits.maxDevices} min="1" />
            </div>

            <div class="limit-card">
              <h3>Max Users</h3>
              <div class="limit-value">{limits.maxUsers}</div>
              <input type="number" bind:value={limits.maxUsers} min="1" />
            </div>

            <div class="limit-card">
              <h3>Max Networks</h3>
              <div class="limit-value">{limits.maxNetworks}</div>
              <input type="number" bind:value={limits.maxNetworks} min="1" />
            </div>

            <div class="limit-card">
              <h3>Storage Quota (MB)</h3>
              <div class="limit-value">{limits.storageQuotaMB}</div>
              <input type="number" bind:value={limits.storageQuotaMB} min="100" step="100" />
            </div>
          </div>

          <button class="btn-primary" on:click={saveLimits} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Update Limits'}
          </button>
        </div>
      {/if}

      {#if activeTab === 'users'}
        <div class="settings-panel">
          <h2>User Management</h2>
          <p class="subtitle">Manage users and their roles in your organization</p>
          
          <div class="user-management-redirect">
            <p>Manage your team members and their access levels</p>
            <button class="btn-primary" on:click={() => goto('/modules/tenant-management/users')}>
              👥 Manage Users
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .tenant-admin-page {
    min-height: 100vh;
    background: var(--bg-primary);
    padding: 2rem;
  }

  .admin-header {
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

  .tenant-name {
    color: var(--text-secondary);
    font-size: 1.125rem;
  }

  .loading-container, .error-container {
    max-width: 500px;
    margin: 4rem auto;
    text-align: center;
    background: var(--card-bg);
    padding: 3rem;
    border-radius: 1rem;
  }

  .spinner-large {
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

  .admin-container {
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

  .success-message {
    background-color: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #22c55e;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .error-message {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .settings-panel {
    background: var(--card-bg);
    border-radius: 1rem;
    padding: 2rem;
  }

  .settings-panel h2 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .subtitle {
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

  .form-group input[type="text"],
  .form-group input[type="email"],
  .form-group input[type="tel"],
  .form-group input[type="number"] {
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

  .read-only {
    color: var(--text-secondary);
  }

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-active {
    background-color: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .info-box {
    background: rgba(124, 58, 237, 0.05);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .info-box h3 {
    margin-bottom: 1rem;
  }

  .url-display {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  code {
    background: var(--bg-secondary);
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    flex: 1;
  }

  .copy-btn {
    padding: 0.5rem 1rem;
    background: var(--brand-primary);
    color: white;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    white-space: nowrap;
  }

  .subdomain-display {
    display: block;
    margin-bottom: 0.5rem;
  }

  .instructions {
    padding-left: 1.5rem;
  }

  .instructions li {
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
  }

  .limits-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .limit-card {
    background: rgba(124, 58, 237, 0.05);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    text-align: center;
  }

  .limit-card h3 {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .limit-value {
    font-size: 2rem;
    font-weight: bold;
    color: var(--brand-primary);
    margin-bottom: 1rem;
  }

  .limit-card input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    text-align: center;
  }

  .btn-primary {
    padding: 0.875rem 2rem;
    background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(37, 99, 235, 0.3);
  }

  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .user-management-redirect {
    text-align: center;
    padding: 3rem 2rem;
  }

  .user-management-redirect p {
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
  }

  .coming-soon {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-secondary);
  }

  .coming-soon .icon {
    font-size: 4rem;
    display: block;
    margin-bottom: 1rem;
  }

  .dismiss-btn {
    margin-left: auto;
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
    padding: 0.25rem;
  }

  .dismiss-btn:hover {
    opacity: 1;
  }

  @media (max-width: 768px) {
    .tenant-admin-page {
      padding: 1rem;
    }

    .settings-panel {
      padding: 1.5rem;
    }

    .tabs {
      flex-direction: column;
    }

    .tab {
      width: 100%;
    }
  }
</style>

