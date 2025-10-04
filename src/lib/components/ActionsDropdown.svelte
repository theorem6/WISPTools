<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import ConflictReportExport from './ConflictReportExport.svelte';
  import type { Cell, PCIConflict } from '../pciMapper';
  
  export let cells: Cell[] = [];
  export let conflicts: PCIConflict[] = [];
  export let recommendations: string[] = [];
  export let isOptimizing = false;
  export let hasData = false;
  export let hasConflicts = false;
  
  let showDropdown = false;
  let showExportModal = false;
  
  const dispatch = createEventDispatcher();
  
  function toggleDropdown() {
    showDropdown = !showDropdown;
  }
  
  function handleAction(action: string) {
    dispatch(action);
    showDropdown = false;
  }

  function openImportModal() {
    dispatch('openImport');
    showDropdown = false;
  }

  function openExportModal() {
    showExportModal = true;
    showDropdown = false;
  }
  
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.actions-dropdown')) {
      showDropdown = false;
    }
  }
  
  $: if (browser && showDropdown) {
    document.addEventListener('click', handleClickOutside);
  } else if (browser) {
    document.removeEventListener('click', handleClickOutside);
  }
  
  onDestroy(() => {
    if (browser) {
      document.removeEventListener('click', handleClickOutside);
    }
  });
</script>

<div class="actions-dropdown">
  <button class="action-trigger" on:click={toggleDropdown} title="Actions">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="5" r="1" fill="currentColor"></circle>
      <circle cx="12" cy="12" r="1" fill="currentColor"></circle>
      <circle cx="12" cy="19" r="1" fill="currentColor"></circle>
    </svg>
    <span class="action-label">Actions</span>
  </button>

  {#if showDropdown}
    <div class="dropdown-menu">
      <div class="dropdown-section">
        <div class="section-label">Data</div>
        <button class="dropdown-item" on:click={openImportModal}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Import Cells
        </button>
      </div>

      <div class="dropdown-divider"></div>

      <div class="dropdown-section">
        <div class="section-label">Analysis</div>
        <button class="dropdown-item primary" on:click={() => handleAction('runAnalysis')} disabled={!hasData}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          Run Analysis
        </button>
        <button 
          class="dropdown-item success" 
          on:click={() => handleAction('optimize')} 
          disabled={isOptimizing || !hasConflicts}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            {#if isOptimizing}
              <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
            {:else}
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6l4 2"></path>
            {/if}
          </svg>
          {isOptimizing ? 'Optimizing...' : 'Optimize PCIs'}
        </button>
      </div>

      <div class="dropdown-divider"></div>

      <div class="dropdown-section">
        <div class="section-label">Export</div>
        <button class="dropdown-item" on:click={openExportModal} disabled={!hasData}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Export & Configure
        </button>
      </div>
    </div>
  {/if}
</div>

<!-- Export Modal -->
{#if showExportModal}
  <div 
    class="export-modal-overlay" 
    role="presentation"
    on:click={() => showExportModal = false}
    on:keydown={(e) => e.key === 'Escape' && (showExportModal = false)}
  >
    <div 
      class="export-modal" 
      role="dialog"
      tabindex="-1"
      aria-labelledby="export-modal-title"
      on:click|stopPropagation
      on:keydown|stopPropagation
    >
      <div class="export-modal-header">
        <h3 id="export-modal-title">📤 Export & Configuration</h3>
        <button class="close-btn" on:click={() => showExportModal = false}>×</button>
      </div>
      <div class="export-modal-body">
        <ConflictReportExport {cells} {conflicts} {recommendations} />
      </div>
    </div>
  </div>
{/if}

<style>
  .actions-dropdown {
    position: relative;
  }

  .action-trigger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 40px;
    padding: 0 1rem;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    background: var(--card-bg);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all var(--transition);
  }

  .action-trigger:hover {
    background: var(--hover-bg);
    box-shadow: var(--shadow-sm);
  }

  .action-label {
    display: none;
  }

  @media (min-width: 640px) {
    .action-label {
      display: inline;
    }
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    min-width: 220px;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    box-shadow: var(--shadow-xl);
    padding: 0.5rem;
    z-index: var(--z-dropdown);
    animation: slideDown var(--transition-fast);
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .dropdown-section {
    padding: 0.25rem 0;
  }

  .section-label {
    padding: 0.5rem 0.75rem 0.25rem;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: none;
    border-radius: var(--border-radius);
    background: transparent;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    text-align: left;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .dropdown-item:hover:not(:disabled) {
    background: var(--hover-bg);
  }

  .dropdown-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dropdown-item.primary {
    color: var(--primary-color);
  }

  .dropdown-item.success {
    color: var(--success-color);
  }

  .dropdown-divider {
    height: 1px;
    background: var(--border-color);
    margin: 0.5rem 0;
  }

  /* Export Modal - Centered on screen */
  .export-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(8px);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: fadeIn var(--transition-fast);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .export-modal {
    background: var(--card-bg);
    border-radius: var(--border-radius-xl);
    max-width: 600px;
    width: 100%;
    max-height: 85vh;
    overflow: hidden;
    box-shadow: var(--shadow-2xl);
    border: 1px solid var(--border-color);
    animation: slideUp var(--transition);
    display: flex;
    flex-direction: column;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .export-modal-header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .export-modal-header h3 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition);
  }

  .close-btn:hover {
    background: var(--danger-light);
    color: var(--danger-color);
  }

  .export-modal-body {
    padding: 2rem;
    overflow-y: auto;
    max-height: calc(85vh - 80px);
  }
</style>

