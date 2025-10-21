<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/firebase';
  import { goto } from '$app/navigation';
  
  let loading = true;
  let error = '';
  let tenants: any[] = [];
  let showAssignOwnerModal = false;
  let selectedTenant: any = null;
  let newOwnerEmail = '';
  let assigning = false;
  
  const PLATFORM_ADMIN_EMAIL = 'david@david.com';
  
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
  
  async function loadTenants() {
    loading = true;
    error = '';
    
    try {
      const { tenantService } = await import('$lib/services/tenantService');
      tenants = await tenantService.getAllTenants();
      console.log('Loaded tenants:', tenants);
    } catch (err: any) {
      error = err.message || 'Failed to load tenants';
      console.error('Error loading tenants:', err);
    } finally {
      loading = false;
    }
  }
  
  function openAssignOwnerModal(tenant: any) {
    selectedTenant = tenant;
    newOwnerEmail = '';
    showAssignOwnerModal = true;
  }
  
  function closeAssignOwnerModal() {
    showAssignOwnerModal = false;
    selectedTenant = null;
    newOwnerEmail = '';
  }
  
  async function assignOwner() {
    if (!selectedTenant || !newOwnerEmail.trim()) {
      alert('Please enter an email address');
      return;
    }
    
    assigning = true;
    
    try {
      const user = auth().currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();
      
      const response = await fetch('https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/admin/assign-owner', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tenantId: selectedTenant.id,
          email: newOwnerEmail.trim()
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to assign owner');
      }
      
      const result = await response.json();
      alert(`Success: ${result.message}`);
      closeAssignOwnerModal();
      await loadTenants();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      console.error('Error assigning owner:', err);
    } finally {
      assigning = false;
    }
  }
</script>

<div class="admin-page">
  <header>
    <div class="header-content">
      <button class="back-btn" on:click={() => goto('/dashboard')}>
        ← Back to Dashboard
      </button>
      <h1>🔧 Platform Admin - Tenant Management</h1>
      <p>Manage tenant owners and assignments</p>
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
        {error}
      </div>
    {:else if tenants.length === 0}
      <div class="empty-state">
        <p>📭 No tenants found</p>
      </div>
    {:else}
      <div class="tenants-list">
        {#each tenants as tenant}
          <div class="tenant-card">
            <div class="tenant-info">
              <h3>{tenant.displayName || tenant.name}</h3>
              <p class="tenant-id">ID: {tenant.id}</p>
              <p class="tenant-subdomain">Subdomain: {tenant.subdomain}</p>
              <p class="tenant-contact">Contact: {tenant.contactEmail}</p>
              <p class="tenant-created">Created: {new Date(tenant.createdAt).toLocaleDateString()}</p>
              <p class="tenant-creator">Created by: {tenant.createdBy}</p>
            </div>
            <div class="tenant-actions">
              <button class="btn-primary" on:click={() => openAssignOwnerModal(tenant)}>
                👤 Assign/Change Owner
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>

{#if showAssignOwnerModal && selectedTenant}
  <div class="modal-overlay" on:click={closeAssignOwnerModal}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>👤 Assign Owner</h2>
        <button class="close-btn" on:click={closeAssignOwnerModal}>✕</button>
      </div>
      
      <div class="modal-body">
        <p><strong>Tenant:</strong> {selectedTenant.displayName}</p>
        <p class="help-text">
          Enter the email address of the user who should be the owner of this tenant.
          The user must already have a Firebase account.
        </p>
        
        <div class="form-group">
          <label>Owner Email Address</label>
          <input 
            type="email" 
            bind:value={newOwnerEmail} 
            placeholder="user@example.com"
            disabled={assigning}
          />
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={closeAssignOwnerModal} disabled={assigning}>
          Cancel
        </button>
        <button class="btn-primary" on:click={assignOwner} disabled={assigning || !newOwnerEmail.trim()}>
          {assigning ? 'Assigning...' : 'Assign Owner'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .admin-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 2rem;
  }
  
  header {
    margin-bottom: 2rem;
  }
  
  .header-content {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  }
  
  .back-btn {
    background: #f3f4f6;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }
  
  .back-btn:hover {
    background: #e5e7eb;
  }
  
  h1 {
    margin: 0;
    color: #1f2937;
    font-size: 1.8rem;
  }
  
  header p {
    margin: 0.5rem 0 0 0;
    color: #6b7280;
  }
  
  main {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  }
  
  .loading, .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }
  
  .spinner {
    border: 3px solid #f3f4f6;
    border-top: 3px solid #667eea;
    border-radius: 50%;
    width: 40px;
    height: 40px;
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
    padding: 1rem;
    border-radius: 8px;
    border-left: 4px solid #dc2626;
  }
  
  .tenants-list {
    display: grid;
    gap: 1.5rem;
  }
  
  .tenant-card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: box-shadow 0.2s;
  }
  
  .tenant-card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  
  .tenant-info h3 {
    margin: 0 0 0.5rem 0;
    color: #1f2937;
  }
  
  .tenant-info p {
    margin: 0.25rem 0;
    font-size: 0.9rem;
    color: #6b7280;
  }
  
  .tenant-id {
    font-family: monospace;
    font-size: 0.85rem;
  }
  
  .btn-primary {
    background: #667eea;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.95rem;
    transition: background 0.2s;
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
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.95rem;
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
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
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
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
  
  .help-text {
    font-size: 0.9rem;
    color: #6b7280;
  }
  
  .form-group {
    margin-top: 1.5rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #374151;
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
  
  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }
</style>

