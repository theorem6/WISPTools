<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import {
    updateUserRole,
    suspendUser,
    activateUser,
    removeUserFromTenant,
    type TenantUser
  } from '$lib/services/userManagementService';
  import { ROLE_NAMES, type UserRole } from '$lib/models/userRole';
  
  export let user: TenantUser;
  
  const dispatch = createEventDispatcher();
  
  let selectedRole: UserRole = user.role;
  let loading = false;
  let error = '';
  let showDeleteConfirm = false;
  
  const availableRoles: UserRole[] = ['admin', 'engineer', 'installer', 'helpdesk', 'support', 'viewer'];
  const isOwner = user.role === 'owner';
  
  async function handleUpdateRole() {
    if (!$currentTenant || selectedRole === user.role) return;
    
    loading = true;
    error = '';
    
    try {
      await updateUserRole($currentTenant.id, user.uid, selectedRole);
      dispatch('close');
    } catch (err: any) {
      error = err.message || 'Failed to update role';
    } finally {
      loading = false;
    }
  }
  
  async function handleSuspend() {
    if (!$currentTenant) return;
    
    loading = true;
    error = '';
    
    try {
      await suspendUser($currentTenant.id, user.uid);
      dispatch('close');
    } catch (err: any) {
      error = err.message || 'Failed to suspend user';
    } finally {
      loading = false;
    }
  }
  
  async function handleActivate() {
    if (!$currentTenant) return;
    
    loading = true;
    error = '';
    
    try {
      await activateUser($currentTenant.id, user.uid);
      dispatch('close');
    } catch (err: any) {
      error = err.message || 'Failed to activate user';
    } finally {
      loading = false;
    }
  }
  
  async function handleDelete() {
    if (!$currentTenant) return;
    
    loading = true;
    error = '';
    
    try {
      await removeUserFromTenant($currentTenant.id, user.uid);
      dispatch('close');
    } catch (err: any) {
      error = err.message || 'Failed to remove user';
    } finally {
      loading = false;
    }
  }
  
  function handleClose() {
    if (!loading) {
      dispatch('close');
    }
  }
  
  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
    }
  }
</script>

<div
  class="modal-backdrop"
  role="presentation"
  aria-hidden="true"
  tabindex="-1"
  on:click={handleBackdropClick}
>
  <div
    class="modal-content"
    role="dialog"
    aria-modal="true"
    aria-label="Edit user dialog"
    tabindex="0"
    on:keydown={handleBackdropKeydown}
    on:click|stopPropagation
  >
    <div class="modal-header">
      <h2>Edit User</h2>
      <button class="close-btn" on:click={handleClose} disabled={loading}>✕</button>
    </div>
    
    <div class="modal-body">
      {#if error}
        <div class="alert alert-error">
          <span>❌</span>
          <span>{error}</span>
        </div>
      {/if}
      
      <div class="user-info-section">
        <div class="user-avatar-large">
          {#if user.photoURL}
            <img src={user.photoURL} alt={user.displayName} />
          {:else}
            <div class="avatar-placeholder">
              {user.displayName?.charAt(0) || user.email.charAt(0).toUpperCase()}
            </div>
          {/if}
        </div>
        <h3>{user.displayName || 'No name'}</h3>
        <p class="user-email">{user.email}</p>
        <span class="status-badge status-{user.status}">{user.status.replace('_', ' ')}</span>
      </div>
      
      {#if !showDeleteConfirm}
        <div class="form-section">
          <label for="role">Role</label>
          {#if isOwner}
            <div class="role-locked">
              <span class="lock-icon">🔒</span>
              <div>
                <div class="role-name">{ROLE_NAMES.owner}</div>
                <div class="role-hint">Owner role cannot be changed</div>
              </div>
            </div>
          {:else}
            <select
              id="role"
              bind:value={selectedRole}
              disabled={loading}
            >
              {#each availableRoles as roleOption}
                <option value={roleOption}>
                  {ROLE_NAMES[roleOption]}
                </option>
              {/each}
            </select>
            
            {#if selectedRole !== user.role}
              <button class="btn btn-primary btn-sm mt-2" on:click={handleUpdateRole} disabled={loading}>
                {#if loading}
                  <span class="spinner-sm"></span>
                  Updating...
                {:else}
                  Update Role
                {/if}
              </button>
            {/if}
          {/if}
        </div>
        
        {#if !isOwner}
          <div class="actions-section">
            <h4>Actions</h4>
            
            {#if user.status === 'active'}
              <button class="btn btn-warning btn-block" on:click={handleSuspend} disabled={loading}>
                🚫 Suspend User
              </button>
            {:else if user.status === 'suspended'}
              <button class="btn btn-success btn-block" on:click={handleActivate} disabled={loading}>
                ✅ Activate User
              </button>
            {/if}
            
            <button class="btn btn-danger btn-block" on:click={() => showDeleteConfirm = true} disabled={loading}>
              🗑️ Remove from Organization
            </button>
          </div>
        {/if}
      {:else}
        <div class="confirm-delete">
          <span class="warning-icon">⚠️</span>
          <h3>Remove User?</h3>
          <p>Are you sure you want to remove <strong>{user.email}</strong> from this organization?</p>
          <p class="warning-text">This action cannot be undone.</p>
          
          <div class="confirm-actions">
            <button class="btn btn-secondary" on:click={() => showDeleteConfirm = false} disabled={loading}>
              Cancel
            </button>
            <button class="btn btn-danger" on:click={handleDelete} disabled={loading}>
              {#if loading}
                <span class="spinner-sm"></span>
                Removing...
              {:else}
                Yes, Remove User
              {/if}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
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
    border-radius: 0.75rem;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    opacity: 0.5;
    padding: 0.5rem;
    line-height: 1;
  }
  
  .close-btn:hover:not(:disabled) {
    opacity: 1;
  }
  
  .modal-body {
    padding: 1.5rem;
  }
  
  .user-info-section {
    text-align: center;
    padding: 1rem 0 2rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .user-avatar-large {
    width: 80px;
    height: 80px;
    margin: 0 auto 1rem;
  }
  
  .user-avatar-large img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }
  
  .avatar-placeholder {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: var(--primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    font-weight: 600;
  }
  
  .user-info-section h3 {
    margin: 0 0 0.25rem;
    font-size: 1.25rem;
  }
  
  .user-email {
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
  }
  
  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    font-weight: 500;
  }
  
  .status-active { background: #d1fae5; color: #065f46; }
  .status-suspended { background: #fee2e2; color: #991b1b; }
  .status-pending_invitation { background: #fef3c7; color: #92400e; }
  
  .form-section {
    padding: 1.5rem 0;
    border-bottom: 1px solid var(--border-color);
  }
  
  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }
  
  select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    font-size: 1rem;
  }
  
  .role-locked {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
  }
  
  .lock-icon {
    font-size: 2rem;
  }
  
  .role-name {
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .role-hint {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .actions-section {
    padding: 1.5rem 0;
  }
  
  .actions-section h4 {
    margin: 0 0 1rem;
    font-size: 1rem;
    font-weight: 600;
  }
  
  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: all 0.2s;
  }
  
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }
  
  .btn-block {
    width: 100%;
    margin-bottom: 0.75rem;
  }
  
  .btn-primary { background: var(--primary); color: white; }
  .btn-secondary { background: #6b7280; color: white; }
  .btn-success { background: #10b981; color: white; }
  .btn-warning { background: #f59e0b; color: white; }
  .btn-danger { background: #ef4444; color: white; }
  
  .mt-2 {
    margin-top: 0.5rem;
  }
  
  .alert {
    padding: 1rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  
  .alert-error {
    background: #fee;
    border: 1px solid #fcc;
    color: #c00;
  }
  
  .confirm-delete {
    text-align: center;
    padding: 2rem 0;
  }
  
  .warning-icon {
    font-size: 4rem;
    display: block;
    margin-bottom: 1rem;
  }
  
  .confirm-delete h3 {
    margin: 0 0 1rem;
  }
  
  .confirm-delete p {
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }
  
  .warning-text {
    color: #ef4444;
    font-weight: 500;
    margin-bottom: 2rem;
  }
  
  .confirm-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }
  
  .spinner-sm {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>

