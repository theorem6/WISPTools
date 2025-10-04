<script lang="ts">
  import { currentNetwork } from '../stores/networkStore';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
</script>

<div class="top-brand">
  <div class="brand-content">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="brand-icon">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3"></circle>
    </svg>
    <div class="brand-info">
      <h1 class="app-title">LTE PCI Mapper</h1>
      {#if $currentNetwork}
        <button class="network-link" on:click={() => dispatch('manageNetworks')}>
          <span class="network-name">{$currentNetwork.name}</span>
          <span class="network-market">{$currentNetwork.market}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      {:else}
        <button class="network-link empty" on:click={() => dispatch('manageNetworks')}>
          <span>Select Network</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .top-brand {
    position: fixed;
    top: 20px;
    left: 220px;
    width: 180px;
    z-index: 200;
    background: var(--card-bg);
    backdrop-filter: blur(16px);
    border-radius: 12px;
    padding: 0.75rem 0.5rem;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-color);
    box-sizing: border-box;
  }

  .brand-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .brand-icon {
    color: var(--primary-color);
    flex-shrink: 0;
    width: 24px;
    height: 24px;
  }

  .brand-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .app-title {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.2;
  }

  .network-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 0.7rem;
    transition: all 0.2s;
  }

  .network-link:hover {
    color: var(--primary-color);
  }

  .network-link .chevron {
    width: 12px;
    height: 12px;
    transition: transform 0.2s;
  }

  .network-link:hover .chevron {
    transform: translateY(2px);
  }

  .network-name {
    font-weight: 600;
  }

  .network-market {
    font-size: 0.65rem;
    opacity: 0.8;
  }

  .network-link.empty {
    font-style: italic;
    opacity: 0.7;
  }

  @media (max-width: 768px) {
    .top-brand {
      top: 60px;
      left: 10px;
      width: 160px;
      padding: 0.5rem;
    }

    .app-title {
      font-size: 0.85rem;
    }

    .brand-icon {
      width: 20px;
      height: 20px;
    }
  }
</style>

