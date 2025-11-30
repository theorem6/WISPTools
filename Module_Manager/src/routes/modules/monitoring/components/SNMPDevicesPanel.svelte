<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { auth } from '$lib/firebase';
  import { API_CONFIG } from '$lib/config/api';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { monitoringService } from '$lib/services/monitoringService';
  
  export let tenantId: string = '';
  
  const dispatch = createEventDispatcher();
  
  let discoveredDevices: any[] = [];
  let loading = false;
  let error: string | null = null;
  let selectedDevice: any = null;
  let showPairModal = false;
  let showAddHardwareModal = false;
  let existingHardware: any[] = [];
  let loadingHardware = false;
  let deployments: any[] = [];
  let sites: any[] = [];
  let loadingSites = false;
  
  $: if ($currentTenant?.id) {
    tenantId = $currentTenant.id;
    if (tenantId) {
      loadDiscoveredDevices();
    }
  }
  
  async function loadDiscoveredDevices() {
    if (!tenantId) return;
    
    loading = true;
    error = null;
    
    try {
      const user = auth().currentUser;
      if (!user) {
        error = 'Not authenticated';
        return;
      }
      
      const token = await user.getIdToken();
      
      // Load discovered devices and deployments in parallel
      // Use monitoringService which handles routing through Firebase Hosting
      const [discoveredResult, deploymentsResponse] = await Promise.all([
        monitoringService.getDiscoveredDevices().catch(() => ({ success: false, data: { devices: [] } })),
        fetch(`${API_CONFIG.PATHS.NETWORK}/deployments`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId
          }
        }).catch(() => ({ ok: false })) // Deployment API might not exist, that's ok
      ]);
      
      if (discoveredResult.success && discoveredResult.data?.devices) {
        console.log('[SNMP Devices] Raw API response:', discoveredResult.data.devices.slice(0, 3)); // Log first 3 devices
        
        discoveredDevices = (discoveredResult.data.devices || []).map(device => {
          // Ensure device has proper structure with normalized IP address
          const ipAddress = device.ipAddress || device.ip_address || device.management_ip || device.serialNumber || 'Unknown';
          
          // Normalize siteId - handle both ObjectId objects and strings
          const siteIdValue = device.siteId ? 
            (typeof device.siteId === 'object' && device.siteId.toString ? device.siteId.toString() : String(device.siteId)) : 
            null;
          
          // Check if device is deployed - prioritize API's isDeployed flag and siteId
          const isDeployedFromAPI = device.isDeployed === true || !!siteIdValue;
          
          const normalizedDevice = {
            ...device,
            ipAddress: ipAddress,
            ip_address: ipAddress, // Also include snake_case for compatibility
            name: device.name || device.sysName || ipAddress || 'Unknown Device',
            siteId: siteIdValue, // Ensure siteId is always a string or null
            isDeployed: isDeployedFromAPI,
            enableGraphs: (device.enableGraphs !== false && isDeployedFromAPI) || device.enableGraphs === true
          };
          
          // Log if IP is missing for debugging
          if (ipAddress === 'Unknown') {
            console.warn('[SNMP Devices] Device missing IP address:', device);
          }
          
          // Log deployed status for debugging - log ALL devices to see which have siteId
          if (siteIdValue || device.isDeployed) {
            console.log(`[SNMP Devices] ✓ DEPLOYED Device: ${device.name || device.id}`, {
              siteId: siteIdValue,
              isDeployed: device.isDeployed,
              enableGraphs: normalizedDevice.enableGraphs,
              rawSiteId: device.siteId
            });
          }
          
          return normalizedDevice;
        });
        
        console.log('[SNMP Devices] Normalized', discoveredDevices.length, 'devices');
        if (discoveredDevices.length > 0) {
          console.log('[SNMP Devices] Sample normalized device:', discoveredDevices[0]);
          // Count deployed devices
          const deployedCount = discoveredDevices.filter(d => d.isDeployed).length;
          const withSiteId = discoveredDevices.filter(d => d.siteId).length;
          console.log(`[SNMP Devices] Deployed devices: ${deployedCount}/${discoveredDevices.length} (${withSiteId} with siteId)`);
          
          // Log first deployed device details
          const firstDeployed = discoveredDevices.find(d => d.isDeployed);
          if (firstDeployed) {
            console.log('[SNMP Devices] First deployed device details:', {
              name: firstDeployed.name,
              id: firstDeployed.id,
              siteId: firstDeployed.siteId,
              isDeployed: firstDeployed.isDeployed,
              enableGraphs: firstDeployed.enableGraphs
            });
          }
        }
        
        // Load deployment info if available (for additional deployment matching, but don't override siteId-based deployment)
        if (deploymentsResponse.ok) {
          try {
            const text = await deploymentsResponse.text();
            // Check for HTML before parsing
            if (text.trim().toLowerCase().startsWith('<!doctype') || text.trim().toLowerCase().startsWith('<html')) {
              console.warn('[SNMP Devices] Deployments API returned HTML, skipping');
            } else {
              const deploymentsData = JSON.parse(text);
              deployments = deploymentsData.deployments || deploymentsData || [];
            }
          } catch (e) {
            console.warn('[SNMP Devices] Failed to parse deployments response:', e);
          }
        }
        
        console.log('[SNMP Devices] Loaded', discoveredDevices.length, 'discovered devices');
      } else {
        console.warn('[SNMP Devices] No devices found or request failed:', discoveredResult.error || 'Unknown error');
        discoveredDevices = [];
        if (discoveredResult.error) {
          error = discoveredResult.error;
        }
      }
    } catch (err: any) {
      console.error('[SNMP Devices] Error loading devices:', err);
      error = err.message || 'Failed to load devices';
    } finally {
      loading = false;
    }
  }
  
  async function toggleGraphs(device: any) {
    if (!device.isDeployed) return; // Can't enable graphs for non-deployed devices
    
    const user = auth().currentUser;
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      device.enableGraphs = !device.enableGraphs;
      
      // Update device in backend
      const deviceId = device.id || device._id;
      if (deviceId) {
        // Use relative path through Firebase Hosting rewrites
        await fetch(`/api/monitoring/snmp/devices/${deviceId}/graphs`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ enabled: device.enableGraphs })
        });
      }
    } catch (err: any) {
      console.error('[SNMP Devices] Error toggling graphs:', err);
      device.enableGraphs = !device.enableGraphs; // Revert on error
    }
  }
  
  async function loadExistingHardware() {
    if (!tenantId) return;
    
    loadingHardware = true;
    
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const response = await fetch(`${API_CONFIG.PATHS.INVENTORY}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        existingHardware = data.items || [];
      }
    } catch (err: any) {
      console.error('[SNMP Devices] Error loading hardware:', err);
    } finally {
      loadingHardware = false;
    }
  }
  
  function handlePairDevice(device: any) {
    selectedDevice = device;
    showPairModal = true;
    loadExistingHardware();
  }
  
  function handleAddHardware(device: any) {
    selectedDevice = device;
    resetHardwareForm();
    // Set default asset tag based on device
    hardwareForm.assetTag = `SNMP-${device.ipAddress || device.id.substring(0, 8)}`;
    hardwareForm.siteId = device.siteId || '';
    loadSites();
    showAddHardwareModal = true;
  }

  async function loadSites() {
    if (!tenantId) return;
    
    loadingSites = true;
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const response = await fetch(`${API_CONFIG.PATHS.NETWORK}/sites`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        sites = Array.isArray(data) ? data : [];
      }
    } catch (err: any) {
      console.error('[SNMP Devices] Error loading sites:', err);
    } finally {
      loadingSites = false;
    }
  }
  
  function closeModals() {
    showPairModal = false;
    showAddHardwareModal = false;
    selectedDevice = null;
    existingHardware = [];
    pairError = null;
    createError = null;
    resetHardwareForm();
  }
  
  let pairingDevice = false;
  let creatingHardware = false;
  let pairError: string | null = null;
  let createError: string | null = null;
  
  async function pairWithHardware(device: any, hardwareId: string) {
    if (!device || !hardwareId) return;
    
    pairingDevice = true;
    pairError = null;
    
    try {
      const user = auth().currentUser;
      if (!user) {
        pairError = 'Not authenticated';
        return;
      }
      
      const token = await user.getIdToken();
      // Use relative path through Firebase Hosting rewrites
      const response = await fetch(`/api/snmp/discovered/${device.id}/pair`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ hardwareId })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[SNMP Devices] Paired device:', data);
        closeModals();
        await loadDiscoveredDevices();
        // Show success message
        alert('Device paired successfully with hardware!');
      } else {
        const errorText = await response.text();
        console.error('[SNMP Devices] Failed to pair:', response.status, errorText);
        pairError = `Failed to pair: ${response.status}`;
      }
    } catch (err: any) {
      console.error('[SNMP Devices] Error pairing device:', err);
      pairError = err.message || 'Failed to pair device';
    } finally {
      pairingDevice = false;
    }
  }
  
  let hardwareForm = {
    assetTag: '',
    category: 'Networking Equipment',
    siteId: ''
  };
  
  async function createNewHardware(device: any) {
    if (!device) return;
    
    // Set default asset tag if not provided
    if (!hardwareForm.assetTag) {
      hardwareForm.assetTag = `SNMP-${device.ipAddress || device.id.substring(0, 8)}`;
    }
    
    creatingHardware = true;
    createError = null;
    
    try {
      const user = auth().currentUser;
      if (!user) {
        createError = 'Not authenticated';
        return;
      }
      
      const token = await user.getIdToken();
      
      // Look up site name from siteId
      let siteName = '';
      if (hardwareForm.siteId) {
        const selectedSite = sites.find(s => (s._id || s.id) === hardwareForm.siteId);
        siteName = selectedSite?.name || '';
      }
      
      // Use relative path through Firebase Hosting rewrites
      const response = await fetch(`/api/snmp/discovered/${device.id}/create-hardware`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assetTag: hardwareForm.assetTag,
          category: hardwareForm.category,
          siteId: hardwareForm.siteId || null,
          siteName: siteName || device.discoveredBy || 'Unknown Site',
          location: device.location || {}
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[SNMP Devices] Created hardware:', data);
        closeModals();
        hardwareForm = { assetTag: '', category: 'Networking Equipment', siteId: '' };
        await loadDiscoveredDevices();
        // Show success message
        alert('Hardware created successfully!');
      } else {
        const errorText = await response.text();
        console.error('[SNMP Devices] Failed to create hardware:', response.status, errorText);
        createError = `Failed to create hardware: ${response.status}`;
      }
    } catch (err: any) {
      console.error('[SNMP Devices] Error creating hardware:', err);
      createError = err.message || 'Failed to create hardware';
    } finally {
      creatingHardware = false;
    }
  }
  
  function resetHardwareForm() {
    hardwareForm = {
      assetTag: '',
      category: 'Networking Equipment',
      siteId: ''
    };
  }
  
  onMount(() => {
    if (tenantId) {
      loadDiscoveredDevices();
    }
  });
</script>

<div class="snmp-devices-panel">
  <div class="panel-header">
    <h2>📡 Discovered SNMP Devices</h2>
    <button class="btn btn-primary" on:click={loadDiscoveredDevices} disabled={loading}>
      {loading ? 'Loading...' : '🔄 Refresh'}
    </button>
  </div>
  
  {#if loading}
    <div class="loading-state">
      <p>⏳ Loading discovered devices...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p>⚠️ Error: {error}</p>
      <button class="btn btn-primary" on:click={loadDiscoveredDevices}>Retry</button>
    </div>
  {:else if discoveredDevices.length === 0}
    <div class="empty-state">
      <p>📡 No discovered SNMP devices found</p>
      <p class="hint">Devices discovered by EPC agents will appear here</p>
    </div>
  {:else}
    <div class="devices-table-container">
      <table class="devices-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>IP Address</th>
            <th>Type</th>
            <th>Manufacturer</th>
            <th>Model</th>
            <th>SNMP Community</th>
            <th>Status</th>
            <th>Deployed</th>
            <th>Graphs</th>
            <th>Discovered</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each discoveredDevices as device (device.id || device._id)}
            <tr>
              <td class="device-name">
                <strong>{device.name || device.sysName || device.ipAddress || 'Unknown'}</strong>
              </td>
              <td>{device.ipAddress || device.ip_address || device.management_ip || device.serialNumber || 'N/A'}</td>
              <td><span class="device-type-badge">{device.deviceType || device.type || device.device_type || 'unknown'}</span></td>
              <td>{device.manufacturer || 'Unknown'}</td>
              <td>{device.model || device.sysDescr?.substring(0, 50) || 'Unknown'}</td>
              <td>{device.snmp?.community || device.community || 'public'}</td>
              <td>
                <span class="status-badge status-{device.status || 'active'}">
                  {device.status || 'active'}
                </span>
              </td>
              <td>
                {#if device.isDeployed}
                  <span class="deployed-badge deployed">✓ Deployed</span>
                {:else}
                  <span class="deployed-badge not-deployed">Not Deployed</span>
                {/if}
              </td>
              <td>
                {#if device.isDeployed}
                  <label class="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={device.enableGraphs} 
                      on:change={() => toggleGraphs(device)}
                    />
                    <span class="toggle-slider"></span>
                  </label>
                {:else}
                  <span class="text-muted">N/A</span>
                {/if}
              </td>
              <td class="date-cell">
                {#if device.discoveredAt}
                  {new Date(device.discoveredAt).toLocaleDateString()}
                {:else}
                  N/A
                {/if}
              </td>
              <td class="actions-cell">
                <button class="btn btn-sm btn-secondary" on:click={() => handlePairDevice(device)} title="Pair with Hardware">
                  🔗
                </button>
                <button class="btn btn-sm btn-primary" on:click={() => handleAddHardware(device)} title="Add as New Hardware">
                  ➕
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Pair with Hardware Modal -->
{#if showPairModal && selectedDevice}
  <div class="modal-overlay" on:click={closeModals}>
    <div class="modal-content" on:click|stopPropagation>
      <h3>Pair Device with Existing Hardware</h3>
      <p>Select hardware to pair with {selectedDevice.name || selectedDevice.ipAddress}</p>
      
      {#if loadingHardware}
        <p>Loading hardware...</p>
      {:else if existingHardware.length === 0}
        <p>No existing hardware found. Create new hardware instead.</p>
      {:else}
        <div class="hardware-list">
          {#each existingHardware as hardware}
            <div class="hardware-item" on:click={() => !pairingDevice && pairWithHardware(selectedDevice, hardware.id || hardware._id)}>
              <strong>{hardware.assetTag || hardware.name || 'Unnamed Hardware'}</strong>
              <span>{hardware.equipmentType || hardware.subcategory || 'Unknown'}</span>
              {#if hardware.model}
                <span class="hardware-model">{hardware.manufacturer || ''} {hardware.model}</span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
      
      {#if pairError}
        <div class="error-message">{pairError}</div>
      {/if}
      
      <div class="modal-actions">
        <button class="btn btn-secondary" on:click={closeModals} disabled={pairingDevice}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<!-- Add as New Hardware Modal -->
{#if showAddHardwareModal && selectedDevice}
  <div class="modal-overlay" on:click={closeModals}>
    <div class="modal-content" on:click|stopPropagation>
      <h3>Add as New Hardware</h3>
      <p>Create new hardware entry for {selectedDevice.name || selectedDevice.ipAddress}</p>
      
      <form on:submit|preventDefault={() => createNewHardware(selectedDevice)}>
        <div class="form-group">
          <label for="assetTag">Asset Tag:</label>
          <input 
            id="assetTag"
            type="text" 
            bind:value={hardwareForm.assetTag}
            placeholder={`SNMP-${selectedDevice.ipAddress || 'DEVICE'}`}
            required
          />
        </div>
        
        <div class="form-group">
          <label for="category">Category:</label>
          <select id="category" bind:value={hardwareForm.category}>
            <option value="Networking Equipment">Networking Equipment</option>
            <option value="Radio Equipment">Radio Equipment</option>
            <option value="Antennas">Antennas</option>
            <option value="Power Systems">Power Systems</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="siteId">Site:</label>
          {#if loadingSites}
            <select id="siteId" disabled>
              <option>Loading sites...</option>
            </select>
          {:else if sites.length === 0}
            <select id="siteId" disabled>
              <option>No sites available</option>
            </select>
          {:else}
            <select id="siteId" bind:value={hardwareForm.siteId} required>
              <option value="">-- Select a Site --</option>
              {#each sites as site (site._id || site.id)}
                <option value={site._id || site.id}>{site.name || 'Unnamed Site'}</option>
              {/each}
            </select>
          {/if}
        </div>
        
        {#if createError}
          <div class="error-message">{createError}</div>
        {/if}
        
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" on:click={closeModals} disabled={creatingHardware}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={creatingHardware}>
            {creatingHardware ? 'Creating...' : 'Create Hardware'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .snmp-devices-panel {
    padding: 2rem;
    background: var(--card-bg, var(--bg-primary, #ffffff));
    color: var(--text-primary, #111827);
    min-height: 100vh;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-top: 1rem;
  }
  
  .panel-header h2 {
    margin: 0;
    color: var(--text-primary, #111827);
  }
  
  .devices-table-container {
    overflow-x: auto;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 8px;
    background: var(--card-bg, var(--bg-primary, #ffffff));
  }
  
  .devices-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  
  .devices-table thead {
    background: var(--bg-secondary, #f9fafb);
    border-bottom: 2px solid var(--border-color, #e5e7eb);
  }
  
  .devices-table th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    color: var(--text-secondary, #6b7280);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .devices-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    color: var(--text-primary, #111827);
  }
  
  .devices-table tbody tr:hover {
    background: var(--bg-secondary, #f9fafb);
  }
  
  .device-name {
    font-weight: 500;
  }
  
  .device-type-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background: var(--bg-tertiary, #e5e7eb);
    border-radius: 4px;
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
    text-transform: capitalize;
  }
  
  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: capitalize;
  }
  
  .status-badge.status-active {
    background: #d1fae5;
    color: #065f46;
  }
  
  .status-badge.status-inactive {
    background: #fee2e2;
    color: #991b1b;
  }
  
  .deployed-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }
  
  .deployed-badge.deployed {
    background: #dbeafe;
    color: #1e40af;
  }
  
  .deployed-badge.not-deployed {
    background: #f3f4f6;
    color: #6b7280;
  }
  
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
  }
  
  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: 0.3s;
    border-radius: 24px;
  }
  
  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }
  
  .toggle-switch input:checked + .toggle-slider {
    background-color: var(--primary, #3b82f6);
  }
  
  .toggle-switch input:checked + .toggle-slider:before {
    transform: translateX(20px);
  }
  
  .date-cell {
    font-size: 0.8125rem;
    color: var(--text-secondary, #6b7280);
  }
  
  .actions-cell {
    display: flex;
    gap: 0.5rem;
  }
  
  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
  }
  
  .text-muted {
    color: var(--text-secondary, #6b7280);
    font-size: 0.8125rem;
  }
  
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .btn-primary {
    background: var(--primary, #3b82f6);
    color: var(--text-inverse, #ffffff);
  }
  
  .btn-primary:hover {
    background: var(--primary-dark, #2563eb);
  }
  
  .btn-secondary {
    background: var(--bg-secondary, #f3f4f6);
    color: var(--text-primary, #111827);
  }
  
  .btn-secondary:hover {
    background: var(--bg-tertiary, #e5e7eb);
  }
  
  .loading-state, .error-state, .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-secondary, #6b7280);
  }
  
  .hint {
    font-size: 0.875rem;
    margin-top: 0.5rem;
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
    background: var(--card-bg, var(--bg-primary, #ffffff));
    color: var(--text-primary, #111827);
    border-radius: 8px;
    padding: 2rem;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
  }
  
  .modal-content h3 {
    margin-top: 0;
    color: var(--text-primary, #111827);
  }
  
  .modal-content p {
    color: var(--text-secondary, #6b7280);
  }
  
  .hardware-list {
    max-height: 300px;
    overflow-y: auto;
    margin: 1rem 0;
  }
  
  .hardware-item {
    padding: 0.75rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 4px;
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .hardware-item:hover {
    background: var(--bg-secondary, #f3f4f6);
  }
  
  .modal-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary, #111827);
  }
  
  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 4px;
    font-size: 0.875rem;
  }
  
  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .error-message {
    padding: 0.75rem;
    background: #fee2e2;
    color: #991b1b;
    border-radius: 4px;
    margin: 1rem 0;
    font-size: 0.875rem;
  }
  
  .hardware-model {
    display: block;
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
    margin-top: 0.25rem;
  }
</style>
