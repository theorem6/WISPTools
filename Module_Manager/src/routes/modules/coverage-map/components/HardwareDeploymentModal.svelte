<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  import type { TowerSite } from '../lib/models';
  
  export let show = false;
  export let tower: TowerSite | null = null;
  export let tenantId: string;
  
  const dispatch = createEventDispatcher();
  
  let isDeploying = false;
  let error = '';
  
  function handleClose() {
    show = false;
    dispatch('close');
  }
  
  function handleDeploy() {
    if (!tower) {
      error = 'No tower selected';
      return;
    }
    
    // Close modal first
    handleClose();
    
    // Navigate to deploy module with this tower pre-selected
    goto(`/modules/deploy?siteId=${tower.id}&siteName=${encodeURIComponent(tower.name)}`);
  }
  
  function handleInventory() {
    if (!tower) {
      error = 'No tower selected';
      return;
    }
    
    // Close modal first
    handleClose();
    
    // Navigate to inventory page with filters for this tower
    goto(`/modules/inventory?siteId=${tower.id}&siteName=${encodeURIComponent(tower.name)}`);
  }
</script>

{#if show && tower}
<div class="modal-overlay" on:click={handleClose}>
  <div class="modal" on:click|stopPropagation>
    <div class="modal-header">
      <h2>🔧 Deploy Hardware to {tower.name}</h2>
      <button class="close-btn" on:click={handleClose}>✕</button>
    </div>
    
    <div class="modal-content">
      <p class="info-text">
        Deploy hardware to <strong>{tower.name}</strong> located at <strong>{tower.location?.address || `${tower.location?.latitude}, ${tower.location?.longitude}`}</strong>
      </p>
      
      {#if error}
      <div class="alert alert-error">
        ⚠️ {error}
      </div>
      {/if}
      
      <div class="button-group">
        <button class="btn btn-primary" on:click={handleDeploy}>
          📦 Select from Inventory
        </button>
        
        <button class="btn btn-secondary" on:click={handleInventory}>
          📋 View Available Inventory
        </button>
      </div>
      
      <div class="info-section">
        <h3>Available Hardware Types:</h3>
        <ul>
          <li>📡 Radio Equipment (eNodeB, gNodeB, RRH)</li>
          <li>🛰️ Antennas (Sector, Panel, MIMO)</li>
          <li>🔌 Power Systems (Batteries, UPS, Solar)</li>
          <li>🌐 Networking Equipment (Routers, Switches)</li>
          <li>📡 EPC Equipment (MME, SGW, PGW)</li>
          <li>🔧 Test Equipment</li>
          <li>📦 Other Equipment</li>
        </ul>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn btn-secondary" on:click={handleClose}>Cancel</button>
    </div>
  </div>
</div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }
  
  .modal {
    background: var(--card-bg);
    border-radius: 12px;
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    overflow: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: var(--text-secondary);
  }
  
  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  .modal-content {
    padding: 1.5rem;
  }
  
  .info-text {
    margin-bottom: 1.5rem;
    color: var(--text-secondary);
  }
  
  .alert {
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }
  
  .alert-error {
    background: #fee;
    color: #c00;
    border: 1px solid #fcc;
  }
  
  .button-group {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .btn {
    flex: 1;
    padding: 1rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--primary);
    color: white;
  }
  
  .btn-primary:hover {
    background: var(--primary-hover);
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--bg-hover);
  }
  
  .info-section {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 8px;
    margin-top: 1.5rem;
  }
  
  .info-section h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    font-size: 1rem;
  }
  
  .info-section ul {
    margin: 0;
    padding-left: 1.5rem;
  }
  
  .info-section li {
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
  }
  
  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
  }
</style>

