<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { auth } from '$lib/firebase';
  import { API_CONFIG } from '$lib/config/api';
  import { currentTenant } from '$lib/stores/tenantStore';
  
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
      const response = await fetch(`${API_CONFIG.PATHS.API}/snmp/discovered`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        discoveredDevices = data.devices || [];
        console.log('[SNMP Devices] Loaded', discoveredDevices.length, 'discovered devices');
      } else {
        const errorText = await response.text();
        console.error('[SNMP Devices] Failed to load:', response.status, errorText);
        error = `Failed to load: ${response.status}`;
      }
    } catch (err: any) {
      console.error('[SNMP Devices] Error loading devices:', err);
      error = err.message || 'Failed to load devices';
    } finally {
      loading = false;
    }
  }
  
  async function loadExistingHardware() {
    if (!tenantId) return;
    
    loadingHardware = true;
    
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const response = await fetch(`${API_CONFIG.PATHS.API}/inventory/items`, {
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
    showAddHardwareModal = true;
  }
  
  function closeModals() {
    showPairModal = false;
    showAddHardwareModal = false;
    selectedDevice = null;
    existingHardware = [];
  }
  
  async function pairWithHardware(device: any, hardwareId: string) {
    // TODO: Implement pairing logic
    console.log('Pairing device', device.id, 'with hardware', hardwareId);
    closeModals();
    await loadDiscoveredDevices();
  }
  
  async function createNewHardware(device: any, hardwareData: any) {
    // TODO: Implement create hardware logic
    console.log('Creating new hardware from device', device.id, hardwareData);
    closeModals();
    await loadDiscoveredDevices();
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
    <div class="devices-grid">
      {#each discoveredDevices as device (device.id)}
        <div class="device-card">
          <div class="device-header">
            <h3>{device.name || device.ipAddress}</h3>
            <span class="device-type">{device.deviceType || 'unknown'}</span>
          </div>
          
          <div class="device-details">
            <div class="detail-row">
              <span class="label">IP Address:</span>
              <span class="value">{device.ipAddress}</span>
            </div>
            <div class="detail-row">
              <span class="label">Manufacturer:</span>
              <span class="value">{device.manufacturer || 'Unknown'}</span>
            </div>
            <div class="detail-row">
              <span class="label">Model:</span>
              <span class="value">{device.model || 'Unknown'}</span>
            </div>
            <div class="detail-row">
              <span class="label">SNMP Community:</span>
              <span class="value">{device.snmp?.community || 'public'}</span>
            </div>
            {#if device.discoveredBy}
              <div class="detail-row">
                <span class="label">Discovered By:</span>
                <span class="value">{device.discoveredBy}</span>
              </div>
            {/if}
            {#if device.discoveredAt}
              <div class="detail-row">
                <span class="label">Discovered:</span>
                <span class="value">{new Date(device.discoveredAt).toLocaleString()}</span>
              </div>
            {/if}
          </div>
          
          <div class="device-actions">
            <button class="btn btn-secondary" on:click={() => handlePairDevice(device)}>
              🔗 Pair with Hardware
            </button>
            <button class="btn btn-primary" on:click={() => handleAddHardware(device)}>
              ➕ Add as New Hardware
            </button>
          </div>
        </div>
      {/each}
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
        <p>No existing hardware found</p>
      {:else}
        <div class="hardware-list">
          {#each existingHardware as hardware}
            <div class="hardware-item" on:click={() => pairWithHardware(selectedDevice, hardware.id)}>
              <strong>{hardware.assetTag || hardware.name}</strong>
              <span>{hardware.equipmentType || 'Unknown'}</span>
            </div>
          {/each}
        </div>
      {/if}
      
      <div class="modal-actions">
        <button class="btn btn-secondary" on:click={closeModals}>Cancel</button>
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
      <!-- TODO: Add form for creating hardware -->
      <div class="modal-actions">
        <button class="btn btn-secondary" on:click={closeModals}>Cancel</button>
        <button class="btn btn-primary" on:click={() => createNewHardware(selectedDevice, {})}>
          Create Hardware
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .snmp-devices-panel {
    padding: 2rem;
    background: white;
    min-height: 100vh;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }
  
  .panel-header h2 {
    margin: 0;
    color: var(--text-primary, #111827);
  }
  
  .devices-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }
  
  .device-card {
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 8px;
    padding: 1.5rem;
    background: var(--bg-primary, white);
    transition: box-shadow 0.2s;
  }
  
  .device-card:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  
  .device-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }
  
  .device-header h3 {
    margin: 0;
    font-size: 1.125rem;
    color: var(--text-primary, #111827);
  }
  
  .device-type {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: var(--bg-secondary, #f3f4f6);
    border-radius: 4px;
    color: var(--text-secondary, #6b7280);
  }
  
  .device-details {
    margin-bottom: 1rem;
  }
  
  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    font-size: 0.875rem;
  }
  
  .detail-row .label {
    color: var(--text-secondary, #6b7280);
    font-weight: 500;
  }
  
  .detail-row .value {
    color: var(--text-primary, #111827);
  }
  
  .device-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color, #e5e7eb);
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
    color: white;
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
    background: white;
    border-radius: 8px;
    padding: 2rem;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
  }
  
  .modal-content h3 {
    margin-top: 0;
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
</style>
