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
  
  // Get object permissions - with comprehensive null safety
  $: objectPermissions = (() => {
    // Early return if tower is null or undefined
    if (tower === null || tower === undefined) {
      return null;
    }
    
    // Check if moduleContext exists
    if (!moduleContext) {
      return null;
    }
    
    // Additional check for tower.id - but safely
    const towerId = tower?.id;
    // Check if id is missing or empty (while allowing legitimate falsy values like 0 or '0')
    const hasValidId =
      towerId !== null &&
      towerId !== undefined &&
      String(towerId).trim() !== '';
    if (!hasValidId) {
      console.error('Tower object missing id property:', tower);
      return null;
    }
    
    // Final validation that tower is fully initialized
    if (typeof tower !== 'object' || Array.isArray(tower)) {
      console.error('Tower is not a valid object:', tower);
      return null;
    }
    
    try {
      const permissions = objectStateManager.getObjectPermissions(tower, moduleContext);
      return permissions;
    } catch (error) {
      console.error('Error getting object permissions:', error);
      return null;
    }
  })();
  
  function handleAction(action: string) {
    console.log('[TowerActionsMenu] handleAction called', { action, tower, hasTower: !!tower });
    
    // Guard: ensure tower exists and has required properties
    if (tower === null || tower === undefined) {
      console.error('[TowerActionsMenu] handleAction called without tower');
      return;
    }
    
    // Guard: ensure tower is an object
    if (typeof tower !== 'object' || Array.isArray(tower)) {
      console.error('[TowerActionsMenu] handleAction called with invalid tower type:', typeof tower);
      return;
    }
    
    // Guard: ensure tower has an id
    if (tower.id === null || tower.id === undefined) {
      console.error('[TowerActionsMenu] handleAction called with tower missing id', tower);
      return;
    }
    
    // Guard: ensure moduleContext exists
    if (!moduleContext) {
      console.error('[TowerActionsMenu] handleAction called without moduleContext');
      return;
    }
    
    // Check if action is allowed
    try {
      const isAllowed = objectStateManager.isActionAllowed(tower, action, moduleContext);
      if (!isAllowed) {
        console.warn(`[TowerActionsMenu] Action '${action}' not allowed for tower ${tower.id}`);
        return;
      }
      
      // Safely dispatch the action with the tower
      console.log('[TowerActionsMenu] Dispatching action', { action, towerId: tower.id });
      dispatch('action', { action, tower });
      show = false;
    } catch (error) {
      console.error('[TowerActionsMenu] Error in handleAction:', error);
    }
  }
  
  function handleClickOutside() {
    show = false;
  }
  
  // Check if action should be disabled
  function isActionDisabled(action: string): boolean {
    // Early returns for safety
    if (!tower) {
      return false; // Can't be disabled if no tower
    }
    
    if (!objectPermissions) {
      return false; // Can't be disabled if no permissions loaded
    }
    
    // Check if action is restricted
    if (!objectPermissions.restrictedActions) {
      return false; // No restrictions defined
    }
    
    try {
      return objectPermissions.restrictedActions.includes(action);
    } catch (error) {
      console.error('Error in isActionDisabled:', error);
      return false; // Default to enabled on error
    }
  }

  // Get formatted site type name for menu labels
  function getSiteTypeLabel(siteType: string | undefined | null): string {
    // Handle null, undefined, or empty string
    if (!siteType || typeof siteType !== 'string') return 'Tower';
    
    const normalizedType = siteType.toLowerCase().trim();
    const typeMap: Record<string, string> = {
      'tower': 'Tower',
      'noc': 'NOC',
      'warehouse': 'Warehouse',
      'building': 'Building',
      'pole': 'Pole',
      'internet-access': 'Internet Access',
      'internet': 'Internet',
      'other': 'Site'
    };
    
    return typeMap[normalizedType] || siteType.charAt(0).toUpperCase() + siteType.slice(1);
  }
  
  // Reactive label that updates when tower changes
  $: siteTypeLabel = getSiteTypeLabel(tower?.type);
</script>

<svelte:window onclick={handleClickOutside} />

{#if show && tower}
<div 
  class="tower-menu" 
  style="left: {x}px; top: {y}px"
  onclick={(e) => e.stopPropagation()}
>
  <div class="menu-header">
    <span class="tower-name">📡 {tower?.name || 'Unknown Site'}</span>
    <span class="tower-type">{tower?.type || 'tower'}</span>
    {#if objectPermissions?.isReadOnly}
      <span class="readonly-indicator">🔒</span>
    {/if}
  </div>
  
  <button 
    class="menu-item" 
    class:disabled={isActionDisabled('edit-site')}
    onclick={() => handleAction('edit-site')}
  >
    <span class="menu-icon">✏️</span>
    <span>Edit {siteTypeLabel}</span>
  </button>
  
  <button 
    class="menu-item" 
    class:disabled={isActionDisabled('add-sector')}
    onclick={() => handleAction('add-sector')}
  >
    <span class="menu-icon">📶</span>
    <span>Add Sector</span>
  </button>
  
  <button 
    class="menu-item" 
    class:disabled={isActionDisabled('add-backhaul')}
    onclick={() => handleAction('add-backhaul')}
  >
    <span class="menu-icon">🔗</span>
    <span>Add Backhaul Link</span>
  </button>
  
  <button 
    class="menu-item" 
    class:disabled={isActionDisabled('add-inventory')}
    onclick={() => handleAction('add-inventory')}
  >
    <span class="menu-icon">📦</span>
    <span>Add Equipment Inventory</span>
  </button>
  
  <button class="menu-item" onclick={() => handleAction('view-inventory')}>
    <span class="menu-icon">📋</span>
    <span>View All Equipment</span>
  </button>
  
  <div class="menu-divider"></div>
  
  <!-- Hardware Deployment -->
  <button 
    class="menu-item epc-option" 
    class:disabled={isActionDisabled('deploy-hardware')}
    onclick={() => handleAction('deploy-hardware')}
  >
    <span class="menu-icon">🔧</span>
    <span>Deploy Hardware</span>
  </button>
  
  <button 
    class="menu-item" 
    class:disabled={isActionDisabled('change-site-type')}
    onclick={() => handleAction('change-site-type')}
  >
    <span class="menu-icon">🔄</span>
    <span>Change Site Type</span>
  </button>
  
  <div class="menu-divider"></div>
  
  <button 
    class="menu-item danger" 
    class:disabled={isActionDisabled('delete-site')}
    onclick={() => handleAction('delete-site')}
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

