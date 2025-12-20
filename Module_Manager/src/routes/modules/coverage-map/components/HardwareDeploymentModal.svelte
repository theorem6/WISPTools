<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { TowerSite } from '../lib/models';
  import { coverageMapService } from '../lib/coverageMapService.mongodb';
  import { inventoryService, type InventoryItem } from '$lib/services/inventoryService';
  
  export let show = false;
  export let tower: TowerSite | null = null;
  export let tenantId: string;
  
  // Debug logging
  $: if (show) {
    console.log('[HardwareDeploymentModal] 🔧 Modal show state changed to true:', { show, hasTower: !!tower, towerName: tower?.name, tenantId });
  }
  
  const dispatch = createEventDispatcher();
  
  let isDeploying = false;
  let error = '';
  let availableSites: TowerSite[] = [];
  let selectedSiteId: string = '';
  let isLoadingSites = false;
  
  // Inventory selection
  let showInventoryList = false;
  let inventoryItems: InventoryItem[] = [];
  let isLoadingInventory = false;
  let selectedInventoryItem: InventoryItem | null = null;
  let searchQuery = '';
  
  function handleClose() {
    console.log('[HardwareDeploymentModal] handleClose called');
    showInventoryList = false;
    selectedInventoryItem = null;
    searchQuery = '';
    error = '';
    isLoadingInventory = false; // Reset loading state
    dispatch('close');
  }
  
  // Reset state when modal closes (not when it opens)
  let previousShowState = false;
  $: {
    // Only reset when modal transitions from open to closed
    if (previousShowState && !show) {
      showInventoryList = false;
      selectedInventoryItem = null;
      searchQuery = '';
      inventoryItems = [];
    }
    previousShowState = show;
  }
  
  async function handleDeploy(e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('[HardwareDeploymentModal] handleDeploy called, showing inventory list', { 
      hasTenantId: !!tenantId, 
      tenantId, 
      currentShowInventoryList: showInventoryList,
      show,
      hasTower: !!tower
    });
    
    // Ensure modal stays open
    if (!show || !tower) {
      console.error('[HardwareDeploymentModal] Cannot show inventory list - modal not open or no tower');
      return;
    }
    
    // Show inventory list instead of navigating
    // Force the update to ensure reactivity triggers
    showInventoryList = true;
    console.log('[HardwareDeploymentModal] showInventoryList set to:', showInventoryList);
    
    // Use setTimeout to ensure state update propagates before loading
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('[HardwareDeploymentModal] About to load inventory items, showInventoryList:', showInventoryList, 'show:', show);
    try {
      await loadInventoryItems();
      console.log('[HardwareDeploymentModal] After loadInventoryItems, showInventoryList:', showInventoryList, 'items count:', inventoryItems.length);
    } catch (err) {
      console.error('[HardwareDeploymentModal] Error loading inventory:', err);
      // Don't close modal on error - show error message instead
    }
  }
  
  async function loadInventoryItems() {
    console.log('[HardwareDeploymentModal] loadInventoryItems called:', { isLoadingInventory, tenantId, showInventoryList });
    
    if (isLoadingInventory) {
      console.log('[HardwareDeploymentModal] Already loading, skipping');
      return;
    }
    
    if (!tenantId) {
      console.error('[HardwareDeploymentModal] No tenantId available, cannot load inventory');
      error = 'Tenant ID is missing. Please refresh the page.';
      return;
    }
    
    console.log('[HardwareDeploymentModal] Loading inventory items for tenant:', tenantId);
    isLoadingInventory = true;
    error = '';
    try {
      // Load available inventory items (status: available)
      const result = await inventoryService.getInventory({
        status: 'available', // Only show available items
        limit: 200
      }, tenantId);
      console.log('[HardwareDeploymentModal] Loaded inventory items:', result.items?.length || 0, 'result:', result);
      inventoryItems = result.items || [];
      console.log('[HardwareDeploymentModal] Inventory items set:', inventoryItems.length, 'items');
      if (inventoryItems.length === 0) {
        error = 'No available inventory items found';
        console.warn('[HardwareDeploymentModal] No available inventory items');
      }
    } catch (err: any) {
      console.error('[HardwareDeploymentModal] Failed to load inventory:', err);
      error = err.message || 'Failed to load inventory items';
    } finally {
      isLoadingInventory = false;
      console.log('[HardwareDeploymentModal] loadInventoryItems completed, isLoadingInventory:', isLoadingInventory);
    }
  }
  
  async function handleSelectInventoryItem(item: InventoryItem) {
    if (!tower || !tower.id) {
      error = 'No tower selected';
      return;
    }
    
    selectedInventoryItem = item;
    
    // Deploy the inventory item to the tower
    try {
      isDeploying = true;
      error = '';
      
      // Update inventory item status and location
      await inventoryService.deployItem(item._id || '', {
        siteId: tower.id,
        siteName: tower.name,
        location: tower.location
      });
      
      // Also create a hardware deployment record
      await coverageMapService.deployHardware(tenantId, tower.id, {
        hardware_type: item.equipmentType || 'other',
        name: item.model || item.equipmentType || 'Hardware',
        inventory_item_id: item._id,
        config: {
          manufacturer: item.manufacturer,
          model: item.model,
          serialNumber: item.serialNumber
        }
      });
      
      // Dispatch success event
      dispatch('deployed', { item, tower });
      handleClose();
    } catch (err: any) {
      console.error('Failed to deploy hardware:', err);
      error = err.message || 'Failed to deploy hardware';
    } finally {
      isDeploying = false;
    }
  }
  
  function handleBackToOptions() {
    showInventoryList = false;
    selectedInventoryItem = null;
    searchQuery = '';
  }
  
  function handleInventory() {
    if (!tower) {
      error = 'No tower selected';
      return;
    }
    
    // Guard: ensure tower has required properties
    if (!tower.id || !tower.name) {
      error = 'Tower data incomplete';
      console.error('Tower missing required properties:', tower);
      return;
    }
    
    // Dispatch event to parent to show SiteEquipmentModal instead of navigating
    console.log('[HardwareDeploymentModal] Dispatching view-inventory event for tower:', tower.name);
    dispatch('view-inventory', { tower });
  }

  let hasLoadedSites = false;
  
  onMount(async () => {
    if (show && tenantId && !hasLoadedSites) {
      await loadAvailableSites();
      hasLoadedSites = true;
      if (tower) {
        selectedSiteId = tower.id;
      }
    }
  });
  
  // Only load sites once when modal opens
  $: if (show && tenantId && !hasLoadedSites) {
    loadAvailableSites();
    hasLoadedSites = true;
  }
  
  // Reset flag when modal closes
  $: if (!show) {
    hasLoadedSites = false;
  }
  
  $: if (tower && availableSites.length > 0) {
    selectedSiteId = tower.id;
  }
  
  // Filter inventory items by search query
  $: filteredInventoryItems = inventoryItems.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (item.manufacturer?.toLowerCase().includes(query)) ||
      (item.model?.toLowerCase().includes(query)) ||
      (item.serialNumber?.toLowerCase().includes(query)) ||
      (item.equipmentType?.toLowerCase().includes(query)) ||
      (item.category?.toLowerCase().includes(query)) ||
      (item.assetTag?.toLowerCase().includes(query))
    );
  });

  async function loadAvailableSites() {
    if (isLoadingSites || !tenantId) return;
    
    isLoadingSites = true;
    try {
      availableSites = await coverageMapService.getTowerSites(tenantId);
      if (tower) {
        selectedSiteId = tower.id;
      }
    } catch (err) {
      console.error('Failed to load sites:', err);
      error = 'Failed to load available sites';
    } finally {
      isLoadingSites = false;
    }
  }

  function getSelectedSite(): TowerSite | null {
    return availableSites.find(s => s.id === selectedSiteId) || null;
  }

  function handleEPCDeployment() {
    const site = getSelectedSite();
    if (!site) {
      error = 'Please select a site';
      return;
    }
    
    // Close this modal and open EPC deployment modal
    handleClose();
    dispatch('deploy-epc', site);
  }
</script>

{#if show && tower}
<div class="modal-overlay" onclick={handleClose}>
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2>🔧 Deploy Hardware to {tower?.name || 'Selected Site'}</h2>
      <button class="close-btn" onclick={handleClose}>✕</button>
    </div>
    
    <div class="modal-content">
      <p class="info-text">
        {#if tower}
          Deploy hardware to <strong>{tower.name}</strong> located at <strong>{tower.location?.address || `${tower.location?.latitude}, ${tower.location?.longitude}`}</strong>
        {:else}
          Deploy hardware to selected location
        {/if}
      </p>
      
      {#if error}
      <div class="alert alert-error">
        ⚠️ {error}
      </div>
      {/if}
      
      <!-- Site Selector -->
      {#if availableSites.length > 1}
        <div class="form-group">
          <label for="siteSelect">Select Site:</label>
          <select id="siteSelect" bind:value={selectedSiteId} class="form-control">
            {#each availableSites as site}
              <option value={site.id}>{site.name}</option>
            {/each}
          </select>
        </div>
      {/if}

      {#if !showInventoryList}
        <div class="button-group">
          <button class="btn btn-primary" onclick={handleEPCDeployment}>
            🚀 Deploy EPC to Site
          </button>
          
          <button 
            class="btn btn-primary" 
            onclick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDeploy(e);
            }}
            type="button"
          >
            📦 Select Hardware from Inventory
          </button>
          
          <button class="btn btn-secondary" onclick={handleInventory}>
            📋 View Current Inventory
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
      {:else if showInventoryList}
        <!-- Inventory Selection View -->
        <div class="inventory-selection">
          <p style="color: var(--text-secondary); margin-bottom: 1rem;">
            Select hardware from your inventory to deploy to <strong>{tower?.name}</strong>
          </p>
          <button class="btn btn-secondary" onclick={handleBackToOptions} style="margin-bottom: 1rem;">
            ← Back to Options
          </button>
          
          <div class="form-group">
            <label for="searchInventory">Search Inventory:</label>
            <input 
              id="searchInventory"
              type="text" 
              class="form-control" 
              placeholder="Search by manufacturer, model, serial number..."
              bind:value={searchQuery}
            />
          </div>
          
          {#if isLoadingInventory}
            <div class="loading-state">
              <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
                <div style="font-size: 1.5rem;">⏳</div>
                <div>Loading inventory items...</div>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">Please wait</div>
              </div>
            </div>
          {:else if filteredInventoryItems.length === 0}
            <div class="empty-state">
              {#if searchQuery}
                No inventory items found matching "{searchQuery}"
              {:else}
                No available inventory items found
              {/if}
            </div>
          {:else}
            <div class="inventory-list">
              {#each filteredInventoryItems as item}
                <div 
                  class="inventory-item" 
                  class:selected={selectedInventoryItem?._id === item._id}
                  onclick={() => handleSelectInventoryItem(item)}
                >
                  <div class="item-header">
                    <strong>{item.model || item.equipmentType || 'Unknown'}</strong>
                    <span class="item-status status-{item.status}">{item.status}</span>
                  </div>
                  <div class="item-details">
                    {#if item.manufacturer}
                      <span>Manufacturer: {item.manufacturer}</span>
                    {/if}
                    {#if item.serialNumber}
                      <span>Serial: {item.serialNumber}</span>
                    {/if}
                    {#if item.category}
                      <span>Category: {item.category}</span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
    
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick={handleClose}>Cancel</button>
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

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
    font-weight: 500;
  }

  .form-control {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
  }

  .form-control:focus {
    outline: none;
    border-color: var(--primary);
  }

  .inventory-selection {
    margin-top: 1rem;
  }

  .loading-state,
  .empty-state {
    padding: 2rem;
    text-align: center;
    color: var(--text-secondary);
  }

  .inventory-list {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    margin-top: 1rem;
  }

  .inventory-item {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
    transition: background 0.2s;
  }

  .inventory-item:hover {
    background: var(--bg-hover);
  }

  .inventory-item.selected {
    background: var(--primary);
    color: white;
  }

  .inventory-item:last-child {
    border-bottom: none;
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .item-status {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-available {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
  }

  .inventory-item.selected .item-status.status-available {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .item-details {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .inventory-item.selected .item-details {
    color: rgba(255, 255, 255, 0.9);
  }
</style>

