<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { BackhaulLink } from '../lib/models';
  import { objectStateManager, type ModuleContext } from '$lib/services/objectStateManager';
  
  export let show = false;
  export let backhaul: BackhaulLink | null = null;
  export let x = 0;
  export let y = 0;
  export let moduleContext: ModuleContext;
  
  const dispatch = createEventDispatcher();
  
  // Get object permissions
  $: objectPermissions = (() => {
    if (backhaul === null || backhaul === undefined) {
      return null;
    }
    
    if (!moduleContext) {
      return null;
    }
    
    const backhaulId = backhaul?.id;
    const hasValidId =
      backhaulId !== null &&
      backhaulId !== undefined &&
      String(backhaulId).trim() !== '';
    if (!hasValidId) {
      console.error('Backhaul object missing id property:', backhaul);
      return null;
    }
    
    if (typeof backhaul !== 'object' || Array.isArray(backhaul)) {
      console.error('Backhaul is not a valid object:', backhaul);
      return null;
    }
    
    try {
      const permissions = objectStateManager.getObjectPermissions(backhaul, moduleContext);
      return permissions;
    } catch (error) {
      console.error('Error getting object permissions:', error);
      return null;
    }
  })();
  
  function handleAction(action: string) {
    console.log('[BackhaulActionsMenu] handleAction called', { action, backhaul, hasBackhaul: !!backhaul });
    
    if (backhaul === null || backhaul === undefined) {
      console.error('[BackhaulActionsMenu] handleAction called without backhaul');
      return;
    }
    
    if (typeof backhaul !== 'object' || Array.isArray(backhaul)) {
      console.error('[BackhaulActionsMenu] handleAction called with invalid backhaul type:', typeof backhaul);
      return;
    }
    
    if (backhaul.id === null || backhaul.id === undefined) {
      console.error('[BackhaulActionsMenu] handleAction called with backhaul missing id', backhaul);
      return;
    }
    
    if (!moduleContext) {
      console.error('[BackhaulActionsMenu] handleAction called without moduleContext');
      return;
    }
    
    try {
      // In deploy mode, allow ALL actions for backhauls
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const urlDeployMode = urlParams?.get('deployMode') === 'true' || urlParams?.get('mode') === 'deploy';
      const contextDeployMode = moduleContext?.module === 'deploy';
      const isDeployMode = contextDeployMode || urlDeployMode;
      
      const isReadOnlyAction = ['view-backhaul-details', 'view-details', 'view'].includes(action);
      
      console.log('[BackhaulActionsMenu] 🔵🔵🔵 Permission check:', { 
        action, 
        contextDeployMode,
        urlDeployMode,
        isDeployMode,
        isReadOnlyAction, 
        moduleContextModule: moduleContext?.module,
        backhaulId: backhaul.id 
      });
      
      // ALWAYS allow actions in deploy mode - skip all permission checks
      if (isDeployMode) {
        console.log(`[BackhaulActionsMenu] ✅✅✅ Action '${action}' ALLOWED in deploy mode (skipping permission check)`);
      } else if (isReadOnlyAction) {
        console.log(`[BackhaulActionsMenu] ✅ Action '${action}' allowed (read-only)`);
      } else {
        // Only check permissions if NOT deploy mode and NOT read-only
        console.log(`[BackhaulActionsMenu] Checking permissions for '${action}' (not deploy mode)`);
        const isAllowed = objectStateManager.isActionAllowed(backhaul, action, moduleContext);
        if (!isAllowed) {
          console.warn(`[BackhaulActionsMenu] ❌ Action '${action}' not allowed for backhaul ${backhaul.id}`);
          return;
        }
        console.log(`[BackhaulActionsMenu] ✅ Action '${action}' allowed via permission check`);
      }
      
      console.log('[BackhaulActionsMenu] ✅✅✅ Dispatching action', { action, backhaulId: backhaul.id });
      dispatch('action', { action, backhaul });
      show = false;
    } catch (error) {
      console.error('[BackhaulActionsMenu] Error in handleAction:', error);
      // Even if permission check fails, try to dispatch in deploy mode
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const isDeployMode = moduleContext?.module === 'deploy' || urlParams?.get('deployMode') === 'true' || urlParams?.get('mode') === 'deploy';
      if (isDeployMode) {
        console.log('[BackhaulActionsMenu] ✅✅✅ Dispatching action anyway in deploy mode despite error');
        dispatch('action', { action, backhaul });
        show = false;
      }
    }
  }
  
  function handleClickOutside() {
    show = false;
  }
  
  function isActionDisabled(action: string): boolean {
    if (!backhaul) {
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

<svelte:window on:click={handleClickOutside} />

{#if show && backhaul}
<div 
  class="backhaul-menu" 
  style="left: {x}px; top: {y}px"
  on:click={(e) => e.stopPropagation()}
>
  <div class="menu-header">
    <span class="backhaul-name">🔗 {backhaul?.name || 'Unknown Backhaul'}</span>
    <span class="backhaul-type">{backhaul?.backhaulType || 'Unknown'}</span>
    {#if objectPermissions?.isReadOnly}
      <span class="readonly-indicator">🔒</span>
    {/if}
  </div>
  
  <button 
    class="menu-item" 
    class:disabled={isActionDisabled('add-backhaul')}
    on:click={() => handleAction('add-backhaul')}
  >
    <span class="menu-icon">➕</span>
    <span>Add Backhaul</span>
  </button>
  
  <button 
    class="menu-item" 
    class:disabled={isActionDisabled('edit-backhaul')}
    on:click={() => handleAction('edit-backhaul')}
  >
    <span class="menu-icon">✏️</span>
    <span>Edit Backhaul</span>
  </button>
  
  <div class="menu-divider"></div>
  
  <button 
    class="menu-item danger" 
    class:disabled={isActionDisabled('delete-backhaul')}
    on:click={() => handleAction('delete-backhaul')}
  >
    <span class="menu-icon">🗑️</span>
    <span>Delete Backhaul</span>
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
  .backhaul-menu {
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
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .backhaul-name {
    font-weight: 600;
    font-size: 1rem;
  }
  
  .backhaul-type {
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
    .backhaul-menu {
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

