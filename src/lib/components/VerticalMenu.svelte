<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ThemeSwitcher from './ThemeSwitcher.svelte';
  import UserProfile from './UserProfile.svelte';
  
  export let hasData = false;
  export let hasConflicts = false;
  
  const dispatch = createEventDispatcher();
  
  let isExpanded = false;
  
  function toggleMenu() {
    isExpanded = !isExpanded;
  }
</script>

<div class="vertical-menu" class:expanded={isExpanded}>
  <button class="menu-toggle" on:click={toggleMenu} title={isExpanded ? 'Collapse menu' : 'Expand menu'}>
    {#if isExpanded}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    {:else}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    {/if}
  </button>
  
  <div class="menu-items">
    <button class="menu-item" on:click={() => dispatch('import')} title="Import cell data">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span class="menu-label">Import</span>
    </button>
    
    <button class="menu-item" on:click={() => dispatch('towers')} title="Manage towers and cell sites">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
        <polyline points="2 17 12 22 22 17"></polyline>
        <polyline points="2 12 12 17 22 12"></polyline>
      </svg>
      <span class="menu-label">Towers</span>
    </button>
    
    <div class="menu-divider"></div>
    
    <button class="menu-item" on:click={() => dispatch('analyze')} disabled={!hasData} title="Run PCI analysis">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
      </svg>
      <span class="menu-label">Analyze</span>
    </button>
    
    <button class="menu-item" on:click={() => dispatch('optimize')} disabled={!hasConflicts} title="Optimize PCI assignments">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 6v6l4 2"></path>
      </svg>
      <span class="menu-label">Optimize</span>
    </button>
    
    <div class="menu-divider"></div>
    
    <button class="menu-item" on:click={() => dispatch('analysis')} title="View detailed analysis">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
      </svg>
      <span class="menu-label">Analysis</span>
    </button>
    
    <button class="menu-item" on:click={() => dispatch('conflicts')} title="View PCI conflicts">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
      <span class="menu-label">Conflicts</span>
    </button>
    
    <button class="menu-item" on:click={() => dispatch('recommendations')} title="AI recommendations">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
      <span class="menu-label">AI Suggest</span>
    </button>
    
    <button class="menu-item" on:click={() => dispatch('export')} disabled={!hasData} title="Export reports and configurations">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
      <span class="menu-label">Export</span>
    </button>
    
    <div class="menu-divider"></div>
    
    <div class="menu-item-wrapper">
      <ThemeSwitcher />
    </div>
    
    <div class="menu-item-wrapper">
      <UserProfile on:networks={() => dispatch('networks')} />
    </div>
  </div>
</div>

<style>
  .vertical-menu {
    position: fixed;
    top: 240px;
    left: 20px;
    z-index: 150;
    background: var(--card-bg);
    backdrop-filter: blur(16px);
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-color);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow-y: auto;
    max-height: calc(100vh - 260px);
  }

  .menu-toggle {
    width: 100%;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--primary-color);
    color: white;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .menu-toggle:hover {
    background: var(--button-primary-hover);
  }

  .menu-items {
    display: flex;
    flex-direction: column;
    padding: 0.35rem;
    gap: 0.15rem;
  }

  .vertical-menu:not(.expanded) .menu-items {
    display: none;
  }

  .vertical-menu.expanded {
    width: 180px;
  }

  .vertical-menu:not(.expanded) {
    width: 44px;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.6rem 0.65rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .menu-item:hover:not(:disabled) {
    background: var(--hover-bg);
    color: var(--primary-color);
  }

  .menu-item:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .menu-item svg {
    flex-shrink: 0;
    stroke-width: 2;
  }

  .menu-label {
    white-space: nowrap;
  }

  .menu-divider {
    height: 1px;
    background: var(--border-color);
    margin: 0.35rem 0;
  }

  .menu-item-wrapper {
    display: flex;
    justify-content: center;
    padding: 0.15rem 0;
  }

  .menu-item-wrapper :global(button),
  .menu-item-wrapper :global(.icon-btn) {
    width: 32px !important;
    height: 32px !important;
    min-width: 32px;
  }

  @media (max-width: 768px) {
    .vertical-menu {
      top: 180px;
      left: 10px;
    }

    .vertical-menu.expanded {
      width: 200px;
    }
  }
</style>

