<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { inventoryService, type InventoryItem } from '$lib/services/inventoryService';
  import { barcodeService } from '$lib/services/barcodeService';

  let item: InventoryItem | null = null;
  let isLoading = true;
  let error = '';
  let showQRCode = false;
  let qrCodeDataURL = '';

  let itemId: string = '';
  $: itemId = $page.params.id ?? '';
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
    } catch (err: any) {
      error = err.message || 'Failed to load item';
      console.error('Error loading item:', err);
    } finally {
      isLoading = false;
    }
  }

  async function handleEdit() {
    goto(`/modules/inventory/${itemId}/edit`);
  }

  async function handleTransfer() {
    goto(`/modules/inventory/${itemId}/transfer`);
  }

  async function handlePrintTag() {
    if (!item) return;
    
    const tagHTML = await barcodeService.generateAssetTag({
      assetTag: item.assetTag || 'N/A',
      serialNumber: item.serialNumber,
      manufacturer: item.manufacturer,
      model: item.model,
      location: item.currentLocation?.siteName || item.currentLocation?.type
    });
    
    barcodeService.printAssetTag(tagHTML);
  }

  async function handleShowQR() {
    if (!item) return;
    
    showQRCode = true;
    const qrData = JSON.stringify({
      assetTag: item.assetTag,
      serialNumber: item.serialNumber,
      id: item._id,
      type: 'inventory'
    });
    
    qrCodeDataURL = await barcodeService.generateQRCodeDataURL(qrData, { size: 300 });
  }

  function formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  }

  function formatCurrency(amount: number | undefined): string {
    if (!amount) return 'N/A';
    return `$${amount.toLocaleString()}`;
  }
</script>

<TenantGuard>
<div class="item-detail-page">
  <div class="page-header">
    <div class="header-left">
      <button class="back-btn" on:click={() => goto('/modules/inventory')}>
        ← Back to Inventory
      </button>
      <h1>📦 Equipment Details</h1>
      {#if item}
        <p class="subtitle">{item.manufacturer} {item.model} - {item.serialNumber}</p>
      {/if}
    </div>

    <div class="header-actions">
      <button class="btn btn-secondary" on:click={handleShowQR} disabled={!item}>
        📱 View QR Code
      </button>
      <button class="btn btn-secondary" on:click={handlePrintTag} disabled={!item}>
        🖨️ Print Tag
      </button>
      <button class="btn btn-primary" on:click={handleEdit} disabled={!item}>
        ✏️ Edit
      </button>
      <button class="btn btn-primary" on:click={handleTransfer} disabled={!item}>
        📦 Transfer
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
  {:else if item}
    <div class="content-grid">
      <!-- Basic Information -->
      <div class="info-card">
        <h3>📋 Basic Information</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>Asset Tag</label>
            <span class="value">{item.assetTag || 'N/A'}</span>
          </div>
          <div class="info-item">
            <label>Serial Number</label>
            <span class="value">{item.serialNumber}</span>
          </div>
          <div class="info-item">
            <label>Category</label>
            <span class="value">{item.category}</span>
          </div>
          <div class="info-item">
            <label>Equipment Type</label>
            <span class="value">{item.equipmentType}</span>
          </div>
          <div class="info-item">
            <label>Manufacturer</label>
            <span class="value">{item.manufacturer || 'N/A'}</span>
          </div>
          <div class="info-item">
            <label>Model</label>
            <span class="value">{item.model || 'N/A'}</span>
          </div>
          <div class="info-item">
            <label>Status</label>
            <span class="status-badge {item.status}">{item.status}</span>
          </div>
          <div class="info-item">
            <label>Condition</label>
            <span class="condition-badge {item.condition}">{item.condition}</span>
          </div>
        </div>
      </div>

      <!-- Current Location -->
      <div class="info-card">
        <h3>📍 Current Location</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>Location Type</label>
            <span class="value">{item.currentLocation.type}</span>
          </div>
          {#if item.currentLocation.siteName}
            <div class="info-item">
              <label>Site Name</label>
              <span class="value">{item.currentLocation.siteName}</span>
            </div>
          {/if}
          {#if item.currentLocation.warehouse}
            <div class="info-item">
              <label>Warehouse</label>
              <span class="value">{item.currentLocation.warehouse.name || 'N/A'}</span>
            </div>
            <div class="info-item">
              <label>Section</label>
              <span class="value">{item.currentLocation.warehouse.section || 'N/A'}</span>
            </div>
            <div class="info-item">
              <label>Aisle</label>
              <span class="value">{item.currentLocation.warehouse.aisle || 'N/A'}</span>
            </div>
            <div class="info-item">
              <label>Shelf</label>
              <span class="value">{item.currentLocation.warehouse.shelf || 'N/A'}</span>
            </div>
          {/if}
          {#if item.currentLocation.tower}
            <div class="info-item">
              <label>Rack</label>
              <span class="value">{item.currentLocation.tower.rack || 'N/A'}</span>
            </div>
            <div class="info-item">
              <label>Rack Unit</label>
              <span class="value">{item.currentLocation.tower.rackUnit || 'N/A'}</span>
            </div>
            <div class="info-item">
              <label>Cabinet</label>
              <span class="value">{item.currentLocation.tower.cabinet || 'N/A'}</span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Purchase Information -->
      {#if item.purchaseInfo}
        <div class="info-card">
          <h3>💰 Purchase Information</h3>
          <div class="info-grid">
            <div class="info-item">
              <label>Vendor</label>
              <span class="value">{item.purchaseInfo.vendor || 'N/A'}</span>
            </div>
            <div class="info-item">
              <label>Purchase Date</label>
              <span class="value">{formatDate(item.purchaseInfo.purchaseDate)}</span>
            </div>
            <div class="info-item">
              <label>Purchase Price</label>
              <span class="value">{formatCurrency(item.purchaseInfo.purchasePrice)}</span>
            </div>
            <div class="info-item">
              <label>PO Number</label>
              <span class="value">{item.purchaseInfo.purchaseOrderNumber || 'N/A'}</span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Warranty Information -->
      {#if item.warranty}
        <div class="info-card">
          <h3>🛡️ Warranty Information</h3>
          <div class="info-grid">
            <div class="info-item">
              <label>Provider</label>
              <span class="value">{item.warranty.provider || 'N/A'}</span>
            </div>
            <div class="info-item">
              <label>Start Date</label>
              <span class="value">{formatDate(item.warranty.startDate)}</span>
            </div>
            <div class="info-item">
              <label>End Date</label>
              <span class="value">{formatDate(item.warranty.endDate)}</span>
            </div>
            <div class="info-item">
              <label>Type</label>
              <span class="value">{item.warranty.type || 'N/A'}</span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Technical Specifications -->
      {#if item.technicalSpecs}
        <div class="info-card">
          <h3>⚙️ Technical Specifications</h3>
          <div class="info-grid">
            <div class="info-item">
              <label>Power Requirements</label>
              <span class="value">{item.technicalSpecs.powerRequirements || 'N/A'}</span>
            </div>
            <div class="info-item">
              <label>IP Address</label>
              <span class="value">{item.technicalSpecs.ipAddress || 'N/A'}</span>
            </div>
            <div class="info-item">
              <label>Management URL</label>
              <span class="value">{item.technicalSpecs.managementUrl || 'N/A'}</span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Module Integration -->
      {#if item.modules}
        <div class="info-card">
          <h3>🔗 Module Integration</h3>
          <div class="info-grid">
            {#if item.modules.acs}
              <div class="info-item">
                <label>ACS Device ID</label>
                <span class="value">{item.modules.acs.deviceId}</span>
              </div>
              <div class="info-item">
                <label>ACS Last Sync</label>
                <span class="value">{formatDate(item.modules.acs.lastSync)}</span>
              </div>
            {/if}
            {#if item.modules.cbrs}
              <div class="info-item">
                <label>CBRS CBSD ID</label>
                <span class="value">{item.modules.cbrs.cbsdId}</span>
              </div>
              <div class="info-item">
                <label>CBRS Last Sync</label>
                <span class="value">{formatDate(item.modules.cbrs.lastSync)}</span>
              </div>
            {/if}
            {#if item.modules.coverageMap}
              <div class="info-item">
                <label>Coverage Map Site ID</label>
                <span class="value">{item.modules.coverageMap.siteId}</span>
              </div>
              <div class="info-item">
                <label>Map Last Sync</label>
                <span class="value">{formatDate(item.modules.coverageMap.lastSync)}</span>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Notes -->
      {#if item.notes}
        <div class="info-card full-width">
          <h3>📝 Notes</h3>
          <div class="notes-content">
            {item.notes}
          </div>
        </div>
      {/if}

      <!-- Metadata -->
      <div class="info-card full-width">
        <h3>📊 Metadata</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>Created</label>
            <span class="value">{formatDate(item.createdAt)}</span>
          </div>
          <div class="info-item">
            <label>Last Updated</label>
            <span class="value">{formatDate(item.updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
</TenantGuard>

<!-- QR Code Modal -->
{#if showQRCode && item}
<div class="modal-overlay" on:click={() => showQRCode = false}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <h3>📱 QR Code - {item.assetTag || item.serialNumber}</h3>
      <button class="close-btn" on:click={() => showQRCode = false}>✕</button>
    </div>
    <div class="modal-body">
      {#if qrCodeDataURL}
        <div class="qr-container">
          <img src={qrCodeDataURL} alt="QR Code" class="qr-image" />
          <p class="qr-info">Scan with mobile app to view equipment details</p>
        </div>
      {/if}
    </div>
  </div>
</div>
{/if}

<style>
  .item-detail-page {
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

  .content-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1.5rem;
  }

  .info-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
  }

  .info-card.full-width {
    grid-column: 1 / -1;
  }

  .info-card h3 {
    margin: 0 0 1.5rem 0;
    color: var(--text-primary);
    border-bottom: 2px solid var(--border-color);
    padding-bottom: 0.5rem;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .info-item label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .info-item .value {
    font-size: 1rem;
    color: var(--text-primary);
    font-weight: 500;
  }

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .status-badge.available { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
  .status-badge.deployed { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
  .status-badge.reserved { background: rgba(251, 191, 36, 0.2); color: #f59e0b; }
  .status-badge.in-transit { background: rgba(168, 85, 247, 0.2); color: #a855f7; }
  .status-badge.maintenance { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
  .status-badge.rma { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
  .status-badge.retired { background: rgba(107, 114, 128, 0.2); color: #6b7280; }

  .condition-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .condition-badge.new { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
  .condition-badge.excellent { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
  .condition-badge.good { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
  .condition-badge.fair { background: rgba(251, 191, 36, 0.2); color: #f59e0b; }
  .condition-badge.poor { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
  .condition-badge.damaged { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
  .condition-badge.refurbished { background: rgba(168, 85, 247, 0.2); color: #a855f7; }

  .notes-content {
    background: var(--bg-secondary);
    padding: 1rem;
    border-radius: 8px;
    white-space: pre-wrap;
    line-height: 1.6;
  }

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
    max-width: 500px;
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

  .qr-container {
    text-align: center;
  }

  .qr-image {
    max-width: 100%;
    height: auto;
    border: 1px solid var(--border-color);
    border-radius: 8px;
  }

  .qr-info {
    margin-top: 1rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
    }

    .content-grid {
      grid-template-columns: 1fr;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
