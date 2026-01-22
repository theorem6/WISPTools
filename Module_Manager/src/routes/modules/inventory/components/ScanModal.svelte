<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { inventoryService, type InventoryItem } from '$lib/services/inventoryService';
  import { currentTenant } from '$lib/stores/tenantStore';
  
  export let show = false;
  export let mode: 'check-in' | 'check-out' | 'lookup' = 'lookup';
  
  const dispatch = createEventDispatcher();
  
  let scanning = false;
  let identifier = '';
  let scannedItem: InventoryItem | null = null;
  let error = '';
  let success = '';
  let loading = false;
  
  // Location for check-in/out
  let locationType: 'warehouse' | 'tower' | 'noc' | 'vehicle' | 'customer' | 'other' = 'warehouse';
  let locationDetails: any = {
    warehouse: { name: '' },
    tower: { siteId: '', rack: '', rackUnit: '' },
    vehicle: { vehicleId: '', vehicleName: '' },
    customer: { customerId: '', customerName: '', serviceAddress: '' }
  };
  let notes = '';
  
  // Camera/video stream
  let videoStream: MediaStream | null = null;
  let videoElement: HTMLVideoElement | null = null;
  let usingCamera = false;
  
  // Barcode scanner library (using HTML5 BarcodeDetector API if available, otherwise manual entry)
  let barcodeDetector: any = null;
  
  onMount(async () => {
    // Check if BarcodeDetector API is available
    if ('BarcodeDetector' in window) {
      try {
        // @ts-ignore - BarcodeDetector may not be in TypeScript definitions
        barcodeDetector = new window.BarcodeDetector({
          formats: ['code_128', 'ean_13', 'qr_code', 'data_matrix']
        });
      } catch (err) {
        console.warn('BarcodeDetector not supported:', err);
      }
    }
  });
  
  onDestroy(() => {
    stopCamera();
  });
  
  async function startCamera() {
    try {
      if (!videoElement) return;
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera on mobile
      });
      
      videoStream = stream;
      videoElement.srcObject = stream;
      usingCamera = true;
      scanning = true;
      
      // Start scanning loop
      scanBarcode();
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      error = 'Could not access camera. Please ensure permissions are granted or use manual entry.';
      usingCamera = false;
    }
  }
  
  function stopCamera() {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }
    if (videoElement) {
      videoElement.srcObject = null;
    }
    scanning = false;
    usingCamera = false;
  }
  
  async function scanBarcode() {
    if (!videoElement || !barcodeDetector || !scanning) return;
    
    try {
      const barcodes = await barcodeDetector.detect(videoElement);
      
      if (barcodes && barcodes.length > 0) {
        const barcode = barcodes[0];
        if (barcode.rawValue) {
          identifier = barcode.rawValue;
          stopCamera();
          await lookupItem();
        }
      }
      
      // Continue scanning if still active
      if (scanning) {
        requestAnimationFrame(() => scanBarcode());
      }
    } catch (err) {
      console.error('Error scanning barcode:', err);
      // Continue scanning even on error
      if (scanning) {
        requestAnimationFrame(() => scanBarcode());
      }
    }
  }
  
  async function lookupItem() {
    if (!identifier.trim()) {
      error = 'Please enter or scan an identifier';
      return;
    }
    
    loading = true;
    error = '';
    success = '';
    scannedItem = null;
    
    try {
      const item = await inventoryService.scanLookup(identifier);
      scannedItem = item;
      success = 'Item found!';
    } catch (err: any) {
      error = err.message || 'Item not found';
      scannedItem = null;
    } finally {
      loading = false;
    }
  }
  
  async function handleCheckIn() {
    if (!scannedItem || !identifier) {
      error = 'Please lookup an item first';
      return;
    }
    
    loading = true;
    error = '';
    success = '';
    
    try {
      const location = buildLocation();
      const updatedItem = await inventoryService.scanCheckIn(identifier, location, notes);
      success = 'Item checked in successfully!';
      scannedItem = updatedItem;
      dispatch('checked-in', { item: updatedItem });
      setTimeout(() => {
        close();
      }, 1500);
    } catch (err: any) {
      error = err.message || 'Failed to check in item';
    } finally {
      loading = false;
    }
  }
  
  async function handleCheckOut() {
    if (!scannedItem || !identifier) {
      error = 'Please lookup an item first';
      return;
    }
    
    loading = true;
    error = '';
    success = '';
    
    try {
      const location = buildLocation();
      const updatedItem = await inventoryService.scanCheckOut(identifier, location, notes);
      success = 'Item checked out successfully!';
      scannedItem = updatedItem;
      dispatch('checked-out', { item: updatedItem });
      setTimeout(() => {
        close();
      }, 1500);
    } catch (err: any) {
      error = err.message || 'Failed to check out item';
    } finally {
      loading = false;
    }
  }
  
  function buildLocation() {
    const baseLocation: any = {
      type: locationType
    };
    
    switch (locationType) {
      case 'warehouse':
        baseLocation.warehouse = locationDetails.warehouse;
        break;
      case 'tower':
      case 'noc':
        baseLocation.siteId = locationDetails.tower.siteId;
        baseLocation.tower = {
          rack: locationDetails.tower.rack,
          rackUnit: locationDetails.tower.rackUnit
        };
        break;
      case 'vehicle':
        baseLocation.vehicle = {
          vehicleId: locationDetails.vehicle.vehicleId,
          vehicleName: locationDetails.vehicle.vehicleName
        };
        break;
      case 'customer':
        baseLocation.customer = {
          customerId: locationDetails.customer.customerId,
          customerName: locationDetails.customer.customerName,
          serviceAddress: locationDetails.customer.serviceAddress
        };
        break;
    }
    
    return baseLocation;
  }
  
  function close() {
    stopCamera();
    identifier = '';
    scannedItem = null;
    error = '';
    success = '';
    notes = '';
    dispatch('close');
  }
  
  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && identifier && !loading) {
      lookupItem();
    }
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={close}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>
          {#if mode === 'check-in'}
            📥 Check In Item
          {:else if mode === 'check-out'}
            📤 Check Out Item
          {:else}
            🔍 Look Up Item
          {/if}
        </h2>
        <button class="close-btn" on:click={close}>✕</button>
      </div>
      
      <div class="modal-body">
        {#if error}
          <div class="alert alert-error">
            <span>❌</span>
            <span>{error}</span>
          </div>
        {/if}
        
        {#if success}
          <div class="alert alert-success">
            <span>✓</span>
            <span>{success}</span>
          </div>
        {/if}
        
        <!-- Scanner Section -->
        <div class="scanner-section">
          <div class="input-group">
            <label>Scan or Enter Identifier</label>
            <div class="input-with-buttons">
              <input
                type="text"
                bind:value={identifier}
                placeholder="Barcode, QR Code, Asset Tag, or Serial Number"
                on:keypress={handleKeyPress}
                disabled={loading || scanning}
              />
              {#if barcodeDetector}
                <button 
                  class="btn btn-icon" 
                  on:click={usingCamera ? stopCamera : startCamera}
                  title={usingCamera ? 'Stop Camera' : 'Start Camera'}
                >
                  {#if usingCamera}
                    📹
                  {:else}
                    📷
                  {/if}
                </button>
              {/if}
              <button 
                class="btn btn-icon" 
                on:click={lookupItem}
                disabled={!identifier || loading}
              >
                🔍
              </button>
            </div>
          </div>
          
          {#if usingCamera && videoElement}
            <div class="video-container">
              <video
                bind:this={videoElement}
                autoplay
                playsinline
                class="scanner-video"
              >
                <track kind="captions" srclang="en" label="No captions available" />
              </video>
            </div>
          {/if}
        </div>
        
        {#if loading}
          <div class="loading">
            <div class="spinner"></div>
            <p>Looking up item...</p>
          </div>
        {/if}
        
        {#if scannedItem}
          <div class="item-details">
            <h3>Item Details</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <label>Asset Tag:</label>
                <span>{scannedItem.assetTag || 'N/A'}</span>
              </div>
              <div class="detail-item">
                <label>Serial Number:</label>
                <span>{scannedItem.serialNumber}</span>
              </div>
              <div class="detail-item">
                <label>Category:</label>
                <span>{scannedItem.category}</span>
              </div>
              <div class="detail-item">
                <label>Type:</label>
                <span>{scannedItem.equipmentType}</span>
              </div>
              <div class="detail-item">
                <label>Manufacturer:</label>
                <span>{scannedItem.manufacturer || 'N/A'}</span>
              </div>
              <div class="detail-item">
                <label>Model:</label>
                <span>{scannedItem.model || 'N/A'}</span>
              </div>
              <div class="detail-item">
                <label>Status:</label>
                <span class="badge badge-{scannedItem.status}">{scannedItem.status}</span>
              </div>
              <div class="detail-item">
                <label>Current Location:</label>
                <span>{scannedItem.currentLocation?.type || 'N/A'}</span>
              </div>
            </div>
            
            {#if mode !== 'lookup'}
              <div class="location-section">
                <h3>New Location</h3>
                
                <div class="form-group">
                  <label>Location Type</label>
                  <select bind:value={locationType}>
                    <option value="warehouse">Warehouse</option>
                    <option value="tower">Tower Site</option>
                    <option value="noc">NOC</option>
                    <option value="vehicle">Vehicle</option>
                    <option value="customer">Customer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                {#if locationType === 'warehouse'}
                  <div class="form-group">
                    <label>Warehouse Name</label>
                    <input 
                      type="text" 
                      bind:value={locationDetails.warehouse.name}
                      placeholder="Main Warehouse"
                    />
                  </div>
                {/if}
                
                {#if locationType === 'tower' || locationType === 'noc'}
                  <div class="form-group">
                    <label>Site ID</label>
                    <input 
                      type="text" 
                      bind:value={locationDetails.tower.siteId}
                      placeholder="Site ID"
                    />
                  </div>
                  <div class="form-group">
                    <label>Rack</label>
                    <input 
                      type="text" 
                      bind:value={locationDetails.tower.rack}
                      placeholder="Rack Number"
                    />
                  </div>
                  <div class="form-group">
                    <label>Rack Unit</label>
                    <input 
                      type="text" 
                      bind:value={locationDetails.tower.rackUnit}
                      placeholder="RU (e.g., 10-15)"
                    />
                  </div>
                {/if}
                
                {#if locationType === 'vehicle'}
                  <div class="form-group">
                    <label>Vehicle ID</label>
                    <input 
                      type="text" 
                      bind:value={locationDetails.vehicle.vehicleId}
                      placeholder="Vehicle ID"
                    />
                  </div>
                  <div class="form-group">
                    <label>Vehicle Name</label>
                    <input 
                      type="text" 
                      bind:value={locationDetails.vehicle.vehicleName}
                      placeholder="Vehicle Name"
                    />
                  </div>
                {/if}
                
                {#if locationType === 'customer'}
                  <div class="form-group">
                    <label>Customer ID</label>
                    <input 
                      type="text" 
                      bind:value={locationDetails.customer.customerId}
                      placeholder="Customer ID"
                    />
                  </div>
                  <div class="form-group">
                    <label>Customer Name</label>
                    <input 
                      type="text" 
                      bind:value={locationDetails.customer.customerName}
                      placeholder="Customer Name"
                    />
                  </div>
                  <div class="form-group">
                    <label>Service Address</label>
                    <input 
                      type="text" 
                      bind:value={locationDetails.customer.serviceAddress}
                      placeholder="Service Address"
                    />
                  </div>
                {/if}
                
                <div class="form-group">
                  <label>Notes (optional)</label>
                  <textarea 
                    bind:value={notes}
                    placeholder="Additional notes about this check-in/out"
                    rows="3"
                  ></textarea>
                </div>
              </div>
              
              <div class="modal-actions">
                {#if mode === 'check-in'}
                  <button 
                    class="btn btn-primary" 
                    on:click={handleCheckIn}
                    disabled={loading}
                  >
                    ✓ Check In
                  </button>
                {:else if mode === 'check-out'}
                  <button 
                    class="btn btn-primary" 
                    on:click={handleCheckOut}
                    disabled={loading}
                  >
                    ✓ Check Out
                  </button>
                {/if}
                <button class="btn btn-secondary" on:click={close}>Cancel</button>
              </div>
            {:else}
              <div class="modal-actions">
                <button class="btn btn-secondary" on:click={close}>Close</button>
              </div>
            {/if}
          </div>
        {/if}
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
    max-width: 700px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    color: var(--text-primary);
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
  
  .alert-success {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid #10b981;
    color: #10b981;
  }
  
  .scanner-section {
    margin-bottom: 1.5rem;
  }
  
  .input-group {
    margin-bottom: 1rem;
  }
  
  .input-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .input-with-buttons {
    display: flex;
    gap: 0.5rem;
  }
  
  .input-with-buttons input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    font-size: 1rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  
  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-icon {
    padding: 0.75rem;
    min-width: 48px;
    font-size: 1.25rem;
  }
  
  .btn-primary {
    background: var(--primary);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .video-container {
    margin-top: 1rem;
    border-radius: 0.5rem;
    overflow: hidden;
    max-height: 300px;
  }
  
  .scanner-video {
    width: 100%;
    height: auto;
    display: block;
  }
  
  .loading {
    text-align: center;
    padding: 2rem;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .item-details {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
  
  .item-details h3 {
    margin: 0 0 1rem;
    color: var(--text-primary);
  }
  
  .detail-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .detail-item label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-weight: 500;
  }
  
  .detail-item span {
    color: var(--text-primary);
  }
  
  .badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    font-weight: 500;
  }
  
  .badge-available { background: #10b981; color: white; }
  .badge-deployed { background: #3b82f6; color: white; }
  .badge-in-transit { background: #f59e0b; color: white; }
  .badge-maintenance { background: #ef4444; color: white; }
  
  .location-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
  
  .location-section h3 {
    margin: 0 0 1rem;
    color: var(--text-primary);
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
  
  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
</style>
