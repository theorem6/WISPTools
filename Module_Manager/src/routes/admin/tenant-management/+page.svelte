<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/firebase';
  import { goto } from '$app/navigation';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  
  let loading = true;
  let error = '';
  let tenants: any[] = [];
  
  // Modals
  let showCreateModal = false;
  let showEditModal = false;
  let showDeleteModal = false;
  let showAssignOwnerModal = false;
  
  let selectedTenant: any = null;
  let processing = false;
  
  // Form data for create/edit
  let formData = {
    name: '',
    displayName: '',
    contactEmail: '',
    subdomain: ''
  };
  
  let newOwnerEmail = '';
  
  const PLATFORM_ADMIN_EMAIL = 'david@david.com';
  const API_BASE = 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/apiProxy';
  
  onMount(async () => {
    // Check if user is platform admin
    const user = auth().currentUser;
    if (!user || user.email !== PLATFORM_ADMIN_EMAIL) {
      error = 'Access denied. Platform admin only.';
      loading = false;
      return;
    }
    
    await loadTenants();
  });
  
  async function getAuthHeaders() {
    const user = auth().currentUser;
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }
  
  async function loadTenants() {
    loading = true;
    error = '';
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/admin/tenants`, { headers });
      
      if (!response.ok) {
        throw new Error('Failed to load tenants');
      }
      
      tenants = await response.json();
      console.log('Loaded tenants:', tenants);
    } catch (err: any) {
      error = err.message || 'Failed to load tenants';
      console.error('Error loading tenants:', err);
    } finally {
      loading = false;
    }
  }
  
  // Create Tenant
  function openCreateModal() {
    formData = {
      name: '',
      displayName: '',
      contactEmail: '',
      subdomain: ''
    };
    showCreateModal = true;
  }
  
  async function createTenant() {
    if (!formData.name || !formData.displayName || !formData.contactEmail) {
      alert('Please fill in all required fields');
      return;
    }
    
    processing = true;
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/admin/tenants`, {
        method: 'POST',
        headers,
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create tenant');
      }
      
      alert('✅ Tenant created successfully! The contact email will be assigned as the owner.');
      showCreateModal = false;
      await loadTenants();
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
      console.error('Error creating tenant:', err);
    } finally {
      processing = false;
    }
  }
  
  // Edit Tenant
  function openEditModal(tenant: any) {
    selectedTenant = tenant;
    formData = {
      name: tenant.name,
      displayName: tenant.displayName,
      contactEmail: tenant.contactEmail,
      subdomain: tenant.subdomain
    };
    showEditModal = true;
  }
  
  async function updateTenant() {
    if (!selectedTenant) return;
    
    processing = true;
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/admin/tenants/${selectedTenant.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update tenant');
      }
      
      alert('✅ Tenant updated successfully!');
      showEditModal = false;
      await loadTenants();
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
      console.error('Error updating tenant:', err);
    } finally {
      processing = false;
    }
  }
  
  // Delete Tenant
  function openDeleteModal(tenant: any) {
    selectedTenant = tenant;
    showDeleteModal = true;
  }
  
  async function deleteTenant() {
    if (!selectedTenant) return;
    
    processing = true;
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/admin/tenants/${selectedTenant.id}`, {
        method: 'DELETE',
        headers
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete tenant');
      }
      
      alert('✅ Tenant deleted successfully!');
      showDeleteModal = false;
      await loadTenants();
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
      console.error('Error deleting tenant:', err);
    } finally {
      processing = false;
    }
  }
  
  // Assign Owner
  function openAssignOwnerModal(tenant: any) {
    selectedTenant = tenant;
    newOwnerEmail = '';
    showAssignOwnerModal = true;
  }
  
  async function assignOwner() {
    if (!selectedTenant || !newOwnerEmail.trim()) {
      alert('Please enter an email address');
      return;
    }
    
    processing = true;
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/admin/assign-owner`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tenantId: selectedTenant.id,
          email: newOwnerEmail.trim()
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to assign owner');
      }
      
      const result = await response.json();
      alert(`✅ ${result.message}`);
      showAssignOwnerModal = false;
      await loadTenants();
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
      console.error('Error assigning owner:', err);
    } finally {
      processing = false;
    }
  }
  
  function closeModals() {
    showCreateModal = false;
    showEditModal = false;
    showDeleteModal = false;
    showAssignOwnerModal = false;
    selectedTenant = null;
  }
</script>

<TenantGuard adminOnly={true} requireTenant={false}>
<div class="admin-page">
  <header>
    <div class="header-content">
      <button class="back-btn" on:click={() => goto('/dashboard')}>
        ← Back to Dashboard
      </button>
      <div class="header-title">
        <h1>🏢 Platform Admin - Tenant Management</h1>
        <p>Create and manage organization tenants</p>
      </div>
      <button class="btn-create" on:click={openCreateModal}>
        ➕ Create New Tenant
      </button>
    </div>
  </header>
  
  <main>
    {#if loading}
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading tenants...</p>
      </div>
    {:else if error}
      <div class="error-banner">
        ❌ {error}
      </div>
    {:else if tenants.length === 0}
      <div class="empty-state">
        <p>📭 No tenants found</p>
        <button class="btn-primary" on:click={openCreateModal}>Create First Tenant</button>
      </div>
    {:else}
      <div class="tenants-grid">
        {#each tenants as tenant}
          <div class="tenant-card">
            <div class="tenant-header">
              <h3>{tenant.displayName || tenant.name}</h3>
              <span class="tenant-status" class:active={tenant.status === 'active'}>
                {tenant.status || 'active'}
              </span>
            </div>
            
            <div class="tenant-details">
              <div class="detail-row">
                <span class="label">Organization Name:</span>
                <span class="value">{tenant.name}</span>
              </div>
              <div class="detail-row">
                <span class="label">Subdomain:</span>
                <span class="value monospace">{tenant.subdomain}</span>
              </div>
              <div class="detail-row">
                <span class="label">Contact Email:</span>
                <span class="value">{tenant.contactEmail}</span>
              </div>
              <div class="detail-row">
                <span class="label">Created:</span>
                <span class="value">{new Date(tenant.createdAt).toLocaleDateString()}</span>
              </div>
              <div class="detail-row">
                <span class="label">Users:</span>
                <span class="value">{tenant.userCount || 0}</span>
              </div>
            </div>
            
            <div class="tenant-actions">
              <button class="btn-action btn-owner" on:click={() => openAssignOwnerModal(tenant)}>
                👤 Assign Owner
              </button>
              <button class="btn-action btn-edit" on:click={() => openEditModal(tenant)}>
                ✏️ Edit
              </button>
              <button class="btn-action btn-delete" on:click={() => openDeleteModal(tenant)}>
                🗑️ Delete
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>

<!-- Create/Edit Modal -->
{#if showCreateModal || showEditModal}
  <div class="modal-overlay" on:click={closeModals}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>{showCreateModal ? '➕ Create New Tenant' : '✏️ Edit Tenant'}</h2>
        <button class="close-btn" on:click={closeModals}>✕</button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label>Organization Name <span class="required">*</span></label>
          <input 
            type="text" 
            bind:value={formData.name} 
            placeholder="e.g., acme-wireless"
            disabled={processing}
          />
          <small>Used internally, lowercase with hyphens</small>
        </div>
        
        <div class="form-group">
          <label>Display Name <span class="required">*</span></label>
          <input 
            type="text" 
            bind:value={formData.displayName} 
            placeholder="e.g., Acme Wireless Corp"
            disabled={processing}
          />
          <small>Friendly name shown in the UI</small>
        </div>
        
        <div class="form-group">
          <label>Contact Email (Owner) <span class="required">*</span></label>
          <input 
            type="email" 
            bind:value={formData.contactEmail} 
            placeholder="admin@example.com"
            disabled={processing}
          />
          <small>This person will be assigned as the tenant owner</small>
        </div>
        
        <div class="form-group">
          <label>Subdomain</label>
          <input 
            type="text" 
            bind:value={formData.subdomain} 
            placeholder="Auto-generated from name"
            disabled={processing}
          />
          <small>Leave blank to auto-generate</small>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={closeModals} disabled={processing}>
          Cancel
        </button>
        <button 
          class="btn-primary" 
          on:click={showCreateModal ? createTenant : updateTenant} 
          disabled={processing || !formData.name || !formData.displayName || !formData.contactEmail}
        >
          {processing ? 'Processing...' : (showCreateModal ? 'Create Tenant' : 'Update Tenant')}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && selectedTenant}
  <div class="modal-overlay" on:click={closeModals}>
    <div class="modal-content modal-danger" on:click|stopPropagation>
      <div class="modal-header">
        <h2>🗑️ Delete Tenant</h2>
        <button class="close-btn" on:click={closeModals}>✕</button>
      </div>
      
      <div class="modal-body">
        <p><strong>⚠️ Warning:</strong> This action cannot be undone!</p>
        <p>Are you sure you want to delete the tenant:</p>
        <p class="tenant-name-delete"><strong>{selectedTenant.displayName}</strong></p>
        <p>All associated users, data, and configurations will be removed.</p>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={closeModals} disabled={processing}>
          Cancel
        </button>
        <button class="btn-danger" on:click={deleteTenant} disabled={processing}>
          {processing ? 'Deleting...' : 'Delete Tenant'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Assign Owner Modal -->
{#if showAssignOwnerModal && selectedTenant}
  <div class="modal-overlay" on:click={closeModals}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>👤 Assign/Change Owner</h2>
        <button class="close-btn" on:click={closeModals}>✕</button>
      </div>
      
      <div class="modal-body">
        <p><strong>Tenant:</strong> {selectedTenant.displayName}</p>
        <p class="help-text">
          Enter the email address of the user who should be the owner of this tenant.
          The user must already have a Firebase account.
        </p>
        
        <div class="form-group">
          <label>Owner Email Address <span class="required">*</span></label>
          <input 
            type="email" 
            bind:value={newOwnerEmail} 
            placeholder="user@example.com"
            disabled={processing}
          />
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={closeModals} disabled={processing}>
          Cancel
        </button>
        <button 
          class="btn-primary" 
          on:click={assignOwner} 
          disabled={processing || !newOwnerEmail.trim()}
        >
          {processing ? 'Assigning...' : 'Assign Owner'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .admin-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
  
  header {
    background: white;
    border-bottom: 2px solid #e5e7eb;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  
  .header-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 1.5rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 2rem;
  }
  
  .back-btn {
    background: #f3f4f6;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    white-space: nowrap;
  }
  
  .back-btn:hover {
    background: #e5e7eb;
  }
  
  .header-title {
    flex: 1;
  }
  
  .header-title h1 {
    margin: 0;
    color: #1f2937;
    font-size: 1.6rem;
  }
  
  .header-title p {
    margin: 0.25rem 0 0 0;
    color: #6b7280;
    font-size: 0.9rem;
  }
  
  .btn-create {
    background: #10b981;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    transition: all 0.2s;
  }
  
  .btn-create:hover {
    background: #059669;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  }
  
  main {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  .loading, .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  }
  
  .loading {
    color: #6b7280;
  }
  
  .spinner {
    border: 4px solid #f3f4f6;
    border-top: 4px solid #667eea;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem auto;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .error-banner {
    background: #fee2e2;
    color: #991b1b;
    padding: 1.5rem;
    border-radius: 12px;
    border-left: 4px solid #dc2626;
    font-weight: 500;
  }
  
  .tenants-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1.5rem;
  }
  
  .tenant-card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .tenant-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  }
  
  .tenant-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 1rem;
    border-bottom: 2px solid #f3f4f6;
  }
  
  .tenant-header h3 {
    margin: 0;
    color: #1f2937;
    font-size: 1.25rem;
  }
  
  .tenant-status {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    background: #f3f4f6;
    color: #6b7280;
  }
  
  .tenant-status.active {
    background: #d1fae5;
    color: #065f46;
  }
  
  .tenant-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .detail-row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.9rem;
  }
  
  .detail-row .label {
    color: #6b7280;
    font-weight: 500;
  }
  
  .detail-row .value {
    color: #1f2937;
    text-align: right;
  }
  
  .monospace {
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
  }
  
  .tenant-actions {
    display: flex;
    gap: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid #f3f4f6;
  }
  
  .btn-action {
    flex: 1;
    padding: 0.5rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    transition: all 0.2s;
  }
  
  .btn-owner {
    background: #dbeafe;
    color: #1e40af;
  }
  
  .btn-owner:hover {
    background: #bfdbfe;
  }
  
  .btn-edit {
    background: #fef3c7;
    color: #92400e;
  }
  
  .btn-edit:hover {
    background: #fde68a;
  }
  
  .btn-delete {
    background: #fee2e2;
    color: #991b1b;
  }
  
  .btn-delete:hover {
    background: #fecaca;
  }
  
  /* Modal styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  
  .modal-content {
    background: white;
    border-radius: 12px;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  }
  
  .modal-danger {
    border-top: 4px solid #dc2626;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #1f2937;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #6b7280;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }
  
  .close-btn:hover {
    background: #f3f4f6;
  }
  
  .modal-body {
    padding: 1.5rem;
  }
  
  .modal-body p {
    margin: 0 0 1rem 0;
    color: #374151;
  }
  
  .tenant-name-delete {
    font-size: 1.1rem;
    color: #dc2626;
    text-align: center;
    padding: 1rem;
    background: #fee2e2;
    border-radius: 8px;
  }
  
  .help-text {
    font-size: 0.9rem;
    color: #6b7280;
  }
  
  .form-group {
    margin-bottom: 1.5rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #374151;
  }
  
  .required {
    color: #dc2626;
  }
  
  .form-group input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 1rem;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
  
  .form-group input:disabled {
    background: #f9fafb;
    cursor: not-allowed;
  }
  
  .form-group small {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.85rem;
    color: #6b7280;
  }
  
  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }
  
  .btn-primary, .btn-secondary, .btn-danger {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 500;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: #667eea;
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: #5568d3;
  }
  
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    background: #f3f4f6;
    color: #1f2937;
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
  }
  
  .btn-danger {
    background: #dc2626;
    color: white;
  }
  
  .btn-danger:hover:not(:disabled) {
    background: #b91c1c;
  }
  
  .empty-state .btn-primary {
    margin-top: 1rem;
  }
  
  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: stretch;
    }
    
    .btn-create {
      width: 100%;
    }
    
    .tenants-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
</TenantGuard>
