<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { getTenantUsers, getAllUsers, type TenantUser } from '$lib/services/userManagementService';
  import { ROLE_NAMES } from '$lib/models/userRole';
  import { isPlatformAdmin } from '$lib/services/adminService';
  import { authService } from '$lib/services/authService';
  import InviteUserModal from '../../routes/modules/user-management/components/InviteUserModal.svelte';
  import EditUserModal from '../../routes/modules/user-management/components/EditUserModal.svelte';
  import type { UserRole } from '$lib/models/userRole';
  
  let users: TenantUser[] = [];
  let filteredUsers: TenantUser[] = [];
  let loading = true;
  let error = '';
  let searchQuery = '';
  let roleFilter: UserRole | 'all' = 'all';
  let statusFilter: 'all' | 'active' | 'suspended' | 'pending_invitation' = 'all';
  let isAdmin = false;
  let tenantRole: UserRole | 'viewer' = 'viewer';
  let canManageUsers = false;
  
  let showInviteModal = false;
  let showEditModal = false;
  let selectedUser: TenantUser | null = null;

  // Load users on mount
  onMount(async () => {
    const currentUser = await authService.getCurrentUser();
    isAdmin = isPlatformAdmin(currentUser?.email || null);
    await loadUsers();
  });

  async function loadUsers() {
    loading = true;
    error = '';
    
    try {
      if (isAdmin) {
        console.log('Loading all users (admin view)');
        users = await getAllUsers();
        tenantRole = 'platform_admin';
        canManageUsers = true;
      } else {
        if (!$currentTenant) {
          loading = false;
          error = 'No tenant selected. Please select a tenant from the dashboard.';
          console.error('No tenant selected');
          return;
        }
        tenantRole = ($currentTenant?.userRole as UserRole | undefined) ?? 'viewer';
        const isTenantManager = tenantRole === 'owner' || tenantRole === 'admin';
        canManageUsers = isTenantManager;
        const scope = isTenantManager ? 'full' : 'visible';
        console.log(`Loading users for tenant: ${$currentTenant.id} (scope: ${scope})`);
        users = await getTenantUsers($currentTenant.id, scope);
      }
      console.log('Loaded users:', users);
      applyFilters();
    } catch (err: any) {
      console.error('Error loading users:', err);
      
      if (err.message?.includes('Failed to fetch') || err.message?.includes('CONNECTION_REFUSED') || err.name === 'TypeError') {
        error = 'Cannot connect to the backend API server (port 3001). The service may be down or unreachable. Please contact support if the issue persists.';
      } else if (err.message?.includes('ECONNREFUSED')) {
        error = 'Connection refused by the backend API server. Please verify the main API service (port 3001) is running.';
      } else if (err.message?.includes('timeout') || err.message?.includes('ETIMEDOUT')) {
        error = 'Request timed out. The backend API server may be overloaded or unreachable.';
      } else {
        error = err.message || 'Failed to load users';
      }
    } finally {
      loading = false;
    }
  }

  function applyFilters() {
    filteredUsers = users.filter(user => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          user.email.toLowerCase().includes(query) ||
          user.displayName?.toLowerCase().includes(query) ||
          '';
        if (!matchesSearch) return false;
      }
      
      if (roleFilter !== 'all' && user.role !== roleFilter) {
        return false;
      }
      
      if (statusFilter !== 'all' && user.status !== statusFilter) {
        return false;
      }
      
      return true;
    });
  }

  function handleSearch() {
    applyFilters();
  }

  function handleRoleFilterChange() {
    applyFilters();
  }

  function handleStatusFilterChange() {
    applyFilters();
  }

  function openInviteModal() {
    if (!canManageUsers) return;
    showInviteModal = true;
  }

  function closeInviteModal() {
    showInviteModal = false;
    loadUsers();
  }

  function openEditModal(user: TenantUser) {
    if (!canManageUsers) return;
    selectedUser = user;
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    selectedUser = null;
    loadUsers();
  }

  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'active':
        return 'badge-success';
      case 'suspended':
        return 'badge-error';
      case 'pending_invitation':
        return 'badge-warning';
      default:
        return 'badge-neutral';
    }
  }

  function getRoleBadgeClass(role: UserRole): string {
    switch (role) {
      case 'owner':
        return 'badge-primary';
      case 'admin':
        return 'badge-secondary';
      case 'engineer':
        return 'badge-info';
      case 'installer':
        return 'badge-accent';
      case 'helpdesk':
        return 'badge-success';
      case 'viewer':
        return 'badge-neutral';
      default:
        return 'badge-neutral';
    }
  }

  function formatTimeAgo(dateString: string | null): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return new Date(dateString).toLocaleDateString();
  }
</script>

<div class="user-management-embedded">
  {#if error}
    <div class="alert alert-error">
      <span>❌</span>
      <span>{error}</span>
      <button on:click={() => error = ''}>✕</button>
    </div>
  {/if}

  <div class="header-section">
    {#if canManageUsers}
      <div class="header-actions">
        <button class="btn btn-link" on:click={() => goto('/modules/user-management/roles')}>
          👥 Role Management
        </button>
        <button class="btn btn-link" on:click={() => goto('/modules/user-management/permissions')}>
          🔐 User Permissions
        </button>
        <button class="btn btn-primary" on:click={openInviteModal}>
          ➕ Add User
        </button>
      </div>
    {/if}
  </div>

  <div class="filters">
    <div class="search-box">
      <span class="search-icon">🔍</span>
      <input
        type="text"
        placeholder="Search by name or email..."
        bind:value={searchQuery}
        on:input={handleSearch}
      />
    </div>

    <select bind:value={roleFilter} on:change={handleRoleFilterChange} class="select">
      <option value="all">All Roles</option>
      <option value="owner">Owner</option>
      <option value="admin">Admin</option>
      <option value="engineer">Engineer</option>
      <option value="installer">Field Technician</option>
      <option value="helpdesk">Help Desk</option>
      <option value="viewer">Viewer</option>
    </select>

    <select bind:value={statusFilter} on:change={handleStatusFilterChange} class="select">
      <option value="all">All Status</option>
      <option value="active">Active</option>
      <option value="suspended">Suspended</option>
      <option value="pending_invitation">Pending</option>
    </select>

    <div class="results-count">
      {filteredUsers.length} of {users.length} users
    </div>
  </div>

  {#if loading}
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Loading users...</p>
    </div>
  {:else if filteredUsers.length === 0}
    <div class="empty-state">
      <span class="empty-icon">👤</span>
      <h3>No users found</h3>
      {#if searchQuery || roleFilter !== 'all' || statusFilter !== 'all'}
        <p>Try adjusting your filters</p>
        <button class="btn btn-secondary" on:click={() => { searchQuery = ''; roleFilter = 'all'; statusFilter = 'all'; applyFilters(); }}>
          Clear Filters
        </button>
      {:else if canManageUsers}
        <p>Invite your first user to get started</p>
        <button class="btn btn-primary" on:click={openInviteModal}>
          Invite User
        </button>
      {:else}
        <p>No team members available in your view.</p>
      {/if}
    </div>
  {:else}
    <div class="table-container">
      <table class="user-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Login</th>
            {#if canManageUsers}
              <th>Actions</th>
            {/if}
          </tr>
        </thead>
        <tbody>
          {#each filteredUsers as user (user.uid)}
            <tr>
              <td>
                <div class="user-cell">
                  {#if user.photoURL}
                    <img src={user.photoURL} alt={user.displayName} class="user-avatar" />
                  {:else}
                    <div class="user-avatar-placeholder">
                      {user.displayName?.charAt(0) || user.email.charAt(0).toUpperCase()}
                    </div>
                  {/if}
                  <div class="user-info">
                    <div class="user-name">{user.displayName || 'No name'}</div>
                    <div class="user-email">{user.email}</div>
                  </div>
                </div>
              </td>
              <td>
                <span class="badge {getRoleBadgeClass(user.role)}">
                  {ROLE_NAMES[user.role]}
                </span>
              </td>
              <td>
                <span class="badge {getStatusBadgeClass(user.status)}">
                  {user.status.replace('_', ' ')}
                </span>
              </td>
              <td class="time-cell">
                {formatTimeAgo(user.lastLoginAt)}
              </td>
              {#if canManageUsers}
                <td>
                  <button class="btn btn-sm btn-ghost" on:click={() => openEditModal(user)}>
                    ✏️ Edit
                  </button>
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

{#if showInviteModal}
  <InviteUserModal on:close={closeInviteModal} />
{/if}

{#if showEditModal && selectedUser}
  <EditUserModal user={selectedUser} on:close={closeEditModal} />
{/if}

<style>
  .user-management-embedded {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .header-section {
    margin-bottom: 1.5rem;
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .filters {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .search-box {
    position: relative;
    flex: 1;
    min-width: 250px;
  }

  .search-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0.5;
  }

  .search-box input {
    width: 100%;
    padding: 0.625rem 0.875rem 0.625rem 2.5rem;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.5rem;
    font-size: 0.9rem;
    background: var(--input-bg, white);
    color: var(--text-primary, #1a202c);
  }
  
  .search-box input::placeholder {
    color: var(--text-secondary, #718096);
    opacity: 0.7;
  }
  
  .search-box input:focus {
    outline: 2px solid var(--primary, #3b82f6);
    outline-offset: 2px;
  }

  .select {
    padding: 0.625rem 0.875rem;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.5rem;
    background: var(--input-bg, white);
    color: var(--text-primary, #1a202c);
    cursor: pointer;
    font-size: 0.9rem;
  }
  
  .select:focus {
    outline: 2px solid var(--primary, #3b82f6);
    outline-offset: 2px;
  }

  .results-count {
    color: var(--text-secondary, #718096);
    font-size: 0.875rem;
    margin-left: auto;
    white-space: nowrap;
    font-weight: 500;
  }

  .table-container {
    flex: 1;
    overflow: auto;
    background: var(--card-bg, white);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.5rem;
  }

  .user-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  .user-table thead {
    background: var(--bg-secondary, #f8f9fa);
    border-bottom: 2px solid var(--border-color, #e0e0e0);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .user-table th {
    padding: 0.875rem 1rem;
    text-align: left;
    font-weight: 600;
    color: var(--text-primary, #1a202c);
    font-size: 0.8125rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .user-table td {
    padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    color: var(--text-primary, #1a202c);
  }

  .user-table tbody tr:hover {
    background: var(--bg-hover, #f1f5f9);
  }

  .user-cell {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
  }

  .user-avatar-placeholder {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--primary, #3b82f6);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 1rem;
  }

  .user-info {
    display: flex;
    flex-direction: column;
  }

  .user-name {
    font-weight: 500;
    color: var(--text-primary, #1a202c);
    line-height: 1.4;
  }

  .user-email {
    font-size: 0.8125rem;
    color: var(--text-secondary, #718096);
    line-height: 1.4;
    margin-top: 0.125rem;
  }

  .time-cell {
    color: var(--text-secondary, #718096);
    font-size: 0.8125rem;
    white-space: nowrap;
  }

  .badge {
    display: inline-block;
    padding: 0.25rem 0.625rem;
    border-radius: 1rem;
    font-size: 0.8125rem;
    font-weight: 500;
    white-space: nowrap;
    text-transform: capitalize;
  }

  .badge-primary { background: #8b5cf6; color: white; }
  .badge-secondary { background: #6366f1; color: white; }
  .badge-info { background: #06b6d4; color: white; }
  .badge-accent { background: #f59e0b; color: white; }
  .badge-success { background: #10b981; color: white; }
  .badge-error { background: #ef4444; color: white; }
  .badge-warning { background: #f59e0b; color: white; }
  .badge-neutral { background: #6b7280; color: white; }

  .btn {
    padding: 0.625rem 1.25rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
    font-size: 0.9rem;
  }

  .btn-primary {
    background: var(--primary, #3b82f6);
    color: white;
  }

  .btn-primary:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: var(--secondary, #64748b);
    color: white;
  }

  .btn-link {
    background: transparent;
    color: var(--primary, #3b82f6);
    padding: 0.5rem 0.75rem;
  }

  .btn-link:hover {
    background: var(--bg-hover, #f1f5f9);
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
  }

  .btn-ghost {
    background: transparent;
    color: var(--primary, #3b82f6);
  }

  .btn-ghost:hover {
    background: var(--bg-hover, #f1f5f9);
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 2rem;
    color: var(--text-secondary, #718096);
    flex: 1;
  }
  
  .loading-container p {
    margin-top: 1rem;
    color: var(--text-primary, #1a202c);
    font-size: 0.9rem;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color, #e0e0e0);
    border-top-color: var(--primary, #3b82f6);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 2rem;
    text-align: center;
    flex: 1;
  }

  .empty-icon {
    font-size: 3rem;
    opacity: 0.4;
    margin-bottom: 1rem;
  }

  .empty-state h3 {
    margin: 0 0 0.5rem;
    color: var(--text-primary, #1a202c);
    font-size: 1.125rem;
    font-weight: 600;
  }

  .empty-state p {
    color: var(--text-secondary, #718096);
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .alert {
    padding: 0.875rem 1.25rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    border: 1px solid;
    font-size: 0.9rem;
  }

  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #ef4444;
  }

  .alert button {
    margin-left: auto;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.125rem;
    opacity: 0.5;
  }

  .alert button:hover {
    opacity: 1;
  }
</style>

