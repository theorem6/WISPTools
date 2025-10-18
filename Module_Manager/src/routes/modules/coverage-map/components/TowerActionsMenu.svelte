<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { TowerSite } from '../lib/models';
  
  export let show = false;
  export let tower: TowerSite | null = null;
  export let x = 0;
  export let y = 0;
  
  const dispatch = createEventDispatcher();
  
  function handleAction(action: string) {
    if (!tower) return;
    dispatch('action', { action, tower });
    show = false;
  }
  
  function handleClickOutside() {
    show = false;
  }
</script>

<svelte:window on:click={handleClickOutside} />

{#if show && tower}
<div 
  class="tower-menu" 
  style="left: {x}px; top: {y}px"
  on:click|stopPropagation
>
  <div class="menu-header">
    <span class="tower-name">📡 {tower.name}</span>
    <span class="tower-type">{tower.type}</span>
  </div>
  
  <button class="menu-item" on:click={() => handleAction('edit-site')}>
    <span class="menu-icon">✏️</span>
    <span>Edit Tower Site</span>
  </button>
  
  <button class="menu-item" on:click={() => handleAction('add-sector')}>
    <span class="menu-icon">📶</span>
    <span>Add Sector</span>
  </button>
  
  <button class="menu-item" on:click={() => handleAction('add-backhaul')}>
    <span class="menu-icon">🔗</span>
    <span>Add Backhaul Link</span>
  </button>
  
  <div class="menu-divider"></div>
  
  <button class="menu-item" on:click={() => handleAction('view-details')}>
    <span class="menu-icon">ℹ️</span>
    <span>View Details</span>
  </button>
  
  <button class="menu-item danger" on:click={() => handleAction('delete-site')}>
    <span class="menu-icon">🗑️</span>
    <span>Delete Site</span>
  </button>
</div>
{/if}

<style>
  .tower-menu {
    position: fixed;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    min-width: 280px;
    z-index: 2000;
    overflow: hidden;
  }
  
  .menu-header {
    padding: 1rem;
    background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%);
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .tower-name {
    font-weight: 600;
    font-size: 1rem;
  }
  
  .tower-type {
    font-size: 0.85rem;
    opacity: 0.9;
    text-transform: capitalize;
  }
  
  .menu-item {
    width: 100%;
    padding: 0.875rem 1rem;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-primary);
    transition: background 0.2s;
    font-size: 0.95rem;
  }
  
  .menu-item:hover {
    background: var(--bg-hover);
  }
  
  .menu-item.danger {
    color: #ef4444;
  }
  
  .menu-item.danger:hover {
    background: rgba(239, 68, 68, 0.1);
  }
  
  .menu-icon {
    font-size: 1.25rem;
    width: 24px;
    text-align: center;
  }
  
  .menu-divider {
    height: 1px;
    background: var(--border-color);
    margin: 0.25rem 0;
  }
</style>

