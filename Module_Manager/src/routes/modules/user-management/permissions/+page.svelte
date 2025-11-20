<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { permissionService, type ModulePermission, type FCAPSCategory, type FCAPSOperation } from '$lib/services/permissionService';
  import { FCAPS_CATEGORIES, FCAPS_OPERATIONS } from '$lib/services/permissionService';
  import { currentTenant } from '$lib/stores/tenantStore';

  let loading = false;
  let error = '';
  let success = '';
  let tenantId: string | null = null;
  
  // Available modules/systems
  const MODULES = [
    { id: 'inventory', name: 'Inventory', description: 'Hardware inventory management' },
    { id: 'customers', name: 'Customers', description: 'Customer and subscriber management' },
    { id: 'plans', name: 'Plans/Projects', description: 'Deployment planning and projects' },
    { id: 'network', name: 'Network', description: 'Network sites and equipment' },
    { id: 'work-orders', name: 'Work Orders', description: 'Work order and ticket management' },
    { id: 'monitoring', name: 'Monitoring', description: 'System monitoring and alerts' },
    { id: 'billing', name: 'Billing', description: 'Billing and accounting' },
    { id: 'users', name: 'User Management', description: 'User and role management' },
    { id: 'tenants', name: 'Tenant Settings', description: 'Tenant configuration' }
  ];

  // Permission type (user or role)
  let permissionType: 'user' | 'role' = 'role';
  let selectedUserId: string | null = null;
  let selectedRole: string = 'admin';
  
  // Role permissions
  let rolePermissions: { [role: string]: ModulePermission[] } = {};
  
  // User permissions
  let userPermissions: ModulePermission[] = [];
  let inheritFromRole = true;

  // Editing state
  let editingModule: string | null = null;
  let editingPermissions: ModulePermission | null = null;

  const ROLES = ['admin', 'engineer', 'installer', 'helpdesk', 'sales', 'viewer'];

  // Reactive statement to update tenantId when currentTenant changes
  $: {
    if ($currentTenant?.id) {
      tenantId = $currentTenant.id;
    }
  }

  onMount(async () => {
    // Wait for tenant to be available
    if (!$currentTenant) {
      // Wait a bit for tenant to load
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if ($currentTenant?.id) {
      tenantId = $currentTenant.id;
      await loadRolePermissions();
    } else {
      error = 'No tenant selected. Please select a tenant from the dashboard.';
    }
  });

  async function loadRolePermissions() {
    if (!tenantId) {
      error = 'No tenant selected. Please select a tenant from the dashboard.';
      return;
    }
    
    loading = true;
    error = '';
    
    try {
      const result = await permissionService.getAllRolePermissions();
      const permissions: { [role: string]: ModulePermission[] } = {};
      
      result.rolePermissions.forEach((rp: any) => {
        permissions[rp.role] = rp.permissions || [];
      });
      
      rolePermissions = permissions;
    } catch (err: any) {
      error = err.message || 'Failed to load role permissions';
      console.error('Error loading role permissions:', err);
    } finally {
      loading = false;
    }
  }

  async function loadUserPermissions(userId: string) {
    loading = true;
    error = '';
    
    try {
      const result = await permissionService.getUserPermissions(userId);
      userPermissions = result.permissions || [];
      inheritFromRole = result.inheritFromRole !== false;
    } catch (err: any) {
      error = err.message || 'Failed to load user permissions';
      console.error('Error loading user permissions:', err);
    } finally {
      loading = false;
    }
  }

  function getModulePermissions(moduleId: string, role: string): ModulePermission | null {
    const perms = rolePermissions[role] || [];
    return perms.find((p: ModulePermission) => p.module === moduleId) || null;
  }

  function getUserModulePermissions(moduleId: string): ModulePermission | null {
    return userPermissions.find((p: ModulePermission) => p.module === moduleId) || null;
  }

  function hasPermission(perm: ModulePermission | null, category: FCAPSCategory, operation: FCAPSOperation): boolean {
    if (!perm) return false;
    return perm[category]?.[operation] === true;
  }

  function editPermissions(moduleId: string) {
    editingModule = moduleId;
    
    if (permissionType === 'role') {
      const existing = getModulePermissions(moduleId, selectedRole);
      editingPermissions = existing 
        ? JSON.parse(JSON.stringify(existing))
        : permissionService.createEmptyModulePermission(moduleId);
    } else {
      const existing = getUserModulePermissions(moduleId);
      editingPermissions = existing
        ? JSON.parse(JSON.stringify(existing))
        : permissionService.createEmptyModulePermission(moduleId);
    }
  }

  function togglePermission(category: FCAPSCategory, operation: FCAPSOperation) {
    if (!editingPermissions) return;
    editingPermissions[category][operation] = !editingPermissions[category][operation];
    editingPermissions = { ...editingPermissions };
  }

  async function savePermissions() {
    if (!editingPermissions || !editingModule) return;
    
    loading = true;
    error = '';
    success = '';
    
    try {
      if (permissionType === 'role') {
        const perms = rolePermissions[selectedRole] || [];
        const index = perms.findIndex((p: ModulePermission) => p.module === editingModule);
        
        if (index >= 0) {
          perms[index] = editingPermissions;
        } else {
          perms.push(editingPermissions);
        }
        
        await permissionService.setRolePermissions(selectedRole, perms);
        rolePermissions = { ...rolePermissions, [selectedRole]: perms };
      } else {
        if (!selectedUserId) {
          throw new Error('User ID is required');
        }
        
        const index = userPermissions.findIndex((p: ModulePermission) => p.module === editingModule);
        
        if (index >= 0) {
          userPermissions[index] = editingPermissions;
        } else {
          userPermissions.push(editingPermissions);
        }
        
        await permissionService.setUserPermissions(selectedUserId, userPermissions, inheritFromRole);
      }
      
      success = `Permissions for ${editingModule} saved successfully`;
      editingModule = null;
      editingPermissions = null;
      
      setTimeout(() => {
        success = '';
      }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to save permissions';
      console.error('Error saving permissions:', err);
    } finally {
      loading = false;
    }
  }

  function cancelEdit() {
    editingModule = null;
    editingPermissions = null;
  }

  async function handlePermissionTypeChange() {
    if (permissionType === 'user' && selectedUserId) {
      await loadUserPermissions(selectedUserId);
    }
    editingModule = null;
    editingPermissions = null;
  }

  async function handleRoleChange() {
    editingModule = null;
    editingPermissions = null;
  }
</script>

<svelte:head>
  <title>FCAPS Permission Management</title>
</svelte:head>

<div class="permissions-page">
  <div class="page-header">
    <div class="header-left">
      <button class="btn-back" on:click={() => goto('/modules/user-management')}>
        ← Back
      </button>
      <div>
        <h1>🔐 FCAPS Permission Management</h1>
        <p class="subtitle">Manage Fault, Configuration, Accounting, Performance, and Security permissions</p>
      </div>
    </div>
  </div>

  {#if error}
    <div class="alert alert-error">
      <span>❌ {error}</span>
      <button on:click={() => error = ''}>✕</button>
    </div>
  {/if}

  {#if success}
    <div class="alert alert-success">
      <span>✅ {success}</span>
      <button on:click={() => success = ''}>✕</button>
    </div>
  {/if}

  <!-- Permission Type Selector -->
  <div class="permission-type-selector">
    <button
      class="type-btn"
      class:active={permissionType === 'role'}
      on:click={() => { permissionType = 'role'; handlePermissionTypeChange(); }}
    >
      👥 Role Permissions
    </button>
    <button
      class="type-btn"
      class:active={permissionType === 'user'}
      on:click={() => { permissionType = 'user'; handlePermissionTypeChange(); }}
    >
      👤 User Permissions
    </button>
  </div>

  {#if permissionType === 'role'}
    <!-- Role Permissions -->
    <div class="permissions-section">
      <div class="section-header">
        <h2>Role Permissions</h2>
        <select bind:value={selectedRole} on:change={handleRoleChange}>
          {#each ROLES as role}
            <option value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
          {/each}
        </select>
      </div>

      <div class="modules-grid">
        {#each MODULES as module}
          {@const modulePerm = getModulePermissions(module.id, selectedRole)}
          <div class="module-card">
            <div class="module-header">
              <h3>{module.name}</h3>
              <p class="module-description">{module.description}</p>
            </div>
            
            <div class="fcaps-permissions">
              {#each FCAPS_CATEGORIES as category}
                <div class="fcaps-category">
                  <div class="category-header">
                    <strong>{category.charAt(0).toUpperCase() + category.slice(1)}</strong>
                  </div>
                  <div class="operations">
                    {#each FCAPS_OPERATIONS as op}
                      {@const hasPerm = hasPermission(modulePerm, category, op)}
                      <span class="operation-badge" class:enabled={hasPerm}>
                        {op.charAt(0).toUpperCase() + op.slice(1)}
                      </span>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
            
            <button class="btn-edit" on:click={() => editPermissions(module.id)}>
              ✏️ Edit
            </button>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <!-- User Permissions -->
    <div class="permissions-section">
      <div class="section-header">
        <h2>User Permissions</h2>
        <input
          type="text"
          placeholder="Enter User ID"
          bind:value={selectedUserId}
          on:input={async () => {
            if (selectedUserId) {
              await loadUserPermissions(selectedUserId);
            }
          }}
        />
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={inheritFromRole} />
          Inherit from role
        </label>
      </div>

      {#if selectedUserId}
        <div class="modules-grid">
          {#each MODULES as module}
            {@const modulePerm = getUserModulePermissions(module.id)}
            <div class="module-card">
              <div class="module-header">
                <h3>{module.name}</h3>
                <p class="module-description">{module.description}</p>
              </div>
              
              <div class="fcaps-permissions">
                {#each FCAPS_CATEGORIES as category}
                  <div class="fcaps-category">
                    <div class="category-header">
                      <strong>{category.charAt(0).toUpperCase() + category.slice(1)}</strong>
                    </div>
                    <div class="operations">
                      {#each FCAPS_OPERATIONS as op}
                        {@const hasPerm = hasPermission(modulePerm, category, op)}
                        <span class="operation-badge" class:enabled={hasPerm}>
                          {op.charAt(0).toUpperCase() + op.slice(1)}
                        </span>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
              
              <button class="btn-edit" on:click={() => editPermissions(module.id)}>
                ✏️ Edit
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-state">
          <p>Enter a User ID to view and edit user permissions</p>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Edit Permission Modal -->
  {#if editingModule && editingPermissions}
    <div class="modal-overlay" on:click={cancelEdit}>
      <div class="modal-content" on:click|stopPropagation>
        <div class="modal-header">
          <h3>Edit Permissions: {editingModule}</h3>
          <button class="close-btn" on:click={cancelEdit}>✕</button>
        </div>
        
        <div class="modal-body">
          <div class="fcaps-edit-grid">
            {#each FCAPS_CATEGORIES as category}
              <div class="fcaps-edit-category">
                <h4>{category.charAt(0).toUpperCase() + category.slice(1)}</h4>
                <div class="operations-checkboxes">
                  {#each FCAPS_OPERATIONS as op}
                    <label class="checkbox-label">
                      <input
                        type="checkbox"
                        checked={editingPermissions[category][op]}
                        on:change={() => togglePermission(category, op)}
                      />
                      <span>{op.charAt(0).toUpperCase() + op.slice(1)}</span>
                    </label>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" on:click={cancelEdit}>Cancel</button>
          <button class="btn-primary" on:click={savePermissions} disabled={loading}>
            {loading ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .permissions-page {
    padding: 2rem;
    max-width: 1600px;
    margin: 0 auto;
    background: var(--bg-primary);
    min-height: 100vh;
    color: var(--text-primary);
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
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
  }

  .btn-back:hover {
    background: var(--bg-tertiary);
    border-color: var(--primary);
  }

  h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
  }

  .subtitle {
    color: var(--text-secondary);
    margin-top: 0.5rem;
    font-size: 0.95rem;
  }

  .alert {
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1px solid;
  }

  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #ef4444;
  }

  .alert-success {
    background: rgba(16, 185, 129, 0.1);
    border-color: #10b981;
    color: #10b981;
  }

  .alert button {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    opacity: 0.5;
  }

  .alert button:hover {
    opacity: 1;
  }

  .permission-type-selector {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 1rem;
  }

  .type-btn {
    padding: 0.75rem 1.5rem;
    border: none;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    cursor: pointer;
    font-weight: 500;
    color: var(--text-secondary);
    transition: all 0.2s;
    border-bottom: 2px solid transparent;
  }

  .type-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .type-btn.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
    background: var(--bg-tertiary);
  }

  .permissions-section {
    margin-top: 2rem;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .section-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text-primary);
  }

  .section-header select,
  .section-header input {
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--card-bg, var(--bg-secondary));
    color: var(--text-primary);
    font-size: 1rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    color: var(--text-primary);
  }

  .modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .module-card {
    background: var(--card-bg, var(--bg-secondary));
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    transition: all 0.2s;
  }

  .module-card:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  .module-header h3 {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
    color: var(--text-primary);
  }

  .module-description {
    margin: 0 0 1rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .fcaps-permissions {
    margin-bottom: 1rem;
  }

  .fcaps-category {
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  .fcaps-category:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  .category-header {
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .operations {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .operation-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    background: var(--bg-tertiary);
    color: var(--text-tertiary);
    border: 1px solid var(--border-color);
  }

  .operation-badge.enabled {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
  }

  .btn-edit {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    background: var(--bg-tertiary);
    border-radius: 0.5rem;
    cursor: pointer;
    font-weight: 500;
    color: var(--text-primary);
    transition: all 0.2s;
    margin-top: 1rem;
  }

  .btn-edit:hover {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-secondary);
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 1rem;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: var(--card-bg, var(--bg-primary));
    border-radius: 0.5rem;
    box-shadow: var(--shadow-xl);
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .fcaps-edit-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
  }

  .fcaps-edit-category {
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    border: 1px solid var(--border-color);
  }

  .fcaps-edit-category h4 {
    margin: 0 0 1rem;
    font-size: 1rem;
    color: var(--text-primary);
  }

  .operations-checkboxes {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
  }

  .btn-primary, .btn-secondary {
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn-primary {
    background: var(--primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--primary-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover {
    background: var(--bg-hover);
    border-color: var(--primary);
  }
</style>

