<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { permissionService, type ModulePermission, type FCAPSCategory, type FCAPSOperation, type RolePermissions } from '$lib/services/permissionService';
  import { FCAPS_CATEGORIES, FCAPS_OPERATIONS } from '$lib/services/permissionService';
  import { ROLE_NAMES, ROLE_DESCRIPTIONS, type UserRole } from '$lib/models/userRole';
  import { currentTenant } from '$lib/stores/tenantStore';

  let loading = false;
  let error = '';
  let success = '';
  let tenantId: string | null = null;
  
  // Available modules/systems
  const MODULES = [
    { id: 'inventory', name: 'Inventory', description: 'Hardware inventory management', icon: '📦' },
    { id: 'customers', name: 'Customers', description: 'Customer and subscriber management', icon: '👥' },
    { id: 'plans', name: 'Plans/Projects', description: 'Deployment planning and projects', icon: '🗺️' },
    { id: 'network', name: 'Network', description: 'Network sites and equipment', icon: '📡' },
    { id: 'work-orders', name: 'Work Orders', description: 'Work order and ticket management', icon: '📋' },
    { id: 'monitoring', name: 'Monitoring', description: 'System monitoring and alerts', icon: '📊' },
    { id: 'billing', name: 'Billing', description: 'Billing and accounting', icon: '💳' },
    { id: 'users', name: 'User Management', description: 'User and role management', icon: '👤' },
    { id: 'tenants', name: 'Tenant Settings', description: 'Tenant configuration', icon: '⚙️' }
  ];

  // Available roles (excluding platform_admin and owner as they have full access)
  const EDITABLE_ROLES: UserRole[] = ['admin', 'engineer', 'installer', 'helpdesk', 'sales', 'viewer'];
  
  // Role permissions data
  let rolePermissionsData: { [role: string]: RolePermissions } = {};
  
  // Selected role for editing
  let selectedRole: UserRole = 'admin';
  let editingModule: string | null = null;
  let editingPermissions: ModulePermission | null = null;

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
      const permissions: { [role: string]: RolePermissions } = {};
      
      result.rolePermissions.forEach((rp: RolePermissions) => {
        permissions[rp.role] = rp;
      });
      
      rolePermissionsData = permissions;
    } catch (err: any) {
      error = err.message || 'Failed to load role permissions';
      console.error('Error loading role permissions:', err);
    } finally {
      loading = false;
    }
  }

  function getModulePermissions(moduleId: string, role: UserRole): ModulePermission | null {
    const rolePerm = rolePermissionsData[role];
    if (!rolePerm || !rolePerm.permissions) return null;
    
    return rolePerm.permissions.find((p: ModulePermission) => p.module === moduleId) || null;
  }

  function hasPermission(perm: ModulePermission | null, category: FCAPSCategory, operation: FCAPSOperation): boolean {
    if (!perm) return false;
    return perm[category]?.[operation] === true;
  }

  function editPermissions(moduleId: string) {
    editingModule = moduleId;
    
    const existing = getModulePermissions(moduleId, selectedRole);
    editingPermissions = existing 
      ? JSON.parse(JSON.stringify(existing))
      : permissionService.createEmptyModulePermission(moduleId);
  }

  function togglePermission(category: FCAPSCategory, operation: FCAPSOperation) {
    if (!editingPermissions) return;
    editingPermissions[category][operation] = !editingPermissions[category][operation];
    editingPermissions = { ...editingPermissions };
  }

  function toggleAllPermissions(enabled: boolean) {
    if (!editingPermissions) return;
    
    FCAPS_CATEGORIES.forEach(category => {
      FCAPS_OPERATIONS.forEach(operation => {
        editingPermissions![category][operation] = enabled;
      });
    });
    
    editingPermissions = { ...editingPermissions };
  }

  function toggleCategory(category: FCAPSCategory, enabled: boolean) {
    if (!editingPermissions) return;
    
    FCAPS_OPERATIONS.forEach(operation => {
      editingPermissions![category][operation] = enabled;
    });
    
    editingPermissions = { ...editingPermissions };
  }

  async function savePermissions() {
    if (!editingPermissions || !editingModule) return;
    
    loading = true;
    error = '';
    success = '';
    
    try {
      const rolePerm = rolePermissionsData[selectedRole];
      const perms = rolePerm?.permissions || [];
      const index = perms.findIndex((p: ModulePermission) => p.module === editingModule);
      
      if (index >= 0) {
        perms[index] = editingPermissions;
      } else {
        perms.push(editingPermissions);
      }
      
      await permissionService.setRolePermissions(selectedRole, perms);
      
      // Update local data
      rolePermissionsData = {
        ...rolePermissionsData,
        [selectedRole]: {
          role: selectedRole,
          tenantId: rolePerm?.tenantId || '',
          permissions: perms
        }
      };
      
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

  function handleRoleChange() {
    editingModule = null;
    editingPermissions = null;
  }

  function getRoleColor(role: UserRole): string {
    const colors: { [key: string]: string } = {
      admin: 'var(--primary)',
      engineer: '#10b981',
      installer: '#f59e0b',
      helpdesk: '#3b82f6',
      sales: '#8b5cf6',
      viewer: '#6b7280'
    };
    return colors[role] || 'var(--primary)';
  }
</script>

<svelte:head>
  <title>Role Management - FCAPS Permissions</title>
</svelte:head>

<div class="role-management-page">
  <div class="page-header">
    <div class="header-left">
      <button class="btn-back" on:click={() => goto('/modules/user-management')}>
        ← Back
      </button>
      <div>
        <h1>👥 Role Management</h1>
        <p class="subtitle">Define FCAPS permissions (Fault, Configuration, Accounting, Performance, Security) for each role</p>
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

  <!-- Role Selector -->
  <div class="role-selector-section">
    <h2>Select Role</h2>
    <div class="role-tabs">
      {#each EDITABLE_ROLES as role}
        <button
          class="role-tab"
          class:active={selectedRole === role}
          style="border-color: {selectedRole === role ? getRoleColor(role) : 'transparent'}"
          on:click={() => { selectedRole = role; handleRoleChange(); }}
        >
          <span class="role-icon">{role === 'admin' ? '👑' : role === 'engineer' ? '⚙️' : role === 'installer' ? '🔧' : role === 'helpdesk' ? '🎧' : role === 'sales' ? '💼' : '👁️'}</span>
          <span class="role-name">{ROLE_NAMES[role]}</span>
        </button>
      {/each}
    </div>
    {#if selectedRole}
      <p class="role-description">{ROLE_DESCRIPTIONS[selectedRole]}</p>
    {/if}
  </div>

  <!-- FCAPS Legend -->
  <div class="fcaps-legend">
    <h3>FCAPS Categories:</h3>
    <div class="legend-items">
      <div class="legend-item">
        <strong>F</strong> - <span>Fault:</span> Monitoring, alarms, error handling
      </div>
      <div class="legend-item">
        <strong>C</strong> - <span>Configuration:</span> Settings, changes, management
      </div>
      <div class="legend-item">
        <strong>A</strong> - <span>Accounting:</span> Billing, usage tracking
      </div>
      <div class="legend-item">
        <strong>P</strong> - <span>Performance:</span> Metrics, analytics, monitoring
      </div>
      <div class="legend-item">
        <strong>S</strong> - <span>Security:</span> Access control, authentication
      </div>
    </div>
    <div class="operations-legend">
      <strong>Operations:</strong> <span class="badge">R</span> = Read, <span class="badge">W</span> = Write, <span class="badge">D</span> = Delete
    </div>
  </div>

  <!-- Modules Grid -->
  <div class="modules-section">
    <h2>Module Permissions for {ROLE_NAMES[selectedRole]}</h2>
    <div class="modules-grid">
      {#each MODULES as module}
        {@const modulePerm = getModulePermissions(module.id, selectedRole)}
        <div class="module-card">
          <div class="module-header">
            <span class="module-icon">{module.icon}</span>
            <div>
              <h3>{module.name}</h3>
              <p class="module-description">{module.description}</p>
            </div>
          </div>
          
          <div class="fcaps-matrix">
            <div class="matrix-header">
              <div class="category-col"></div>
              <div class="operation-col">R</div>
              <div class="operation-col">W</div>
              <div class="operation-col">D</div>
            </div>
            {#each FCAPS_CATEGORIES as category}
              <div class="matrix-row">
                <div class="category-label">{category.charAt(0).toUpperCase()}</div>
                {#each FCAPS_OPERATIONS as op}
                  {@const hasPerm = hasPermission(modulePerm, category, op)}
                  <div class="permission-cell" class:enabled={hasPerm}>
                    {hasPerm ? '✓' : '✗'}
                  </div>
                {/each}
              </div>
            {/each}
          </div>
          
          <button class="btn-edit" on:click={() => editPermissions(module.id)}>
            ✏️ Edit Permissions
          </button>
        </div>
      {/each}
    </div>
  </div>

  <!-- Edit Permission Modal -->
  {#if editingModule && editingPermissions}
    {@const module = MODULES.find(m => m.id === editingModule)}
    <div class="modal-overlay" on:click={cancelEdit}>
      <div class="modal-content" on:click|stopPropagation>
        <div class="modal-header">
          <div>
            <h3>{module?.icon} {module?.name}</h3>
            <p class="modal-subtitle">Role: {ROLE_NAMES[selectedRole]}</p>
          </div>
          <button class="close-btn" on:click={cancelEdit}>✕</button>
        </div>
        
        <div class="modal-body">
          <div class="quick-actions">
            <button class="btn-quick" on:click={() => toggleAllPermissions(true)}>
              ✅ Grant All
            </button>
            <button class="btn-quick" on:click={() => toggleAllPermissions(false)}>
              ❌ Revoke All
            </button>
          </div>

          <div class="fcaps-edit-grid">
            {#each FCAPS_CATEGORIES as category}
              <div class="fcaps-edit-category">
                <div class="category-header-edit">
                  <h4>{category.charAt(0).toUpperCase() + category.slice(1)}</h4>
                  <div class="category-toggle">
                    <button class="btn-toggle" on:click={() => toggleCategory(category, true)}>All</button>
                    <button class="btn-toggle" on:click={() => toggleCategory(category, false)}>None</button>
                  </div>
                </div>
                <div class="operations-checkboxes">
                  {#each FCAPS_OPERATIONS as op}
                    <label class="checkbox-label">
                      <input
                        type="checkbox"
                        checked={editingPermissions[category][op]}
                        on:change={() => togglePermission(category, op)}
                      />
                      <span class="operation-name">
                        {op === 'read' ? '📖' : op === 'write' ? '✏️' : '🗑️'}
                        {op.charAt(0).toUpperCase() + op.slice(1)}
                      </span>
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
  .role-management-page {
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

  .role-selector-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: var(--card-bg, var(--bg-secondary));
    border-radius: 0.5rem;
    border: 1px solid var(--border-color);
  }

  .role-selector-section h2 {
    margin: 0 0 1rem;
    font-size: 1.25rem;
    color: var(--text-primary);
  }

  .role-tabs {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .role-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border: 2px solid transparent;
    border-radius: 0.5rem;
    background: var(--bg-tertiary);
    cursor: pointer;
    font-weight: 500;
    color: var(--text-primary);
    transition: all 0.2s;
  }

  .role-tab:hover {
    background: var(--bg-hover);
    transform: translateY(-2px);
  }

  .role-tab.active {
    background: var(--bg-primary);
    box-shadow: var(--shadow-md);
  }

  .role-icon {
    font-size: 1.25rem;
  }

  .role-name {
    font-size: 1rem;
  }

  .role-description {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.95rem;
  }

  .fcaps-legend {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: var(--card-bg, var(--bg-secondary));
    border-radius: 0.5rem;
    border: 1px solid var(--border-color);
  }

  .fcaps-legend h3 {
    margin: 0 0 1rem;
    font-size: 1.125rem;
    color: var(--text-primary);
  }

  .legend-items {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .legend-item {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .legend-item strong {
    color: var(--primary);
    font-weight: 600;
  }

  .operations-legend {
    font-size: 0.875rem;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: var(--bg-tertiary);
    font-weight: 600;
    font-size: 0.75rem;
  }

  .modules-section {
    margin-top: 2rem;
  }

  .modules-section h2 {
    margin: 0 0 1.5rem;
    font-size: 1.5rem;
    color: var(--text-primary);
  }

  .modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
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

  .module-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .module-icon {
    font-size: 2rem;
  }

  .module-header h3 {
    margin: 0 0 0.25rem;
    font-size: 1.25rem;
    color: var(--text-primary);
  }

  .module-description {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .fcaps-matrix {
    margin-bottom: 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .matrix-header {
    display: grid;
    grid-template-columns: 80px 1fr 1fr 1fr;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
  }

  .category-col,
  .operation-col {
    padding: 0.75rem;
    text-align: center;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .matrix-row {
    display: grid;
    grid-template-columns: 80px 1fr 1fr 1fr;
    border-bottom: 1px solid var(--border-color);
  }

  .matrix-row:last-child {
    border-bottom: none;
  }

  .category-label {
    padding: 0.75rem;
    text-align: center;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-secondary);
    background: var(--bg-tertiary);
  }

  .permission-cell {
    padding: 0.75rem;
    text-align: center;
    font-size: 1rem;
    color: var(--text-tertiary);
    background: var(--bg-primary);
  }

  .permission-cell.enabled {
    color: var(--primary);
    font-weight: 600;
    background: rgba(139, 92, 246, 0.1);
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
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h3 {
    margin: 0 0 0.25rem;
    font-size: 1.5rem;
    color: var(--text-primary);
  }

  .modal-subtitle {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
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

  .quick-actions {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .btn-quick {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text-primary);
    transition: all 0.2s;
  }

  .btn-quick:hover {
    background: var(--bg-hover);
    border-color: var(--primary);
  }

  .fcaps-edit-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
  }

  .fcaps-edit-category {
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    border: 1px solid var(--border-color);
  }

  .category-header-edit {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .category-header-edit h4 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-primary);
  }

  .category-toggle {
    display: flex;
    gap: 0.5rem;
  }

  .btn-toggle {
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--border-color);
    background: var(--bg-tertiary);
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-primary);
    transition: all 0.2s;
  }

  .btn-toggle:hover {
    background: var(--bg-hover);
    border-color: var(--primary);
  }

  .operations-checkboxes {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
  }

  .checkbox-label input[type="checkbox"] {
    width: auto;
    cursor: pointer;
  }

  .operation-name {
    flex: 1;
    color: var(--text-primary);
    font-size: 0.875rem;
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

