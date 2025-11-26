<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { auth } from '$lib/firebase';
  
  export let show = false;
  export let site: any = null;
  export let tenantId: string;
  export let HSS_API: string;
  
  const dispatch = createEventDispatcher();
  
  let devices: any[] = [];
  let loading = true;
  let editingDevice: any = null;
  let showAddDeviceModal = false;
  let saving = false;
  let error = '';
  let success = '';
  
  // New device form
  let newDevice = {
    deployment_type: 'both',
    hss_config: {
      mcc: '001',
      mnc: '01',
      tac: '1',
      apnName: 'internet',
      dnsPrimary: '8.8.8.8',
      dnsSecondary: '8.8.4.4'
    },
    snmp_config: {
      enabled: true,
      community: 'public',
      version: '2c',
      pollingInterval: 60,
      autoDiscovery: true,
      targets: []
    }
  };
  
  $: if (show && site) {
    loadDevices();
  }
  
  async function loadDevices() {
    loading = true;
    error = '';
    
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      
      // Get devices for this site by site_name
      const response = await fetch(`${HSS_API}/epc/list?site_name=${encodeURIComponent(site.name)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        devices = data.epcs || [];
      } else {
        error = 'Failed to load devices';
      }
    } catch (err: any) {
      console.error('Error loading devices:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  function startEdit(device: any) {
    editingDevice = JSON.parse(JSON.stringify(device)); // Deep copy
    // Ensure nested objects exist
    if (!editingDevice.hss_config) {
      editingDevice.hss_config = { mcc: '001', mnc: '01', tac: '1', apnName: 'internet', dnsPrimary: '8.8.8.8', dnsSecondary: '8.8.4.4' };
    }
    if (!editingDevice.snmp_config) {
      editingDevice.snmp_config = { enabled: true, community: 'public', version: '2c', pollingInterval: 60, autoDiscovery: true, targets: [] };
    }
  }
  
  function cancelEdit() {
    editingDevice = null;
  }
  
  async function saveDevice() {
    if (!editingDevice) return;
    
    saving = true;
    error = '';
    
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      
      const response = await fetch(`${HSS_API}/epc/${editingDevice.epc_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deployment_type: editingDevice.deployment_type,
          hss_config: editingDevice.hss_config,
          snmp_config: editingDevice.snmp_config,
          network_config: editingDevice.network_config
        })
      });
      
      if (response.ok) {
        success = 'Device configuration saved!';
        editingDevice = null;
        await loadDevices();
        setTimeout(() => success = '', 3000);
      } else {
        const data = await response.json();
        error = data.error || 'Failed to save device';
      }
    } catch (err: any) {
      error = err.message;
    } finally {
      saving = false;
    }
  }
  
  async function addDevice() {
    saving = true;
    error = '';
    
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      
      // Create the device via the register-epc endpoint
      const response = await fetch(`${HSS_API}/deploy/register-epc`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          siteName: site.name,
          siteId: site.id || site._id,
          location: site.location,
          deploymentType: newDevice.deployment_type,
          hssConfig: newDevice.hss_config,
          snmpConfig: newDevice.snmp_config
        })
      });
      
      if (response.ok) {
        success = 'Device added! Download the ISO to deploy hardware.';
        showAddDeviceModal = false;
        await loadDevices();
        // Reset form
        newDevice = {
          deployment_type: 'both',
          hss_config: { mcc: '001', mnc: '01', tac: '1', apnName: 'internet', dnsPrimary: '8.8.8.8', dnsSecondary: '8.8.4.4' },
          snmp_config: { enabled: true, community: 'public', version: '2c', pollingInterval: 60, autoDiscovery: true, targets: [] }
        };
        setTimeout(() => success = '', 5000);
      } else {
        const data = await response.json();
        error = data.error || 'Failed to add device';
      }
    } catch (err: any) {
      error = err.message;
    } finally {
      saving = false;
    }
  }
  
  function getDeploymentTypeLabel(type: string) {
    switch(type) {
      case 'epc': return '📡 EPC Only';
      case 'snmp': return '📊 SNMP Only';
      case 'both': return '📡📊 EPC + SNMP';
      default: return '📡📊 EPC + SNMP';
    }
  }
  
  function getStatusBadge(status: string) {
    const badges: Record<string, { class: string; label: string }> = {
      'registered': { class: 'status-registered', label: '⏳ Registered' },
      'online': { class: 'status-online', label: '🟢 Online' },
      'offline': { class: 'status-offline', label: '🔴 Offline' },
      'error': { class: 'status-error', label: '⚠️ Error' }
    };
    return badges[status] || badges['registered'];
  }
  
  function close() {
    show = false;
    editingDevice = null;
    dispatch('close');
  }
</script>

{#if show && site}
  <div class="modal-overlay" on:click|self={close}>
    <div class="modal site-devices-modal">
      <div class="modal-header">
        <div>
          <h2>🏢 {site.name}</h2>
          <p class="subtitle">Manage deployed devices at this site</p>
        </div>
        <button class="close-btn" on:click={close}>✕</button>
      </div>
      
      {#if error}
        <div class="error-banner">{error}</div>
      {/if}
      
      {#if success}
        <div class="success-banner">{success}</div>
      {/if}
      
      <div class="modal-body">
        <!-- Site Info Summary -->
        <div class="site-info">
          <div class="info-item">
            <span class="icon">📍</span>
            <span>{site.location?.city || 'N/A'}, {site.location?.state || ''}</span>
          </div>
          {#if site.location?.coordinates}
            <div class="info-item">
              <span class="icon">🗺️</span>
              <span>{site.location.coordinates.latitude?.toFixed(4)}, {site.location.coordinates.longitude?.toFixed(4)}</span>
            </div>
          {/if}
          <div class="info-item">
            <span class="icon">📦</span>
            <span>{devices.length} device(s) deployed</span>
          </div>
        </div>
        
        <!-- Devices List -->
        <div class="devices-section">
          <div class="section-header">
            <h3>Deployed Devices</h3>
            <button class="add-btn" on:click={() => showAddDeviceModal = true}>
              ➕ Add Device
            </button>
          </div>
          
          {#if loading}
            <div class="loading">Loading devices...</div>
          {:else if devices.length === 0}
            <div class="empty-state">
              <p>No devices deployed at this site yet.</p>
              <button class="add-btn" on:click={() => showAddDeviceModal = true}>
                ➕ Add First Device
              </button>
            </div>
          {:else}
            <div class="devices-list">
              {#each devices as device}
                <div class="device-card" class:editing={editingDevice?.epc_id === device.epc_id}>
                  {#if editingDevice?.epc_id === device.epc_id}
                    <!-- Edit Mode -->
                    <div class="device-edit-form">
                      <h4>Edit Device Configuration</h4>
                      
                      <div class="form-group">
                        <label>Deployment Type</label>
                        <select bind:value={editingDevice.deployment_type}>
                          <option value="epc">📡 EPC Only</option>
                          <option value="snmp">📊 SNMP Agent Only</option>
                          <option value="both">📡📊 EPC + SNMP</option>
                        </select>
                      </div>
                      
                      {#if editingDevice.deployment_type === 'epc' || editingDevice.deployment_type === 'both'}
                        <div class="config-section">
                          <h5>📡 EPC Configuration</h5>
                          <div class="form-row">
                            <div class="form-group">
                              <label>MCC</label>
                              <input type="text" bind:value={editingDevice.hss_config.mcc} />
                            </div>
                            <div class="form-group">
                              <label>MNC</label>
                              <input type="text" bind:value={editingDevice.hss_config.mnc} />
                            </div>
                            <div class="form-group">
                              <label>TAC</label>
                              <input type="text" bind:value={editingDevice.hss_config.tac} />
                            </div>
                          </div>
                          <div class="form-group">
                            <label>APN Name</label>
                            <input type="text" bind:value={editingDevice.hss_config.apnName} />
                          </div>
                          <div class="form-row">
                            <div class="form-group">
                              <label>Primary DNS</label>
                              <input type="text" bind:value={editingDevice.hss_config.dnsPrimary} />
                            </div>
                            <div class="form-group">
                              <label>Secondary DNS</label>
                              <input type="text" bind:value={editingDevice.hss_config.dnsSecondary} />
                            </div>
                          </div>
                        </div>
                      {/if}
                      
                      {#if editingDevice.deployment_type === 'snmp' || editingDevice.deployment_type === 'both'}
                        <div class="config-section">
                          <h5>📊 SNMP Configuration</h5>
                          <div class="form-row">
                            <div class="form-group">
                              <label>
                                <input type="checkbox" bind:checked={editingDevice.snmp_config.enabled} />
                                SNMP Enabled
                              </label>
                            </div>
                            <div class="form-group">
                              <label>
                                <input type="checkbox" bind:checked={editingDevice.snmp_config.autoDiscovery} />
                                Auto-Discovery
                              </label>
                            </div>
                          </div>
                          <div class="form-row">
                            <div class="form-group">
                              <label>Community String</label>
                              <input type="text" bind:value={editingDevice.snmp_config.community} />
                            </div>
                            <div class="form-group">
                              <label>Version</label>
                              <select bind:value={editingDevice.snmp_config.version}>
                                <option value="1">SNMPv1</option>
                                <option value="2c">SNMPv2c</option>
                                <option value="3">SNMPv3</option>
                              </select>
                            </div>
                          </div>
                          <div class="form-group">
                            <label>Polling Interval (seconds)</label>
                            <input type="number" bind:value={editingDevice.snmp_config.pollingInterval} min="10" max="3600" />
                          </div>
                        </div>
                      {/if}
                      
                      <div class="edit-actions">
                        <button class="btn-secondary" on:click={cancelEdit} disabled={saving}>Cancel</button>
                        <button class="btn-primary" on:click={saveDevice} disabled={saving}>
                          {#if saving}⏳ Saving...{:else}💾 Save Changes{/if}
                        </button>
                      </div>
                    </div>
                  {:else}
                    <!-- View Mode -->
                    <div class="device-header">
                      <div>
                        <span class="deployment-type">{getDeploymentTypeLabel(device.deployment_type)}</span>
                        <span class="status-badge {getStatusBadge(device.status).class}">
                          {getStatusBadge(device.status).label}
                        </span>
                      </div>
                      <button class="edit-btn" on:click={() => startEdit(device)}>✏️ Edit</button>
                    </div>
                    
                    <div class="device-details">
                      <div class="detail-row">
                        <span class="label">Device Code:</span>
                        {#if device.device_code}
                          <code class="device-code">{device.device_code}</code>
                        {:else}
                          <span class="not-linked">Not linked yet</span>
                        {/if}
                      </div>
                      
                      {#if device.hardware_id}
                        <div class="detail-row">
                          <span class="label">Hardware ID:</span>
                          <code>{device.hardware_id}</code>
                        </div>
                      {/if}
                      
                      {#if device.deployment_type === 'epc' || device.deployment_type === 'both'}
                        <div class="detail-row">
                          <span class="label">Network:</span>
                          <span>MCC: {device.hss_config?.mcc || device.network_config?.mcc || '001'} / MNC: {device.hss_config?.mnc || device.network_config?.mnc || '01'}</span>
                        </div>
                        <div class="detail-row">
                          <span class="label">APN:</span>
                          <span>{device.hss_config?.apnName || 'internet'}</span>
                        </div>
                      {/if}
                      
                      {#if device.deployment_type === 'snmp' || device.deployment_type === 'both'}
                        <div class="detail-row">
                          <span class="label">SNMP:</span>
                          <span>
                            {device.snmp_config?.enabled !== false ? '✓ Enabled' : '✗ Disabled'}
                            ({device.snmp_config?.community || 'public'})
                          </span>
                        </div>
                      {/if}
                      
                      {#if device.last_seen}
                        <div class="detail-row">
                          <span class="label">Last Seen:</span>
                          <span>{new Date(device.last_seen).toLocaleString()}</span>
                        </div>
                      {/if}
                    </div>
                    
                    <div class="device-id">
                      ID: {device.epc_id}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={close}>Close</button>
      </div>
    </div>
  </div>
{/if}

<!-- Add Device Modal -->
{#if showAddDeviceModal}
  <div class="modal-overlay nested" on:click|self={() => showAddDeviceModal = false}>
    <div class="modal add-device-modal">
      <div class="modal-header">
        <h2>➕ Add New Device</h2>
        <button class="close-btn" on:click={() => showAddDeviceModal = false}>✕</button>
      </div>
      
      <div class="modal-body">
        <p class="info-text">
          Add a new device deployment to <strong>{site?.name}</strong>. After adding, you'll get an ISO to boot the hardware.
        </p>
        
        <div class="form-group">
          <label>Deployment Type</label>
          <select bind:value={newDevice.deployment_type}>
            <option value="epc">📡 EPC Only - LTE Core Network</option>
            <option value="snmp">📊 SNMP Agent Only - Network Monitoring</option>
            <option value="both">📡📊 EPC + SNMP - Full Package</option>
          </select>
        </div>
        
        {#if newDevice.deployment_type === 'epc' || newDevice.deployment_type === 'both'}
          <div class="config-section">
            <h4>📡 EPC Configuration</h4>
            <div class="form-row">
              <div class="form-group">
                <label>MCC</label>
                <input type="text" bind:value={newDevice.hss_config.mcc} placeholder="001" />
              </div>
              <div class="form-group">
                <label>MNC</label>
                <input type="text" bind:value={newDevice.hss_config.mnc} placeholder="01" />
              </div>
              <div class="form-group">
                <label>TAC</label>
                <input type="text" bind:value={newDevice.hss_config.tac} placeholder="1" />
              </div>
            </div>
            <div class="form-group">
              <label>APN Name</label>
              <input type="text" bind:value={newDevice.hss_config.apnName} placeholder="internet" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Primary DNS</label>
                <input type="text" bind:value={newDevice.hss_config.dnsPrimary} placeholder="8.8.8.8" />
              </div>
              <div class="form-group">
                <label>Secondary DNS</label>
                <input type="text" bind:value={newDevice.hss_config.dnsSecondary} placeholder="8.8.4.4" />
              </div>
            </div>
          </div>
        {/if}
        
        {#if newDevice.deployment_type === 'snmp' || newDevice.deployment_type === 'both'}
          <div class="config-section">
            <h4>📊 SNMP Configuration</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Community String</label>
                <input type="text" bind:value={newDevice.snmp_config.community} placeholder="public" />
              </div>
              <div class="form-group">
                <label>Version</label>
                <select bind:value={newDevice.snmp_config.version}>
                  <option value="1">SNMPv1</option>
                  <option value="2c">SNMPv2c</option>
                  <option value="3">SNMPv3</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Polling Interval (seconds)</label>
              <input type="number" bind:value={newDevice.snmp_config.pollingInterval} min="10" max="3600" />
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" bind:checked={newDevice.snmp_config.autoDiscovery} />
                Auto-discover devices on local network
              </label>
            </div>
          </div>
        {/if}
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={() => showAddDeviceModal = false}>Cancel</button>
        <button class="btn-primary" on:click={addDevice} disabled={saving}>
          {#if saving}⏳ Creating...{:else}➕ Add Device{/if}
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
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  
  .modal-overlay.nested {
    z-index: 1100;
  }
  
  .modal {
    background: white;
    border-radius: 12px;
    max-width: 900px;
    width: 100%;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }
  
  .add-device-modal {
    max-width: 600px;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  
  .subtitle {
    margin: 0.25rem 0 0 0;
    color: #6b7280;
    font-size: 0.875rem;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #9ca3af;
    padding: 0;
  }
  
  .close-btn:hover {
    color: #374151;
  }
  
  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
  }
  
  .error-banner {
    background: #fee2e2;
    color: #991b1b;
    padding: 0.75rem 1rem;
    border-left: 4px solid #dc2626;
  }
  
  .success-banner {
    background: #d1fae5;
    color: #065f46;
    padding: 0.75rem 1rem;
    border-left: 4px solid #10b981;
  }
  
  .site-info {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    padding: 1rem;
    background: #f0f9ff;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }
  
  .info-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }
  
  .info-item .icon {
    font-size: 1.1rem;
  }
  
  .devices-section {
    margin-top: 1rem;
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  
  .section-header h3 {
    margin: 0;
    font-size: 1.1rem;
  }
  
  .add-btn {
    padding: 0.5rem 1rem;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.875rem;
  }
  
  .add-btn:hover {
    background: #1d4ed8;
  }
  
  .loading, .empty-state {
    text-align: center;
    padding: 2rem;
    color: #6b7280;
  }
  
  .devices-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .device-card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1rem;
    background: white;
    transition: box-shadow 0.2s;
  }
  
  .device-card:hover {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  
  .device-card.editing {
    border-color: #2563eb;
    background: #f0f9ff;
  }
  
  .device-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  .deployment-type {
    font-weight: 600;
    margin-right: 0.75rem;
  }
  
  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }
  
  .status-registered { background: #e0e7ff; color: #3730a3; }
  .status-online { background: #d1fae5; color: #065f46; }
  .status-offline { background: #fee2e2; color: #991b1b; }
  .status-error { background: #fef3c7; color: #92400e; }
  
  .edit-btn {
    padding: 0.25rem 0.5rem;
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
  }
  
  .edit-btn:hover {
    background: #e5e7eb;
  }
  
  .device-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .detail-row {
    display: flex;
    gap: 0.5rem;
    font-size: 0.875rem;
  }
  
  .detail-row .label {
    color: #6b7280;
    min-width: 100px;
  }
  
  .device-code {
    background: #ecfdf5;
    color: #047857;
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-family: monospace;
    font-size: 0.9rem;
    letter-spacing: 1px;
  }
  
  .not-linked {
    color: #9ca3af;
    font-style: italic;
  }
  
  .device-id {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #e5e7eb;
    font-size: 0.7rem;
    color: #9ca3af;
    font-family: monospace;
  }
  
  .device-edit-form {
    padding: 0.5rem 0;
  }
  
  .device-edit-form h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    color: #2563eb;
  }
  
  .config-section {
    background: #f9fafb;
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 1rem;
  }
  
  .config-section h4, .config-section h5 {
    margin: 0 0 0.75rem 0;
    font-size: 0.9rem;
    color: #374151;
  }
  
  .form-group {
    margin-bottom: 0.75rem;
  }
  
  .form-group label {
    display: block;
    font-size: 0.8rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.25rem;
  }
  
  .form-group input[type="text"],
  .form-group input[type="number"],
  .form-group select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 0.875rem;
  }
  
  .form-group input[type="checkbox"] {
    margin-right: 0.5rem;
  }
  
  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 0.75rem;
  }
  
  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }
  
  .btn-primary {
    padding: 0.5rem 1rem;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: #1d4ed8;
  }
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    padding: 0.5rem 1rem;
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: #f9fafb;
  }
  
  .info-text {
    margin: 0 0 1rem 0;
    color: #6b7280;
    font-size: 0.9rem;
  }
</style>

