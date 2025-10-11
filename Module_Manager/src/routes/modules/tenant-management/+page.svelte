<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { isCurrentUserAdmin } from '$lib/services/adminService';
  import { tenantService } from '$lib/services/tenantService';
  import type { Tenant } from '$lib/models/tenant';

  let tenants: Tenant[] = [];
  let isLoading = true;
  let error = '';
  let success = '';
  
  // Create tenant form
  let showCreateForm = false;
  let newTenantName = '';
  let newTenantDisplayName = '';
  let newTenantEmail = '';
  let newTenantSubdomain = '';
  
  // Selected tenant for editing
  let selectedTenant: Tenant | null = null;
  let showEditModal = false;

  onMount(async () => {
    if (!browser) return;

    // Check if user is admin
    if (!isCurrentUserAdmin()) {
      error = 'Access Denied: Admin privileges required';
      setTimeout(() => goto('/dashboard'), 2000);
      return;
    }

    await loadAllTenants();
    isLoading = false;
  });

  async function loadAllTenants() {
    try {
      console.log('Loading all tenants from Firestore...');
      
      // Use tenantService to get all tenants
      tenants = await tenantService.getAllTenants();
      
      console.log(`Loaded ${tenants.length} tenants`);
    } catch (err: any) {
      console.error('Error loading tenants:', err);
      error = err.message || 'Failed to load tenants';
    }
  }

  async function handleCreateTenant() {
    if (!newTenantName || !newTenantDisplayName || !newTenantEmail) {
      error = 'Please fill in all required fields';
      return;
    }

    try {
      const { authService } = await import('$lib/services/authService');
      const currentUser = authService.getCurrentUser();
      
      if (!currentUser) {
        error = 'User not authenticated';
        return;
      }

      const result = await tenantService.createTenant(
        newTenantName,
        newTenantDisplayName,
        newTenantEmail,
        currentUser.uid,
        newTenantSubdomain || undefined
      );

      if (result.success) {
        success = `Tenant "${newTenantDisplayName}" created successfully!`;
        showCreateForm = false;
        newTenantName = '';
        newTenantDisplayName = '';
        newTenantEmail = '';
        newTenantSubdomain = '';
        
        await loadAllTenants();
        
        setTimeout(() => success = '', 3000);
      } else {
        error = result.error || 'Failed to create tenant';
      }
    } catch (err: any) {
      error = err.message || 'Failed to create tenant';
    }
  }

  function handleEditTenant(tenant: Tenant) {
    selectedTenant = tenant;
    showEditModal = true;
  }

  function closeEditModal() {
    selectedTenant = null;
    showEditModal = false;
  }

  function generateSubdomain() {
    if (newTenantName) {
      newTenantSubdomain = newTenantName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }
  }

  function getTenantStats(tenant: Tenant) {
    // In a real implementation, fetch these from Firestore or Functions
    return {
      users: 0,
      devices: 0
    };
  }
</script>

<div class="tenant-management-page">
  <div class="page-header">
    <div>
      <button class="back-btn" on:click={() => goto('/dashboard')}>
        ← Back to Dashboard
      </button>
      <h1>🏢 Tenant Management</h1>
      <p class="subtitle">Manage all organizations and customer accounts</p>
      <div class="admin-badge">
        <span>🔐</span>
        <span>Platform Admin Access</span>
      </div>
    </div>
    
    <button class="btn-primary" on:click={() => showCreateForm = !showCreateForm}>
      {showCreateForm ? '✕ Cancel' : '➕ Create New Tenant'}
    </button>
  </div>

  {#if error}
    <div class="error-message">
      <span class="error-icon">⚠️</span>
      {error}
    </div>
  {/if}

  {#if success}
    <div class="success-message">
      <span class="success-icon">✅</span>
      {success}
    </div>
  {/if}

  <!-- Create Tenant Form -->
  {#if showCreateForm}
    <div class="create-form">
      <h2>Create New Tenant</h2>
      
      <div class="form-grid">
        <div class="form-group">
          <label for="tenant-name">Tenant Name *</label>
          <input
            id="tenant-name"
            type="text"
            bind:value={newTenantName}
            on:input={generateSubdomain}
            placeholder="e.g., acme-wireless"
          />
        </div>

        <div class="form-group">
          <label for="display-name">Display Name *</label>
          <input
            id="display-name"
            type="text"
            bind:value={newTenantDisplayName}
            placeholder="e.g., Acme Wireless ISP"
          />
        </div>

        <div class="form-group">
          <label for="contact-email">Contact Email *</label>
          <input
            id="contact-email"
            type="email"
            bind:value={newTenantEmail}
            placeholder="admin@acme.com"
          />
        </div>

        <div class="form-group">
          <label for="subdomain">Subdomain</label>
          <input
            id="subdomain"
            type="text"
            bind:value={newTenantSubdomain}
            placeholder="acme-wireless-abc123"
          />
          <p class="help-text">Used for CWMP URL: /cwmp/{newTenantSubdomain || 'subdomain'}</p>
        </div>
      </div>

      <div class="form-actions">
        <button class="btn-secondary" on:click={() => showCreateForm = false}>
          Cancel
        </button>
        <button class="btn-primary" on:click={handleCreateTenant}>
          Create Tenant
        </button>
      </div>
    </div>
  {/if}

  <!-- Tenants List -->
  <div class="tenants-section">
    <h2>All Tenants ({tenants.length})</h2>
    
    {#if isLoading}
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading tenants...</p>
      </div>
    {:else if tenants.length === 0}
      <div class="empty-state">
        <span class="empty-icon">📦</span>
        <h3>No Tenants Yet</h3>
        <p>Create your first tenant to get started</p>
      </div>
    {:else}
      <div class="tenants-grid">
        {#each tenants as tenant}
          <div class="tenant-card">
            <div class="tenant-header">
              <div class="tenant-icon">🏢</div>
              <div class="tenant-status">
                <span class="status-badge status-{tenant.status}">
                  {tenant.status}
                </span>
              </div>
            </div>

            <h3 class="tenant-name">{tenant.displayName}</h3>
            <p class="tenant-id">{tenant.subdomain}</p>

            <div class="tenant-info">
              <div class="info-row">
                <span class="label">Contact:</span>
                <span class="value">{tenant.contactEmail}</span>
              </div>
              <div class="info-row">
                <span class="label">Created:</span>
                <span class="value">{new Date(tenant.createdAt).toLocaleDateString()}</span>
              </div>
              <div class="info-row">
                <span class="label">CWMP URL:</span>
                <span class="value url">{tenant.cwmpUrl}</span>
              </div>
            </div>

            <div class="tenant-stats">
              <div class="stat">
                <span class="stat-value">{getTenantStats(tenant).users}</span>
                <span class="stat-label">Users</span>
              </div>
              <div class="stat">
                <span class="stat-value">{getTenantStats(tenant).devices}</span>
                <span class="stat-label">Devices</span>
              </div>
            </div>

            <div class="tenant-actions">
              <button class="btn-small" on:click={() => handleEditTenant(tenant)}>
                ⚙️ Manage
              </button>
              <button class="btn-small" on:click={() => {
                localStorage.setItem('selectedTenantId', tenant.id);
                localStorage.setItem('selectedTenantName', tenant.displayName);
                goto('/tenant-admin');
              }}>
                📊 Settings
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .tenant-management-page {
    min-height: 100vh;
    background: var(--bg-primary);
    padding: 2rem;
  }

  .page-header {
    max-width: 1400px;
    margin: 0 auto 2rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
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
    font-size: 1rem;
  }

  .admin-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding: 0.5rem 1rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 0.5rem;
    color: #ef4444;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .error-message, .success-message {
    max-width: 1400px;
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

  .create-form {
    max-width: 1400px;
    margin: 0 auto 2rem;
    background: var(--card-bg);
    border-radius: 1rem;
    padding: 2rem;
    border: 2px solid var(--brand-primary);
  }

  .create-form h2 {
    margin-bottom: 1.5rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
  }

  .form-group input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .help-text {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }

  .tenants-section {
    max-width: 1400px;
    margin: 0 auto;
  }

  .tenants-section h2 {
    margin-bottom: 1.5rem;
  }

  .tenants-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .tenant-card {
    background: var(--card-bg);
    border-radius: 1rem;
    padding: 1.5rem;
    border: 1px solid var(--border-color);
    transition: all 0.2s;
  }

  .tenant-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  }

  .tenant-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .tenant-icon {
    font-size: 2rem;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-active {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }

  .status-trial {
    background: rgba(251, 191, 36, 0.1);
    color: #fbbf24;
  }

  .status-suspended {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .tenant-name {
    font-size: 1.25rem;
    margin-bottom: 0.25rem;
  }

  .tenant-id {
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-family: 'Courier New', monospace;
    margin-bottom: 1rem;
  }

  .tenant-info {
    margin-bottom: 1rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .info-row .label {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .info-row .value {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .info-row .value.url {
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
  }

  .tenant-stats {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .stat {
    flex: 1;
    text-align: center;
    padding: 0.75rem;
    background: rgba(124, 58, 237, 0.05);
    border-radius: 0.5rem;
  }

  .stat-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--brand-primary);
  }

  .stat-label {
    display: block;
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .tenant-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-small {
    flex: 1;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .btn-small:hover {
    background: var(--bg-hover);
  }

  .btn-primary, .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--brand-primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--brand-primary-hover);
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover {
    background: var(--bg-hover);
  }

  .loading, .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-secondary);
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

  .empty-icon {
    font-size: 4rem;
    display: block;
    margin-bottom: 1rem;
  }

  @media (max-width: 768px) {
    .tenant-management-page {
      padding: 1rem;
    }

    .page-header {
      flex-direction: column;
    }

    .tenants-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

