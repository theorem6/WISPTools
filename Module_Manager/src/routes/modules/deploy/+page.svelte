<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import { inventoryService, type InventoryItem } from '$lib/services/inventoryService';
  import { planService, type PlanProject } from '$lib/services/planService';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';

  let currentUser: any = null;
  let mapContainer: HTMLDivElement;
  let showHardwareSelector = false;
  let availableHardware: InventoryItem[] = [];
  let selectedHardware: InventoryItem[] = [];
  let isLoadingHardware = false;
  
  // Plan approval workflow
  let showPlanApprovalModal = false;
  let readyPlans: PlanProject[] = [];
  let selectedPlan: PlanProject | null = null;
  let isLoadingPlans = false;

  onMount(async () => {
    if (browser) {
      currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        goto('/login');
      }
      await loadAvailableHardware();
    }
  });

  async function loadAvailableHardware() {
    isLoadingHardware = true;
    try {
      const result = await inventoryService.getInventory({
        status: 'available',
        limit: 100
      });
      availableHardware = result.items;
    } catch (err) {
      console.error('Failed to load hardware:', err);
    } finally {
      isLoadingHardware = false;
    }
  }

  async function loadReadyPlans() {
    isLoadingPlans = true;
    try {
      const tenantId = $currentTenant?.id;
      if (tenantId) {
        const plans = await planService.getPlans(tenantId);
        readyPlans = plans.filter(plan => plan.status === 'ready');
      }
    } catch (err) {
      console.error('Failed to load ready plans:', err);
    } finally {
      isLoadingPlans = false;
    }
  }

  function goBack() {
    goto('/dashboard');
  }

  function toggleHardwareSelector() {
    showHardwareSelector = !showHardwareSelector;
  }

  function selectHardware(item: InventoryItem) {
    if (!selectedHardware.find(h => h._id === item._id)) {
      selectedHardware = [...selectedHardware, item];
    }
  }

  function removeHardware(item: InventoryItem) {
    selectedHardware = selectedHardware.filter(h => h._id !== item._id);
  }

  function clearSelection() {
    selectedHardware = [];
  }

  function deployHardware() {
    if (selectedHardware.length === 0) {
      alert('Please select hardware to deploy');
      return;
    }
    // TODO: Implement deployment logic
    alert(`Deploying ${selectedHardware.length} items to selected location`);
  }

  // Plan approval functions
  function openPlanApproval() {
    showPlanApprovalModal = true;
  }

  function closePlanApprovalModal() {
    showPlanApprovalModal = false;
    selectedPlan = null;
  }

  function selectPlanForApproval(plan: PlanProject) {
    selectedPlan = plan;
  }

  async function approvePlan() {
    if (!selectedPlan) return;
    
    try {
      await planService.updatePlan(selectedPlan.id, { status: 'approved' });
      await loadReadyPlans();
      alert(`Plan "${selectedPlan.name}" has been approved for deployment.`);
      closePlanApprovalModal();
    } catch (error) {
      console.error('Error approving plan:', error);
      alert('Failed to approve plan');
    }
  }

  async function rejectPlan() {
    if (!selectedPlan) return;
    
    try {
      await planService.updatePlan(selectedPlan.id, { status: 'rejected' });
      await loadReadyPlans();
      alert(`Plan "${selectedPlan.name}" has been rejected.`);
      closePlanApprovalModal();
    } catch (error) {
      console.error('Error rejecting plan:', error);
      alert('Failed to reject plan');
    }
  }

  async function refactorPlan() {
    if (!selectedPlan) return;
    
    try {
      await planService.updatePlan(selectedPlan.id, { status: 'draft' });
      await loadReadyPlans();
      alert(`Plan "${selectedPlan.name}" has been sent back for refactoring.`);
      closePlanApprovalModal();
    } catch (error) {
      console.error('Error refactoring plan:', error);
      alert('Failed to refactor plan');
    }
  }
</script>

<TenantGuard requireTenant={true}>
  <div class="app">
    <!-- Full Screen Map -->
    <div class="map-fullscreen" bind:this={mapContainer}>
      <iframe 
        src="/modules/coverage-map" 
        title="Network Coverage Map"
        class="coverage-map-iframe"
      ></iframe>
    </div>

    <!-- Minimal Header Overlay -->
    <!-- Deploy Header Overlay -->
    <div class="header-overlay">
      <h1>🚀 Deploy</h1>
      <div class="header-controls">
        <ThemeSwitcher />
        <button class="control-btn" on:click={openPlanApproval} title="Plan Approval">
          📋 Plans ({readyPlans.length})
        </button>
        <button class="control-btn" on:click={() => alert('PCI Planner - Coming Soon')} title="PCI Planner">
          📊 PCI
        </button>
        <button class="control-btn" on:click={() => alert('Frequency Planner - Coming Soon')} title="Frequency Planner">
          📡 Freq
        </button>
        <button class="control-btn" on:click={toggleHardwareSelector} title="Select Hardware">
          📦 {selectedHardware.length > 0 ? selectedHardware.length : ''}
        </button>
      </div>
    </div>

    <!-- Hardware Selection Panel -->
    {#if showHardwareSelector}
      <div class="hardware-panel">
        <div class="panel-header">
          <h3>📦 Select Hardware for Deployment</h3>
          <button class="close-btn" on:click={toggleHardwareSelector}>✕</button>
        </div>
        
        <div class="panel-content">
          <!-- Selected Hardware -->
          {#if selectedHardware.length > 0}
            <div class="selected-section">
              <h4>Selected Hardware ({selectedHardware.length})</h4>
              <div class="selected-list">
                {#each selectedHardware as item}
                  <div class="selected-item">
                    <span class="item-info">
                      <strong>{item.equipmentType}</strong>
                      <small>{item.manufacturer} {item.model}</small>
                      <code>{item.serialNumber}</code>
                    </span>
                    <button class="remove-btn" on:click={() => removeHardware(item)}>✕</button>
                  </div>
                {/each}
              </div>
              <div class="selection-actions">
                <button class="btn-secondary" on:click={clearSelection}>Clear All</button>
                <button class="btn-primary" on:click={deployHardware}>Deploy Selected</button>
              </div>
            </div>
          {/if}

          <!-- Available Hardware -->
          <div class="available-section">
            <h4>Available Hardware</h4>
            {#if isLoadingHardware}
              <div class="loading">Loading hardware...</div>
            {:else if availableHardware.length === 0}
              <div class="empty-state">
                <p>No available hardware found</p>
                <button class="btn-primary" on:click={() => goto('/modules/inventory/add')}>
                  Add Hardware to Inventory
                </button>
              </div>
            {:else}
              <div class="hardware-grid">
                {#each availableHardware as item}
                  <div class="hardware-item" on:click={() => selectHardware(item)}>
                    <div class="item-header">
                      <span class="item-icon">📦</span>
                      <span class="item-type">{item.equipmentType}</span>
                    </div>
                    <div class="item-details">
                      <div class="manufacturer">{item.manufacturer} {item.model}</div>
                      <div class="serial">SN: {item.serialNumber}</div>
                      <div class="location">📍 {item.currentLocation.type}</div>
                    </div>
                    <div class="item-status">
                      <span class="status-badge available">{item.status}</span>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
</TenantGuard>

<style>
  /* App Container - Full Screen */
  .app {
    position: relative;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    background: var(--bg-primary);
  }

  /* Full Screen Map */
  .map-fullscreen {
    position: absolute;
    inset: 0;
    z-index: 0;
  }

  .coverage-map-iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }

  /* Header Overlay */
  .header-overlay {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--gradient-success);
    border-radius: var(--border-radius-md);
    padding: 0.5rem 1rem;
    box-shadow: var(--shadow-sm);
    color: white;
    text-align: center;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-overlay h1 {
    font-size: 1.2rem;
    margin: 0;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .hardware-btn {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    padding: 0.5rem;
    font-size: 1.1rem;
    cursor: pointer;
    color: white;
    transition: all 0.2s;
    backdrop-filter: blur(10px);
    min-width: 2.5rem;
  }

  .hardware-btn:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-1px);
  }

  /* Hardware Selection Panel */
  .hardware-panel {
    position: absolute;
    top: 80px;
    right: 20px;
    width: 400px;
    max-height: calc(100vh - 120px);
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-xl);
    z-index: 20;
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
    border-radius: var(--border-radius-lg) var(--border-radius-lg) 0 0;
  }

  .panel-header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .selected-section {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: var(--border-radius-md);
    border: 1px solid var(--border-color);
  }

  .selected-section h4 {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    color: var(--brand-primary);
  }

  .selected-list {
    margin-bottom: 1rem;
  }

  .selected-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: var(--bg-primary);
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }

  .item-info {
    flex: 1;
  }

  .item-info strong {
    display: block;
    font-size: 0.9rem;
  }

  .item-info small {
    display: block;
    color: var(--text-secondary);
    font-size: 0.8rem;
  }

  .item-info code {
    font-size: 0.75rem;
    background: var(--bg-secondary);
    padding: 0.125rem 0.25rem;
    border-radius: 3px;
  }

  .remove-btn {
    background: var(--danger);
    color: white;
    border: none;
    border-radius: 50%;
    width: 1.5rem;
    height: 1.5rem;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .remove-btn:hover {
    background: var(--danger-hover);
  }

  .selection-actions {
    display: flex;
    gap: 0.5rem;
  }

  .available-section h4 {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    color: var(--text-primary);
  }

  .hardware-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .hardware-item {
    padding: 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    cursor: pointer;
    transition: all 0.2s;
  }

  .hardware-item:hover {
    background: var(--bg-hover);
    border-color: var(--brand-primary);
    transform: translateY(-1px);
  }

  .item-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .item-icon {
    font-size: 1.2rem;
  }

  .item-type {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .item-details {
    margin-bottom: 0.5rem;
  }

  .manufacturer {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .serial {
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-family: monospace;
  }

  .location {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .item-status {
    text-align: right;
  }

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .status-badge.available {
    background: rgba(16, 185, 129, 0.2);
    color: var(--success);
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
  }

  .empty-state p {
    margin: 0 0 1rem 0;
    color: var(--text-secondary);
  }

  .btn-primary, .btn-secondary {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
  }

  .btn-primary {
    background: var(--brand-primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--brand-primary-hover);
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }
</style>