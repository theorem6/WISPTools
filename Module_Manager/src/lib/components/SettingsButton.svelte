<script lang="ts">
  import GlobalSettings from './GlobalSettings.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  
  let showSettings = false;
  
  // Check if we're on the dashboard
  $: isDashboard = $page.url.pathname === '/dashboard' || $page.url.pathname === '/';
  
  // Check if we're in a module (hide settings button in modules)
  $: isModule = (() => {
    const path = $page.url.pathname;
    return path.includes('/modules/') && path !== '/modules';
  })();
  
  // Only show on dashboard
  $: shouldShow = isDashboard && !isModule;
  
  function openSettings() {
    showSettings = true;
  }
  
  function closeSettings() {
    showSettings = false;
  }
  
  function openWizards() {
    goto('/wizards');
  }
  
  function openDocs() {
    goto('/docs');
  }
</script>

{#if shouldShow}
  <div class="header-buttons">
    <button 
      class="wizards-button" 
      class:dashboard-mode={isDashboard}
      on:click={openWizards} 
      title="Wizards"
      aria-label="Open wizards"
      type="button"
    >
      🧙
    </button>
    <button 
      class="docs-button"
      class:dashboard-mode={isDashboard}
      on:click={openDocs}
      title="Documentation"
      aria-label="Open documentation"
      type="button"
    >
      📖
    </button>
    <button 
      class="settings-button" 
      class:dashboard-mode={isDashboard}
      on:click={openSettings} 
      title="Settings"
      aria-label="Open settings"
      type="button"
    >
      ⚙️
    </button>
  </div>
{/if}

<GlobalSettings 
  bind:show={showSettings}
  on:close={closeSettings}
/>

<style>
  .header-buttons {
    position: fixed;
    top: 1.5rem;
    right: 2rem;
    bottom: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    z-index: 10002;
  }
  
  .wizards-button,
  .docs-button,
  .settings-button {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;
    font-size: 1.3rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .wizards-button {
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
    border: 2px solid rgba(0, 217, 255, 0.3);
    box-shadow: 0 4px 20px rgba(0, 217, 255, 0.4),
                0 0 20px rgba(0, 242, 254, 0.2);
  }
  
  .wizards-button:hover {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 25px rgba(0, 217, 255, 0.5),
                0 0 30px rgba(0, 242, 254, 0.3);
  }
  
  .docs-button {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    color: var(--text-primary);
  }
  
  .docs-button:hover {
    background: var(--primary-color);
    color: var(--text-inverse);
    border-color: var(--primary-color);
    transform: translateY(-2px);
  }
  
  .settings-button {
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
    border: 2px solid rgba(0, 217, 255, 0.3);
    box-shadow: 0 4px 20px rgba(0, 217, 255, 0.4),
                0 0 20px rgba(0, 242, 254, 0.2);
  }
  
  .settings-button:hover {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    transform: translateY(-2px) rotate(90deg);
    box-shadow: 0 6px 25px rgba(0, 217, 255, 0.5),
                0 0 30px rgba(0, 242, 254, 0.3);
    border-color: #00d9ff;
  }
  
  .wizards-button.dashboard-mode:hover {
    transform: translateY(-2px);
  }
  
  .settings-button:active,
  .wizards-button:active {
    transform: translateY(0);
  }
  
  .settings-button:active {
    transform: translateY(0) rotate(90deg);
  }
</style>

