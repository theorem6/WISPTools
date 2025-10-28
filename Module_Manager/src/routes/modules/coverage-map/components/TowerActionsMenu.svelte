<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { TowerSite } from '../lib/models';
  import { objectStateManager, type ModuleContext } from '$lib/services/objectStateManager';
  
  export let show = false;
  export let tower: TowerSite | null = null;
  export let x = 0;
  export let y = 0;
  export let moduleContext: ModuleContext;
  
  const dispatch = createEventDispatcher();
  
  // Get object permissions
  $: objectPermissions = (() => {
    // Early return if tower or moduleContext is null
    if (!tower) {
      return null;
    }
    if (!moduleContext) {
      return null;
    }
    
    // Additional check for tower.id
    if (!tower.id) {
      console.error('Tower object missing id property');
      return null;
    }
    
    try {
      return objectStateManager.getObjectPermissions(tower, moduleContext);
    } catch (error) {
      console.error('Error getting object permissions:', error);
      return null;
    }
  })();
  
  function handleAction(action: string) {
    // Guard: ensure tower exists
    if (!tower) {
      console.error('handleAction called without tower');
      return;
    }
    
    // Check if action is allowed
    try {
      if (!objectStateManager.isActionAllowed(tower, action, moduleContext)) {
        console.warn(`Action '${action}' not allowed for tower ${tower.id}`);
        return;
      }
      
      dispatch('action', { action, tower });
      show = false;
    } catch (error) {
      console.error('Error in handleAction:', error);
    }
  }
  
  function handleClickOutside() {
    show = false;
  }
  
  // Check if action should be disabled
  function isActionDisabled(action: string): boolean {
    try {
      if (!tower) return false;
      if (!objectPermissions) return false;
      return objectPermissions.restrictedActions.includes(action);
    } catch (error) {
      console.error('Error in isActionDisabled:', error);
      return false;
    }
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
  
  <!-- Hardware Deployment -->
  <button 
    class="menu-item epc-option" 
    class:disabled={isActionDisabled('deploy-hardware')}
    on:click={() => handleAction('deploy-hardware')}
  >
    <span class="menu-icon">🔧</span>
    <span>Deploy Hardware</span>
  </button>
  
  <button 
    class="menu-item" 
    class:disabled={isActionDisabled('change-site-type')}
    on:click={() => handleAction('change-site-type')}
  >
    <span class="menu-icon">🔄</span>
    <span>Change Site Type</span>
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
    max-width: 90vw;
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
    min-height: 44px;
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
  
  /* Mobile-specific styles */
  @media (max-width: 768px) {
    .tower-menu {
      min-width: 260px;
      max-width: calc(100vw - 2rem);
      max-height: 80vh;
      overflow-y: auto;
    }
    
    .menu-header {
      padding: 1rem;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    
    .menu-item {
      min-height: 48px;
      padding: 1rem;
      font-size: 1rem;
    }
    
    .menu-icon {
      font-size: 1.5rem;
      width: 28px;
    }
    
    .tower-name {
      font-size: 1.1rem;
    }
    
    .tower-type {
      font-size: 0.9rem;
    }
    
    .object-state-info {
      padding: 1rem;
      font-size: 0.9rem;
    }
  }
</style>

