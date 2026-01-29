<script lang="ts">
  /**
   * RMA Tracking Wizard
   * Guides users through marking an inventory item as RMA (Return Merchandise Authorization) and recording details.
   */
  import { createEventDispatcher } from 'svelte';
  import BaseWizard from '../BaseWizard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { inventoryService, type InventoryItem } from '$lib/services/inventoryService';

  export let show = false;
  const dispatch = createEventDispatcher<{ close: void; saved: void }>();

  let currentStep = 0;
  let isLoading = false;
  let error = '';
  let success = '';

  const steps = [
    { id: 'welcome', title: 'Welcome', icon: '📋' },
    { id: 'select', title: 'Select Item', icon: '📦' },
    { id: 'details', title: 'RMA Details', icon: '📝' },
    { id: 'complete', title: 'Complete', icon: '🎉' }
  ];

  let items: InventoryItem[] = [];
  let searchQuery = '';
  let selectedItem: InventoryItem | null = null;
  let rmaNumber = '';
  let rmaVendor = '';
  let rmaReason = '';
  let expectedReturnDate = '';
  let rmaNotes = '';

  async function loadItems() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) return;
    isLoading = true;
    error = '';
    try {
      const result = await inventoryService.getInventory({
        limit: 200,
        status: undefined // get available, deployed, etc. - exclude rma if we want only eligible
      });
      items = result.items || [];
      // Prefer items that are not already in RMA
      items = items.filter((i: InventoryItem) => i.status !== 'rma');
    } catch (err: any) {
      console.error('Failed to load inventory:', err);
      error = err.message || 'Failed to load inventory';
      items = [];
    } finally {
      isLoading = false;
    }
  }

  $: filteredItems = searchQuery.trim()
    ? items.filter(
        (i) =>
          (i.serialNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (i.assetTag || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (i.model || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (i.manufacturer || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : items;

  function handleClose() {
    show = false;
    resetWizard();
    dispatch('close');
  }

  function resetWizard() {
    currentStep = 0;
    items = [];
    searchQuery = '';
    selectedItem = null;
    rmaNumber = '';
    rmaVendor = '';
    rmaReason = '';
    expectedReturnDate = '';
    rmaNotes = '';
    error = '';
    success = '';
  }

  function handleStepChange(event: CustomEvent<number>) {
    currentStep = event.detail;
    if (currentStep === 1) loadItems();
  }

  function nextStep() {
    if (currentStep === 1) {
      if (!selectedItem) {
        error = 'Please select an item';
        return;
      }
    }
    if (currentStep === 2) {
      if (!rmaNumber.trim()) {
        error = 'RMA number is required';
        return;
      }
      if (!rmaVendor.trim()) {
        error = 'Vendor is required';
        return;
      }
    }
    error = '';
    if (currentStep < steps.length - 1) {
      currentStep++;
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
      error = '';
    }
  }

  async function submitRMA() {
    if (!selectedItem?._id) {
      error = 'No item selected';
      return;
    }
    isLoading = true;
    error = '';
    try {
      const rmaLine = `[RMA] ${rmaNumber} - ${rmaVendor} - ${rmaReason}${expectedReturnDate ? ' - Expected return: ' + expectedReturnDate : ''}${rmaNotes ? ' - ' + rmaNotes : ''}`;
      const existingNotes = selectedItem.notes || '';
      const newNotes = existingNotes ? existingNotes + '\n' + rmaLine : rmaLine;
      await inventoryService.updateItem(selectedItem._id, {
        status: 'rma',
        notes: newNotes,
        currentLocation: { type: 'rma' as const }
      });
      success = 'Item marked as RMA and details recorded.';
      currentStep = steps.length - 1;
      dispatch('saved');
    } catch (err: any) {
      error = err.message || 'Failed to update item';
    } finally {
      isLoading = false;
    }
  }
</script>

<BaseWizard
  {show}
  title="📋 RMA Tracking Wizard"
  {steps}
  {currentStep}
  {isLoading}
  {error}
  {success}
  on:close={handleClose}
  on:stepChange={handleStepChange}
>
  <div slot="content">
    {#if currentStep === 0}
      <div class="wizard-panel">
        <h3>RMA (Return Merchandise Authorization)</h3>
        <p>Mark an inventory item as sent for RMA and record the RMA number, vendor, and reason.</p>
        <div class="info-box">
          <h4>You will:</h4>
          <ul>
            <li>Select the item being sent for RMA</li>
            <li>Enter RMA number and vendor</li>
            <li>Record reason and optional expected return date</li>
          </ul>
        </div>
      </div>
    {:else if currentStep === 1}
      <div class="wizard-panel">
        <h3>Select Item</h3>
        <div class="form-group">
          <label>Search</label>
          <input type="text" bind:value={searchQuery} placeholder="Serial, asset tag, model..." disabled={isLoading} />
        </div>
        {#if isLoading && items.length === 0}
          <p>Loading inventory...</p>
        {:else if filteredItems.length === 0}
          <p class="hint">No items found. Add inventory first or clear the search.</p>
        {:else}
          <div class="item-list">
            {#each filteredItems.slice(0, 50) as item}
              <button
                type="button"
                class="item-card"
                class:selected={selectedItem?._id === item._id}
                on:click={() => selectedItem = item}
                disabled={isLoading}
              >
                <span class="item-serial">{item.serialNumber || item.assetTag || '—'}</span>
                <span class="item-meta">{item.model || item.equipmentType} · {item.status}</span>
              </button>
            {/each}
          </div>
          {#if selectedItem}
            <div class="info-box success">
              <p>Selected: <strong>{selectedItem.serialNumber || selectedItem.assetTag}</strong> — {selectedItem.model || selectedItem.equipmentType}</p>
            </div>
          {/if}
        {/if}
      </div>
    {:else if currentStep === 2}
      <div class="wizard-panel">
        <h3>RMA Details</h3>
        {#if selectedItem}
          <p class="hint">Item: {selectedItem.serialNumber || selectedItem.assetTag} — {selectedItem.model || selectedItem.equipmentType}</p>
        {/if}
        <div class="form-group">
          <label>RMA Number <span class="required">*</span></label>
          <input type="text" bind:value={rmaNumber} placeholder="e.g. RMA-2024-001" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Vendor <span class="required">*</span></label>
          <input type="text" bind:value={rmaVendor} placeholder="Vendor or manufacturer" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Reason</label>
          <input type="text" bind:value={rmaReason} placeholder="e.g. Defective, warranty repair" disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Expected Return Date</label>
          <input type="date" bind:value={expectedReturnDate} disabled={isLoading} />
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea bind:value={rmaNotes} rows="2" placeholder="Additional notes" disabled={isLoading}></textarea>
        </div>
      </div>
    {:else if currentStep === 3}
      <div class="wizard-panel">
        {#if success}
          <h3>🎉 RMA recorded</h3>
          <p>{success}</p>
          <div class="info-box success">
            <p><strong>{selectedItem?.serialNumber || selectedItem?.assetTag}</strong></p>
            <p>RMA: {rmaNumber} — {rmaVendor}</p>
          </div>
          <a href="/modules/inventory" class="next-step-item">View in Inventory →</a>
        {:else}
          <h3>Review & submit</h3>
          <div class="summary-row"><span class="label">Item</span><span class="value">{selectedItem?.serialNumber || selectedItem?.assetTag} — {selectedItem?.model}</span></div>
          <div class="summary-row"><span class="label">RMA Number</span><span class="value">{rmaNumber}</span></div>
          <div class="summary-row"><span class="label">Vendor</span><span class="value">{rmaVendor}</span></div>
          <div class="summary-row"><span class="label">Reason</span><span class="value">{rmaReason || '—'}</span></div>
          {#if expectedReturnDate}
            <div class="summary-row"><span class="label">Expected Return</span><span class="value">{expectedReturnDate}</span></div>
          {/if}
          <button type="button" class="wizard-btn-primary" on:click={submitRMA} disabled={isLoading}>
            {isLoading ? 'Submitting...' : 'Mark as RMA'}
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <div slot="footer" let:currentStep let:nextStep let:prevStep let:handleClose let:isLoading>
    {#if currentStep > 0 && currentStep < steps.length - 1}
      <button class="wizard-btn-secondary" on:click={prevStep} disabled={isLoading}>← Previous</button>
    {:else if currentStep === 0}
      <button class="wizard-btn-secondary" on:click={handleClose} disabled={isLoading}>Cancel</button>
    {/if}
    <div class="footer-actions">
      {#if currentStep === 2}
        <button class="wizard-btn-primary" on:click={nextStep} disabled={isLoading}>Next →</button>
      {:else if currentStep === 3 && success}
        <button class="wizard-btn-primary" on:click={handleClose}>Done</button>
      {:else if currentStep < steps.length - 1}
        <button class="wizard-btn-primary" on:click={nextStep} disabled={isLoading}>Next →</button>
      {/if}
    </div>
  </div>
</BaseWizard>

<style>
  .wizard-panel h3 { margin: 0 0 var(--spacing-md) 0; font-size: var(--font-size-2xl); color: var(--text-primary); }
  .wizard-panel p { margin: var(--spacing-sm) 0; color: var(--text-secondary); }
  .hint { font-size: var(--font-size-sm); color: var(--text-secondary); }
  .info-box { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--spacing-md); margin: var(--spacing-md) 0; color: var(--text-primary); }
  .info-box.success { background: var(--success-light); border-color: var(--success-color); }
  .info-box ul { margin: var(--spacing-sm) 0 0 0; padding-left: 1.25rem; }
  .form-group { margin: var(--spacing-md) 0; }
  .form-group label { display: block; margin-bottom: var(--spacing-sm); font-weight: var(--font-weight-medium); color: var(--text-primary); }
  .form-group input, .form-group select, .form-group textarea { width: 100%; padding: var(--spacing-sm) var(--spacing-md); border: 1px solid var(--border-color); border-radius: var(--radius-md); font-size: var(--font-size-sm); background: var(--input-bg); color: var(--text-primary); }
  .required { color: var(--danger-color); }
  .item-list { max-height: 280px; overflow-y: auto; margin-top: var(--spacing-md); }
  .item-card { display: block; width: 100%; text-align: left; padding: var(--spacing-md); margin-bottom: var(--spacing-sm); border: 2px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-secondary); color: var(--text-primary); cursor: pointer; transition: all 0.2s; }
  .item-card:hover { border-color: var(--primary-color); }
  .item-card.selected { border-color: var(--primary-color); background: var(--primary-color); color: var(--text-inverse); }
  .item-serial { font-weight: 600; display: block; }
  .item-meta { font-size: var(--font-size-sm); opacity: 0.9; }
  .summary-row { display: flex; justify-content: space-between; padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
  .summary-row .label { color: var(--text-secondary); }
  .next-step-item { display: inline-block; margin-top: var(--spacing-md); padding: var(--spacing-sm) var(--spacing-md); background: var(--primary-color); color: var(--text-inverse); border-radius: var(--radius-md); text-decoration: none; }
  .footer-actions { display: flex; gap: var(--spacing-sm); }
</style>
