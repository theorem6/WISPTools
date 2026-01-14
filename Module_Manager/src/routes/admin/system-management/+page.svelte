<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { auth } from '$lib/firebase';
  import { isCurrentUserPlatformAdmin, isPlatformAdminByUid } from '$lib/services/adminService';
  import { tenantService } from '$lib/services/tenantService';
  import { authService } from '$lib/services/authService';
  import type { Tenant } from '$lib/models/tenant';
  import { buildApiUrl } from '$lib/config/backendConfig';
  import AdminBreadcrumb from '$lib/components/admin/AdminBreadcrumb.svelte';

  let isLoading = true;
  let isAdmin = false;
  let tenants: Tenant[] = [];
  let error = '';
  let success = '';
  let selectedTenant: Tenant | null = null;
  let showDeleteConfirm = false;
  let tenantToDelete: Tenant | null = null;
  
  // Remote agents status (global/system-wide)
  let remoteAgents: any[] = [];
  let loadingAgents = false;
  let agentsError = '';

  onMount(async () => {
    if (!browser) return;

    // Check if user is platform admin
    isAdmin = await isCurrentUserPlatformAdmin();
    
    if (!isAdmin) {
      error = 'Access denied. This page is only accessible to platform administrators.';
      isLoading = false;
      return;
    }

    await loadTenants();
    await loadAllRemoteAgents();
    isLoading = false;
  });

  async function loadTenants() {
    try {
      isLoading = true;
      error = '';
      
      // Use admin endpoint to get all tenants
      const headers = await getAuthHeaders();
      const response = await fetch('/admin/tenants', {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to load tenants: ${response.statusText}`);
      }

      const data = await response.json();
      tenants = data.map((t: any) => ({
        id: t.id || t._id,
        name: t.name,
        displayName: t.displayName,
        subdomain: t.subdomain,
        cwmpUrl: t.cwmpUrl,
        contactEmail: t.contactEmail,
        status: t.status || 'active',
        userCount: t.userCount || 0,
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
        updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date()
      }));
    } catch (err: any) {
      console.error('Error loading tenants:', err);
      error = err.message || 'Failed to load tenants';
    } finally {
      isLoading = false;
    }
  }

  async function getAuthHeaders() {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    const token = await currentUser.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  function selectTenant(tenant: Tenant) {
    selectedTenant = tenant;
  }

  function showDeleteDialog(tenant: Tenant) {
    tenantToDelete = tenant;
    showDeleteConfirm = true;
  }

  async function deleteTenant() {
    if (!tenantToDelete) return;

    try {
      isLoading = true;
      error = '';
      success = '';

      const headers = await getAuthHeaders();
      const response = await fetch(`/admin/tenants/${tenantToDelete.id}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete tenant');
      }

      success = `Tenant "${tenantToDelete.displayName}" deleted successfully.`;
      showDeleteConfirm = false;
      tenantToDelete = null;
      selectedTenant = null;

      // Reload tenants
      await loadTenants();
    } catch (err: any) {
      console.error('Error deleting tenant:', err);
      error = err.message || 'Failed to delete tenant';
    } finally {
      isLoading = false;
    }
  }

  async function suspendTenant(tenant: Tenant) {
    try {
      isLoading = true;
      error = '';
      success = '';

      const headers = await getAuthHeaders();
      const response = await fetch(`/admin/tenants/${tenant.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          status: tenant.status === 'suspended' ? 'active' : 'suspended'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update tenant');
      }

      success = `Tenant "${tenant.displayName}" ${tenant.status === 'suspended' ? 'activated' : 'suspended'} successfully.`;
      await loadTenants();
    } catch (err: any) {
      console.error('Error updating tenant:', err);
      error = err.message || 'Failed to update tenant';
    } finally {
      isLoading = false;
    }
  }

  function cancelDelete() {
    showDeleteConfirm = false;
    tenantToDelete = null;
  }

  function formatDate(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  }

  async function loadAllRemoteAgents() {
    try {
      loadingAgents = true;
      agentsError = '';
      remoteAgents = [];

      const headers = await getAuthHeaders();
      const allAgents: any[] = [];

      // Load agents from all tenants
      for (const tenant of tenants) {
        try {
          const tenantHeaders = { ...headers };
          tenantHeaders['X-Tenant-ID'] = tenant.id;

          const apiUrl = buildApiUrl('remote-agents/status');
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: tenantHeaders
          });

          if (response.ok) {
            const data = await response.json();
            if (data.agents && Array.isArray(data.agents)) {
              // Add tenant info to each agent
              const agentsWithTenant = data.agents.map((agent: any) => ({
                ...agent,
                tenant_id: tenant.id,
                tenant_name: tenant.displayName || tenant.name
              }));
              allAgents.push(...agentsWithTenant);
            }
          }
        } catch (err: any) {
          console.warn(`Failed to load agents for tenant ${tenant.id}:`, err);
          // Continue with other tenants
        }
      }

      // Sort by last check-in (most recent first)
      remoteAgents = allAgents.sort((a, b) => {
        const aTime = a.last_checkin || a.discovered_at || 0;
        const bTime = b.last_checkin || b.discovered_at || 0;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
    } catch (err: any) {
      console.error('Error loading remote agents:', err);
      agentsError = err.message || 'Failed to load remote agents';
      remoteAgents = [];
    } finally {
      loadingAgents = false;
    }
  }

  function formatTimeAgo(seconds: number | null): string {
    if (seconds === null || seconds === undefined) return 'N/A';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function getFirstCheckin(agent: any): string {
    if (agent.type === 'epc_agent') {
      return agent.created_at ? formatDate(agent.created_at) : 'N/A';
    } else {
      return agent.discovered_at ? formatDate(agent.discovered_at) : 'N/A';
    }
  }
</script>

<div class="system-admin-page">
    <AdminBreadcrumb items={[{ label: 'System Administration' }]} />
    <div class="admin-header">
      <h1>🔧 System Administration</h1>
      <p>Manage all tenants and system settings</p>
    </div>

    {#if isLoading && tenants.length === 0}
      <div class="loading">
        <p>Loading tenants...</p>
      </div>
    {:else if error}
      <div class="error-message">
        <span class="error-icon">⚠️</span>
        {error}
      </div>
    {:else if success}
      <div class="success-message">
        <span class="success-icon">✅</span>
        {success}
      </div>
    {/if}

    <div class="admin-content">
      <div class="tenants-list">
        <h2>All Tenants ({tenants.length})</h2>
        
        {#if tenants.length === 0}
          <div class="empty-state">
            <p>No tenants found.</p>
          </div>
        {:else}
          <div class="tenants-table">
            <table>
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Subdomain</th>
                  <th>Contact Email</th>
                  <th>Users</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each tenants as tenant (tenant.id)}
                  <tr class:selected={selectedTenant?.id === tenant.id}>
                    <td>
                      <strong>{tenant.displayName}</strong>
                      <br>
                      <small>{tenant.name}</small>
                    </td>
                    <td>{tenant.subdomain}</td>
                    <td>{tenant.contactEmail}</td>
                    <td>{tenant.userCount || 0}</td>
                    <td>
                      <span class="status-badge status-{tenant.status}">
                        {tenant.status || 'active'}
                      </span>
                    </td>
                    <td>{formatDate(tenant.createdAt)}</td>
                    <td class="actions">
            <button 
              class="btn btn-sm btn-secondary" 
              on:click={() => selectTenant(tenant)}
              title="View Details"
            >
              View
            </button>
                      <button 
                        class="btn btn-sm btn-warning" 
                        on:click={() => suspendTenant(tenant)}
                        disabled={isLoading}
                        title={tenant.status === 'suspended' ? 'Activate Tenant' : 'Suspend Tenant'}
                      >
                        {tenant.status === 'suspended' ? 'Activate' : 'Suspend'}
                      </button>
                      <button 
                        class="btn btn-sm btn-danger" 
                        on:click={() => showDeleteDialog(tenant)}
                        disabled={isLoading}
                        title="Delete Tenant"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>

      {#if selectedTenant}
        <div class="tenant-details">
          <h2>Tenant Details</h2>
          <div class="details-card">
            <div class="detail-row">
              <strong>Organization Name:</strong>
              <span>{selectedTenant.name}</span>
            </div>
            <div class="detail-row">
              <strong>Display Name:</strong>
              <span>{selectedTenant.displayName}</span>
            </div>
            <div class="detail-row">
              <strong>Subdomain:</strong>
              <span>{selectedTenant.subdomain}</span>
            </div>
            <div class="detail-row">
              <strong>Contact Email:</strong>
              <span>{selectedTenant.contactEmail}</span>
            </div>
            <div class="detail-row">
              <strong>CWMP URL:</strong>
              <span>{selectedTenant.cwmpUrl}</span>
            </div>
            <div class="detail-row">
              <strong>Status:</strong>
              <span class="status-badge status-{selectedTenant.status}">
                {selectedTenant.status || 'active'}
              </span>
            </div>
            <div class="detail-row">
              <strong>User Count:</strong>
              <span>{selectedTenant.userCount || 0}</span>
            </div>
            <div class="detail-row">
              <strong>Created:</strong>
              <span>{formatDate(selectedTenant.createdAt)}</span>
            </div>
            <div class="detail-row">
              <strong>Last Updated:</strong>
              <span>{formatDate(selectedTenant.updatedAt)}</span>
            </div>
          </div>
          
          <div class="details-actions">
            <button 
              class="btn btn-warning" 
              on:click={() => suspendTenant(selectedTenant!)}
              disabled={isLoading}
            >
              {selectedTenant.status === 'suspended' ? 'Activate Tenant' : 'Suspend Tenant'}
            </button>
            <button 
              class="btn btn-danger" 
              on:click={() => showDeleteDialog(selectedTenant!)}
              disabled={isLoading}
            >
              Delete Tenant
            </button>
            <button 
              class="btn btn-secondary" 
              on:click={() => selectedTenant = null}
            >
              Close
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Remote Agents Status Section (Global/System-wide) -->
    <div class="remote-agents-section">
      <div class="section-header">
        <h2>📡 Remote Agents Status (System-wide)</h2>
        <button class="btn btn-secondary" on:click={loadAllRemoteAgents} disabled={loadingAgents}>
          {loadingAgents ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

        {#if loadingAgents}
          <div class="loading">
            <p>Loading remote agents...</p>
          </div>
        {:else if agentsError}
          <div class="error-message">
            <span class="error-icon">⚠️</span>
            {agentsError}
          </div>
        {:else if remoteAgents.length === 0}
          <div class="empty-state">
            <p>No remote agents found across all tenants.</p>
          </div>
        {:else}
          <div class="agents-table-container">
            <table class="agents-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Type</th>
                  <th>ID</th>
                  <th>Name/Code</th>
                  <th>First Check-in</th>
                  <th>Last Check-in</th>
                  <th>Status</th>
                  <th>Hardware Linked</th>
                </tr>
              </thead>
              <tbody>
                {#each remoteAgents as agent (agent.epc_id || agent.device_id)}
                  <tr>
                    <td>
                      <strong>{agent.tenant_name || agent.tenant_id || 'Unknown'}</strong>
                    </td>
                    <td>
                      <span class="agent-type-badge type-{agent.type}">
                        {agent.type === 'epc_agent' ? 'EPC' : 'SNMP'}
                      </span>
                    </td>
                    <td>
                      <code>{agent.epc_id || agent.device_id || 'N/A'}</code>
                    </td>
                    <td>
                      {agent.type === 'epc_agent' 
                        ? (agent.device_code || agent.site_name || 'N/A')
                        : (agent.name || agent.ip_address || 'N/A')}
                    </td>
                    <td>{getFirstCheckin(agent)}</td>
                    <td>
                      {agent.type === 'epc_agent' 
                        ? (agent.last_checkin ? formatDate(agent.last_checkin) : 'Never')
                        : (agent.discovered_at ? formatDate(agent.discovered_at) : 'N/A')}
                      {#if agent.time_since_checkin !== null && agent.time_since_checkin !== undefined}
                        <br>
                        <small class="time-ago">{formatTimeAgo(agent.time_since_checkin)}</small>
                      {/if}
                    </td>
                    <td>
                      <span class="status-badge status-{agent.checkin_status || agent.status}">
                        {agent.type === 'epc_agent' 
                          ? (agent.checkin_status || agent.status || 'unknown')
                          : (agent.status || 'discovered')}
                      </span>
                    </td>
                    <td>
                      {#if agent.hardware_linked}
                        <span class="linked-badge linked">✓ Linked</span>
                        {#if agent.hardware_link_type}
                          <br><small>({agent.hardware_link_type})</small>
                        {/if}
                      {:else}
                        <span class="linked-badge unlinked">✗ Unlinked</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>

    {#if showDeleteConfirm && tenantToDelete}
      <div class="modal-overlay" on:click={cancelDelete}>
        <div class="modal" on:click|stopPropagation>
          <h2>⚠️ Confirm Deletion</h2>
          <p>
            Are you sure you want to delete the tenant <strong>"{tenantToDelete.displayName}"</strong>?
          </p>
          <p class="warning-text">
            This action cannot be undone. All data associated with this tenant will be permanently deleted,
            including:
          </p>
          <ul>
            <li>All user associations</li>
            <li>All customers</li>
            <li>All work orders</li>
            <li>All inventory</li>
            <li>All network configurations</li>
          </ul>
          <div class="modal-actions">
            <button 
              class="btn btn-danger" 
              on:click={deleteTenant}
              disabled={isLoading}
            >
              {isLoading ? 'Deleting...' : 'Yes, Delete Tenant'}
            </button>
            <button 
              class="btn btn-secondary" 
              on:click={cancelDelete}
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>

<style>
  .system-admin-page {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
    background: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
  }

  .admin-header {
    margin-bottom: 2rem;
  }

  .admin-header h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .admin-content {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  .tenants-list {
    background: var(--card-bg);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
  }

  .tenants-list h2 {
    margin-bottom: 1rem;
    font-size: 1.5rem;
  }

  .tenants-table {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead {
    background: var(--bg-secondary);
  }

  th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
  }

  tr.selected {
    background: var(--primary-light);
  }

  tr:hover {
    background: var(--hover-bg);
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .status-active {
    background: var(--success-light);
    color: var(--success-dark, #065f46);
  }

  .status-suspended {
    background: var(--warning-light);
    color: var(--warning-dark, #92400e);
  }

  .status-deleted {
    background: var(--danger-light);
    color: var(--danger-dark, #991b1b);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
  }

  .btn-secondary {
    background: var(--text-secondary);
    color: var(--text-inverse);
  }

  .btn-secondary:hover {
    background: var(--text-secondary);
    opacity: 0.9;
  }

  .btn-warning {
    background: var(--warning-color);
    color: var(--text-inverse);
  }

  .btn-warning:hover {
    background: var(--warning-hover);
  }

  .btn-danger {
    background: var(--danger-color);
    color: var(--text-inverse);
  }

  .btn-danger:hover {
    background: var(--danger-hover);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tenant-details {
    background: var(--card-bg);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
  }

  .details-card {
    margin-bottom: 1.5rem;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border-color);
  }

  .detail-row:last-child {
    border-bottom: none;
  }

  .details-actions {
    display: flex;
    gap: 1rem;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: var(--card-bg);
    border-radius: var(--radius-md);
    padding: 2rem;
    max-width: 500px;
    width: 90%;
  }

  .modal h2 {
    margin-bottom: 1rem;
    color: var(--danger-dark, #991b1b);
  }

  .warning-text {
    color: var(--danger-dark, #991b1b);
    font-weight: 500;
    margin: 1rem 0;
  }

  .modal ul {
    margin: 1rem 0;
    padding-left: 1.5rem;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
    justify-content: flex-end;
  }

  .error-message, .success-message {
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .error-message {
    background: var(--danger-light);
    color: var(--danger-dark, #991b1b);
  }

  .success-message {
    background: var(--success-light);
    color: var(--success-dark, #065f46);
  }

  .loading {
    text-align: center;
    padding: 2rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
  }

  .remote-agents-section {
    background: var(--card-bg);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
    margin-top: 2rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid var(--border-color);
  }

  .section-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .btn-primary {
    background: var(--primary-color);
    color: white;
  }

  .btn-primary:hover {
    background: var(--primary-hover);
  }

  .agents-table-container {
    overflow-x: auto;
  }

  .agents-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .agents-table th {
    background: var(--bg-secondary);
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    border-bottom: 2px solid var(--border-color);
    position: sticky;
    top: 0;
  }

  .agents-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  .agents-table tbody tr:hover {
    background: var(--hover-bg);
  }

  .agent-type-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .type-epc_agent {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }

  .type-snmp_device {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }

  code {
    background: var(--code-bg, rgba(0, 0, 0, 0.1));
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
  }

  .time-ago {
    color: var(--text-secondary);
    font-size: 0.75rem;
  }

  .linked-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .linked-badge.linked {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }

  .linked-badge.unlinked {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .status-stale {
    background: var(--warning-light);
    color: var(--warning-dark, #92400e);
  }

  .status-offline {
    background: var(--danger-light);
    color: var(--danger-dark, #991b1b);
  }

  .status-never {
    background: var(--text-secondary);
    color: var(--text-inverse);
  }
</style>


  }

  .status-active {
    background: var(--success-light);
    color: var(--success-dark, #065f46);
  }

  .status-suspended {
    background: var(--warning-light);
    color: var(--warning-dark, #92400e);
  }

  .status-deleted {
    background: var(--danger-light);
    color: var(--danger-dark, #991b1b);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
  }

  .btn-secondary {
    background: var(--text-secondary);
    color: var(--text-inverse);
  }

  .btn-secondary:hover {
    background: var(--text-secondary);
    opacity: 0.9;
  }

  .btn-warning {
    background: var(--warning-color);
    color: var(--text-inverse);
  }

  .btn-warning:hover {
    background: var(--warning-hover);
  }

  .btn-danger {
    background: var(--danger-color);
    color: var(--text-inverse);
  }

  .btn-danger:hover {
    background: var(--danger-hover);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tenant-details {
    background: var(--card-bg);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
  }

  .details-card {
    margin-bottom: 1.5rem;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border-color);
  }

  .detail-row:last-child {
    border-bottom: none;
  }

  .details-actions {
    display: flex;
    gap: 1rem;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: var(--card-bg);
    border-radius: var(--radius-md);
    padding: 2rem;
    max-width: 500px;
    width: 90%;
  }

  .modal h2 {
    margin-bottom: 1rem;
    color: var(--danger-dark, #991b1b);
  }

  .warning-text {
    color: var(--danger-dark, #991b1b);
    font-weight: 500;
    margin: 1rem 0;
  }

  .modal ul {
    margin: 1rem 0;
    padding-left: 1.5rem;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
    justify-content: flex-end;
  }

  .error-message, .success-message {
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .error-message {
    background: var(--danger-light);
    color: var(--danger-dark, #991b1b);
  }

  .success-message {
    background: var(--success-light);
    color: var(--success-dark, #065f46);
  }

  .loading {
    text-align: center;
    padding: 2rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
  }

  .remote-agents-section {
    background: var(--card-bg);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
    margin-top: 2rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid var(--border-color);
  }

  .section-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .btn-primary {
    background: var(--primary-color);
    color: white;
  }

  .btn-primary:hover {
    background: var(--primary-hover);
  }

  .agents-table-container {
    overflow-x: auto;
  }

  .agents-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .agents-table th {
    background: var(--bg-secondary);
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    border-bottom: 2px solid var(--border-color);
    position: sticky;
    top: 0;
  }

  .agents-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  .agents-table tbody tr:hover {
    background: var(--hover-bg);
  }

  .agent-type-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .type-epc_agent {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }

  .type-snmp_device {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }

  code {
    background: var(--code-bg, rgba(0, 0, 0, 0.1));
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
  }

  .time-ago {
    color: var(--text-secondary);
    font-size: 0.75rem;
  }

  .linked-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .linked-badge.linked {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }

  .linked-badge.unlinked {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .status-stale {
    background: var(--warning-light);
    color: var(--warning-dark, #92400e);
  }

  .status-offline {
    background: var(--danger-light);
    color: var(--danger-dark, #991b1b);
  }

  .status-never {
    background: var(--text-secondary);
    color: var(--text-inverse);
  }
</style>


  }

  .status-active {
    background: var(--success-light);
    color: var(--success-dark, #065f46);
  }

  .status-suspended {
    background: var(--warning-light);
    color: var(--warning-dark, #92400e);
  }

  .status-deleted {
    background: var(--danger-light);
    color: var(--danger-dark, #991b1b);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
  }

  .btn-secondary {
    background: var(--text-secondary);
    color: var(--text-inverse);
  }

  .btn-secondary:hover {
    background: var(--text-secondary);
    opacity: 0.9;
  }

  .btn-warning {
    background: var(--warning-color);
    color: var(--text-inverse);
  }

  .btn-warning:hover {
    background: var(--warning-hover);
  }

  .btn-danger {
    background: var(--danger-color);
    color: var(--text-inverse);
  }

  .btn-danger:hover {
    background: var(--danger-hover);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tenant-details {
    background: var(--card-bg);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
  }

  .details-card {
    margin-bottom: 1.5rem;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border-color);
  }

  .detail-row:last-child {
    border-bottom: none;
  }

  .details-actions {
    display: flex;
    gap: 1rem;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: var(--card-bg);
    border-radius: var(--radius-md);
    padding: 2rem;
    max-width: 500px;
    width: 90%;
  }

  .modal h2 {
    margin-bottom: 1rem;
    color: var(--danger-dark, #991b1b);
  }

  .warning-text {
    color: var(--danger-dark, #991b1b);
    font-weight: 500;
    margin: 1rem 0;
  }

  .modal ul {
    margin: 1rem 0;
    padding-left: 1.5rem;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
    justify-content: flex-end;
  }

  .error-message, .success-message {
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .error-message {
    background: var(--danger-light);
    color: var(--danger-dark, #991b1b);
  }

  .success-message {
    background: var(--success-light);
    color: var(--success-dark, #065f46);
  }

  .loading {
    text-align: center;
    padding: 2rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
  }

  .remote-agents-section {
    background: var(--card-bg);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
    margin-top: 2rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid var(--border-color);
  }

  .section-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .btn-primary {
    background: var(--primary-color);
    color: white;
  }

  .btn-primary:hover {
    background: var(--primary-hover);
  }

  .agents-table-container {
    overflow-x: auto;
  }

  .agents-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .agents-table th {
    background: var(--bg-secondary);
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    border-bottom: 2px solid var(--border-color);
    position: sticky;
    top: 0;
  }

  .agents-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  .agents-table tbody tr:hover {
    background: var(--hover-bg);
  }

  .agent-type-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .type-epc_agent {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }

  .type-snmp_device {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }

  code {
    background: var(--code-bg, rgba(0, 0, 0, 0.1));
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
  }

  .time-ago {
    color: var(--text-secondary);
    font-size: 0.75rem;
  }

  .linked-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .linked-badge.linked {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }

  .linked-badge.unlinked {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .status-stale {
    background: var(--warning-light);
    color: var(--warning-dark, #92400e);
  }

  .status-offline {
    background: var(--danger-light);
    color: var(--danger-dark, #991b1b);
  }

  .status-never {
    background: var(--text-secondary);
    color: var(--text-inverse);
  }
</style>

