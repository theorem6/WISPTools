<script lang="ts">
  import GlobalSettings from './GlobalSettings.svelte';
  
  let showSettings = false;
  
  function openSettings() {
    showSettings = true;
  }
  
  function closeSettings() {
    showSettings = false;
  }
</script>

<button class="settings-button" on:click={openSettings} title="Settings">
  ⚙️
</button>

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

