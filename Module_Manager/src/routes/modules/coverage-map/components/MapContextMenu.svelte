<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  export let x = 0;
  export let y = 0;
  export let latitude = 0;
  export let longitude = 0;
  
  const dispatch = createEventDispatcher();
  
  function handleAction(action: string) {
    dispatch('action', { action, latitude, longitude });
    show = false;
  }
  
  function handleClickOutside() {
    show = false;
  }
</script>

<svelte:window on:click={handleClickOutside} />

{#if show}
<div 
  class="context-menu" 
  style="left: {x}px; top: {y}px"
  on:click|stopPropagation
>
  <div class="menu-header">
    <span class="coords">
      📍 {latitude.toFixed(4)}, {longitude.toFixed(4)}
    </span>
  </div>
  
  <button class="menu-item" on:click={() => handleAction('add-site')}>
    <span class="menu-icon">📡</span>
    <span>Add Tower Site Here</span>
  </button>
  
  <button class="menu-item" on:click={() => handleAction('add-cpe')}>
    <span class="menu-icon">📱</span>
    <span>Add CPE Here</span>
  </button>
  
  <div class="menu-divider"></div>
  
  <button class="menu-item" on:click={() => handleAction('copy-coords')}>
    <span class="menu-icon">📋</span>
    <span>Copy Coordinates</span>
  </button>
</div>
{/if}

<style>
  .context-menu {
    position: fixed;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    min-width: 250px;
    z-index: 2000;
    overflow: hidden;
  }
  
  .menu-header {
    padding: 0.75rem 1rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }
  
  .coords {
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-family: monospace;
  }
  
  .menu-item {
    width: 100%;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-primary);
    transition: background 0.2s;
  }
  
  .menu-item:hover {
    background: var(--bg-hover);
  }
  
  .menu-icon {
    font-size: 1.25rem;
  }
  
  .menu-divider {
    height: 1px;
    background: var(--border-color);
    margin: 0.25rem 0;
  }
</style>

