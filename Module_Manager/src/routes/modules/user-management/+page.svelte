<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { getTenantUsers, getAllUsers, type TenantUser } from '$lib/services/userManagementService';
  import { ROLE_NAMES } from '$lib/models/userRole';
  import { isPlatformAdmin } from '$lib/services/adminService';
  import { authService } from '$lib/services/authService';
  import InviteUserModal from './components/InviteUserModal.svelte';
  import EditUserModal from './components/EditUserModal.svelte';
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
        // Admin users see all users across all tenants
        console.log('Loading all users (admin view)');
        users = await getAllUsers();
        tenantRole = 'platform_admin';
        canManageUsers = true;
      } else {
        // Regular users see only their tenant's users
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
      
      // Provide more helpful error messages based on error type
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
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          user.email.toLowerCase().includes(query) ||
          user.displayName?.toLowerCase().includes(query) ||
          '';
        if (!matchesSearch) return false;
      }
      
      // Role filter
      if (roleFilter !== 'all' && user.role !== roleFilter) {
        return false;
      }
      
      // Status filter
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
    loadUsers(); // Reload after invite
  }

  function openEditModal(user: TenantUser) {
    if (!canManageUsers) return;
    selectedUser = user;
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    selectedUser = null;
    loadUsers(); // Reload after edit
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

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
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
    return formatDate(dateString);
  }
</script>

<div class="user-management-container">
  <div class="header">
    <button class="btn-back" on:click={() => goto('/dashboard')}>
      ← Back to Modules
    </button>
    
    <div class="title-section">
      <h1>👥 User Management</h1>
      <p class="subtitle">
        {#if isAdmin}
          Manage all users across all organizations
        {:else}
          Manage users, roles, and permissions for {$currentTenant?.name || 'your organization'}
        {/if}
      </p>
    </div>
    
    {#if canManageUsers}
      <div class="header-actions">
        <button class="btn btn-secondary" on:click={() => goto('/modules/user-management/roles')}>
          <span>👥</span>
          Role Management
        </button>
        <button class="btn btn-secondary" on:click={() => goto('/modules/user-management/permissions')}>
          <span>🔐</span>
          User Permissions
        </button>
        <button class="btn btn-primary" on:click={openInviteModal}>
          <span>➕</span>
          Add User
        </button>
      </div>
    {/if}
  </div>

  {#if error}
    <div class="alert alert-error">
      <span>❌</span>
      <span>{error}</span>
      <button on:click={() => error = ''}>✕</button>
    </div>
  {/if}

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
            <th>Added</th>
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
              <td class="time-cell">
                {formatTimeAgo(user.addedAt)}
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
  .user-management-container {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
    background: var(--bg-primary);
    min-height: 100vh;
    color: var(--text-primary);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    gap: 1.5rem;
  }

  .btn-back {
    padding: 0.75rem 1.25rem;
    border: 1px solid var(--border-color);
    background: var(--card-bg, var(--bg-secondary));
    border-radius: 0.5rem;
    cursor: pointer;
    font-weight: 500;
    color: var(--text-primary);
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-back:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--primary);
  }

  .title-section {
    flex: 1;
  }

  .title-section h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
    line-height: 1.2;
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .subtitle {
    color: var(--text-secondary);
    margin-top: 0.5rem;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .filters {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .search-box {
    position: relative;
    flex: 1;
    min-width: 300px;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0.5;
  }

  .search-box input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 3rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    font-size: 1rem;
    background: var(--card-bg, var(--bg-secondary));
    color: var(--text-primary);
  }
  
  .search-box input::placeholder {
    color: var(--text-secondary);
    opacity: 0.7;
  }
  
  .search-box input:focus {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .select {
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--card-bg, var(--bg-secondary));
    color: var(--text-primary);
    cursor: pointer;
  }
  
  .select:focus {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .results-count {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-left: auto;
    white-space: nowrap;
    font-weight: 500;
  }

  .table-container {
    background: var(--card-bg, var(--bg-primary));
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    box-shadow: var(--shadow-md);
    overflow-x: auto;
  }

  .user-table {
    width: 100%;
    border-collapse: collapse;
  }

  .user-table thead {
    background: var(--bg-secondary);
    border-bottom: 2px solid var(--border-color);
  }

  .user-table th {
    padding: 1rem;
    text-align: left;
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .user-table td {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
    background: var(--card-bg, var(--bg-primary));
  }

  .user-table tbody tr:hover {
    background: var(--bg-hover, var(--bg-secondary));
  }
  
  .user-table tbody tr:hover td {
    background: var(--bg-hover, var(--bg-secondary));
  }

  .user-cell {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
  }

  .user-avatar-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 1.125rem;
  }

  .user-info {
    display: flex;
    flex-direction: column;
  }

  .user-name {
    font-weight: 500;
    color: var(--text-primary);
    line-height: 1.4;
  }

  .user-email {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.4;
    margin-top: 0.125rem;
  }

  .time-cell {
    color: var(--text-secondary);
    font-size: 0.875rem;
    white-space: nowrap;
  }

  .badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
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
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--primary);
    color: white;
  }

  .btn-primary:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: var(--secondary);
    color: white;
  }

  .btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }

  .btn-ghost {
    background: transparent;
    color: var(--primary);
  }

  .btn-ghost:hover {
    background: var(--bg-hover);
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    color: var(--text-secondary);
    background: var(--card-bg, var(--bg-secondary));
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    min-height: 300px;
  }
  
  .loading-container p {
    margin-top: 1rem;
    color: var(--text-primary);
    font-size: 0.95rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary);
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
    padding: 4rem 2rem;
    text-align: center;
    background: var(--card-bg, var(--bg-secondary));
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    min-height: 300px;
  }

  .empty-icon {
    font-size: 4rem;
    opacity: 0.4;
    margin-bottom: 1rem;
    color: var(--text-tertiary, var(--text-secondary));
  }

  .empty-state h3 {
    margin: 0 0 0.5rem;
    color: var(--text-primary);
    font-size: 1.25rem;
    font-weight: 600;
  }

  .empty-state p {
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .alert {
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    border: 1px solid;
  }

  .alert-error {
    background: var(--danger-light, rgba(239, 68, 68, 0.1));
    border-color: var(--danger, #ef4444);
    color: var(--danger, #ef4444);
  }
  
  .alert-success {
    background: var(--success-light, rgba(16, 185, 129, 0.1));
    border-color: var(--success, #10b981);
    color: var(--success, #10b981);
  }

  .alert button {
    margin-left: auto;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    opacity: 0.5;
  }

  .alert button:hover {
    opacity: 1;
  }
</style>