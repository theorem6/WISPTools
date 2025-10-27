<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { TowerSite } from '../lib/models';
  import { objectStateManager, type ModuleContext } from '$lib/services/objectStateManager';
  
  export let show = false;
  export let tower: TowerSite | null = null;
  export let x = 0;
  export let y = 0;
  export let moduleContext: ModuleContext = { module: 'coverage-map', userRole: 'admin' };
  
  const dispatch = createEventDispatcher();
  
  // Get object permissions
  $: objectPermissions = tower ? objectStateManager.getObjectPermissions(tower, moduleContext) : null;
  
  function handleAction(action: string) {
    if (!tower) return;
    
    // Check if action is allowed
    if (!objectStateManager.isActionAllowed(tower, action, moduleContext)) {
      console.warn(`Action '${action}' not allowed for tower ${tower.id}`);
      return;
    }
    
    dispatch('action', { action, tower });
    show = false;
  }
  
  function handleClickOutside() {
    show = false;
  }
  
  // Check if action should be disabled
  function isActionDisabled(action: string): boolean {
    if (!tower || !objectPermissions) return false;
    return objectPermissions.restrictedActions.includes(action);
  }
</script>

<svelte:window on:click={handleClickOutside} />

{#if show && tower}
<div 
  class="tower-menu" 
  style="left: {x}px; top: {y}px"
  on:click|stopPropagation
>
  <div class="menu-header">
    <span class="tower-name">📡 {tower.name}</span>
    <span class="tower-type">{tower.type}</span>
    {#if objectPermissions?.isReadOnly}
      <span class="readonly-indicator">🔒</span>
    {/if}
  </div>
  
  <button 
    class="menu-item" 
    class:disabled={isActionDisabled('edit-site')}
    on:click={() => handleAction('edit-site')}
  >
    <span class="menu-icon">✏️</span>
    <span>Edit Tower Site</span>
  </button>
  
  <button 
    class="menu-item" 
    class:disabled={isActionDisabled('add-sector')}
    on:click={() => handleAction('add-sector')}
  >
    <span class="menu-icon">📶</span>
    <span>Add Sector</span>
  </button>
  
  <button 
    class="menu-item" 
    class:disabled={isActionDisabled('add-backhaul')}
    on:click={() => handleAction('add-backhaul')}
  >
    <span class="menu-icon">🔗</span>
    <span>Add Backhaul Link</span>
  </button>
  
  <button 
    class="menu-item" 
    class:disabled={isActionDisabled('add-inventory')}
    on:click={() => handleAction('add-inventory')}
  >
    <span class="menu-icon">📦</span>
    <span>Add Equipment Inventory</span>
  </button>
  
  <button class="menu-item" on:click={() => handleAction('view-inventory')}>
    <span class="menu-icon">📋</span>
    <span>View All Equipment</span>
  </button>
  
  <div class="menu-divider"></div>
  
  <!-- HSS/EPC Deployment Options -->
  <button 
    class="menu-item epc-option" 
    class:disabled={isActionDisabled('deploy-epc')}
    on:click={() => handleAction('deploy-epc')}
  >
    <span class="menu-icon">🚀</span>
    <span>Deploy EPC</span>
  </button>
  
  <button 
    class="menu-item epc-option" 
    class:disabled={isActionDisabled('register-hss')}
    on:click={() => handleAction('register-hss')}
  >
    <span class="menu-icon">🏠</span>
    <span>Register with HSS</span>
  </button>
  
  <div class="menu-divider"></div>
  
  <button class="menu-item" on:click={() => handleAction('view-details')}>
    <span class="menu-icon">ℹ️</span>
    <span>View Details</span>
  </button>
  
  <button 
    class="menu-item danger" 
    class:disabled={isActionDisabled('delete-site')}
    on:click={() => handleAction('delete-site')}
  >
    <span class="menu-icon">🗑️</span>
    <span>Delete Site</span>
  </button>
  
  <!-- Show object state info -->
  {#if objectPermissions}
    <div class="menu-divider"></div>
    <div class="object-state-info">
      <div class="state-item">
        <span class="state-label">Status:</span>
        <span class="state-value">{objectPermissions.status}</span>
      </div>
      <div class="state-item">
        <span class="state-label">Source:</span>
        <span class="state-value">{objectPermissions.source}</span>
      </div>
      {#if objectPermissions.projectId}
        <div class="state-item">
          <span class="state-label">Project:</span>
          <span class="state-value">{objectPermissions.projectId}</span>
        </div>
      {/if}
    </div>
  {/if}
</div>
{/if}

<style>
  .tower-menu {
    position: fixed;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    min-width: 280px;
    z-index: 2000;
    overflow: hidden;
  }
  
  .menu-header {
    padding: 1rem;
    background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%);
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .tower-name {
    font-weight: 600;
    font-size: 1rem;
  }
  
  .tower-type {
    font-size: 0.85rem;
    opacity: 0.9;
    text-transform: capitalize;
  }
  
  .menu-item {
    width: 100%;
    padding: 0.875rem 1rem;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-primary);
    transition: background 0.2s;
    font-size: 0.95rem;
  }
  
  .menu-item:hover {
    background: var(--bg-hover);
  }
  
  .menu-item.danger {
    color: #ef4444;
  }
  
  .menu-item.danger:hover {
    background: rgba(239, 68, 68, 0.1);
  }
  
  .menu-item.epc-option {
    color: var(--brand-primary);
    font-weight: 500;
  }
  
  .menu-item.epc-option:hover {
    background: rgba(124, 58, 237, 0.1);
  }
  
  .menu-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    color: var(--text-muted);
  }
  
  .menu-item.disabled:hover {
    background: none;
  }
  
  .readonly-indicator {
    font-size: 0.8rem;
    opacity: 0.8;
  }
  
  .object-state-info {
    padding: 0.75rem 1rem;
    background: var(--bg-subtle);
    font-size: 0.85rem;
  }
  
  .state-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.25rem;
  }
  
  .state-item:last-child {
    margin-bottom: 0;
  }
  
  .state-label {
    color: var(--text-muted);
    font-weight: 500;
  }
  
  .state-value {
    color: var(--text-primary);
    text-transform: capitalize;
  }
  
  .menu-icon {
    font-size: 1.25rem;
    width: 24px;
    text-align: center;
  }
  
  .menu-divider {
    height: 1px;
    background: var(--border-color);
    margin: 0.25rem 0;
  }
</style>

