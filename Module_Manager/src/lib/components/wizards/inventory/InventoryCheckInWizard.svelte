<script lang="ts">
  /**
   * Inventory Check-in Wizard
   * 
   * Guides warehouse staff through receiving and checking in inventory items.
   */
  
  import BaseWizard from '../BaseWizard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  
  export let show = false;
  
  let currentStep = 0;
  let isLoading = false;
  let error = '';
  let success = '';
  
  // Wizard steps
  const steps = [
    { id: 'welcome', title: 'Welcome', icon: '📦' },
    { id: 'scan', title: 'Scan Item', icon: '📷' },
    { id: 'verify', title: 'Verify', icon: '✅' },
    { id: 'location', title: 'Set Location', icon: '📍' },
    { id: 'label', title: 'Print Label', icon: '🏷️' },
    { id: 'complete', title: 'Complete', icon: '🎉' }
  ];
  
  // Check-in state
  let scanMethod: 'barcode' | 'manual' | 'bulk' | null = null;
  let scannedSerial = '';
  let scannedBarcode = '';
  let itemDetails: {
    serialNumber: string;
    name: string;
    category: string;
    manufacturer: string;
    model: string;
    purchaseOrder?: string;
  } | null = null;
  let locationType: 'warehouse' | 'tower' | 'noc' | 'vehicle' | 'other' = 'warehouse';
  let locationDetails: Record<string, any> = {
    warehouse: { section: '', shelf: '' },
    tower: { siteId: '', rack: '', rackUnit: '' },
    noc: { room: '', rack: '' },
    vehicle: { vehicleId: '', vehicleName: '' },
    other: { description: '' }
  };
  let availableSites: Array<{ id: string; name: string }> = [];
  let printLabel = true;
  let checkInNotes = '';
  let purchaseOrderId = '';
  
  async function loadSites() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) return;
    
    try {
      const { coverageMapService } = await import('../../../../routes/modules/coverage-map/lib/coverageMapService.mongodb');
      const sites = await coverageMapService.getTowerSites(tenantId);
      availableSites = sites.map((site: any) => ({
        id: site.id || site._id,
        name: site.name
      }));
    } catch (err) {
      console.error('Failed to load sites:', err);
    }
  }
  
  function handleClose() {
    show = false;
    resetWizard();
  }
  
  function resetWizard() {
    currentStep = 0;
    scanMethod = null;
    scannedSerial = '';
    scannedBarcode = '';
    itemDetails = null;
    locationType = 'warehouse';
    locationDetails = {
      warehouse: { section: '', shelf: '' },
      tower: { siteId: '', rack: '', rackUnit: '' },
      noc: { room: '', rack: '' },
      vehicle: { vehicleId: '', vehicleName: '' },
      other: { description: '' }
    };
    printLabel = true;
    checkInNotes = '';
    purchaseOrderId = '';
    error = '';
    success = '';
  }
  
  function handleStepChange(event: CustomEvent<number>) {
    currentStep = event.detail;
    if (currentStep === 3) {
      loadSites();
    }
  }
  
  function nextStep() {
    if (currentStep === 1 && !scanMethod) {
      error = 'Please select a scan method';
      return;
    }
    if (currentStep === 1 && scanMethod === 'manual' && !scannedSerial.trim()) {
      error = 'Serial number is required';
      return;
    }
    if (currentStep === 2 && !itemDetails) {
      error = 'Please scan or enter item details';
      return;
    }
    if (currentStep === 3 && !locationDetails[locationType]) {
      error = 'Please set location details';
      return;
    }
    if (currentStep < steps.length - 1) {
      currentStep++;
      error = '';
      success = '';
    }
  }
  
  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
      error = '';
      success = '';
    }
  }
  
  function selectScanMethod(method: 'barcode' | 'manual' | 'bulk') {
    scanMethod = method;
    if (method === 'bulk') {
      // Bulk check-in - skip to location step
      currentStep = 3;
    } else {
      nextStep();
    }
  }
  
  async function lookupItem() {
    if (!scannedSerial.trim() && !scannedBarcode.trim()) {
      error = 'Please enter serial number or scan barcode';
      return;
    }
    
    isLoading = true;
    error = '';
    
    try {
      const tenantId = $currentTenant?.id;
      if (!tenantId) {
        throw new Error('No tenant selected');
      }
      
      const identifier = scannedSerial || scannedBarcode;
      
      // Check if item already exists
      const { inventoryService } = await import('$lib/services/inventoryService');
      const items = await inventoryService.getInventory({ search: identifier, limit: 1 });
      
      if (items.items.length > 0) {
        const existingItem = items.items[0];
        itemDetails = {
          serialNumber: existingItem.serialNumber || identifier,
          name: existingItem.name || 'Unknown',
          category: existingItem.category || 'Unknown',
          manufacturer: existingItem.manufacturer || '',
          model: existingItem.model || '',
          purchaseOrder: existingItem.purchaseOrder
        };
        success = 'Item found in inventory';
      } else {
        // New item - collect details
        itemDetails = {
          serialNumber: identifier,
          name: '',
          category: '',
          manufacturer: '',
          model: '',
          purchaseOrder: purchaseOrderId || undefined
        };
        success = 'New item - please enter details';
      }
      
      setTimeout(() => {
        nextStep();
      }, 1000);
    } catch (err: any) {
      error = err.message || 'Failed to lookup item';
    } finally {
      isLoading = false;
    }
  }
  
  async function completeCheckIn() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) {
      error = 'No tenant selected';
      return;
    }
    
    if (!itemDetails) {
      error = 'Item details are required';
      return;
    }
    
    isLoading = true;
    error = '';
    
    try {
      const { inventoryService } = await import('$lib/services/inventoryService');
      
      // Prepare location data
      const locationData: any = {
        type: locationType,
        ...locationDetails[locationType]
      };
      
      // Check if item exists
      const existingItems = await inventoryService.getInventory({ search: itemDetails.serialNumber, limit: 1 });
      
      if (existingItems.items.length > 0) {
        // Update existing item
        const itemId = existingItems.items[0].id || existingItems.items[0]._id;
        await inventoryService.updateInventory(itemId, {
          status: 'available',
          location: locationData,
          notes: checkInNotes || undefined
        });
      } else {
        // Create new item
        await inventoryService.createInventory({
          serialNumber: itemDetails.serialNumber,
          name: itemDetails.name || itemDetails.serialNumber,
          category: itemDetails.category || 'Other',
          manufacturer: itemDetails.manufacturer,
          model: itemDetails.model,
          status: 'available',
          location: locationData,
          purchaseOrder: purchaseOrderId || undefined,
          notes: checkInNotes || undefined
        });
      }
      
      // Print label if requested
      if (printLabel) {
        // Trigger label printing (would integrate with label printer API)
        console.log('Printing label for:', itemDetails.serialNumber);
      }
      
      success = 'Item checked in successfully!';
      setTimeout(() => {
        nextStep();
      }, 1500);
    } catch (err: any) {
      error = err.message || 'Failed to check in item';
    } finally {
      isLoading = false;
    }
  }
  
  function complete() {
    handleClose();
  }
</script>

<BaseWizard
  {show}
  title="📦 Inventory Check-in Wizard"
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
      <!-- Welcome Step -->
      <div class="wizard-panel">
        <h3>Welcome to Inventory Check-in! 📦</h3>
        <p>This wizard will guide you through checking in inventory items.</p>
        
        <div class="info-box">
          <h4>Check-in Process:</h4>
          <ul>
            <li>✅ Scan or enter item serial number</li>
            <li>✅ Verify item details</li>
            <li>✅ Set storage location</li>
            <li>✅ Print label (optional)</li>
            <li>✅ Complete check-in</li>
          </ul>
        </div>
        
        <div class="info-box">
          <h4>Check-in Methods:</h4>
          <ul>
            <li><strong>Barcode Scan:</strong> Scan item barcode with camera</li>
            <li><strong>Manual Entry:</strong> Enter serial number manually</li>
            <li><strong>Bulk:</strong> Check in multiple items at once</li>
          </ul>
        </div>
      </div>
      
    {:else if currentStep === 1}
      <!-- Scan Item -->
      <div class="wizard-panel">
        <h3>Scan or Enter Item</h3>
        <p>How would you like to identify the item?</p>
        
        <div class="method-grid">
          <button 
            class="method-card" 
            on:click={() => selectScanMethod('barcode')}
            disabled={isLoading}
          >
            <div class="method-icon">📷</div>
            <h4>Scan Barcode</h4>
            <p>Use camera to scan barcode/QR code</p>
          </button>
          
          <button 
            class="method-card" 
            on:click={() => selectScanMethod('manual')}
            disabled={isLoading}
          >
            <div class="method-icon">✏️</div>
            <h4>Manual Entry</h4>
            <p>Enter serial number manually</p>
          </button>
          
          <button 
            class="method-card" 
            on:click={() => selectScanMethod('bulk')}
            disabled={isLoading}
          >
            <div class="method-icon">📊</div>
            <h4>Bulk Check-in</h4>
            <p>Check in multiple items</p>
          </button>
        </div>
        
        {#if scanMethod === 'manual'}
          <div class="form-section">
            <div class="form-group">
              <label>
                Serial Number <span class="required">*</span>
              </label>
              <input 
                type="text" 
                bind:value={scannedSerial}
                placeholder="Enter serial number"
                on:keydown={(e) => e.key === 'Enter' && lookupItem()}
                disabled={isLoading}
              />
            </div>
            
            <div class="form-group">
              <label>Purchase Order ID</label>
              <input 
                type="text" 
                bind:value={purchaseOrderId}
                placeholder="Optional: Link to purchase order"
                disabled={isLoading}
              />
            </div>
            
            <button 
              class="wizard-btn-primary" 
              on:click={lookupItem} 
              disabled={isLoading || !scannedSerial.trim()}
            >
              {isLoading ? 'Looking up...' : 'Lookup Item →'}
            </button>
          </div>
        {:else if scanMethod === 'barcode'}
          <div class="form-section">
            <div class="info-box">
              <p>📷 Camera scanning will be activated. Point camera at barcode/QR code.</p>
            </div>
            
            <div class="form-group">
              <label>Or Enter Barcode Manually</label>
              <input 
                type="text" 
                bind:value={scannedBarcode}
                placeholder="Enter barcode"
                on:keydown={(e) => e.key === 'Enter' && lookupItem()}
                disabled={isLoading}
              />
            </div>
            
            <button 
              class="wizard-btn-primary" 
              on:click={lookupItem} 
              disabled={isLoading || (!scannedBarcode.trim() && !scannedSerial.trim())}
            >
              {isLoading ? 'Looking up...' : 'Lookup Item →'}
            </button>
          </div>
        {/if}
      </div>
      
    {:else if currentStep === 2}
      <!-- Verify -->
      <div class="wizard-panel">
        <h3>Verify Item Details</h3>
        <p>Review and update item information if needed.</p>
        
        {#if itemDetails}
          <div class="item-details">
            <div class="form-group">
              <label>
                Item Name <span class="required">*</span>
              </label>
              <input 
                type="text" 
                bind:value={itemDetails.name}
                placeholder="e.g., TP-Link Router"
                disabled={isLoading}
              />
            </div>
            
            <div class="form-group">
              <label>Category</label>
              <select bind:value={itemDetails.category} disabled={isLoading}>
                <option value="">-- Select Category --</option>
                <option value="Radio Equipment">Radio Equipment</option>
                <option value="Antennas">Antennas</option>
                <option value="Power Systems">Power Systems</option>
                <option value="Networking Equipment">Networking Equipment</option>
                <option value="CPE Devices">CPE Devices</option>
                <option value="Cables & Accessories">Cables & Accessories</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Manufacturer</label>
              <input 
                type="text" 
                bind:value={itemDetails.manufacturer}
                placeholder="e.g., TP-Link"
                disabled={isLoading}
              />
            </div>
            
            <div class="form-group">
              <label>Model</label>
              <input 
                type="text" 
                bind:value={itemDetails.model}
                placeholder="e.g., CPE610"
                disabled={isLoading}
              />
            </div>
            
            <div class="form-group">
              <label>Serial Number</label>
              <input 
                type="text" 
                value={itemDetails.serialNumber}
                disabled
              />
            </div>
          </div>
        {/if}
      </div>
      
    {:else if currentStep === 3}
      <!-- Set Location -->
      <div class="wizard-panel">
        <h3>Set Storage Location</h3>
        <p>Where will this item be stored?</p>
        
        <div class="form-group">
          <label>Location Type</label>
          <select bind:value={locationType} disabled={isLoading}>
            <option value="warehouse">Warehouse</option>
            <option value="tower">Tower Site</option>
            <option value="noc">NOC</option>
            <option value="vehicle">Vehicle</option>
            <option value="other">Other</option>
          </select>
        </div>
        
        {#if locationType === 'warehouse'}
          <div class="form-group">
            <label>Section</label>
            <input 
              type="text" 
              bind:value={locationDetails.warehouse.section}
              placeholder="e.g., A, B, C"
              disabled={isLoading}
            />
          </div>
          <div class="form-group">
            <label>Shelf</label>
            <input 
              type="text" 
              bind:value={locationDetails.warehouse.shelf}
              placeholder="e.g., Shelf 1"
              disabled={isLoading}
            />
          </div>
        {:else if locationType === 'tower'}
          <div class="form-group">
            <label>Site</label>
            <select bind:value={locationDetails.tower.siteId} disabled={isLoading}>
              <option value="">-- Select Site --</option>
              {#each availableSites as site}
                <option value={site.id}>{site.name}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label>Rack</label>
            <input 
              type="text" 
              bind:value={locationDetails.tower.rack}
              placeholder="e.g., Rack 1"
              disabled={isLoading}
            />
          </div>
          <div class="form-group">
            <label>Rack Unit</label>
            <input 
              type="text" 
              bind:value={locationDetails.tower.rackUnit}
              placeholder="e.g., U12"
              disabled={isLoading}
            />
          </div>
        {:else if locationType === 'noc'}
          <div class="form-group">
            <label>Room</label>
            <input 
              type="text" 
              bind:value={locationDetails.noc.room}
              placeholder="e.g., Server Room A"
              disabled={isLoading}
            />
          </div>
          <div class="form-group">
            <label>Rack</label>
            <input 
              type="text" 
              bind:value={locationDetails.noc.rack}
              placeholder="e.g., Rack 1"
              disabled={isLoading}
            />
          </div>
        {:else if locationType === 'vehicle'}
          <div class="form-group">
            <label>Vehicle ID</label>
            <input 
              type="text" 
              bind:value={locationDetails.vehicle.vehicleId}
              placeholder="e.g., VEH-001"
              disabled={isLoading}
            />
          </div>
          <div class="form-group">
            <label>Vehicle Name</label>
            <input 
              type="text" 
              bind:value={locationDetails.vehicle.vehicleName}
              placeholder="e.g., Service Truck 1"
              disabled={isLoading}
            />
          </div>
        {:else}
          <div class="form-group">
            <label>Description</label>
            <input 
              type="text" 
              bind:value={locationDetails.other.description}
              placeholder="Describe location"
              disabled={isLoading}
            />
          </div>
        {/if}
        
        <div class="form-group">
          <label>Notes</label>
          <textarea 
            bind:value={checkInNotes}
            placeholder="Any additional notes..."
            rows="3"
            disabled={isLoading}
          ></textarea>
        </div>
      </div>
      
    {:else if currentStep === 4}
      <!-- Print Label -->
      <div class="wizard-panel">
        <h3>Print Label</h3>
        <p>Print asset tag label for this item.</p>
        
        {#if itemDetails}
          <div class="label-preview">
            <div class="label-content">
              <h4>{itemDetails.name || itemDetails.serialNumber}</h4>
              <p class="serial">SN: {itemDetails.serialNumber}</p>
              {#if itemDetails.category}
                <p class="category">{itemDetails.category}</p>
              {/if}
            </div>
          </div>
        {/if}
        
        <div class="form-group">
          <label>
            <input 
              type="checkbox" 
              bind:checked={printLabel}
              disabled={isLoading}
            />
            Print label after check-in
          </label>
        </div>
        
        <div class="info-box">
          <p>💡 Label will be printed automatically after check-in completes.</p>
        </div>
      </div>
      
    {:else if currentStep === 5}
      <!-- Complete -->
      <div class="wizard-panel">
        <h3>🎉 Check-in Complete!</h3>
        <p>Item has been successfully checked in.</p>
        
        {#if itemDetails}
          <div class="checkin-summary">
            <h4>Check-in Summary</h4>
            <div class="summary-row">
              <span class="label">Item:</span>
              <span class="value">{itemDetails.name || itemDetails.serialNumber}</span>
            </div>
            <div class="summary-row">
              <span class="label">Serial Number:</span>
              <span class="value">{itemDetails.serialNumber}</span>
            </div>
            <div class="summary-row">
              <span class="label">Location:</span>
              <span class="value">
                {locationType} - 
                {locationType === 'warehouse' ? `${locationDetails.warehouse.section} ${locationDetails.warehouse.shelf}` :
                 locationType === 'tower' ? availableSites.find(s => s.id === locationDetails.tower.siteId)?.name || 'Unknown' :
                 locationType === 'noc' ? `${locationDetails.noc.room} ${locationDetails.noc.rack}` :
                 locationType === 'vehicle' ? locationDetails.vehicle.vehicleName :
                 locationDetails.other.description}
              </span>
            </div>
            <div class="summary-row">
              <span class="label">Status:</span>
              <span class="value">Available</span>
            </div>
          </div>
        {/if}
        
        <div class="next-steps">
          <h4>What's Next?</h4>
          <a href="/modules/inventory" class="next-step-item">
            <span class="icon">📋</span>
            <div>
              <strong>View Inventory</strong>
              <p>Check the Inventory module to see your item</p>
            </div>
          </a>
          {#if printLabel}
            <div class="next-step-item">
              <span class="icon">🏷️</span>
              <div>
                <strong>Label Printed</strong>
                <p>Asset tag label has been printed</p>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
  
  <div slot="footer" let:currentStep let:nextStep let:prevStep let:handleClose let:isLoading>
    {#if currentStep > 0}
      <button class="wizard-btn-secondary" on:click={prevStep} disabled={isLoading}>
        ← Previous
      </button>
    {:else}
      <button class="wizard-btn-secondary" on:click={handleClose} disabled={isLoading}>
        Cancel
      </button>
    {/if}
    
    <div class="footer-actions">
      {#if currentStep === 1 && scanMethod === 'bulk'}
        <!-- Bulk check-in skips to location step -->
      {:else if currentStep === 4}
        <button 
          class="wizard-btn-primary" 
          on:click={completeCheckIn} 
          disabled={isLoading || !itemDetails}
        >
          {isLoading ? 'Checking in...' : '✅ Complete Check-in'}
        </button>
      {:else if currentStep < steps.length - 1}
        <button class="wizard-btn-primary" on:click={nextStep} disabled={isLoading}>
          Next →
        </button>
      {:else}
        <button class="wizard-btn-primary" on:click={complete} disabled={isLoading}>
          Finish →
        </button>
      {/if}
    </div>
  </div>
</BaseWizard>

<style>
  /* Use global theme variables - no hardcoded colors */
  .wizard-panel h3 {
    margin: 0 0 var(--spacing-md) 0;
    font-size: var(--font-size-2xl);
    color: var(--text-primary);
  }
  
  .wizard-panel p {
    color: var(--text-secondary);
    line-height: var(--line-height-normal);
    margin: var(--spacing-sm) 0;
  }
  
  .info-box {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
    margin: var(--spacing-md) 0;
    color: var(--text-primary);
  }
  
  .info-box h4 {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-base);
    color: var(--text-primary);
  }
  
  .info-box ul {
    margin: var(--spacing-sm) 0 0 var(--spacing-lg);
    padding: 0;
    color: var(--text-primary);
  }
  
  .method-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md);
    margin: var(--spacing-lg) 0;
  }
  
  .method-card {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    cursor: pointer;
    transition: var(--transition);
    text-align: center;
    color: var(--text-primary);
  }
  
  .method-card:hover:not(:disabled) {
    border-color: var(--primary-color);
    transform: translateY(-2px);
    background: var(--hover-bg);
  }
  
  .method-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .method-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-sm);
  }
  
  .method-card h4 {
    margin: var(--spacing-sm) 0;
    font-size: var(--font-size-lg);
    color: var(--text-primary);
  }
  
  .method-card p {
    font-size: var(--font-size-sm);
    margin: var(--spacing-sm) 0 0 0;
    color: var(--text-secondary);
  }
  
  .form-section {
    margin-top: var(--spacing-lg);
  }
  
  .form-group {
    margin: var(--spacing-md) 0;
  }
  
  .form-group label {
    display: block;
    margin-bottom: var(--spacing-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
  }
  
  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    background: var(--input-bg);
    color: var(--text-primary);
  }
  
  .required {
    color: var(--danger-color);
  }
  
  .item-details {
    margin: var(--spacing-md) 0;
  }
  
  .label-preview {
    margin: var(--spacing-md) 0;
    padding: var(--spacing-lg);
    background: var(--card-bg);
    border: 2px dashed var(--border-color);
    border-radius: var(--radius-md);
    text-align: center;
    color: var(--text-primary);
  }
  
  .label-content h4 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--text-primary);
  }
  
  .label-content .serial {
    font-family: monospace;
    font-size: var(--font-size-sm);
    margin: var(--spacing-sm) 0;
    color: var(--text-primary);
  }
  
  .label-content .category {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }
  
  .checkin-summary {
    margin: var(--spacing-lg) 0;
  }
  
  .checkin-summary h4 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-primary);
  }
  
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-md) 0;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
  }
  
  .summary-row .label {
    font-weight: var(--font-weight-medium);
    color: var(--text-secondary);
  }
  
  .summary-row .value {
    color: var(--text-primary);
  }
  
  .next-steps {
    margin-top: var(--spacing-lg);
  }

  a.next-step-item {
    text-decoration: none;
    color: inherit;
  }

  a.next-step-item:hover {
    background: var(--bg-primary);
  }
  
  .next-step-item {
    display: flex;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    margin: var(--spacing-md) 0;
    border: 1px solid var(--border-color);
    color: var(--text-primary);
  }
  
  .next-step-item .icon {
    font-size: 2rem;
  }
  
  .next-step-item strong {
    display: block;
    margin-bottom: var(--spacing-xs);
    color: var(--text-primary);
  }
  
  .next-step-item p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  
  .footer-actions {
    display: flex;
    gap: var(--spacing-sm);
  }
</style>
