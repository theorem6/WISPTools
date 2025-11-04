<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { auth } from '$lib/firebase';
  import { isCurrentUserPlatformAdmin, isPlatformAdminByUid } from '$lib/services/adminService';
  import { tenantService } from '$lib/services/tenantService';
  import { authService } from '$lib/services/authService';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import type { Tenant } from '$lib/models/tenant';

  let isLoading = true;
  let isAdmin = false;
  let tenants: Tenant[] = [];
  let error = '';
  let success = '';
  let selectedTenant: Tenant | null = null;
  let showDeleteConfirm = false;
  let tenantToDelete: Tenant | null = null;

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
</script>

<TenantGuard adminOnly={true}>
  <div class="system-admin-page">
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
</TenantGuard>

<style>
  .system-admin-page {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
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
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
    background: #f5f5f5;
  }

  th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid #e0e0e0;
  }

  tr.selected {
    background: #e3f2fd;
  }

  tr:hover {
    background: #f9f9f9;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .status-active {
    background: #e8f5e9;
    color: #2e7d32;
  }

  .status-suspended {
    background: #fff3e0;
    color: #ef6c00;
  }

  .status-deleted {
    background: #ffebee;
    color: #c62828;
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
    background: #757575;
    color: white;
  }

  .btn-secondary:hover {
    background: #616161;
  }

  .btn-warning {
    background: #ff9800;
    color: white;
  }

  .btn-warning:hover {
    background: #f57c00;
  }

  .btn-danger {
    background: #f44336;
    color: white;
  }

  .btn-danger:hover {
    background: #d32f2f;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tenant-details {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .details-card {
    margin-bottom: 1.5rem;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid #e0e0e0;
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
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: 8px;
    padding: 2rem;
    max-width: 500px;
    width: 90%;
  }

  .modal h2 {
    margin-bottom: 1rem;
    color: #f44336;
  }

  .warning-text {
    color: #d32f2f;
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
    background: #ffebee;
    color: #c62828;
  }

  .success-message {
    background: #e8f5e9;
    color: #2e7d32;
  }

  .loading {
    text-align: center;
    padding: 2rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #757575;
  }
</style>

