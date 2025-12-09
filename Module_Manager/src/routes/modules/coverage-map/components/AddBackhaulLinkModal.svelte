<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { coverageMapService } from '../lib/coverageMapService.mongodb';
  import { mapLayerManager } from '$lib/map/MapLayerManager';
  import type { TowerSite } from '../lib/models';
  
  export let show = false;
  export let sites: TowerSite[] = [];
  export let fromSite: TowerSite | null = null;
  export let tenantId: string;
  export let planId: string | null = null; // Plan ID if creating backhaul within a plan
  export let backhaulToEdit: any | null = null; // Backhaul equipment to edit (null = create mode)
  
  const dispatch = createEventDispatcher();
  
  let isSaving = false;
  let error = '';
  
  // Check if we have enough sites
  $: canCreateBackhaul = sites.length >= 2;
  $: availableToSites = fromSite ? sites.filter(s => s.id !== fromSite.id) : sites;
  
  // Track last shown state to detect when modal opens
  let lastShowState = false;
  
  // Form data
  let formData = {
    fromSiteId: fromSite?.id || '',
    toSiteId: '',
    name: '',
    backhaulType: 'fiber' as 'fiber' | 'fixed-wireless-licensed' | 'fixed-wireless-unlicensed',
    
    // Site A (from) - wireless only
    siteA_azimuth: 0,
    siteA_antennaHeight: 0,
    siteA_antennaGain: 23,
    siteA_txPower: 20,
    
    // Site B (to) - wireless only
    siteB_azimuth: 180,
    siteB_antennaHeight: 0,
    siteB_antennaGain: 23,
    siteB_txPower: 20,
    
    // Wireless common
    frequency: 5800,
    bandwidth: 80,
    beamwidth: 10,
    // FCC Licensing - Comprehensive fields
    licenseType: '',
    licenseNumber: '',
    fccCallSign: '',
    licenseHolderName: '',
    licenseHolderAddress: '',
    licenseStatus: 'active',
    licenseExpiration: '',
    licenseRenewalDate: '',
    fccFileNumber: '',
    partNumber: '',  // Part 101, Part 90, etc.
    frequencyBand: '',
    authorizedBandwidth: '',
    emissionDesignator: '',
    
    // Fiber
    provider: '',
    circuitId: '',
    handoffType: 'single-mode',
    connectorType: 'LC',
    fiberCount: 2,
    fiberSpeed: '1G',
    demarcLocation: '',
    
    // Common
    capacity: 1000,
    equipmentManufacturer: '',
    equipmentModel: '',
    equipmentSerialNumber: '',
    installDate: '',
    monthlyRecurringCost: 0,
    contractTermMonths: 12,
    notes: '',
    status: 'active' as const
  };
  
  $: if (fromSite) formData.fromSiteId = fromSite.id;
  $: isWireless = formData.backhaulType.includes('wireless');
  $: isFiber = formData.backhaulType === 'fiber';
  
  // Track when we need to recalculate azimuths
  let lastFromSiteId = '';
  let lastToSiteId = '';
  
  // Auto-calculate pointing angles when sites change
  $: {
    if (formData.fromSiteId && formData.toSiteId && isWireless) {
      // Only recalculate if sites actually changed
      if (formData.fromSiteId !== lastFromSiteId || formData.toSiteId !== lastToSiteId) {
        const siteA = sites.find(s => s.id === formData.fromSiteId);
        const siteB = sites.find(s => s.id === formData.toSiteId);
        if (siteA && siteB) {
          formData.siteA_azimuth = calculateAzimuth(
            siteA.location.latitude, siteA.location.longitude,
            siteB.location.latitude, siteB.location.longitude
          );
          formData.siteB_azimuth = calculateAzimuth(
            siteB.location.latitude, siteB.location.longitude,
            siteA.location.latitude, siteA.location.longitude
          );
          lastFromSiteId = formData.fromSiteId;
          lastToSiteId = formData.toSiteId;
        }
      }
    }
  }
  
  function calculateAzimuth(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let azimuth = Math.atan2(y, x) * 180 / Math.PI;
    azimuth = (azimuth + 360) % 360;
    
    return Math.round(azimuth);
  }
  
  async function handleSave() {
    if (!formData.name.trim()) {
      error = 'Backhaul name is required';
      return;
    }
    
    if (!formData.fromSiteId || !formData.toSiteId) {
      error = 'Please select both sites';
      return;
    }
    
    if (formData.fromSiteId === formData.toSiteId) {
      error = 'Cannot create backhaul to same site';
      return;
    }
    
    isSaving = true;
    error = '';
    
    try {
      if (planId) {
        const fromSiteObj = sites.find(s => s.id === formData.fromSiteId);
        const toSiteObj = sites.find(s => s.id === formData.toSiteId);

        if (!fromSiteObj || !toSiteObj || !fromSiteObj.location || !toSiteObj.location) {
          throw new Error('Selected sites are missing coordinates');
        }

        const properties: Record<string, any> = {
          name: formData.name,
          backhaulType: formData.backhaulType,
          fromSiteId: formData.fromSiteId,
          toSiteId: formData.toSiteId,
          wireless: isWireless ? {
            siteA: {
              azimuth: formData.siteA_azimuth,
              antennaHeight: formData.siteA_antennaHeight,
              antennaGain: formData.siteA_antennaGain,
              txPower: formData.siteA_txPower
            },
            siteB: {
              azimuth: formData.siteB_azimuth,
              antennaHeight: formData.siteB_antennaHeight,
              antennaGain: formData.siteB_antennaGain,
              txPower: formData.siteB_txPower
            },
            frequency: formData.frequency,
            bandwidth: formData.bandwidth,
            beamwidth: formData.beamwidth,
            licensing: formData.backhaulType === 'fixed-wireless-licensed' ? {
              licenseType: formData.licenseType || undefined,
              licenseNumber: formData.licenseNumber || undefined,
              fccCallSign: formData.fccCallSign || undefined,
              licenseHolderName: formData.licenseHolderName || undefined,
              licenseHolderAddress: formData.licenseHolderAddress || undefined,
              licenseStatus: formData.licenseStatus || 'active',
              expirationDate: formData.licenseExpiration || undefined,
              renewalDate: formData.licenseRenewalDate || undefined,
              fccFileNumber: formData.fccFileNumber || undefined,
              partNumber: formData.partNumber || undefined,
              frequencyBand: formData.frequencyBand || undefined,
              authorizedBandwidth: formData.authorizedBandwidth || undefined,
              emissionDesignator: formData.emissionDesignator || undefined
            } : undefined
          } : undefined,
          fiber: isFiber ? {
            provider: formData.provider || undefined,
            circuitId: formData.circuitId || undefined,
            handoffType: formData.handoffType,
            connectorType: formData.connectorType,
            fiberCount: formData.fiberCount,
            fiberSpeed: formData.fiberSpeed,
            demarcLocation: formData.demarcLocation || undefined
          } : undefined,
          capacityMbps: formData.capacity,
          manufacturer: formData.equipmentManufacturer || undefined,
          equipmentModel: formData.equipmentModel || undefined,
          notes: formData.notes || undefined,
          costs: {
            monthlyRecurringCost: formData.monthlyRecurringCost || undefined,
            contractTermMonths: formData.contractTermMonths || undefined
          }
        };

        await mapLayerManager.addFeature(planId, {
          featureType: 'link',
          geometry: {
            type: 'LineString',
            coordinates: [
              [fromSiteObj.location.longitude, fromSiteObj.location.latitude],
              [toSiteObj.location.longitude, toSiteObj.location.latitude]
            ]
          },
          properties,
          status: 'draft'
        });

        dispatch('saved', { message: 'Backhaul link staged in plan.' });
      } else {
        const backhaulData: any = {
          siteId: formData.fromSiteId,
          name: formData.name,
          type: 'backhaul',
          locationType: 'tower',
          manufacturer: formData.equipmentManufacturer || (isWireless ? 'Wireless' : formData.provider || 'Fiber'),
          model: formData.equipmentModel || 'N/A',
          serialNumber: formData.equipmentSerialNumber || `BH-${Date.now()}`,
          status: formData.status,
          location: sites.find(s => s.id === formData.fromSiteId)?.location || { latitude: 0, longitude: 0 },
          installDate: formData.installDate || undefined,
          notes: JSON.stringify({
            backhaulType: formData.backhaulType,
            fromSiteId: formData.fromSiteId,
            toSiteId: formData.toSiteId,
            ...(isWireless && {
              wireless: {
                siteA: {
                  azimuth: formData.siteA_azimuth,
                  antennaHeight: formData.siteA_antennaHeight,
                  antennaGain: formData.siteA_antennaGain,
                  txPower: formData.siteA_txPower
                },
                siteB: {
                  azimuth: formData.siteB_azimuth,
                  antennaHeight: formData.siteB_antennaHeight,
                  antennaGain: formData.siteB_antennaGain,
                  txPower: formData.siteB_txPower
                },
                frequency: formData.frequency,
                bandwidth: formData.bandwidth,
                beamwidth: formData.beamwidth
              }
            }),
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
            capacity: formData.capacity,
            financial: {
              monthlyRecurringCost: formData.monthlyRecurringCost || 0,
              contractTermMonths: formData.contractTermMonths || 12
            },
            additionalNotes: formData.notes
          })
        };

        if (backhaulToEdit && backhaulToEdit.id) {
          // Update existing backhaul
          console.log('[AddBackhaulLinkModal] Updating existing backhaul:', backhaulToEdit.id);
          await coverageMapService.updateEquipment(tenantId, backhaulToEdit.id, backhaulData);
          dispatch('saved', { message: 'Backhaul link updated successfully.' });
        } else {
          // Create new backhaul
          console.log('[AddBackhaulLinkModal] Creating new backhaul');
          await coverageMapService.createEquipment(tenantId, backhaulData);
          dispatch('saved', { message: 'Backhaul link created successfully.' });
        }
      }

      handleClose();
    } catch (err: any) {
      error = err.message || 'Failed to create backhaul link';
    } finally {
      isSaving = false;
    }
  }
  
  function handleClose() {
    show = false;
    error = '';
    lastShowState = false; // Reset flag when closing
  }
  
  $: fromSiteName = sites.find(s => s.id === formData.fromSiteId)?.name || 'Site A';
  $: toSiteName = sites.find(s => s.id === formData.toSiteId)?.name || 'Site B';
</script>

{#if show}
<div class="modal-overlay" on:click={handleClose}>
  <div class="modal-content" on:click={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2>🔗 {backhaulToEdit ? 'Edit Backhaul Link' : 'Add Backhaul Link'}</h2>
      <button class="close-btn" on:click={handleClose}>✕</button>
    </div>
    
    {#if error}
      <div class="error-banner">{error}</div>
    {/if}
    
    {#if !canCreateBackhaul}
      <div class="warning-banner">
        ⚠️ Need at least 2 sites to create backhaul. Add more tower sites or NOC first.
      </div>
    {/if}
    
    <div class="modal-body">
      <!-- Link Endpoints -->
      <div class="section">
        <h3>🔗 Link Endpoints</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>From Site (A) *</label>
            <select bind:value={formData.fromSiteId} disabled={!canCreateBackhaul}>
              <option value="">-- Select site --</option>
              {#each sites as site}
                <option value={site.id}>{site.name} ({site.type})</option>
              {/each}
            </select>
          </div>
          
          <div class="form-group">
            <label>To Site (B) *</label>
            <select bind:value={formData.toSiteId} disabled={!canCreateBackhaul}>
              <option value="">-- Select site --</option>
              {#each availableToSites as site}
                <option value={site.id}>{site.name} ({site.type})</option>
              {/each}
            </select>
          </div>
        </div>
        
        <div class="form-group">
          <label>Link Name *</label>
          <input 
            type="text" 
            bind:value={formData.name} 
            placeholder="{fromSiteName} ↔ {toSiteName}" 
            disabled={!canCreateBackhaul}
          />
        </div>
      </div>
      
      <!-- Backhaul Type -->
      <div class="section">
        <h3>📡 Backhaul Type</h3>
        <div class="form-group">
          <select bind:value={formData.backhaulType} disabled={!canCreateBackhaul}>
            <option value="fiber">🌐 Fiber Optic</option>
            <option value="fixed-wireless-licensed">📡 Fixed Wireless (Licensed Spectrum)</option>
            <option value="fixed-wireless-unlicensed">📡 Fixed Wireless (Unlicensed WiFi/60GHz)</option>
          </select>
        </div>
      </div>
      
      <!-- Wireless Configuration -->
      {#if isWireless && canCreateBackhaul}
        <div class="section wireless-section">
          <h3>📡 Fixed Wireless Configuration</h3>
          
          <!-- Site A Configuration -->
          <div class="site-config">
            <h4>📍 {fromSiteName} (Site A)</h4>
            <div class="form-grid">
              <div class="form-group">
                <label>Azimuth (auto-calculated)</label>
                <input type="number" min="0" max="360" bind:value={formData.siteA_azimuth} />
                <p class="help-text">Pointing toward {toSiteName}</p>
              </div>
              
              <div class="form-group">
                <label>Antenna Height (feet)</label>
                <input type="number" bind:value={formData.siteA_antennaHeight} placeholder="150" />
              </div>
              
              <div class="form-group">
                <label>Antenna Gain (dBi)</label>
                <input type="number" bind:value={formData.siteA_antennaGain} placeholder="23" />
              </div>
              
              <div class="form-group">
                <label>TX Power (dBm)</label>
                <input type="number" bind:value={formData.siteA_txPower} placeholder="20" />
              </div>
            </div>
          </div>
          
          <!-- Site B Configuration -->
          <div class="site-config">
            <h4>📍 {toSiteName} (Site B)</h4>
            <div class="form-grid">
              <div class="form-group">
                <label>Azimuth (auto-calculated)</label>
                <input type="number" min="0" max="360" bind:value={formData.siteB_azimuth} />
                <p class="help-text">Pointing toward {fromSiteName}</p>
              </div>
              
              <div class="form-group">
                <label>Antenna Height (feet)</label>
                <input type="number" bind:value={formData.siteB_antennaHeight} placeholder="150" />
              </div>
              
              <div class="form-group">
                <label>Antenna Gain (dBi)</label>
                <input type="number" bind:value={formData.siteB_antennaGain} placeholder="23" />
              </div>
              
              <div class="form-group">
                <label>TX Power (dBm)</label>
                <input type="number" bind:value={formData.siteB_txPower} placeholder="20" />
              </div>
            </div>
          </div>
          
          <!-- RF Parameters -->
          <h4>📻 RF Parameters</h4>
          <div class="form-grid">
            <div class="form-group">
              <label>Frequency (MHz) *</label>
              <input type="number" bind:value={formData.frequency} placeholder="5800" />
              <p class="help-text">
                {#if formData.backhaulType === 'fixed-wireless-unlicensed'}
                  WiFi: 5150-5850 | 60GHz: 57000-71000
                {:else}
                  Licensed: 6, 11, 18, 23, 80 GHz
                {/if}
              </p>
            </div>
            
            <div class="form-group">
              <label>Channel Bandwidth (MHz)</label>
              <input type="number" bind:value={formData.bandwidth} placeholder="80" />
            </div>
            
            <div class="form-group">
              <label>Beamwidth (degrees)</label>
              <input type="number" bind:value={formData.beamwidth} placeholder="10" />
              <p class="help-text">Antenna beamwidth (5-15° typical)</p>
            </div>
          </div>
          
          <!-- Licensed Spectrum -->
          {#if formData.backhaulType === 'fixed-wireless-licensed'}
            <div class="license-section">
              <h4>📜 FCC Licensing Information</h4>
              <p class="section-help">Required FCC licensing details for licensed wireless backhaul links</p>
              
              <div class="form-grid">
                <div class="form-group">
                  <label>License Type *</label>
                  <select bind:value={formData.licenseType}>
                    <option value="">-- Select --</option>
                    <option value="point-to-point">Point-to-Point</option>
                    <option value="point-to-multipoint">Point-to-Multipoint</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label>FCC Call Sign *</label>
                  <input type="text" bind:value={formData.fccCallSign} placeholder="WXYZ123" />
                  <p class="help-text">FCC-assigned call sign</p>
                </div>
                
                <div class="form-group">
                  <label>FCC License Number</label>
                  <input type="text" bind:value={formData.licenseNumber} placeholder="Additional license identifier" />
                  <p class="help-text">Additional license number if different from call sign</p>
                </div>
                
                <div class="form-group">
                  <label>FCC File Number</label>
                  <input type="text" bind:value={formData.fccFileNumber} placeholder="0000123456" />
                  <p class="help-text">FCC application/file number</p>
                </div>
                
                <div class="form-group">
                  <label>License Status</label>
                  <select bind:value={formData.licenseStatus}>
                    <option value="active">✅ Active</option>
                    <option value="pending">⏳ Pending</option>
                    <option value="expired">❌ Expired</option>
                    <option value="suspended">⚠️ Suspended</option>
                    <option value="revoked">🚫 Revoked</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label>Part Number</label>
                  <select bind:value={formData.partNumber}>
                    <option value="">-- Select --</option>
                    <option value="Part 101">Part 101 - Fixed Microwave Services</option>
                    <option value="Part 90">Part 90 - Private Land Mobile Radio</option>
                    <option value="Part 22">Part 22 - Public Mobile Services</option>
                    <option value="Part 24">Part 24 - Personal Communications Services</option>
                    <option value="Part 27">Part 27 - Miscellaneous Wireless Services</option>
                    <option value="Part 94">Part 94 - Private Operational-Fixed Microwave Service</option>
                    <option value="Part 97">Part 97 - Amateur Radio Service</option>
                  </select>
                </div>
              </div>
              
              <div class="form-grid">
                <div class="form-group">
                  <label>Frequency Band</label>
                  <input type="text" bind:value={formData.frequencyBand} placeholder="6 GHz, 11 GHz, 18 GHz, 23 GHz, 80 GHz" />
                  <p class="help-text">Authorized frequency band (e.g., "6 GHz", "18-23 GHz")</p>
                </div>
                
                <div class="form-group">
                  <label>Authorized Bandwidth</label>
                  <input type="text" bind:value={formData.authorizedBandwidth} placeholder="50 MHz, 100 MHz" />
                  <p class="help-text">Total authorized bandwidth for this license</p>
                </div>
                
                <div class="form-group">
                  <label>Emission Designator</label>
                  <input type="text" bind:value={formData.emissionDesignator} placeholder="8K00F1D" />
                  <p class="help-text">FCC emission designator code</p>
                </div>
              </div>
              
              <div class="form-group">
                <label>License Holder Name *</label>
                <input type="text" bind:value={formData.licenseHolderName} placeholder="Company Name" />
              </div>
              
              <div class="form-group">
                <label>License Holder Address</label>
                <textarea 
                  bind:value={formData.licenseHolderAddress} 
                  placeholder="123 Business St, City, State ZIP"
                  rows="2"
                ></textarea>
                <p class="help-text">Full address of license holder as registered with FCC</p>
              </div>
              
              <div class="form-grid">
                <div class="form-group">
                  <label>License Expiration Date</label>
                  <input type="date" bind:value={formData.licenseExpiration} />
                  <p class="help-text">When the license expires</p>
                </div>
                
                <div class="form-group">
                  <label>Renewal Date</label>
                  <input type="date" bind:value={formData.licenseRenewalDate} />
                  <p class="help-text">Recommended renewal date (before expiration)</p>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Fiber Configuration -->
      {#if isFiber && canCreateBackhaul}
        <div class="section fiber-section">
          <h3>🌐 Fiber Optic Details</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Provider *</label>
              <input type="text" bind:value={formData.provider} placeholder="AT&T, Verizon, Zayo" />
            </div>
            
            <div class="form-group">
              <label>Circuit ID</label>
              <input type="text" bind:value={formData.circuitId} placeholder="CIRCUIT-123456" />
            </div>
            
            <div class="form-group">
              <label>Speed</label>
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
                <option value="single-mode">Single-Mode Fiber</option>
                <option value="multi-mode">Multi-Mode Fiber</option>
                <option value="ethernet">Ethernet</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Connector</label>
              <select bind:value={formData.connectorType}>
                <option value="LC">LC</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
                <option value="RJ45">RJ45</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Fiber Count</label>
              <input type="number" bind:value={formData.fiberCount} placeholder="2" />
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Common Fields -->
      {#if canCreateBackhaul}
        <div class="section">
          <h3>⚙️ Link Details</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Capacity (Mbps) *</label>
              <input type="number" bind:value={formData.capacity} placeholder="1000" />
            </div>
            
            <div class="form-group">
              <label>Equipment Manufacturer</label>
              <input type="text" bind:value={formData.equipmentManufacturer} placeholder="Cisco, Ubiquiti" />
            </div>
            
            <div class="form-group">
              <label>Equipment Model</label>
              <input type="text" bind:value={formData.equipmentModel} placeholder="ASR9000, AirFiber60" />
            </div>
          </div>
          
          <div class="form-grid">
            <div class="form-group">
              <label>Monthly Cost ($)</label>
              <input type="number" bind:value={formData.monthlyRecurringCost} />
            </div>
            
            <div class="form-group">
              <label>Contract (months)</label>
              <input type="number" bind:value={formData.contractTermMonths} />
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
      {/if}
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" on:click={handleClose}>Cancel</button>
      <button class="btn-primary" on:click={handleSave} disabled={isSaving || !canCreateBackhaul}>
        {isSaving ? 'Saving...' : '✅ Create Backhaul Link'}
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
    max-width: 900px;
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
  
  .warning-banner {
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.3);
    color: #f59e0b;
    padding: 1rem;
    margin: 0 1.5rem;
    margin-top: 1rem;
    border-radius: 6px;
    font-weight: 500;
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
  
  .wireless-section {
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.2);
  }
  
  .fiber-section {
    background: rgba(34, 197, 94, 0.05);
    border: 1px solid rgba(34, 197, 94, 0.2);
  }
  
  .site-config {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: rgba(124, 58, 237, 0.05);
    border: 1px solid rgba(124, 58, 237, 0.2);
    border-radius: 6px;
  }
  
  .license-section {
    margin-top: 1rem;
    padding: 1rem;
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.3);
    border-radius: 6px;
  }
  
  .section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: var(--brand-primary);
  }
  
  .section h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
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
</style>

