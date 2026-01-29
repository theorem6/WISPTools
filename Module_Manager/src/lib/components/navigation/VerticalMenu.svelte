<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { authStore, currentUser, isAuthenticated } from '../../stores/authStore';
  import { authService } from '../../services/authService';
  import { networkStore, currentNetwork } from '../../stores/networkStore';
  import { resetAllStores } from '../../stores/appState';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import ModuleWizardMenu from '../wizards/ModuleWizardMenu.svelte';
  
  export let hasData = false;
  export let hasConflicts = false;
  export let wizardItems: Array<{ id: string; label: string; icon?: string }> = [];
  
  const dispatch = createEventDispatcher();
  
  async function handleBackToDashboard() {
    // Clear PCI module state but keep user logged in
    resetAllStores();
    networkStore.clear();
    
    // Return to Module Manager dashboard (user stays logged in)
    goto('/dashboard');
  }
  
  function getUserName(): string {
    if ($currentUser?.displayName) {
      return $currentUser.displayName;
    }
    if ($currentUser?.email) {
      return $currentUser.email.split('@')[0];
    }
    return 'User';
  }
</script>

<div class="vertical-menu">
  <div class="menu-items">
    <!-- Back to Dashboard Button at Top -->
    {#if $isAuthenticated && $currentUser}
      <button class="logout-button back-button" on:click={handleBackToDashboard} title="Back to Module Manager">
        <div class="user-info">
          <span class="user-name">{getUserName()}</span>
          <span class="user-email">{$currentUser.email}</span>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </button>
    {/if}
    
    <div class="menu-divider"></div>
    
    <!-- Network Selector -->
    {#if $currentNetwork}
      <button class="network-selector" on:click={() => dispatch('networks')} title="Change network">
        <div class="network-info">
          <span class="network-name-menu">{$currentNetwork.name}</span>
          <span class="network-market-menu">{$currentNetwork.market}</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    {:else}
      <button class="network-selector empty" on:click={() => dispatch('networks')} title="Select network">
        <span>Select Network</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    {/if}
    
    <div class="menu-divider"></div>
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
    
    {#if wizardItems.length > 0}
      <div class="menu-wizards">
        <ModuleWizardMenu
          wizards={wizardItems}
          disabled={!hasData}
          on:select={(e) => dispatch('wizard', e.detail)}
        />
      </div>
    {:else}
      <button class="menu-item" on:click={() => dispatch('wizard')} disabled={!hasData} title="Conflict Resolution Wizard">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
          <polyline points="2 17 12 22 22 17"></polyline>
        </svg>
        <span class="menu-label">Conflict Wizard</span>
      </button>
    {/if}
    
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
    
  </div>
</div>

<style>
  .vertical-menu {
    position: fixed;
    top: 90px;
    left: 20px;
    width: 180px;
    z-index: 200;
    background: var(--card-bg);
    backdrop-filter: blur(16px);
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-color);
    overflow-y: auto;
    max-height: calc(100vh - 110px);
    box-sizing: border-box;
    pointer-events: auto;
  }

  .menu-items {
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    gap: 0.15rem;
  }

  .logout-button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    padding: 0.6rem 0.65rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 0.5rem;
    text-align: left;
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .logout-button:hover {
    background: var(--primary-light);
    color: var(--primary-color);
  }
  
  .back-button:hover {
    background: var(--primary-light);
    color: var(--primary-color);
  }

  .user-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
    flex: 1;
    min-width: 0;
  }

  .user-name {
    font-size: 0.8125rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .user-email {
    font-size: 0.65rem;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .logout-button svg {
    flex-shrink: 0;
    stroke-width: 2;
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

  .menu-wizards {
    width: 100%;
    margin-bottom: 0.25rem;
  }

  .menu-wizards :global(.module-wizard-menu) {
    width: 100%;
  }

  .menu-wizards :global(.wizard-trigger) {
    width: 100%;
    justify-content: flex-start;
  }

  .network-selector {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.65rem;
    background: var(--primary-light);
    border: 1px solid var(--primary-color);
    border-radius: 6px;
    color: var(--primary-color);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.8125rem;
  }

  .network-selector:hover {
    background: var(--primary-color);
    color: white;
  }

  .network-selector.empty {
    background: var(--bg-secondary);
    border-color: var(--border-color);
    color: var(--text-secondary);
    font-style: italic;
  }

  .network-selector.empty:hover {
    background: var(--hover-bg);
    color: var(--primary-color);
  }

  .network-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
    flex: 1;
    min-width: 0;
  }

  .network-name-menu {
    font-size: 0.8125rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .network-market-menu {
    font-size: 0.65rem;
    opacity: 0.8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .network-selector .chevron {
    flex-shrink: 0;
    transition: transform 0.2s;
  }

  .network-selector:hover .chevron {
    transform: translateY(2px);
  }

  @media (max-width: 768px) {
    .vertical-menu {
      top: 130px;
      left: 10px;
      width: 160px;
      box-sizing: border-box;
    }
  }
</style>

