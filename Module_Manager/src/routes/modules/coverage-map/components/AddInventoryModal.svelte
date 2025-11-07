<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { coverageMapService } from '../lib/coverageMapService.mongodb';
  import type { TowerSite } from '../lib/models';
  
  export let show = false;
  export let site: TowerSite | null = null;
  export let tenantId: string;
  
  const dispatch = createEventDispatcher();
  
  let isSaving = false;
  let error = '';
  
  // Equipment categories based on standard tower deployments
  const equipmentCategories = {
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
      'UPS (Uninterruptible Power Supply)',
      'Generator',
      'Solar Panel System',
      'Power Distribution Unit (PDU)',
      'DC Power Plant',
      'Surge Protector'
    ],
    'Networking Equipment': [
      'Core Router',
      'Edge Router',
      'Layer 2/3 Switch',
      'Firewall',
      'Load Balancer',
      'Optical Network Terminal (ONT)',
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
      'Fire Suppression System',
      'Heater'
    ],
    'Monitoring & Control': [
      'Remote Monitoring Unit (RMU)',
      'SNMP Agent',
      'GPS Clock/Timing Source',
      'Network Management System',
      'Environmental Monitoring System',
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
      'Surge Arrestor',
      'Tower Climber Safety System',
      'Ice Shield'
    ],
    'Test Equipment': [
      'Spectrum Analyzer',
      'Cable Tester',
      'OTDR (Optical Time Domain Reflectometer)',
      'Power Meter',
      'Multimeter',
      'Signal Generator',
      'Antenna Analyzer'
    ]
  };
  
  // Form data
  let formData = {
    category: 'Radio Equipment',
    equipmentType: '',
    customType: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    partNumber: '',
    firmwareVersion: '',
    hardwareVersion: '',
    installDate: '',
    warrantyExpiration: '',
    purchaseDate: '',
    purchaseOrderNumber: '',
    vendor: '',
    purchasePrice: 0,
    condition: 'new' as 'new' | 'used' | 'refurbished' | 'rma' | 'retired',
    status: 'deployed' as 'deployed' | 'inventory' | 'maintenance' | 'rma' | 'retired',
    rackLocation: '',
    rackUnit: '',
    powerRequirements: '',
    ipAddress: '',
    macAddress: '',
    managementUrl: '',
    notes: ''
  };
  
  $: availableTypes = equipmentCategories[formData.category as keyof typeof equipmentCategories] || [];
  $: useCustomType = formData.equipmentType === 'Other/Custom';
  
  async function handleSave() {
    const finalEquipmentType = useCustomType ? formData.customType : formData.equipmentType;
    const isPlanMode = Boolean(planId);

    if (!finalEquipmentType.trim()) {
      error = 'Equipment type is required';
      return;
    }

    if (!isPlanMode && !formData.serialNumber.trim()) {
      error = 'Serial number is required for inventory tracking';
      return;
    }

    if (!site) {
      error = 'No site selected';
      return;
    }

    isSaving = true;
    error = '';

    try {
      if (isPlanMode) {
        if (!site.location || site.location.longitude === undefined || site.location.latitude === undefined) {
          throw new Error('Selected site is missing coordinates');
        }

        const properties: Record<string, any> = {
          category: formData.category,
          equipmentType: finalEquipmentType,
          manufacturer: formData.manufacturer || undefined,
          model: formData.model || undefined,
          quantity: formData.quantity || 1,
          status: formData.status,
          condition: formData.condition,
          siteId: site.id,
          siteName: site.name,
          partNumber: formData.partNumber || undefined,
          firmwareVersion: formData.firmwareVersion || undefined,
          hardwareVersion: formData.hardwareVersion || undefined,
          installDate: formData.installDate || undefined,
          powerRequirements: formData.powerRequirements || undefined,
          ipAddress: formData.ipAddress || undefined,
          macAddress: formData.macAddress || undefined,
          managementUrl: formData.managementUrl || undefined,
          vendor: formData.vendor || undefined,
          purchaseDate: formData.purchaseDate || undefined,
          purchaseOrderNumber: formData.purchaseOrderNumber || undefined,
          purchasePrice: formData.purchasePrice || undefined,
          rackLocation: formData.rackLocation || undefined,
          rackUnit: formData.rackUnit || undefined,
          notes: formData.notes || undefined
        };

        await mapLayerManager.addFeature(planId!, {
          featureType: 'equipment',
          geometry: {
            type: 'Point',
            coordinates: [site.location.longitude, site.location.latitude]
          },
          properties,
          status: 'draft'
        });

        dispatch('saved', { message: 'Hardware staged in plan.' });
      } else {
        const equipmentData = {
          siteId: site.id,
          name: `${finalEquipmentType} - ${formData.serialNumber}`,
          type: 'tower-equipment',
          locationType: 'tower',
          manufacturer: formData.manufacturer,
          model: formData.model,
          serialNumber: formData.serialNumber,
          status: formData.status,
          location: site.location,
          installDate: formData.installDate || undefined,
          notes: JSON.stringify({
            category: formData.category,
            equipmentType: finalEquipmentType,
            partNumber: formData.partNumber,
            firmwareVersion: formData.firmwareVersion,
            hardwareVersion: formData.hardwareVersion,
            warrantyExpiration: formData.warrantyExpiration,
            purchase: {
              date: formData.purchaseDate,
              orderNumber: formData.purchaseOrderNumber,
              vendor: formData.vendor,
              price: formData.purchasePrice
            },
            condition: formData.condition,
            location: {
              rack: formData.rackLocation,
              rackUnit: formData.rackUnit
            },
            technical: {
              powerRequirements: formData.powerRequirements,
              ipAddress: formData.ipAddress,
              macAddress: formData.macAddress,
              managementUrl: formData.managementUrl
            },
            additionalNotes: formData.notes
          })
        };

        await coverageMapService.createEquipment(tenantId, equipmentData);
        dispatch('saved', { message: 'Hardware added to inventory.' });
      }

      handleClose();
    } catch (err: any) {
      error = err.message || 'Failed to add inventory';
    } finally {
      isSaving = false;
    }
  }
  
  function handleClose() {
    show = false;
    error = '';
  }
</script>

{#if show && site}
<div class="modal-overlay" on:click={handleClose}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <div>
        <h2>📦 Add Equipment Inventory</h2>
        <p class="site-name">📡 {site.name}</p>
      </div>
      <button class="close-btn" on:click={handleClose}>✕</button>
    </div>
    
    {#if error}
      <div class="error-banner">{error}</div>
    {/if}
    
    <div class="modal-body">
      <!-- Equipment Category & Type -->
      <div class="section">
        <h3>🏷️ Equipment Classification</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Equipment Category *</label>
            <select bind:value={formData.category}>
              {#each Object.keys(equipmentCategories) as category}
                <option value={category}>{category}</option>
              {/each}
            </select>
          </div>
          
          <div class="form-group">
            <label>Equipment Type *</label>
            <select bind:value={formData.equipmentType}>
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
            <input type="text" bind:value={formData.customType} placeholder="Enter custom equipment type" />
          </div>
        {/if}
      </div>
      
      <!-- Manufacturer & Model Information -->
      <div class="section">
        <h3>🏭 Manufacturer Information</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Manufacturer</label>
            <input 
              type="text" 
              bind:value={formData.manufacturer} 
              placeholder="Nokia, Ericsson, Huawei, Cisco, etc." 
            />
          </div>
          
          <div class="form-group">
            <label>Model Number</label>
            <input type="text" bind:value={formData.model} placeholder="Model/SKU" />
          </div>
          
          <div class="form-group">
            <label>Serial Number *</label>
            <input type="text" bind:value={formData.serialNumber} placeholder="S/N" required />
            <p class="help-text">Required for inventory tracking</p>
          </div>
          
          <div class="form-group">
            <label>Part Number</label>
            <input type="text" bind:value={formData.partNumber} placeholder="P/N" />
          </div>
        </div>
        
        <div class="form-grid">
          <div class="form-group">
            <label>Firmware Version</label>
            <input type="text" bind:value={formData.firmwareVersion} placeholder="FW version" />
          </div>
          
          <div class="form-group">
            <label>Hardware Version</label>
            <input type="text" bind:value={formData.hardwareVersion} placeholder="HW revision" />
          </div>
        </div>
      </div>
      
      <!-- Physical Location -->
      <div class="section">
        <h3>📍 Physical Location</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Rack/Cabinet Location</label>
            <input type="text" bind:value={formData.rackLocation} placeholder="Rack A, Cabinet 1, etc." />
          </div>
          
          <div class="form-group">
            <label>Rack Unit (RU)</label>
            <input type="text" bind:value={formData.rackUnit} placeholder="RU 10-15" />
          </div>
          
          <div class="form-group">
            <label>Condition</label>
            <select bind:value={formData.condition}>
              <option value="new">New</option>
              <option value="used">Used</option>
              <option value="refurbished">Refurbished</option>
              <option value="rma">RMA</option>
              <option value="retired">Retired</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Status</label>
            <select bind:value={formData.status}>
              <option value="deployed">Deployed</option>
              <option value="inventory">In Inventory</option>
              <option value="maintenance">Under Maintenance</option>
              <option value="rma">RMA</option>
              <option value="retired">Retired</option>
            </select>
          </div>
        </div>
      </div>
      
      <!-- Dates & Warranty -->
      <div class="section">
        <h3>📅 Installation & Warranty</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Install Date</label>
            <input type="date" bind:value={formData.installDate} />
          </div>
          
          <div class="form-group">
            <label>Warranty Expiration</label>
            <input type="date" bind:value={formData.warrantyExpiration} />
          </div>
        </div>
      </div>
      
      <!-- Purchase Information -->
      <div class="section">
        <h3>💰 Purchase Information</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Purchase Date</label>
            <input type="date" bind:value={formData.purchaseDate} />
          </div>
          
          <div class="form-group">
            <label>Vendor</label>
            <input type="text" bind:value={formData.vendor} placeholder="Vendor/Supplier" />
          </div>
          
          <div class="form-group">
            <label>Purchase Order Number</label>
            <input type="text" bind:value={formData.purchaseOrderNumber} placeholder="PO-######" />
          </div>
          
          <div class="form-group">
            <label>Purchase Price ($)</label>
            <input type="number" bind:value={formData.purchasePrice} placeholder="0.00" step="0.01" />
          </div>
        </div>
      </div>
      
      <!-- Technical Details -->
      <div class="section">
        <h3>⚙️ Technical Details</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Power Requirements</label>
            <input type="text" bind:value={formData.powerRequirements} placeholder="48V DC, 100-240V AC, etc." />
          </div>
          
          <div class="form-group">
            <label>IP Address</label>
            <input type="text" bind:value={formData.ipAddress} placeholder="192.168.1.100" />
          </div>
          
          <div class="form-group">
            <label>MAC Address</label>
            <input type="text" bind:value={formData.macAddress} placeholder="00:1A:2B:3C:4D:5E" />
          </div>
          
          <div class="form-group">
            <label>Management URL</label>
            <input type="url" bind:value={formData.managementUrl} placeholder="https://..." />
          </div>
        </div>
        
        <div class="form-group">
          <label>Additional Notes</label>
          <textarea 
            bind:value={formData.notes} 
            placeholder="Configuration notes, maintenance history, special instructions..."
            rows="3"
          ></textarea>
        </div>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" on:click={handleClose}>Cancel</button>
      <button class="btn-primary" on:click={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : '✅ Add to Inventory'}
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
    max-width: 1000px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }
  
  .site-name {
    margin: 0.5rem 0 0 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
  }
  
  .error-banner {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 1rem;
    margin: 0 1.5rem;
    margin-top: 1rem;
    border-radius: 6px;
  }
  
  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
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
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
</style>

