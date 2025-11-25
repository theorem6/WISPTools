<script lang="ts">
  import GlobalSettings from './GlobalSettings.svelte';
  import { page } from '$app/stores';
  
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
</script>

{#if shouldShow}
  <button 
    class="settings-button" 
    class:dashboard-mode={isDashboard}
    on:click={openSettings} 
    title="Settings"
  >
    ⚙️
  </button>
{/if}

<GlobalSettings 
  bind:show={showSettings}
  on:close={closeSettings}
/>

<style>
  .settings-button {
    position: fixed;
    bottom: 8.5rem;
    right: 2rem;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--primary, #3b82f6);
    color: white;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 
                0 8px 24px rgba(59, 130, 246, 0.3);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 10002;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  /* Dashboard mode - top right, matching page colors */
  .settings-button.dashboard-mode {
    top: 1.5rem;
    right: 2rem;
    bottom: auto;
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
    border: 2px solid rgba(0, 217, 255, 0.3);
    box-shadow: 0 4px 20px rgba(0, 217, 255, 0.4),
                0 0 20px rgba(0, 242, 254, 0.2);
    font-size: 1.3rem;
  }
  
  .settings-button.dashboard-mode:hover {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    transform: translateY(-2px) rotate(90deg);
    box-shadow: 0 6px 25px rgba(0, 217, 255, 0.5),
                0 0 30px rgba(0, 242, 254, 0.3);
    border-color: #00d9ff;
  }
  
  .settings-button.dashboard-mode:active {
    transform: translateY(0) rotate(90deg);
  }
  
  .settings-button:hover {
    background: var(--primary-dark, #2563eb);
    transform: translateY(-2px) rotate(90deg);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2), 
                0 12px 32px rgba(59, 130, 246, 0.4);
  }
  
  .settings-button:active {
    transform: translateY(0) rotate(90deg);
  }
</style>

