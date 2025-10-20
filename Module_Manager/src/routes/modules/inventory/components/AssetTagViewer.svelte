<script lang="ts">
  import { onMount } from 'svelte';
  import { barcodeService } from '$lib/services/barcodeService';
  import type { InventoryItem } from '$lib/services/inventoryService';
  
  export let item: InventoryItem;
  export let show = false;
  
  let qrCodeDataURL = '';
  let isGenerating = false;
  
  $: if (show && item) {
    generateQRCode();
  }
  
  async function generateQRCode() {
    isGenerating = true;
    try {
      const qrData = JSON.stringify({
        assetTag: item.assetTag,
        serialNumber: item.serialNumber,
        id: item._id,
        type: 'inventory'
      });
      
      qrCodeDataURL = await barcodeService.generateQRCodeDataURL(qrData, { size: 200 });
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    } finally {
      isGenerating = false;
    }
  }
  
  async function handlePrint() {
    const tagHTML = await barcodeService.generateAssetTag({
      assetTag: item.assetTag || 'N/A',
      serialNumber: item.serialNumber,
      manufacturer: item.manufacturer,
      model: item.model,
      location: item.currentLocation?.siteName || item.currentLocation?.type
    });
    
    barcodeService.printAssetTag(tagHTML);
  }
  
  function handleClose() {
    show = false;
  }
</script>

{#if show}
<div class="modal-overlay" on:click={handleClose}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <h2>🏷️ Asset Tag</h2>
      <button class="close-btn" on:click={handleClose}>✕</button>
    </div>
    
    <div class="modal-body">
      {#if isGenerating}
        <div class="loading">
          <div class="spinner"></div>
          <p>Generating QR code...</p>
        </div>
      {:else}
        <div class="asset-tag">
          <div class="tag-header">
            <h3>ASSET TAG</h3>
            <div class="asset-number">{item.assetTag || 'No Asset Tag'}</div>
          </div>
          
          <div class="qr-section">
            {#if qrCodeDataURL}
              <img src={qrCodeDataURL} alt="QR Code" class="qr-code" />
            {:else}
              <div class="qr-placeholder">QR Code</div>
            {/if}
          </div>
          
          <div class="details-section">
            <div class="detail-row">
              <span class="label">Serial Number:</span>
              <span class="value">{item.serialNumber}</span>
            </div>
            {#if item.manufacturer}
              <div class="detail-row">
                <span class="label">Manufacturer:</span>
                <span class="value">{item.manufacturer}</span>
              </div>
            {/if}
            {#if item.model}
              <div class="detail-row">
                <span class="label">Model:</span>
                <span class="value">{item.model}</span>
              </div>
            {/if}
            {#if item.currentLocation}
              <div class="detail-row">
                <span class="label">Location:</span>
                <span class="value">{item.currentLocation.siteName || item.currentLocation.type}</span>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" on:click={handleClose}>Close</button>
      <button class="btn-primary" on:click={handlePrint}>
        🖨️ Print Label
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
  }

  .modal-content {
    background: var(--card-bg);
    border-radius: 12px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
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
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
  }

  .close-btn:hover {
    color: var(--text-primary);
  }

  .modal-body {
    padding: 2rem;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(124, 58, 237, 0.2);
    border-top-color: var(--brand-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .asset-tag {
    border: 2px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    background: white;
    color: #000;
  }

  .tag-header {
    text-align: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid #000;
  }

  .tag-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: bold;
  }

  .asset-number {
    font-size: 1.75rem;
    font-weight: bold;
    margin: 0.5rem 0;
    font-family: monospace;
  }

  .qr-section {
    display: flex;
    justify-content: center;
    margin: 1.5rem 0;
  }

  .qr-code {
    width: 200px;
    height: 200px;
    border: 1px solid #ddd;
  }

  .qr-placeholder {
    width: 200px;
    height: 200px;
    border: 2px dashed #ddd;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
  }

  .details-section {
    font-size: 0.875rem;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #eee;
  }

  .detail-row .label {
    font-weight: 600;
  }

  .detail-row .value {
    font-family: monospace;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
  }

  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-primary {
    background: var(--brand-primary);
    color: white;
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
</style>

