<script lang="ts">
  import { goto } from '$app/navigation';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { inventoryService } from '$lib/services/inventoryService';
  import { coverageMapService } from '../../coverage-map/lib/coverageMapService.mongodb';
  import { onMount } from 'svelte';
  
  let isSaving = false;
  let isLoading = true;
  let error = '';
  let availableLocations: any[] = [];
  
  $: tenantId = $currentTenant?.id || '';
  
  onMount(async () => {
    if (tenantId) {
      await loadLocations();
    }
    isLoading = false;
  });
  
  async function loadLocations() {
    try {
      // Load all sites from Coverage Map
      const sites = await coverageMapService.getTowerSites(tenantId);
      availableLocations = sites;
    } catch (err) {
      console.error('Error loading locations:', err);
      error = 'Failed to load locations. Please add locations in Coverage Map first.';
    }
  }
  
  // Equipment categories (matching backend schema)
  const equipmentCategories = {
    'EPC Equipment': [
      'MME (Mobility Management Entity)',
      'SGW (Serving Gateway)',
      'PGW (Packet Data Network Gateway)',
      'PCRF (Policy and Charging Rules Function)',
      'HSS (Home Subscriber Server)',
      'USIM Authentication Server',
      'Diameter Gateway',
      'Firewall',
      'Load Balancer',
      'Session Controller'
    ],
    'Radio Equipment': [
      'Base Station (eNodeB/gNodeB)',
      'Remote Radio Head (RRH)',
      'Radio Unit (RU)',
      'Baseband Unit (BBU)',
      'Distributed Unit (DU)',
      'Centralized Unit (CU)',
      'Small Cell',
      'Repeater',
      'Microwave Radio',
      'Point-to-Point Radio'
    ],
    'Antennas': [
      'Sector Antenna',
      'Panel Antenna',
      'Omni Antenna',
      'Parabolic Dish',
      'MIMO Antenna',
      'Massive MIMO Array',
      'GPS Antenna',
      'Combiner'
    ],
    'Power Systems': [
      'Rectifier',
      'Battery Bank',
      'UPS',
      'Generator',
      'Solar Panel System',
      'Power Distribution Unit',
      'DC Power Plant',
      'Surge Protector'
    ],
    'Networking Equipment': [
      'Core Router',
      'Edge Router',
      'Layer 2/3 Switch',
      'Firewall',
      'Load Balancer',
      'Optical Network Terminal',
      'Media Converter',
      'Ethernet Switch'
    ],
    'Transmission Equipment': [
      'Fiber Optic Terminal',
      'Multiplexer (DWDM/CWDM)',
      'Fiber Distribution Panel',
      'Coaxial Cable',
      'Fiber Optic Cable',
      'Hybrid Cable',
      'RF Cables/Jumpers',
      'Waveguide'
    ],
    'Environmental Control': [
      'HVAC Unit',
      'Air Conditioner',
      'Heat Exchanger',
      'Ventilation Fan',
      'Temperature Sensor',
      'Humidity Sensor',
      'Fire Suppression System'
    ],
    'Monitoring & Control': [
      'Remote Monitoring Unit',
      'SNMP Agent',
      'GPS Clock/Timing Source',
      'Network Management System',
      'CCTV Camera',
      'Access Control System',
      'Alarm Panel'
    ],
    'Structural & Housing': [
      'Equipment Shelter',
      'Equipment Cabinet/Rack',
      'Weatherproof Enclosure',
      'Cable Tray',
      'Tower Lighting System',
      'Grounding System',
      'Lightning Arrestor',
      'Surge Arrestor'
    ],
    'Test Equipment': [
      'Spectrum Analyzer',
      'Cable Tester',
      'OTDR',
      'Power Meter',
      'Multimeter',
      'Signal Generator'
    ],
    'CPE Devices': [
      'LTE CPE',
      'CBRS CPE',
      'Fixed Wireless CPE',
      'Cable Modem',
      'ONT',
      'WiFi Router'
    ],
    'SIM Cards': [
      'SIM Card',
      'eSIM Profile'
    ],
    'Cables & Accessories': [
      'Ethernet Cable',
      'Fiber Patch Cable',
      'RF Jumper',
      'Connector',
      'Adapter'
    ],
    'Tools': [
      'Drill',
      'Crimper',
      'Cable Stripper',
      'Torque Wrench',
      'Ladder'
    ],
    'Spare Parts': [
      'Power Supply',
      'Fan Module',
      'Transceiver',
      'Filter'
    ]
  };
  
  const categories = Object.keys(equipmentCategories);
  
  // Form data
  let formData = {
    // Classification
    category: 'Radio Equipment',
    equipmentType: '',
    customType: '',
    
    // Manufacturer
    manufacturer: '',
    model: '',
    partNumber: '',
    serialNumber: '',
    
    // Location
    locationSiteId: '',
    locationType: 'warehouse' as 'warehouse' | 'tower' | 'noc' | 'vehicle' | 'customer' | 'rma' | 'other',
    warehouseSection: '',
    rackLocation: '',
    rackUnit: '',
    
    // Status
    status: 'available' as const,
    condition: 'new' as const,
    
    // Purchase
    vendor: '',
    purchaseDate: '',
    purchasePrice: 0,
    purchaseOrderNumber: '',
    
    // Warranty
    warrantyProvider: '',
    warrantyStartDate: '',
    warrantyEndDate: '',
    
    // Technical
    firmwareVersion: '',
    powerRequirements: '',
    ipAddress: '',
    
    // Financial
    bookValue: 0,
    
    notes: ''
  };
  
  $: availableTypes = equipmentCategories[formData.category as keyof typeof equipmentCategories] || [];
  $: useCustomType = formData.equipmentType === 'Other/Custom';
  
  $: selectedLocation = availableLocations.find(loc => loc.id === formData.locationSiteId);
  $: filteredLocations = availableLocations.filter(loc => 
    formData.locationType === 'customer' || formData.locationType === 'other' 
      ? true 
      : loc.type === formData.locationType
  );
  
  async function handleSave() {
    const finalType = useCustomType ? formData.customType : formData.equipmentType;
    
    if (!finalType.trim()) {
      error = 'Equipment type is required';
      return;
    }
    
    if (!formData.serialNumber.trim()) {
      error = 'Serial number is required';
      return;
    }
    
    if (!formData.locationSiteId && formData.locationType !== 'customer' && formData.locationType !== 'other') {
      error = 'Please select a location from the map, or add the location in Coverage Map first';
      return;
    }
    
    isSaving = true;
    error = '';
    
    try {
      const inventoryItem = {
        category: formData.category,
        equipmentType: finalType,
        manufacturer: formData.manufacturer || undefined,
        model: formData.model || undefined,
        partNumber: formData.partNumber || undefined,
        serialNumber: formData.serialNumber,
        
        currentLocation: {
          type: formData.locationType,
          siteId: formData.locationSiteId || undefined,
          siteName: selectedLocation?.name || undefined,
          warehouse: formData.locationType === 'warehouse' ? {
            name: selectedLocation?.name,
            section: formData.warehouseSection
          } : undefined,
          tower: (formData.locationType === 'tower' || formData.locationType === 'noc') ? {
            rack: formData.rackLocation,
            rackUnit: formData.rackUnit
          } : undefined
        },
        
        status: formData.status,
        condition: formData.condition,
        
        purchaseInfo: {
          vendor: formData.vendor || undefined,
          purchaseDate: formData.purchaseDate || undefined,
          purchasePrice: formData.purchasePrice || undefined,
          purchaseOrderNumber: formData.purchaseOrderNumber || undefined
        },
        
        warranty: {
          provider: formData.warrantyProvider || undefined,
          startDate: formData.warrantyStartDate || undefined,
          endDate: formData.warrantyEndDate || undefined
        },
        
        technicalSpecs: {
          powerRequirements: formData.powerRequirements || undefined,
          ipAddress: formData.ipAddress || undefined
        },
        
        firmwareVersion: formData.firmwareVersion || undefined,
        bookValue: formData.bookValue || undefined,
        notes: formData.notes || undefined,
        tenantId
      };
      
      await inventoryService.createItem(inventoryItem);
      
      goto('/modules/inventory');
    } catch (err: any) {
      error = err.message || 'Failed to create inventory item';
    } finally {
      isSaving = false;
    }
  }
  
  function getLocationIcon(type: string): string {
    const icons: Record<string, string> = {
      tower: '📡',
      rooftop: '🏢',
      monopole: '📍',
      warehouse: '🏭',
      noc: '🖥️',
      vehicle: '🚚',
      rma: '🔧',
      vendor: '🏪',
      other: '📍'
    };
    return icons[type] || icons.other;
  }
</script>

<TenantGuard>
<div class="add-inventory-page">
  <div class="page-header">
    <div class="header-left">
      <button class="back-button" on:click={() => goto('/modules/inventory')}>
        ← Back to Inventory
      </button>
      <h1>➕ Add Inventory Item</h1>
    </div>
  </div>
  
  {#if error}
    <div class="alert alert-error">
      ⚠️ {error}
      <button class="dismiss-btn" on:click={() => error = ''}>✕</button>
    </div>
  {/if}
  
  <div class="form-container">
    <form on:submit|preventDefault={handleSave}>
      
      <!-- Classification -->
      <div class="section">
        <h3>🏷️ Equipment Classification</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Category *</label>
            <select bind:value={formData.category} required>
              {#each categories as category}
                <option value={category}>{category}</option>
              {/each}
            </select>
          </div>
          
          <div class="form-group">
            <label>Equipment Type *</label>
            <select bind:value={formData.equipmentType} required>
              <option value="">-- Select Type --</option>
              {#each availableTypes as type}
                <option value={type}>{type}</option>
              {/each}
              <option value="Other/Custom">Other/Custom</option>
            </select>
          </div>
        </div>
        
        {#if useCustomType}
          <div class="form-group">
            <label>Custom Equipment Type *</label>
            <input type="text" bind:value={formData.customType} required />
          </div>
        {/if}
      </div>
      
      <!-- Manufacturer Info -->
      <div class="section">
        <h3>🏭 Manufacturer Information</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Manufacturer</label>
            <input type="text" bind:value={formData.manufacturer} />
          </div>
          
          <div class="form-group">
            <label>Model</label>
            <input type="text" bind:value={formData.model} />
          </div>
          
          <div class="form-group">
            <label>Part Number</label>
            <input type="text" bind:value={formData.partNumber} />
          </div>
          
          <div class="form-group">
            <label>Serial Number *</label>
            <input type="text" bind:value={formData.serialNumber} required />
          </div>
        </div>
        
        <div class="form-group">
          <label>Firmware Version</label>
          <input type="text" bind:value={formData.firmwareVersion} />
        </div>
      </div>
      
      <!-- Location -->
      <div class="section">
        <h3>📍 Location (from Coverage Map)</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Location Type *</label>
            <select bind:value={formData.locationType} required>
              <option value="warehouse">Warehouse</option>
              <option value="tower">Tower Site</option>
              <option value="noc">NOC</option>
              <option value="vehicle">Service Vehicle</option>
              <option value="rma">RMA/Repair Center</option>
              <option value="customer">Customer Premises</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Select Location *</label>
            <select bind:value={formData.locationSiteId} required>
              <option value="">-- Select from map --</option>
              {#each filteredLocations as location}
                <option value={location.id}>
                  {getLocationIcon(location.type)} {location.name} ({location.type})
                </option>
              {/each}
            </select>
            {#if filteredLocations.length === 0}
              <p class="help-text warning">
                ⚠️ No {formData.locationType} locations found. 
                <button type="button" class="link-button" on:click={() => goto('/modules/coverage-map')}>
                  Add in Coverage Map →
                </button>
              </p>
            {:else}
              <p class="help-text">
                Selected location must exist on Coverage Map
              </p>
            {/if}
          </div>
        </div>
        
        <!-- Specific location details based on type -->
        {#if formData.locationSiteId}
          {#if formData.locationType === 'warehouse'}
            <div class="form-group">
              <label>Warehouse Section/Aisle</label>
              <input type="text" bind:value={formData.warehouseSection} placeholder="A-5, Shelf 3, Bin 12" />
            </div>
          {:else if formData.locationType === 'tower' || formData.locationType === 'noc'}
            <div class="form-grid">
              <div class="form-group">
                <label>Rack/Cabinet</label>
                <input type="text" bind:value={formData.rackLocation} placeholder="Rack A" />
              </div>
              
              <div class="form-group">
                <label>Rack Unit (RU)</label>
                <input type="text" bind:value={formData.rackUnit} placeholder="10-15" />
              </div>
            </div>
          {/if}
        {/if}
        
        <div class="form-grid">
          <div class="form-group">
            <label>Status *</label>
            <select bind:value={formData.status} required>
              <option value="available">Available</option>
              <option value="deployed">Deployed</option>
              <option value="reserved">Reserved</option>
              <option value="maintenance">Maintenance</option>
              <option value="rma">RMA</option>
              <option value="retired">Retired</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Condition *</label>
            <select bind:value={formData.condition} required>
              <option value="new">New</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
              <option value="refurbished">Refurbished</option>
            </select>
          </div>
        </div>
      </div>
      
      <!-- Purchase Info -->
      <div class="section">
        <h3>💰 Purchase Information</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Vendor</label>
            <input type="text" bind:value={formData.vendor} />
          </div>
          
          <div class="form-group">
            <label>Purchase Date</label>
            <input type="date" bind:value={formData.purchaseDate} />
          </div>
          
          <div class="form-group">
            <label>Purchase Price ($)</label>
            <input type="number" bind:value={formData.purchasePrice} step="0.01" />
          </div>
          
          <div class="form-group">
            <label>PO Number</label>
            <input type="text" bind:value={formData.purchaseOrderNumber} />
          </div>
        </div>
        
        <div class="form-group">
          <label>Book Value ($)</label>
          <input type="number" bind:value={formData.bookValue} step="0.01" />
        </div>
      </div>
      
      <!-- Warranty -->
      <div class="section">
        <h3>🛡️ Warranty Information</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Warranty Provider</label>
            <input type="text" bind:value={formData.warrantyProvider} />
          </div>
          
          <div class="form-group">
            <label>Start Date</label>
            <input type="date" bind:value={formData.warrantyStartDate} />
          </div>
          
          <div class="form-group">
            <label>End Date</label>
            <input type="date" bind:value={formData.warrantyEndDate} />
          </div>
        </div>
      </div>
      
      <!-- Technical Details -->
      <div class="section">
        <h3>⚙️ Technical Specifications</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Power Requirements</label>
            <input type="text" bind:value={formData.powerRequirements} placeholder="48V DC, 100-240V AC" />
          </div>
          
          <div class="form-group">
            <label>IP Address</label>
            <input type="text" bind:value={formData.ipAddress} placeholder="192.168.1.100" />
          </div>
        </div>
      </div>
      
      <!-- Notes -->
      <div class="section">
        <h3>📝 Additional Notes</h3>
        <div class="form-group">
          <textarea bind:value={formData.notes} rows="4" placeholder="Configuration notes, special instructions..."></textarea>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="form-actions">
        <button type="button" class="btn-secondary" on:click={() => goto('/modules/inventory')}>
          Cancel
        </button>
        <button type="submit" class="btn-primary" disabled={isSaving}>
          {isSaving ? 'Saving...' : '✅ Add to Inventory'}
        </button>
      </div>
    </form>
  </div>
</div>
</TenantGuard>

<style>
  .add-inventory-page {
    min-height: 100vh;
    background: var(--bg-primary);
    padding: 2rem;
  }
  
  .page-header {
    margin-bottom: 2rem;
  }
  
  .header-left {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .back-button {
    background: none;
    border: 1px solid var(--border-color);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--text-secondary);
    width: fit-content;
  }
  
  .back-button:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  h1 {
    font-size: 2rem;
    margin: 0;
    color: var(--text-primary);
  }
  
  .alert {
    padding: 1rem 1.5rem;
    border-radius: 6px;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }
  
  .dismiss-btn {
    margin-left: auto;
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: inherit;
  }
  
  .form-container {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 2rem;
    max-width: 1200px;
  }
  
  .section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: var(--bg-secondary);
    border-radius: 8px;
  }
  
  .section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: var(--brand-primary);
  }
  
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .form-group label {
    font-weight: 500;
    font-size: 0.9rem;
  }
  
  .form-group input,
  .form-group select,
  .form-group textarea {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: inherit;
  }
  
  .form-group textarea {
    resize: vertical;
  }
  
  .help-text {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin: 0;
  }
  
  .help-text.warning {
    color: #f59e0b;
    font-weight: 500;
  }
  
  .link-button {
    background: none;
    border: none;
    color: var(--brand-primary);
    text-decoration: underline;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 0;
    margin-left: 0.5rem;
  }
  
  .link-button:hover {
    color: var(--brand-primary-hover);
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 2px solid var(--border-color);
  }
  
  .btn-primary, .btn-secondary {
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
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  @media (max-width: 768px) {
    .add-inventory-page {
      padding: 1rem;
    }
    
    .form-container {
      padding: 1rem;
    }
    
    .form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

