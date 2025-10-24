<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { inventoryService, type InventoryItem } from '$lib/services/inventoryService';

  let item: InventoryItem | null = null;
  let isLoading = true;
  let isSaving = false;
  let error = '';
  let success = '';

  // Form data
  let formData: Partial<InventoryItem> = {};

  $: itemId = $page.params.id;
  $: tenantId = $currentTenant?.id || '';

  onMount(async () => {
    if (itemId) {
      await loadItem();
    }
  });

  async function loadItem() {
    isLoading = true;
    error = '';
    
    try {
      item = await inventoryService.getItem(itemId);
      if (item) {
        formData = { 
          ...item,
          currentLocation: {
            type: 'warehouse',
            siteId: '',
            siteName: '',
            warehouse: { name: '', section: '', aisle: '', shelf: '', bin: '' },
            tower: { rack: '', rackUnit: '', cabinet: '', position: '' },
            ...item.currentLocation
          },
          purchaseInfo: {
            vendor: '',
            purchaseDate: '',
            purchasePrice: 0,
            purchaseOrderNumber: '',
            ...item.purchaseInfo
          },
          warranty: {
            provider: '',
            startDate: '',
            endDate: '',
            type: '',
            ...item.warranty
          },
          technicalSpecs: {
            powerRequirements: '',
            ipAddress: '',
            managementUrl: '',
            ...item.technicalSpecs
          }
        };
      }
    } catch (err: any) {
      error = err.message || 'Failed to load item';
      console.error('Error loading item:', err);
    } finally {
      isLoading = false;
    }
  }

  async function handleSave() {
    if (!item || !formData) return;

    isSaving = true;
    error = '';
    success = '';

    try {
      await inventoryService.updateItem(itemId, formData);
      success = 'Equipment updated successfully!';
      
      // Reload the item to get updated data
      await loadItem();
      
      // Redirect to view page after a short delay
      setTimeout(() => {
        goto(`/modules/inventory/${itemId}`);
      }, 1500);
    } catch (err: any) {
      error = err.message || 'Failed to update equipment';
      console.error('Error updating item:', err);
    } finally {
      isSaving = false;
    }
  }

  function handleCancel() {
    goto(`/modules/inventory/${itemId}`);
  }

  function formatDate(date: Date | string | undefined): string {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
  }
</script>

<TenantGuard>
<div class="edit-page">
  <div class="page-header">
    <div class="header-left">
      <button class="back-btn" on:click={() => goto(`/modules/inventory/${itemId}`)}>
        ← Back to Details
      </button>
      <h1>✏️ Edit Equipment</h1>
      {#if item}
        <p class="subtitle">{item.manufacturer} {item.model} - {item.serialNumber}</p>
      {/if}
    </div>

    <div class="header-actions">
      <button class="btn btn-secondary" on:click={handleCancel} disabled={isSaving}>
        Cancel
      </button>
      <button class="btn btn-primary" on:click={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  </div>

  {#if isLoading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading equipment details...</p>
    </div>
  {:else if error}
    <div class="error-banner">
      <span>⚠️</span>
      <span>{error}</span>
      <button on:click={() => error = ''}>✕</button>
    </div>
  {:else if success}
    <div class="success-banner">
      <span>✅</span>
      <span>{success}</span>
    </div>
  {:else if item && formData}
    <form on:submit|preventDefault={handleSave} class="edit-form">
      <div class="form-sections">
        <!-- Basic Information -->
        <div class="form-section">
          <h3>📋 Basic Information</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="assetTag">Asset Tag</label>
              <input 
                id="assetTag"
                type="text" 
                bind:value={formData.assetTag} 
                placeholder="Enter asset tag"
              />
            </div>
            
            <div class="form-group">
              <label for="serialNumber">Serial Number *</label>
              <input 
                id="serialNumber"
                type="text" 
                bind:value={formData.serialNumber} 
                placeholder="Enter serial number"
                required
              />
            </div>
            
            <div class="form-group">
              <label for="category">Category *</label>
              <select id="category" bind:value={formData.category} required>
                <option value="">Select category...</option>
                <option value="radio">Radio Equipment</option>
                <option value="antenna">Antenna</option>
                <option value="cpe">CPE Device</option>
                <option value="backhaul">Backhaul Equipment</option>
                <option value="power">Power Equipment</option>
                <option value="network">Network Equipment</option>
                <option value="test">Test Equipment</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="equipmentType">Equipment Type *</label>
              <input 
                id="equipmentType"
                type="text" 
                bind:value={formData.equipmentType} 
                placeholder="e.g., Sector Antenna, CPE Router"
                required
              />
            </div>
            
            <div class="form-group">
              <label for="manufacturer">Manufacturer</label>
              <input 
                id="manufacturer"
                type="text" 
                bind:value={formData.manufacturer} 
                placeholder="Enter manufacturer"
              />
            </div>
            
            <div class="form-group">
              <label for="model">Model</label>
              <input 
                id="model"
                type="text" 
                bind:value={formData.model} 
                placeholder="Enter model"
              />
            </div>
            
            <div class="form-group">
              <label for="status">Status *</label>
              <select id="status" bind:value={formData.status} required>
                <option value="available">Available</option>
                <option value="deployed">Deployed</option>
                <option value="reserved">Reserved</option>
                <option value="in-transit">In Transit</option>
                <option value="maintenance">Maintenance</option>
                <option value="rma">RMA</option>
                <option value="retired">Retired</option>
                <option value="lost">Lost</option>
                <option value="sold">Sold</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="condition">Condition *</label>
              <select id="condition" bind:value={formData.condition} required>
                <option value="new">New</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
                <option value="damaged">Damaged</option>
                <option value="refurbished">Refurbished</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Current Location -->
        <div class="form-section">
          <h3>📍 Current Location</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="locationType">Location Type *</label>
              <select id="locationType" bind:value={formData.currentLocation.type} required>
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
            
            <div class="form-group">
              <label for="siteName">Site Name</label>
              <input 
                id="siteName"
                type="text" 
                bind:value={formData.currentLocation.siteName} 
                placeholder="Enter site name"
              />
            </div>
          </div>
        </div>

        <!-- Purchase Information -->
        <div class="form-section">
          <h3>💰 Purchase Information</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="vendor">Vendor</label>
              <input 
                id="vendor"
                type="text" 
                bind:value={formData.purchaseInfo.vendor} 
                placeholder="Enter vendor name"
              />
            </div>
            
            <div class="form-group">
              <label for="purchaseDate">Purchase Date</label>
              <input 
                id="purchaseDate"
                type="date" 
                bind:value={formData.purchaseInfo.purchaseDate} 
              />
            </div>
            
            <div class="form-group">
              <label for="purchasePrice">Purchase Price</label>
              <input 
                id="purchasePrice"
                type="number" 
                step="0.01"
                bind:value={formData.purchaseInfo.purchasePrice} 
                placeholder="0.00"
              />
            </div>
            
            <div class="form-group">
              <label for="purchaseOrderNumber">PO Number</label>
              <input 
                id="purchaseOrderNumber"
                type="text" 
                bind:value={formData.purchaseInfo.purchaseOrderNumber} 
                placeholder="Enter PO number"
              />
            </div>
          </div>
        </div>

        <!-- Warranty Information -->
        <div class="form-section">
          <h3>🛡️ Warranty Information</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="warrantyProvider">Provider</label>
              <input 
                id="warrantyProvider"
                type="text" 
                bind:value={formData.warranty.provider} 
                placeholder="Enter warranty provider"
              />
            </div>
            
            <div class="form-group">
              <label for="warrantyStartDate">Start Date</label>
              <input 
                id="warrantyStartDate"
                type="date" 
                bind:value={formData.warranty.startDate} 
              />
            </div>
            
            <div class="form-group">
              <label for="warrantyEndDate">End Date</label>
              <input 
                id="warrantyEndDate"
                type="date" 
                bind:value={formData.warranty.endDate} 
              />
            </div>
            
            <div class="form-group">
              <label for="warrantyType">Type</label>
              <input 
                id="warrantyType"
                type="text" 
                bind:value={formData.warranty.type} 
                placeholder="e.g., Manufacturer, Extended"
              />
            </div>
          </div>
        </div>

        <!-- Technical Specifications -->
        <div class="form-section">
          <h3>⚙️ Technical Specifications</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="powerRequirements">Power Requirements</label>
              <input 
                id="powerRequirements"
                type="text" 
                bind:value={formData.technicalSpecs.powerRequirements} 
                placeholder="e.g., 24V DC, 2A"
              />
            </div>
            
            <div class="form-group">
              <label for="ipAddress">IP Address</label>
              <input 
                id="ipAddress"
                type="text" 
                bind:value={formData.technicalSpecs.ipAddress} 
                placeholder="192.168.1.100"
              />
            </div>
            
            <div class="form-group">
              <label for="managementUrl">Management URL</label>
              <input 
                id="managementUrl"
                type="url" 
                bind:value={formData.technicalSpecs.managementUrl} 
                placeholder="http://192.168.1.100"
              />
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div class="form-section">
          <h3>📝 Notes</h3>
          <div class="form-group">
            <label for="notes">Additional Notes</label>
            <textarea 
              id="notes"
              bind:value={formData.notes} 
              placeholder="Enter any additional notes or comments..."
              rows="4"
            ></textarea>
          </div>
        </div>
      </div>
    </form>
  {/if}
</div>
</TenantGuard>

<style>
  .edit-page {
    min-height: 100vh;
    background: var(--bg-primary);
    padding: 2rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    gap: 1rem;
  }

  .header-left h1 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }

  .subtitle {
    color: var(--text-secondary);
    margin: 0;
  }

  .back-btn {
    background: none;
    border: 1px solid var(--border-color);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-secondary);
    margin-bottom: 1rem;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: var(--bg-hover);
    border-color: var(--brand-primary);
    color: var(--brand-primary);
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
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

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4rem;
    gap: 1rem;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(124, 58, 237, 0.2);
    border-top-color: var(--brand-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-banner {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .success-banner {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #22c55e;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .edit-form {
    max-width: 1200px;
  }

  .form-sections {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .form-section {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
  }

  .form-section h3 {
    margin: 0 0 1.5rem 0;
    color: var(--text-primary);
    border-bottom: 2px solid var(--border-color);
    padding-bottom: 0.5rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
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

  .form-group textarea {
    resize: vertical;
    min-height: 100px;
  }

  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
