<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { coverageMapService } from '../lib/coverageMapService.mongodb';
  import type { TowerSite } from '../lib/models';
  
  export let show = false;
  export let site: TowerSite | null = null;
  export let sites: TowerSite[] = [];
  export let tenantId: string;
  
  const dispatch = createEventDispatcher();
  
  let isSaving = false;
  let error = '';
  
  // Form data
  let formData = {
    siteId: site?.id || '',
    name: '',
    backhaulType: 'fiber' as 'fiber' | 'fixed-wireless-licensed' | 'fixed-wireless-unlicensed',
    
    // Fixed Wireless fields
    azimuth: 0,
    beamwidth: 30,
    frequency: 5800,
    bandwidth: 100,
    licenseType: '',
    licenseNumber: '',
    licenseExpiration: '',
    antennaHeight: 0,
    antennaGain: 0,
    txPower: 0,
    
    // Fiber fields
    provider: '',
    circuitId: '',
    handoffType: 'single-mode',
    connectorType: 'LC',
    fiberCount: 2,
    fiberSpeed: '1G',
    demarcLocation: '',
    
    // Common
    capacity: 1000,
    upstreamSite: '',
    remoteSiteLatitude: 0,
    remoteSiteLongitude: 0,
    remoteAddress: '',
    equipmentManufacturer: '',
    equipmentModel: '',
    equipmentSerialNumber: '',
    installDate: '',
    monthlyRecurringCost: 0,
    contractTermMonths: 12,
    notes: '',
    status: 'active' as const
  };
  
  $: if (site) formData.siteId = site.id;
  $: isWireless = formData.backhaulType.includes('wireless');
  $: isFiber = formData.backhaulType === 'fiber';
  
  async function handleSave() {
    if (!formData.name.trim()) {
      error = 'Backhaul name is required';
      return;
    }
    
    if (!formData.siteId) {
      error = 'Please select a site';
      return;
    }
    
    isSaving = true;
    error = '';
    
    try {
      const backhaulData: any = {
        siteId: formData.siteId,
        name: formData.name,
        type: 'backhaul',
        locationType: 'tower',
        manufacturer: formData.equipmentManufacturer || (isWireless ? 'Wireless Equipment' : 'Fiber Provider'),
        model: formData.equipmentModel || 'N/A',
        serialNumber: formData.equipmentSerialNumber || `BH-${Date.now()}`,
        status: formData.status,
        location: sites.find(s => s.id === formData.siteId)?.location || { latitude: 0, longitude: 0 },
        installDate: formData.installDate || undefined,
        
        // Store backhaul-specific data in notes field as JSON
        notes: JSON.stringify({
          backhaulType: formData.backhaulType,
          
          // Wireless backhaul data
          ...(isWireless && {
            wireless: {
              azimuth: formData.azimuth,
              beamwidth: formData.beamwidth,
              frequency: formData.frequency,
              bandwidth: formData.bandwidth,
              antennaHeight: formData.antennaHeight,
              antennaGain: formData.antennaGain,
              txPower: formData.txPower,
              remoteSite: {
                latitude: formData.remoteSiteLatitude || undefined,
                longitude: formData.remoteSiteLongitude || undefined,
                address: formData.remoteAddress || undefined
              },
              licensing: formData.backhaulType === 'fixed-wireless-licensed' ? {
                licenseType: formData.licenseType,
                licenseNumber: formData.licenseNumber,
                expirationDate: formData.licenseExpiration || undefined
              } : undefined
            }
          }),
          
          // Fiber backhaul data
          ...(isFiber && {
            fiber: {
              provider: formData.provider,
              circuitId: formData.circuitId,
              handoffType: formData.handoffType,
              connectorType: formData.connectorType,
              fiberCount: formData.fiberCount,
              fiberSpeed: formData.fiberSpeed,
              demarcLocation: formData.demarcLocation
            }
          }),
          
          // Common data
          capacity: formData.capacity,
          upstreamSite: formData.upstreamSite,
          financial: {
            monthlyRecurringCost: formData.monthlyRecurringCost || 0,
            contractTermMonths: formData.contractTermMonths || 12
          },
          additionalNotes: formData.notes
        })
      };
      
      await coverageMapService.createEquipment(tenantId, backhaulData);
      
      dispatch('saved');
      handleClose();
    } catch (err: any) {
      error = err.message || 'Failed to create backhaul';
    } finally {
      isSaving = false;
    }
  }
  
  function handleClose() {
    show = false;
    error = '';
  }
</script>

{#if show}
<div class="modal-overlay" onclick={handleClose}>
  <div class="modal-content" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2>🔗 Add Backhaul Link</h2>
      <button class="close-btn" onclick={handleClose}>✕</button>
    </div>
    
    {#if error}
      <div class="error-banner">{error}</div>
    {/if}
    
    <div class="modal-body">
      <!-- Site Selection -->
      <div class="section">
        <h3>📡 Tower Site</h3>
        <div class="form-group">
          <label>Select Site *</label>
          <select bind:value={formData.siteId}>
            <option value="">-- Select a tower site --</option>
            {#each sites as s}
              <option value={s.id}>{s.name} ({s.type})</option>
            {/each}
          </select>
        </div>
      </div>
      
      <!-- Backhaul Type -->
      <div class="section">
        <h3>🔗 Backhaul Type</h3>
        <div class="form-group">
          <label>Type *</label>
          <select bind:value={formData.backhaulType}>
            <option value="fiber">🌐 Fiber Optic</option>
            <option value="fixed-wireless-licensed">📡 Fixed Wireless (Licensed Spectrum)</option>
            <option value="fixed-wireless-unlicensed">📡 Fixed Wireless (Unlicensed - WiFi/60GHz)</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Link Name *</label>
          <input type="text" bind:value={formData.name} placeholder="Main Fiber Link" />
        </div>
      </div>
      
      <!-- Fiber Specific Fields -->
      {#if isFiber}
        <div class="section fiber-section">
          <h3>🌐 Fiber Optic Details</h3>
          
          <div class="form-grid">
            <div class="form-group">
              <label>Fiber Provider *</label>
              <input type="text" bind:value={formData.provider} placeholder="AT&T, Verizon, Zayo, Crown Castle" />
            </div>
            
            <div class="form-group">
              <label>Circuit ID</label>
              <input type="text" bind:value={formData.circuitId} placeholder="CIRCUIT-123456-ABC" />
            </div>
            
            <div class="form-group">
              <label>Fiber Speed</label>
              <select bind:value={formData.fiberSpeed}>
                <option value="100M">100 Mbps</option>
                <option value="1G">1 Gbps</option>
                <option value="10G">10 Gbps</option>
                <option value="100G">100 Gbps</option>
              </select>
            </div>
          </div>
          
          <div class="form-grid">
            <div class="form-group">
              <label>Handoff Type</label>
              <select bind:value={formData.handoffType}>
                <option value="single-mode">Single-Mode Fiber (SMF)</option>
                <option value="multi-mode">Multi-Mode Fiber (MMF)</option>
                <option value="ethernet">Ethernet Handoff</option>
                <option value="coax">Coax Handoff</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Connector Type</label>
              <select bind:value={formData.connectorType}>
                <option value="LC">LC (Lucent Connector)</option>
                <option value="SC">SC (Subscriber Connector)</option>
                <option value="ST">ST (Straight Tip)</option>
                <option value="RJ45">RJ45 (Ethernet)</option>
                <option value="MTP">MTP/MPO (Multi-fiber)</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Fiber Count</label>
              <input type="number" bind:value={formData.fiberCount} placeholder="2" />
              <p class="help-text">Number of fiber strands</p>
            </div>
          </div>
          
          <div class="form-group">
            <label>Demarc Location</label>
            <input type="text" bind:value={formData.demarcLocation} placeholder="Ground floor equipment room, Rack A3" />
            <p class="help-text">Where fiber enters the building</p>
          </div>
        </div>
      {/if}
      
      <!-- Fixed Wireless Specific Fields -->
      {#if isWireless}
        <div class="section wireless-section">
          <h3>📡 Fixed Wireless Details</h3>
          
          <!-- RF Configuration -->
          <h4>📻 RF Configuration</h4>
          <div class="form-grid">
            <div class="form-group">
              <label>Azimuth (degrees) *</label>
              <input type="number" min="0" max="360" bind:value={formData.azimuth} />
              <p class="help-text">Direction link is pointing (0° = North)</p>
            </div>
            
            <div class="form-group">
              <label>Beamwidth (degrees)</label>
              <input type="number" bind:value={formData.beamwidth} />
              <p class="help-text">Antenna beamwidth (10-30° typical for PTP)</p>
            </div>
            
            <div class="form-group">
              <label>Antenna Height (feet)</label>
              <input type="number" bind:value={formData.antennaHeight} placeholder="150" />
              <p class="help-text">Height above ground level</p>
            </div>
          </div>
          
          <div class="form-grid">
            <div class="form-group">
              <label>Frequency (MHz) *</label>
              <input type="number" bind:value={formData.frequency} placeholder="5800" />
              <p class="help-text">
                {#if formData.backhaulType === 'fixed-wireless-unlicensed'}
                  WiFi: 2412-2484, 5150-5850 MHz | 60 GHz: 57000-71000 MHz
                {:else}
                  Licensed bands: 6 GHz, 11 GHz, 18 GHz, 23 GHz, 80 GHz
                {/if}
              </p>
            </div>
            
            <div class="form-group">
              <label>Channel Bandwidth (MHz)</label>
              <input type="number" bind:value={formData.bandwidth} placeholder="40" />
              <p class="help-text">20, 40, 80, 160 MHz</p>
            </div>
            
            <div class="form-group">
              <label>Antenna Gain (dBi)</label>
              <input type="number" bind:value={formData.antennaGain} placeholder="23" />
            </div>
          </div>
          
          <div class="form-grid">
            <div class="form-group">
              <label>TX Power (dBm)</label>
              <input type="number" bind:value={formData.txPower} placeholder="20" />
              <p class="help-text">Transmit power</p>
            </div>
          </div>
          
          <!-- Remote Site Location -->
          <h4>📍 Remote Site Location</h4>
          <div class="form-grid">
            <div class="form-group">
              <label>Remote Latitude</label>
              <input type="number" step="0.000001" bind:value={formData.remoteSiteLatitude} />
            </div>
            
            <div class="form-group">
              <label>Remote Longitude</label>
              <input type="number" step="0.000001" bind:value={formData.remoteSiteLongitude} />
            </div>
          </div>
          
          <div class="form-group">
            <label>Remote Site Address</label>
            <input type="text" bind:value={formData.remoteAddress} placeholder="123 Remote Tower Rd" />
          </div>
          
          {#if formData.backhaulType === 'fixed-wireless-licensed'}
            <div class="license-section">
              <h4>📜 FCC Licensing (Required for Licensed Spectrum)</h4>
              <div class="form-grid">
                <div class="form-group">
                  <label>License Type *</label>
                  <select bind:value={formData.licenseType}>
                    <option value="">-- Select Type --</option>
                    <option value="point-to-point">Point-to-Point</option>
                    <option value="point-to-multipoint">Point-to-Multipoint</option>
                    <option value="multipoint">Multipoint</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label>FCC License Number *</label>
                  <input type="text" bind:value={formData.licenseNumber} placeholder="FCC-ABC123456" />
                  <p class="help-text">FCC call sign or license number</p>
                </div>
                
                <div class="form-group">
                  <label>License Expiration Date</label>
                  <input type="date" bind:value={formData.licenseExpiration} />
                </div>
              </div>
            </div>
          {:else if formData.backhaulType === 'fixed-wireless-unlicensed'}
            <div class="unlicensed-info">
              <p class="info-text">
                ℹ️ <strong>Unlicensed Spectrum:</strong> No FCC license required for WiFi (2.4/5 GHz) or 60 GHz bands.
                Ensure compliance with Part 15 power limits.
              </p>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Common Fields -->
      <div class="section">
        <h3>⚙️ Link Configuration</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Link Capacity (Mbps) *</label>
            <input type="number" bind:value={formData.capacity} placeholder="1000" />
            <p class="help-text">Expected/guaranteed throughput</p>
          </div>
          
          <div class="form-group">
            <label>Connects to (Upstream Site)</label>
            <select bind:value={formData.upstreamSite}>
              <option value="">-- Select upstream site --</option>
              {#each sites.filter(s => s.id !== formData.siteId) as upstreamOption}
                <option value={upstreamOption.id}>{upstreamOption.name}</option>
              {/each}
            </select>
            <p class="help-text">Network topology - which site this connects to</p>
          </div>
          
          <div class="form-group">
            <label>Status</label>
            <select bind:value={formData.status}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
              <option value="planned">Planned</option>
            </select>
          </div>
        </div>
      </div>
      
      <!-- Equipment Details -->
      <div class="section">
        <h3>🔧 Equipment Details</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Equipment Manufacturer</label>
            <input 
              type="text" 
              bind:value={formData.equipmentManufacturer} 
              placeholder="{isWireless ? 'Ubiquiti, Cambium, Mimosa' : 'Cisco, Juniper, Adtran'}" 
            />
          </div>
          
          <div class="form-group">
            <label>Equipment Model</label>
            <input 
              type="text" 
              bind:value={formData.equipmentModel} 
              placeholder="{isWireless ? 'AirFiber 60 LR, PTP 670' : 'ASR9000, MX480'}" 
            />
          </div>
          
          <div class="form-group">
            <label>Serial Number</label>
            <input type="text" bind:value={formData.equipmentSerialNumber} placeholder="SN-123456789" />
          </div>
        </div>
        
        <div class="form-group">
          <label>Install Date</label>
          <input type="date" bind:value={formData.installDate} />
        </div>
      </div>
      
      <!-- Financial/Contract -->
      <div class="section">
        <h3>💰 Financial Information</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Monthly Recurring Cost ($)</label>
            <input type="number" bind:value={formData.monthlyRecurringCost} placeholder="{isFiber ? '500' : '0'}" />
            <p class="help-text">{isFiber ? 'Monthly circuit fee' : 'Maintenance/licensing costs'}</p>
          </div>
          
          <div class="form-group">
            <label>Contract Term (months)</label>
            <input type="number" bind:value={formData.contractTermMonths} placeholder="12" />
            <p class="help-text">Length of service agreement</p>
          </div>
        </div>
        
        <div class="form-group">
          <label>Notes</label>
          <textarea 
            bind:value={formData.notes} 
            placeholder="Installation notes, special requirements, escalation contacts..."
            rows="3"
          ></textarea>
        </div>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" onclick={handleClose}>Cancel</button>
      <button class="btn-primary" onclick={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : '✅ Create Backhaul'}
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
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
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
    font-size: 1.5rem;
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
  
  .fiber-section {
    background: rgba(34, 197, 94, 0.05);
    border: 1px solid rgba(34, 197, 94, 0.2);
  }
  
  .wireless-section {
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.2);
  }
  
  .section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: var(--brand-primary);
  }
  
  .license-section {
    margin-top: 1rem;
    padding: 1rem;
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.3);
    border-radius: 6px;
  }
  
  .license-section h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    color: #f59e0b;
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
  .form-group select {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
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
  
  .unlicensed-info {
    margin-top: 1rem;
    padding: 1rem;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 6px;
  }
  
  .info-text {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-primary);
    line-height: 1.5;
  }
  
  .section h4 {
    margin: 1.5rem 0 1rem 0;
    font-size: 1rem;
    color: var(--text-primary);
    font-weight: 600;
  }
  
  .section textarea {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: inherit;
    resize: vertical;
  }
</style>

