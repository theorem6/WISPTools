<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { authStore, currentUser, isAuthenticated } from '../stores/authStore';
  import { authService } from '../services/authService';
  import { networkStore } from '../stores/networkStore';
  import { resetAllStores } from '../stores/appState';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  
  export let hasData = false;
  export let hasConflicts = false;
  
  const dispatch = createEventDispatcher();
  
  async function handleLogout() {
    // Clear all app state before signing out
    resetAllStores();
    networkStore.clear();
    
    // Clear browser storage (except theme preference)
    if (browser) {
      const theme = localStorage.getItem('theme');
      sessionStorage.clear();
      localStorage.clear();
      if (theme) {
        localStorage.setItem('theme', theme);
      }
    }
    
    // Sign out from Firebase
    await authService.signOut();
    
    // Redirect to login
    goto('/login');
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
    <!-- Logout Button at Top -->
    {#if $isAuthenticated && $currentUser}
      <button class="logout-button" on:click={handleLogout} title="Sign out">
        <div class="user-info">
          <span class="user-name">{getUserName()}</span>
          <span class="user-email">{$currentUser.email}</span>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
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
    top: 173px;
    left: 20px;
    width: 180px;
    z-index: 150;
    background: var(--card-bg);
    backdrop-filter: blur(16px);
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-color);
    overflow-y: auto;
    max-height: calc(100vh - 193px);
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
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--danger-light);
    border: 1px solid var(--danger-color);
    border-radius: 8px;
    color: var(--danger-color);
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 0.5rem;
  }

  .logout-button:hover {
    background: var(--danger-color);
    color: white;
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
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .user-email {
    font-size: 0.65rem;
    opacity: 0.8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .logout-button svg {
    flex-shrink: 0;
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

  @media (max-width: 768px) {
    .vertical-menu {
      top: 163px;
      left: 10px;
      width: 160px;
    }
  }
</style>

