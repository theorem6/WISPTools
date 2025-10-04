<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ThemeSwitcher from './ThemeSwitcher.svelte';
  
  const dispatch = createEventDispatcher();
  
  let isOpen = false;
  
  function toggleMenu() {
    isOpen = !isOpen;
  }
  
  function closeMenu() {
    isOpen = false;
  }
</script>

<div class="settings-menu">
  <button class="settings-trigger" on:click={toggleMenu} title="Settings">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  </button>
  
  {#if isOpen}
    <div class="settings-panel">
      <div class="settings-header">
        <h3>⚙️ Settings</h3>
        <button class="close-btn" on:click={closeMenu}>×</button>
      </div>
      
      <div class="settings-content">
        <div class="setting-item">
          <label>Theme</label>
          <ThemeSwitcher />
        </div>
        
        <div class="menu-divider"></div>
        
        <div class="setting-info">
          <p class="info-text">More settings coming soon...</p>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .settings-menu {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 200;
  }

  .settings-trigger {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: none;
    background: var(--primary-color);
    color: white;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .settings-trigger:hover {
    background: var(--button-primary-hover);
    transform: rotate(90deg) scale(1.05);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }

  .settings-panel {
    position: absolute;
    bottom: 70px;
    right: 0;
    width: 280px;
    background: var(--card-bg);
    backdrop-filter: blur(16px);
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border-color);
    animation: slideUp 0.2s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-color);
  }

  .settings-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 1.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--danger-light);
    color: var(--danger-color);
  }

  .settings-content {
    padding: 1rem 1.25rem;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
  }

  .setting-item label {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .menu-divider {
    height: 1px;
    background: var(--border-color);
    margin: 0.75rem 0;
  }

  .setting-info {
    text-align: center;
    padding: 0.5rem 0;
  }

  .info-text {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-tertiary);
    font-style: italic;
  }

  @media (max-width: 768px) {
    .settings-trigger {
      width: 48px;
      height: 48px;
    }

    .settings-panel {
      width: 260px;
    }
  }
</style>

