<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { tenantService } from '$lib/services/tenantService';
  import { authService } from '$lib/services/authService';
  import type { UserTenantAssociation, TenantRole } from '$lib/models/tenant';

  let isLoading = true;
  let users: UserTenantAssociation[] = [];
  let tenantId = '';
  let tenantName = '';
  let error = '';
  let success = '';
  
  // Add user form
  let showAddUserForm = false;
  let newUserEmail = '';
  let newUserRole: TenantRole = 'operator';
  let isAdding = false;
  
  // Invite form (for future email invitations)
  let showInviteForm = false;
  let inviteEmail = '';
  let inviteRole: TenantRole = 'operator';
  let isSending = false;

  const roleOptions: { value: TenantRole; label: string; description: string }[] = [
    { value: 'owner', label: 'Owner', description: 'Full control (only one per tenant)' },
    { value: 'admin', label: 'Admin', description: 'Full access except owner rights' },
    { value: 'operator', label: 'Operator', description: 'Can manage devices and view reports' },
    { value: 'viewer', label: 'Viewer', description: 'Read-only access' }
  ];

  async function handleAddUser() {
    if (!newUserEmail) {
      error = 'Please enter an email address';
      return;
    }

    isAdding = true;
    error = '';

    try {
      // For now, create a placeholder user ID from email
      // In production, you'd look up or create the actual Firebase user
      const userId = newUserEmail.replace('@', '_').replace(/\./g, '_');
      
      const result = await tenantService.addUserToTenant(
        userId,
        tenantId,
        newUserRole
      );

      if (result.success) {
        success = `User ${newUserEmail} added as ${newUserRole}!`;
        newUserEmail = '';
        newUserRole = 'operator';
        showAddUserForm = false;
        
        await loadUsers();
      } else {
        error = result.error || 'Failed to add user';
      }
    } catch (err: any) {
      error = err.message || 'Failed to add user';
    } finally {
      isAdding = false;
    }
  }

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
      await goto('/tenant-selector');
      return;
    }

    if (!tenantId && isAdmin) {
      error = 'System Admin: Please select a tenant to manage users';
      isLoading = false;
      return;
    }

    // Check if user has permission to manage users
    // System admins automatically have permission
    if (!isAdmin) {
      try {
        const role = await tenantService.getUserRole(currentUser.uid, tenantId);
        console.log('User role in tenant:', role);
        
        if (!role) {
          error = 'You are not a member of this tenant';
          setTimeout(() => goto('/dashboard'), 2000);
          return;
        }
        
        // Owners and admins can manage users
        const canManage = role === 'owner' || role === 'admin';
        
        if (!canManage) {
          error = `Your role (${role}) does not have permission to manage users`;
          setTimeout(() => goto('/dashboard'), 2000);
          return;
        }
        
        console.log('Permission granted to manage users');
      } catch (err: any) {
        console.error('Permission check failed:', err);
        error = 'Failed to verify permissions';
        setTimeout(() => goto('/dashboard'), 2000);
        return;
      }
    } else {
      console.log('System admin - permission automatically granted');
    }

    await loadUsers();
    isLoading = false;
  });

  async function loadUsers() {
    try {
      users = await tenantService.getTenantUsers(tenantId);
    } catch (err: any) {
      error = err.message || 'Failed to load users';
    }
  }

  async function handleInvite() {
    if (!inviteEmail) {
      error = 'Please enter an email address';
      return;
    }

    isSending = true;
    error = '';

    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) throw new Error('Not authenticated');

      const result = await tenantService.createInvitation(
        tenantId,
        inviteEmail,
        inviteRole,
        currentUser.uid
      );

      if (result.success) {
        success = `Invitation sent to ${inviteEmail}!`;
        inviteEmail = '';
        showInviteForm = false;
        
        // Don't auto-dismiss - user can click X to dismiss
        // setTimeout(() => success = '', 5000);
      } else {
        error = result.error || 'Failed to send invitation';
      }
    } catch (err: any) {
      error = err.message || 'Failed to send invitation';
    } finally {
      isSending = false;
    }
  }

  async function handleRemoveUser(userId: string) {
    if (!confirm('Are you sure you want to remove this user from the organization?')) {
      return;
    }

    try {
      const result = await tenantService.removeUserFromTenant(userId, tenantId);
      
      if (result.success) {
        success = 'User removed successfully';
        await loadUsers();
        // Don't auto-dismiss
        // setTimeout(() => success = '', 5000);
      } else {
        error = result.error || 'Failed to remove user';
      }
    } catch (err: any) {
      error = err.message || 'Failed to remove user';
    }
  }

  async function handleChangeRole(userId: string, newRole: TenantRole) {
    try {
      const result = await tenantService.updateUserRole(userId, tenantId, newRole);
      
      if (result.success) {
        success = 'Role updated successfully';
        await loadUsers();
        // Don't auto-dismiss
        // setTimeout(() => success = '', 5000);
      } else {
        error = result.error || 'Failed to update role';
      }
    } catch (err: any) {
      error = err.message || 'Failed to update role';
    }
  }
</script>

<div class="users-page">
  <div class="page-header">
    <div>
      <button class="back-btn" on:click={() => goto('/tenant-admin')}>
        ← Back to Tenant Settings
      </button>
      <h1>👥 User Management</h1>
      <p class="subtitle">{tenantName}</p>
    </div>

    <div class="header-buttons">
      <button class="btn-primary" on:click={() => showAddUserForm = !showAddUserForm}>
        {showAddUserForm ? '✕ Cancel' : '➕ Add User'}
      </button>
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

  {#if showAddUserForm}
    <div class="invite-form">
      <h2>Add User to Organization</h2>
      <p class="form-subtitle">Add an existing user or create a placeholder for a future user</p>
      
      <div class="form-group">
        <label for="user-email">Email Address</label>
        <input
          id="user-email"
          type="email"
          bind:value={newUserEmail}
          placeholder="user@example.com"
        />
        <p class="help-text">User will be granted access to this organization</p>
      </div>

      <div class="form-group">
        <label for="user-role">Role</label>
        <select id="user-role" bind:value={newUserRole}>
          {#each roleOptions as role}
            <option value={role.value} disabled={role.value === 'owner' && users.some(u => u.role === 'owner')}>
              {role.label} - {role.description}
            </option>
          {/each}
        </select>
        <p class="help-text">Determines what this user can do in the organization</p>
      </div>

      <div class="form-actions">
        <button class="btn-secondary" on:click={() => showAddUserForm = false}>
          Cancel
        </button>
        <button class="btn-primary" on:click={handleAddUser} disabled={isAdding}>
          {isAdding ? 'Adding...' : 'Add User'}
        </button>
      </div>
    </div>
  {/if}

  <div class="users-section">
    <h2>Organization Users ({users.length})</h2>

    {#if isLoading}
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading users...</p>
      </div>
    {:else if users.length === 0}
      <div class="empty-state">
        <span class="empty-icon">👥</span>
        <h3>No Users Yet</h3>
        <p>Invite users to collaborate in your organization</p>
      </div>
    {:else}
      <div class="users-table">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each users as user}
              <tr>
                <td>
                  <div class="user-cell">
                    <span class="user-icon">👤</span>
                    <span>{user.userId}</span>
                  </div>
                </td>
                <td>
                  <select 
                    value={user.role}
                    on:change={(e) => handleChangeRole(user.userId, e.currentTarget.value as TenantRole)}
                    disabled={user.role === 'owner'}
                  >
                    <option value="owner" disabled={user.role !== 'owner'}>Owner</option>
                    <option value="admin">Admin</option>
                    <option value="operator">Operator</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </td>
                <td>
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td>
                  {#if user.role !== 'owner'}
                    <button 
                      class="btn-danger-small"
                      on:click={() => handleRemoveUser(user.userId)}
                    >
                      Remove
                    </button>
                  {:else}
                    <span class="owner-badge">Owner</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<style>
  .users-page {
    min-height: 100vh;
    background: var(--bg-primary);
    padding: 2rem;
  }

  .page-header {
    max-width: 1200px;
    margin: 0 auto 2rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .header-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .form-subtitle {
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
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

  .invite-form {
    max-width: 1200px;
    margin: 0 auto 2rem;
    background: var(--card-bg);
    border-radius: 1rem;
    padding: 2rem;
    border: 2px solid var(--brand-primary);
  }

  .invite-form h2 {
    margin-bottom: 1.5rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .form-group input, .form-group select {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }

  .users-section {
    max-width: 1200px;
    margin: 0 auto;
  }

  .users-section h2 {
    margin-bottom: 1.5rem;
  }

  .users-table {
    background: var(--card-bg);
    border-radius: 1rem;
    overflow: hidden;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead {
    background: var(--bg-secondary);
  }

  th {
    padding: 1rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  td {
    padding: 1rem;
    border-top: 1px solid var(--border-color);
  }

  .user-cell {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .user-icon {
    font-size: 1.5rem;
  }

  select {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    background: var(--bg-primary);
    color: var(--text-primary);
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

  .btn-primary:hover:not(:disabled) {
    background: var(--brand-primary-hover);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-danger-small {
    padding: 0.375rem 0.75rem;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .btn-danger-small:hover {
    background: #ef4444;
    color: white;
  }

  .owner-badge {
    padding: 0.375rem 0.75rem;
    background: rgba(124, 58, 237, 0.1);
    color: var(--brand-primary);
    border-radius: 0.25rem;
    font-size: 0.875rem;
    font-weight: 600;
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
</style>

