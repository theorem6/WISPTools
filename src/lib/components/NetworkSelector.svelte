<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { currentNetwork, allNetworks } from '../stores/networkStore';
  
  const dispatch = createEventDispatcher();
  
  function handleManageNetworks() {
    dispatch('manage');
  }
</script>

<div class="network-selector">
  {#if $currentNetwork}
    <button class="selector-button" on:click={handleManageNetworks}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
      <div class="network-info">
        <span class="network-name">{$currentNetwork.name}</span>
        <span class="network-market">{$currentNetwork.market}</span>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
  {:else}
    <button class="selector-button empty" on:click={handleManageNetworks}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
      <span class="select-text">Select Network</span>
    </button>
  {/if}
</div>

<style>
  .network-selector {
    position: relative;
  }

  .selector-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 36px;
    padding: 0 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 10px;
    background: transparent;
    cursor: pointer;
    transition: all var(--transition);
    max-width: 200px;
    color: var(--text-primary);
  }

  .selector-button:hover {
    background: var(--hover-bg);
    box-shadow: var(--shadow-sm);
    border-color: var(--primary-color);
  }

  .selector-button svg:first-child {
    color: var(--primary-color);
    flex-shrink: 0;
  }

  .network-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    flex: 1;
    min-width: 0;
  }

  .network-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 140px;
  }

  .network-market {
    font-size: 0.65rem;
    color: var(--text-tertiary);
    line-height: 1;
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 140px;
  }

  .chevron {
    color: var(--text-tertiary);
    flex-shrink: 0;
  }

  .select-text {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .selector-button.empty {
    border-style: dashed;
  }

  .selector-button.empty:hover {
    border-color: var(--primary-color);
    color: var(--primary-color);
  }

  @media (max-width: 768px) {
    .selector-button {
      max-width: 160px;
    }

    .network-name,
    .network-market {
      max-width: 100px;
    }
  }
</style>

