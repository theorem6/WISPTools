<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { inventoryService, type InventoryItem } from '$lib/services/inventoryService';
  import { coverageMapService } from '../../coverage-map/lib/coverageMapService.mongodb';

  export let show = false;
  export let item: InventoryItem | null = null;
  export let tenantId: string;

  const dispatch = createEventDispatcher();

  let isSaving = false;
  let error = '';
  let sites: any[] = [];
  let sitesLoaded = false;
  const locationTypeId = 'transfer-location-type';
  const siteSelectId = 'transfer-site';
  const warehouseNameId = 'transfer-warehouse-name';
  const warehouseSectionId = 'transfer-warehouse-section';
  const warehouseAisleId = 'transfer-warehouse-aisle';
  const warehouseShelfId = 'transfer-warehouse-shelf';
  const warehouseBinId = 'transfer-warehouse-bin';
  const towerRackId = 'transfer-tower-rack';
  const towerRackUnitId = 'transfer-tower-rack-unit';
  const towerCabinetId = 'transfer-tower-cabinet';
  const towerPositionId = 'transfer-tower-position';
  const transferReasonId = 'transfer-reason';
  const movedById = 'transfer-moved-by';
  const transferNotesId = 'transfer-notes';

  // Transfer form data
  let transferData = {
    newLocation: {
      type: 'warehouse' as any,
      siteId: '',
      siteName: '',
      warehouse: {
        name: '',
        section: '',
        aisle: '',
        shelf: '',
        bin: ''
      },
      tower: {
        rack: '',
        rackUnit: '',
        cabinet: '',
        position: ''
      }
    },
    reason: '',
    movedBy: '',
    notes: ''
  };

  onMount(async () => {
    if (show && !sitesLoaded) {
      await loadSites();
    }
  });

  $: if (show && !sitesLoaded) {
    loadSites();
  }

  async function loadSites() {
    if (sitesLoaded) return;
    
    try {
      sites = await coverageMapService.getTowerSites(tenantId);
      sitesLoaded = true;
    } catch (err) {
      console.error('Failed to load sites:', err);
      sites = [];
    }
  }

  function handleLocationTypeChange() {
    // Reset location-specific fields when type changes
    transferData.newLocation.siteId = '';
    transferData.newLocation.siteName = '';
    transferData.newLocation.warehouse = { name: '', section: '', aisle: '', shelf: '', bin: '' };
    transferData.newLocation.tower = { rack: '', rackUnit: '', cabinet: '', position: '' };
  }

  function handleSiteChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const siteId = target.value;
    transferData.newLocation.siteId = siteId;
    
    if (siteId) {
      const site = sites.find(s => s.id === siteId);
      if (site) {
        transferData.newLocation.siteName = site.name;
      }
    } else {
      transferData.newLocation.siteName = '';
    }
  }

  async function handleTransfer() {
    if (!item) return;

    if (!transferData.newLocation.type) {
      error = 'Please select a location type';
      return;
    }

    if (!transferData.reason.trim()) {
      error = 'Please provide a reason for the transfer';
      return;
    }

    isSaving = true;
    error = '';

    try {
      await inventoryService.transferItem(
        item._id!,
        transferData.newLocation,
        transferData.reason,
        transferData.movedBy || 'Current User',
        transferData.notes
      );

      dispatch('transferred');
      handleClose();
    } catch (err: any) {
      error = err.message || 'Failed to transfer item';
    } finally {
      isSaving = false;
    }
  }

  function handleClose() {
    show = false;
    error = '';
    // Reset form
    transferData = {
      newLocation: {
        type: 'warehouse',
        siteId: '',
        siteName: '',
        warehouse: { name: '', section: '', aisle: '', shelf: '', bin: '' },
        tower: { rack: '', rackUnit: '', cabinet: '', position: '' }
      },
      reason: '',
      movedBy: '',
      notes: ''
    };
  }

  function handleOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
    }
  }

  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }
</script>

{#if show && item}
<div
  class="modal-overlay"
  role="presentation"
  aria-hidden="true"
  tabindex="-1"
  on:click={handleOverlayClick}
>
  <div
    class="modal-content"
    role="dialog"
    aria-modal="true"
    aria-label="Transfer equipment"
    tabindex="0"
    on:keydown={handleOverlayKeydown}
  >
    <div class="modal-header">
      <h3>📦 Transfer Equipment</h3>
      <button class="close-btn" on:click={handleClose}>✕</button>
    </div>
    
    <div class="modal-body">
      <!-- Item Info -->
      <div class="item-info">
        <h4>Item Details</h4>
        <div class="item-details">
          <span class="item-name">{item.manufacturer} {item.model}</span>
          <span class="item-serial">SN: {item.serialNumber}</span>
          <span class="item-location">📍 Currently at: {item.currentLocation?.siteName || item.currentLocation?.type}</span>
        </div>
      </div>

      {#if error}
        <div class="error-banner">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      {/if}

      <!-- Transfer Form -->
      <form on:submit|preventDefault={handleTransfer}>
        <!-- New Location -->
        <div class="form-section">
          <h4>📍 New Location</h4>
          
          <div class="form-group">
            <label for={locationTypeId}>Location Type *</label>
            <select
              id={locationTypeId}
              bind:value={transferData.newLocation.type}
              on:change={handleLocationTypeChange}
            >
              <option value="warehouse">Warehouse</option>
              <option value="tower">Tower Site</option>
              <option value="noc">NOC</option>
              <option value="vehicle">Vehicle</option>
              <option value="customer">Customer Site</option>
              <option value="rma">RMA</option>
              <option value="vendor">Vendor</option>
              <option value="other">Other</option>
            </select>
          </div>

          {#if transferData.newLocation.type === 'tower'}
            <div class="form-group">
              <label for={siteSelectId}>Site</label>
              <select id={siteSelectId} value={transferData.newLocation.siteId} on:change={handleSiteChange}>
                <option value="">Select site...</option>
                {#each sites as site}
                  <option value={site.id}>{site.name} ({site.type})</option>
                {/each}
              </select>
            </div>
          {/if}

          {#if transferData.newLocation.type === 'warehouse'}
            <div class="form-grid">
              <div class="form-group">
                <label for={warehouseNameId}>Warehouse Name</label>
                <input id={warehouseNameId} type="text" bind:value={transferData.newLocation.warehouse.name} placeholder="Main Warehouse" />
              </div>
              <div class="form-group">
                <label for={warehouseSectionId}>Section</label>
                <input id={warehouseSectionId} type="text" bind:value={transferData.newLocation.warehouse.section} placeholder="A" />
              </div>
              <div class="form-group">
                <label for={warehouseAisleId}>Aisle</label>
                <input id={warehouseAisleId} type="text" bind:value={transferData.newLocation.warehouse.aisle} placeholder="1" />
              </div>
              <div class="form-group">
                <label for={warehouseShelfId}>Shelf</label>
                <input id={warehouseShelfId} type="text" bind:value={transferData.newLocation.warehouse.shelf} placeholder="B" />
              </div>
              <div class="form-group">
                <label for={warehouseBinId}>Bin</label>
                <input id={warehouseBinId} type="text" bind:value={transferData.newLocation.warehouse.bin} placeholder="1" />
              </div>
            </div>
          {/if}

          {#if transferData.newLocation.type === 'tower'}
            <div class="form-grid">
              <div class="form-group">
                <label for={towerRackId}>Rack</label>
                <input id={towerRackId} type="text" bind:value={transferData.newLocation.tower.rack} placeholder="Rack-01" />
              </div>
              <div class="form-group">
                <label for={towerRackUnitId}>Rack Unit</label>
                <input id={towerRackUnitId} type="text" bind:value={transferData.newLocation.tower.rackUnit} placeholder="U10" />
              </div>
              <div class="form-group">
                <label for={towerCabinetId}>Cabinet</label>
                <input id={towerCabinetId} type="text" bind:value={transferData.newLocation.tower.cabinet} placeholder="Cab-01" />
              </div>
              <div class="form-group">
                <label for={towerPositionId}>Position</label>
                <input id={towerPositionId} type="text" bind:value={transferData.newLocation.tower.position} placeholder="Top" />
              </div>
            </div>
          {/if}
        </div>

        <!-- Transfer Details -->
        <div class="form-section">
          <h4>📋 Transfer Details</h4>
          
          <div class="form-group">
            <label for={transferReasonId}>Reason for Transfer *</label>
            <select id={transferReasonId} bind:value={transferData.reason}>
              <option value="">Select reason...</option>
              <option value="deployment">Deployment to Site</option>
              <option value="maintenance">Maintenance</option>
              <option value="repair">Repair</option>
              <option value="upgrade">Upgrade</option>
              <option value="relocation">Site Relocation</option>
              <option value="storage">Storage</option>
              <option value="rma">RMA Return</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div class="form-group">
            <label for={movedById}>Moved By</label>
            <input id={movedById} type="text" bind:value={transferData.movedBy} placeholder="Your name" />
          </div>

          <div class="form-group">
            <label for={transferNotesId}>Additional Notes</label>
            <textarea 
              id={transferNotesId}
              bind:value={transferData.notes} 
              placeholder="Any additional notes about this transfer..."
              rows="3"
            ></textarea>
          </div>
        </div>
      </form>
    </div>
    
    <div class="modal-footer">
      <button class="btn btn-secondary" on:click={handleClose} disabled={isSaving}>
        Cancel
      </button>
      <button class="btn btn-primary" on:click={handleTransfer} disabled={isSaving}>
        {isSaving ? 'Transferring...' : 'Transfer Item'}
      </button>
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
    z-index: 1000;
  }

  .modal-content {
    background: var(--card-bg);
    border-radius: 12px;
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h3 {
    margin: 0;
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .item-info {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .item-info h4 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }

  .item-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .item-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .item-serial {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .item-location {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .error-banner {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 1rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .form-section {
    margin-bottom: 1.5rem;
  }

  .form-section h4 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.5rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
    transition: border-color 0.2s;
  }

  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--brand-primary);
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--brand-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--brand-primary-hover);
    transform: translateY(-2px);
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
