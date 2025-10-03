<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  export let x = 0;
  export let y = 0;
  export let hasSelectedCell = false;
  export let cellId = '';
  
  const dispatch = createEventDispatcher();
  
  function handleAddSite() {
    dispatch('addSite');
  }
  
  function handleImport() {
    dispatch('import');
  }
  
  function handleEditSector() {
    dispatch('editSector');
  }
  
  function handleDeleteSector() {
    dispatch('deleteSector');
  }
  
  function handleEditTower() {
    dispatch('editTower');
  }
  
  function handleDeleteTower() {
    dispatch('deleteTower');
  }
  
  function handleClose() {
    dispatch('close');
  }
  
  function handleBackdropClick() {
    handleClose();
  }
</script>

{#if show}
  <!-- Invisible backdrop to close menu -->
  <div 
    class="context-backdrop" 
    role="presentation"
    on:click={handleBackdropClick}
    on:keydown={(e) => e.key === 'Escape' && handleBackdropClick()}
  ></div>
  
  <!-- Context menu -->
  <div class="context-menu" style="left: {x}px; top: {y}px;">
    {#if hasSelectedCell}
      <!-- Options for existing sector -->
      <div class="menu-header">
        <span class="menu-title">Sector: {cellId}</span>
      </div>
      
      <button class="menu-item" on:click={handleEditSector}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        Edit Sector
      </button>
      
      <button class="menu-item danger" on:click={handleDeleteSector}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        Delete Sector
      </button>
      
      <div class="menu-divider"></div>
    {/if}
    
    <!-- Always show add options -->
    <button class="menu-item primary" on:click={handleAddSite}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
        <line x1="12" y1="7" x2="12" y2="13"></line>
        <line x1="9" y1="10" x2="15" y2="10"></line>
      </svg>
      Add Cell Site Manually
    </button>
    
    <button class="menu-item" on:click={handleImport}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
      Import from CSV/KML
    </button>
  </div>
{/if}

<style>
  .context-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: transparent;
  }

  .context-menu {
    position: fixed;
    z-index: 9999;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-lg);
    min-width: 220px;
    padding: 0.5rem;
    animation: menuSlideIn 0.15s ease-out;
  }

  @keyframes menuSlideIn {
    from {
      opacity: 0;
      transform: translateY(-10px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .menu-header {
    padding: 0.625rem 0.875rem;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 0.5rem;
  }

  .menu-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 0.875rem;
    border: none;
    border-radius: var(--border-radius);
    background: transparent;
    color: var(--text-primary);
    font-size: 0.95rem;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition: all var(--transition);
  }

  .menu-item:hover {
    background: var(--hover-bg);
    color: var(--primary-color);
  }

  .menu-item svg {
    flex-shrink: 0;
  }

  .menu-item.primary {
    color: var(--primary-color);
    font-weight: 600;
  }

  .menu-item.primary:hover {
    background: var(--primary-light);
  }

  .menu-item.danger {
    color: var(--danger-color);
  }

  .menu-item.danger:hover {
    background: var(--danger-light);
  }

  .menu-divider {
    height: 1px;
    background: var(--border-color);
    margin: 0.5rem 0;
  }
</style>

