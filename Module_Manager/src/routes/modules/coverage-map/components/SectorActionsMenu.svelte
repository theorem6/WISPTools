<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Sector } from '../lib/models';
  import { objectStateManager, type ModuleContext } from '$lib/services/objectStateManager';
  
  export let show = false;
  export let sector: Sector | null = null;
  export let x = 0;
  export let y = 0;
  export let moduleContext: ModuleContext;
  
  const dispatch = createEventDispatcher();
  
  // Get object permissions
  $: objectPermissions = (() => {
    if (sector === null || sector === undefined) {
      return null;
    }
    
    if (!moduleContext) {
      return null;
    }
    
    const sectorId = sector?.id;
    const hasValidId =
      sectorId !== null &&
      sectorId !== undefined &&
      String(sectorId).trim() !== '';
    if (!hasValidId) {
      console.error('Sector object missing id property:', sector);
      return null;
    }
    
    if (typeof sector !== 'object' || Array.isArray(sector)) {
      console.error('Sector is not a valid object:', sector);
      return null;
    }
    
    try {
      const permissions = objectStateManager.getObjectPermissions(sector, moduleContext);
      return permissions;
    } catch (error) {
      console.error('Error getting object permissions:', error);
      return null;
    }
  })();
  
  function handleAction(action: string) {
    console.log('[SectorActionsMenu] handleAction called', { action, sector, hasSector: !!sector });
    
    if (sector === null || sector === undefined) {
      console.error('[SectorActionsMenu] handleAction called without sector');
      return;
    }
    
    if (typeof sector !== 'object' || Array.isArray(sector)) {
      console.error('[SectorActionsMenu] handleAction called with invalid sector type:', typeof sector);
      return;
    }
    
    if (sector.id === null || sector.id === undefined) {
      console.error('[SectorActionsMenu] handleAction called with sector missing id', sector);
      return;
    }
    
    if (!moduleContext) {
      console.error('[SectorActionsMenu] handleAction called without moduleContext');
      return;
    }
    
    try {
      // In deploy mode, allow edit and view actions for sectors (they're production assets)
      const isDeployMode = moduleContext?.module === 'deploy';
      const isReadOnlyAction = ['view-sector-details', 'view-details', 'view'].includes(action);
      
      // Always allow read-only actions, and in deploy mode allow edit actions too
      if (!isReadOnlyAction && !isDeployMode) {
        const isAllowed = objectStateManager.isActionAllowed(sector, action, moduleContext);
        if (!isAllowed) {
          console.warn(`[SectorActionsMenu] Action '${action}' not allowed for sector ${sector.id}`);
          return;
        }
      } else {
        console.log(`[SectorActionsMenu] Action '${action}' allowed (${isDeployMode ? 'deploy mode' : 'read-only'})`);
      }
      
      console.log('[SectorActionsMenu] Dispatching action', { action, sectorId: sector.id });
      dispatch('action', { action, sector });
      show = false;
    } catch (error) {
      console.error('[SectorActionsMenu] Error in handleAction:', error);
      // Even if permission check fails, try to dispatch in deploy mode
      if (moduleContext?.module === 'deploy') {
        console.log('[SectorActionsMenu] Dispatching action anyway in deploy mode despite error');
        dispatch('action', { action, sector });
        show = false;
      }
    }
  }
  
  function handleClickOutside() {
    show = false;
  }
  
  function isActionDisabled(action: string): boolean {
    if (!sector) {
      return false;
    }
    
    if (!objectPermissions) {
      return false;
    }
    
    if (!objectPermissions.restrictedActions) {
      return false;
    }
    
    try {
      return objectPermissions.restrictedActions.includes(action);
    } catch (error) {
      console.error('Error in isActionDisabled:', error);
      return false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

{#if show && sector}
<div 
  class="sector-menu" 
  style="left: {x}px; top: {y}px"
  onclick={(e) => e.stopPropagation()}
>
  <div class="menu-header">
    <span class="sector-name">📶 {sector?.name || 'Unknown Sector'}</span>
    <span class="sector-type">{sector?.technology || 'Unknown'}</span>
    {#if objectPermissions?.isReadOnly}
      <span class="readonly-indicator">🔒</span>
    {/if}
  </div>
  
  <button 
    class="menu-item" 
    class:disabled={isActionDisabled('edit-sector')}
    onclick={() => handleAction('edit-sector')}
  >
    <span class="menu-icon">✏️</span>
    <span>Edit Sector</span>
  </button>
  
  <button 
    class="menu-item" 
    onclick={() => handleAction('view-sector-details')}
  >
    <span class="menu-icon">👁️</span>
    <span>View Details</span>
  </button>
  
  <div class="menu-divider"></div>
  
  <button 
    class="menu-item danger" 
    class:disabled={isActionDisabled('delete-sector')}
    onclick={() => handleAction('delete-sector')}
  >
    <span class="menu-icon">🗑️</span>
    <span>Delete Sector</span>
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
  .sector-menu {
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
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .sector-name {
    font-weight: 600;
    font-size: 1rem;
  }
  
  .sector-type {
    font-size: 0.85rem;
    opacity: 0.9;
    text-transform: uppercase;
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
  
  @media (max-width: 768px) {
    .sector-menu {
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
  }
</style>

