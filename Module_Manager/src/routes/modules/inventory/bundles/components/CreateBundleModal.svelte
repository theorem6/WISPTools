<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { bundleService, type HardwareBundle, type BundleItem } from '$lib/services/bundleService';
  import { categoryList, getEquipmentTypesByCategory } from '$lib/config/equipmentCategories';
  
  const dispatch = createEventDispatcher();
  
  export let show = true;
  
  let loading = false;
  let error = '';
  
  let formData: Partial<HardwareBundle> = {
    name: '',
    description: '',
    bundleType: 'standard',
    items: [],
    tags: [],
    status: 'active',
    notes: ''
  };
  
  let newItem: Partial<BundleItem> = {
    category: 'Radio Equipment',
    equipmentType: '',
    quantity: 1,
    manufacturer: '',
    model: '',
    estimatedCost: 0
  };
  
  const bundleTypes = [
    { value: 'standard', label: 'Standard', emoji: '📦' },
    { value: 'custom', label: 'Custom', emoji: '🔧' },
    { value: 'site-deployment', label: 'Site Deployment', emoji: '🏗️' },
    { value: 'cpe-installation', label: 'CPE Installation', emoji: '📡' },
    { value: 'maintenance-kit', label: 'Maintenance Kit', emoji: '🔧' },
    { value: 'emergency-kit', label: 'Emergency Kit', emoji: '🚨' }
  ];
  
  $: availableTypes = getEquipmentTypesByCategory(newItem.category || 'Radio Equipment');
  $: totalCost = (formData.items || []).reduce((sum, item) => {
    const itemCost = (item.estimatedCost || 0) * (item.quantity || 1);
    return sum + itemCost;
  }, 0);
  
  async function handleSubmit() {
    if (!formData.name?.trim()) {
      error = 'Bundle name is required';
      return;
    }
    
    if (!formData.items || formData.items.length === 0) {
      error = 'At least one item is required';
      return;
    }
    
    loading = true;
    error = '';
    
    try {
      formData.estimatedTotalCost = totalCost;
      await bundleService.createBundle(formData);
      dispatch('close');
    } catch (err: any) {
      error = err.message || 'Failed to create bundle';
    } finally {
      loading = false;
    }
  }
  
  function addItem() {
    if (!newItem.equipmentType || !newItem.category) {
      error = 'Equipment type and category are required';
      return;
    }
    
    if (!formData.items) {
      formData.items = [];
    }
    
    formData.items.push({
      ...newItem,
      quantity: newItem.quantity || 1,
      equipmentType: newItem.equipmentType,
      category: newItem.category
    } as BundleItem);
    
    // Reset new item form
    newItem = {
      category: newItem.category,
      equipmentType: '',
      quantity: 1,
      manufacturer: '',
      model: '',
      estimatedCost: 0
    };
    
    error = '';
  }
  
  function removeItem(index: number) {
    if (formData.items) {
      formData.items.splice(index, 1);
    }
  }
  
  function addTag() {
    const tagInput = document.getElementById('tag-input') as HTMLInputElement;
    if (tagInput && tagInput.value.trim()) {
      if (!formData.tags) {
        formData.tags = [];
      }
      if (!formData.tags.includes(tagInput.value.trim())) {
        formData.tags.push(tagInput.value.trim());
      }
      tagInput.value = '';
    }
  }
  
  function removeTag(tag: string) {
    if (formData.tags) {
      formData.tags = formData.tags.filter(t => t !== tag);
    }
  }
  
  function close() {
    dispatch('close');
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={close}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>➕ Create Hardware Bundle</h2>
        <button class="close-btn" on:click={close}>✕</button>
      </div>
      
      <div class="modal-body">
        {#if error}
          <div class="alert alert-error">
            <span>❌</span>
            <span>{error}</span>
          </div>
        {/if}
        
        <div class="form-section">
          <h3>Basic Information</h3>
          
          <div class="form-group">
            <label>Bundle Name *</label>
            <input 
              type="text" 
              bind:value={formData.name}
              placeholder="e.g., Standard Site Deployment Kit"
              required
            />
          </div>
          
          <div class="form-group">
            <label>Description</label>
            <textarea 
              bind:value={formData.description}
              placeholder="Describe this bundle and when to use it..."
              rows="3"
            ></textarea>
          </div>
          
          <div class="form-group">
            <label>Bundle Type</label>
            <select bind:value={formData.bundleType}>
              {#each bundleTypes as type}
                <option value={type.value}>{type.emoji} {type.label}</option>
              {/each}
            </select>
          </div>
          
          <div class="form-group">
            <label>Tags</label>
            <div class="tag-input-group">
              <input 
                id="tag-input"
                type="text" 
                placeholder="Add a tag..."
                on:keypress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <button class="btn-sm" on:click={addTag}>Add</button>
            </div>
            {#if formData.tags && formData.tags.length > 0}
              <div class="tags-list">
                {#each formData.tags as tag}
                  <span class="tag">
                    {tag}
                    <button class="tag-remove" on:click={() => removeTag(tag)}>✕</button>
                  </span>
                {/each}
              </div>
            {/if}
          </div>
        </div>
        
        <div class="form-section">
          <h3>Bundle Items</h3>
          
          <div class="add-item-form">
            <div class="form-row">
              <div class="form-group">
                <label>Category</label>
                <select bind:value={newItem.category}>
                  {#each categoryList as category}
                    <option value={category}>{category}</option>
                  {/each}
                </select>
              </div>
              
              <div class="form-group">
                <label>Equipment Type *</label>
                <select bind:value={newItem.equipmentType} required>
                  <option value="">Select type...</option>
                  {#each availableTypes as type}
                    <option value={type}>{type}</option>
                  {/each}
                </select>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>Quantity *</label>
                <input 
                  type="number" 
                  bind:value={newItem.quantity}
                  min="1"
                  required
                />
              </div>
              
              <div class="form-group">
                <label>Manufacturer</label>
                <input 
                  type="text" 
                  bind:value={newItem.manufacturer}
                  placeholder="e.g., Ubiquiti"
                />
              </div>
              
              <div class="form-group">
                <label>Model</label>
                <input 
                  type="text" 
                  bind:value={newItem.model}
                  placeholder="e.g., AirFiber 5X"
                />
              </div>
              
              <div class="form-group">
                <label>Estimated Cost per Unit</label>
                <input 
                  type="number" 
                  bind:value={newItem.estimatedCost}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <button class="btn-add" on:click={addItem} type="button">
              ➕ Add Item
            </button>
          </div>
          
          {#if formData.items && formData.items.length > 0}
            <div class="items-list">
              <h4>Bundle Items ({formData.items.length})</h4>
              <div class="items-table">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Type</th>
                      <th>Qty</th>
                      <th>Manufacturer</th>
                      <th>Model</th>
                      <th>Cost</th>
                      <th>Total</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each formData.items as item, index}
                      <tr>
                        <td>{item.category}</td>
                        <td>{item.equipmentType}</td>
                        <td>{item.quantity}</td>
                        <td>{item.manufacturer || '-'}</td>
                        <td>{item.model || '-'}</td>
                        <td>${(item.estimatedCost || 0).toFixed(2)}</td>
                        <td>${((item.estimatedCost || 0) * (item.quantity || 1)).toFixed(2)}</td>
                        <td>
                          <button class="btn-remove" on:click={() => removeItem(index)}>
                            🗑️
                          </button>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="6" style="text-align: right; font-weight: 600;">Total:</td>
                      <td style="font-weight: 600;">${totalCost.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          {/if}
        </div>
        
        <div class="form-section">
          <h3>Notes</h3>
          <textarea 
            bind:value={formData.notes}
            placeholder="Additional notes about this bundle..."
            rows="3"
          ></textarea>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={close} disabled={loading}>
          Cancel
        </button>
        <button class="btn-primary" on:click={handleSubmit} disabled={loading}>
          {loading ? 'Creating...' : 'Create Bundle'}
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
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  
  .modal-content {
    background: var(--card-bg, var(--bg-primary));
    border-radius: 0.75rem;
    box-shadow: var(--shadow-xl);
    max-width: 900px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
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
    font-size: 1.5rem;
    color: var(--text-primary);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem 0.5rem;
  }
  
  .close-btn:hover {
    color: var(--text-primary);
  }
  
  .modal-body {
    padding: 1.5rem;
    flex: 1;
    overflow-y: auto;
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
  
  .alert {
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    color: #ef4444;
  }
  
  .form-section {
    margin-bottom: 2rem;
  }
  
  .form-section h3 {
    margin: 0 0 1rem;
    font-size: 1.25rem;
    color: var(--text-primary);
    border-bottom: 2px solid var(--border-color);
    padding-bottom: 0.5rem;
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    font-size: 1rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-family: inherit;
  }
  
  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .tag-input-group {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  
  .tag-input-group input {
    flex: 1;
  }
  
  .btn-sm {
    padding: 0.75rem 1rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.875rem;
    white-space: nowrap;
  }
  
  .btn-sm:hover {
    background: var(--bg-secondary);
  }
  
  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.75rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 1rem;
    font-size: 0.875rem;
    color: var(--text-primary);
  }
  
  .tag-remove {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
  
  .tag-remove:hover {
    color: var(--text-primary);
  }
  
  .add-item-form {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
  }
  
  .btn-add {
    width: 100%;
    padding: 0.75rem;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 1rem;
  }
  
  .btn-add:hover {
    opacity: 0.9;
  }
  
  .items-list {
    margin-top: 1.5rem;
  }
  
  .items-list h4 {
    margin: 0 0 1rem;
    color: var(--text-primary);
  }
  
  .items-table {
    overflow-x: auto;
  }
  
  .items-table table {
    width: 100%;
    border-collapse: collapse;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  .items-table thead {
    background: var(--bg-tertiary);
  }
  
  .items-table th {
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.875rem;
    border-bottom: 2px solid var(--border-color);
  }
  
  .items-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
  }
  
  .items-table tbody tr:hover {
    background: var(--bg-tertiary);
  }
  
  .items-table tfoot {
    background: var(--bg-tertiary);
  }
  
  .btn-remove {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    padding: 0.25rem 0.5rem;
  }
  
  .btn-remove:hover {
    opacity: 0.7;
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--primary);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }
  
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-tertiary);
  }
  
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

