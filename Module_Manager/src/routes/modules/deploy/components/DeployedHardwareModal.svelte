<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { coverageMapService } from '../../coverage-map/lib/coverageMapService.mongodb';
  import { planService, type PlanProject } from '$lib/services/planService';
  import { authService } from '$lib/services/authService';
  import { auth } from '$lib/firebase';
  import { API_CONFIG } from '$lib/config/api';
  
  export let show = false;
  export let tenantId: string = '';
  
  const dispatch = createEventDispatcher();
  const HSS_API = API_CONFIG.PATHS.HSS;
  
  let deployments: any[] = [];
  let epcDevices: any[] = []; // EPC/SNMP devices from MongoDB
  let plans: PlanProject[] = [];
  let isLoading = false;
  let error = '';
  let selectedDeployment: any = null;
  let selectedEPCDevice: any = null;
  let showEditModal = false;
  let showEPCEditModal = false;
  let isSaving = false;
  let activeTab: 'hardware' | 'epc' = 'hardware';
  
  // Edit form for general hardware
  let editForm = {
    name: '',
    hardware_type: '',
    status: 'deployed',
    config: {} as any,
    planId: ''
  };
  
  // Edit form for EPC/SNMP devices
  let epcEditForm = {
    deployment_type: 'both',
    device_code: '',
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
      autoDiscovery: true
    }
  };
  
  $: if (show && tenantId) {
    loadDeployments();
    loadEPCDevices();
    loadPlans();
  }
  
  async function loadDeployments() {
    if (!tenantId) return;
    
    isLoading = true;
    error = '';
    try {
      deployments = await coverageMapService.getAllHardwareDeployments(tenantId);
    } catch (err: any) {
      console.error('Error loading deployments:', err);
      error = err.message || 'Failed to load deployments';
    } finally {
      isLoading = false;
    }
  }
  
  async function loadEPCDevices() {
    if (!tenantId) return;
    
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const response = await fetch(`${HSS_API}/epc/remote/list`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        epcDevices = data.epcs || [];
      }
    } catch (err: any) {
      console.error('Error loading EPC devices:', err);
    }
  }
  
  async function loadPlans() {
    if (!tenantId) return;
    
    try {
      plans = await planService.getPlans(tenantId);
    } catch (err) {
      console.error('Error loading plans:', err);
    }
  }
  
  function openEdit(deployment: any) {
    selectedDeployment = deployment;
    editForm = {
      name: deployment.name || '',
      hardware_type: deployment.hardware_type || '',
      status: deployment.status || 'deployed',
      config: deployment.config || {},
      planId: deployment.planId || ''
    };
    showEditModal = true;
  }
  
  function openEPCEdit(device: any) {
    selectedEPCDevice = device;
    epcEditForm = {
      deployment_type: device.deployment_type || 'both',
      device_code: device.device_code || '',
      hss_config: {
        mcc: device.hss_config?.mcc || device.network_config?.mcc || '001',
        mnc: device.hss_config?.mnc || device.network_config?.mnc || '01',
        tac: device.hss_config?.tac || device.network_config?.tac || '1',
        apnName: device.hss_config?.apnName || 'internet',
        dnsPrimary: device.hss_config?.dnsPrimary || '8.8.8.8',
        dnsSecondary: device.hss_config?.dnsSecondary || '8.8.4.4'
      },
      snmp_config: {
        enabled: device.snmp_config?.enabled !== false,
        community: device.snmp_config?.community || 'public',
        version: device.snmp_config?.version || '2c',
        pollingInterval: device.snmp_config?.pollingInterval || 60,
        autoDiscovery: device.snmp_config?.autoDiscovery !== false
      }
    };
    showEPCEditModal = true;
  }
  
  async function saveEdit() {
    if (!selectedDeployment || !tenantId) return;
    
    isSaving = true;
    error = '';
    try {
      await coverageMapService.updateHardwareDeployment(
        tenantId,
        selectedDeployment._id || selectedDeployment.id,
        editForm
      );
      await loadDeployments();
      showEditModal = false;
      selectedDeployment = null;
    } catch (err: any) {
      console.error('Error updating deployment:', err);
      error = err.message || 'Failed to update deployment';
    } finally {
      isSaving = false;
    }
  }
  
  async function saveEPCEdit() {
    if (!selectedEPCDevice || !tenantId) return;
    
    isSaving = true;
    error = '';
    try {
      const user = auth().currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();
      const response = await fetch(`${HSS_API}/epc/${selectedEPCDevice.epc_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deployment_type: epcEditForm.deployment_type,
          hss_config: epcEditForm.hss_config,
          snmp_config: epcEditForm.snmp_config
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update device');
      }
      
      await loadEPCDevices();
      showEPCEditModal = false;
      selectedEPCDevice = null;
    } catch (err: any) {
      console.error('Error updating EPC device:', err);
      error = err.message || 'Failed to update EPC device';
    } finally {
      isSaving = false;
    }
  }
  
  async function linkDeviceCode() {
    if (!selectedEPCDevice || !epcEditForm.device_code) return;
    
    isSaving = true;
    error = '';
    try {
      const user = auth().currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();
      const response = await fetch(`${HSS_API}/epc/${selectedEPCDevice.epc_id}/link-device`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_code: epcEditForm.device_code
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to link device');
      }
      
      await loadEPCDevices();
    } catch (err: any) {
      error = err.message || 'Failed to link device code';
    } finally {
      isSaving = false;
    }
  }
  
  async function deleteDeployment(deployment: any) {
    if (!confirm(`Are you sure you want to delete deployment "${deployment.name}"?`)) {
      return;
    }
    
    if (!tenantId) return;
    
    try {
      await coverageMapService.removeHardwareDeployment(
        tenantId,
        deployment._id || deployment.id
      );
      await loadDeployments();
      
      // Trigger refresh in monitoring module
      if (typeof window !== 'undefined') {
        localStorage.setItem('monitoring-refresh-needed', 'true');
        // Also trigger storage event for other tabs
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'monitoring-refresh-needed',
          newValue: 'true',
          storageArea: localStorage
        }));
      }
    } catch (err: any) {
      console.error('Error deleting deployment:', err);
      error = err.message || 'Failed to delete deployment';
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
  
  function getEPCStatusBadge(status: string) {
    const badges: Record<string, { class: string; label: string }> = {
      'registered': { class: 'status-registered', label: '⏳ Registered' },
      'online': { class: 'status-online', label: '🟢 Online' },
      'offline': { class: 'status-offline', label: '🔴 Offline' },
      'error': { class: 'status-error', label: '⚠️ Error' }
    };
    return badges[status] || badges['registered'];
  }
  
  function closeModal() {
    show = false;
    showEditModal = false;
    selectedDeployment = null;
    dispatch('close');
  }
  
  function getPlanName(planId: string) {
    if (!planId) return 'No project';
    const plan = plans.find(p => p.id === planId);
    return plan ? plan.name : 'Unknown project';
  }
</script>

{#if show}
<div class="modal-overlay" onclick={closeModal}>
  <div class="modal-content large" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2>🔧 Deployed Hardware</h2>
      <button class="close-btn" onclick={closeModal}>✕</button>
    </div>
    
    {#if error}
      <div class="error-banner">{error}</div>
    {/if}
    
    <!-- Tabs -->
    <div class="tabs">
      <button class="tab-btn" class:active={activeTab === 'hardware'} onclick={() => activeTab = 'hardware'}>
        🔧 Hardware ({deployments.length})
      </button>
      <button class="tab-btn" class:active={activeTab === 'epc'} onclick={() => activeTab = 'epc'}>
        📡 EPC/SNMP Devices ({epcDevices.length})
      </button>
    </div>
    
    <div class="modal-body">
      {#if activeTab === 'hardware'}
        <!-- Hardware Deployments Tab -->
        {#if isLoading}
          <div class="loading">Loading deployments...</div>
        {:else if deployments.length === 0}
          <div class="empty-state">
            <p>No hardware deployments found</p>
          </div>
        {:else}
          <div class="deployments-list">
            {#each deployments as deployment}
              <div class="deployment-item">
                <div class="deployment-header">
                  <div>
                    <h3>{deployment.name || 'Unnamed Deployment'}</h3>
                    <span class="deployment-type">{deployment.hardware_type}</span>
                    <span class="deployment-status {deployment.status}">{deployment.status}</span>
                  </div>
                  <div class="deployment-actions">
                    <button class="btn-edit" onclick={() => openEdit(deployment)}>✏️ Edit</button>
                    <button class="btn-delete" onclick={() => deleteDeployment(deployment)}>🗑️ Delete</button>
                  </div>
                </div>
                
                <div class="deployment-details">
                  <div class="detail-row">
                    <span class="label">Site:</span>
                    <span class="value">{deployment.siteId?.name || 'Unknown'}</span>
                  </div>
                  <div class="detail-row">
                    <span class="label">Project:</span>
                    <span class="value">{getPlanName(deployment.planId)}</span>
                  </div>
                  <div class="detail-row">
                    <span class="label">Deployed:</span>
                    <span class="value">{new Date(deployment.deployedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {:else}
        <!-- EPC/SNMP Devices Tab -->
        {#if epcDevices.length === 0}
          <div class="empty-state">
            <p>No EPC/SNMP devices deployed</p>
            <p class="hint">Use the EPC Deployment wizard to register new devices</p>
          </div>
        {:else}
          <div class="deployments-list">
            {#each epcDevices as device}
              <div class="deployment-item epc-device">
                <div class="deployment-header">
                  <div>
                    <h3>{device.site_name || 'Unnamed Device'}</h3>
                    <span class="deployment-type">{getDeploymentTypeLabel(device.deployment_type)}</span>
                    <span class="deployment-status {getEPCStatusBadge(device.status).class}">
                      {getEPCStatusBadge(device.status).label}
                    </span>
                  </div>
                  <div class="deployment-actions">
                    <button class="btn-edit" onclick={() => openEPCEdit(device)}>✏️ Edit</button>
                  </div>
                </div>
                
                <div class="deployment-details">
                  <div class="detail-row">
                    <span class="label">Device Code:</span>
                    {#if device.device_code}
                      <code class="device-code">{device.device_code}</code>
                    {:else}
                      <span class="not-linked">Not linked</span>
                    {/if}
                  </div>
                  
                  {#if device.deployment_type === 'epc' || device.deployment_type === 'both' || !device.deployment_type}
                    <div class="detail-row">
                      <span class="label">Network:</span>
                      <span class="value">MCC: {device.hss_config?.mcc || device.network_config?.mcc || '001'} / MNC: {device.hss_config?.mnc || device.network_config?.mnc || '01'}</span>
                    </div>
                    <div class="detail-row">
                      <span class="label">APN:</span>
                      <span class="value">{device.hss_config?.apnName || 'internet'}</span>
                    </div>
                  {/if}
                  
                  {#if device.deployment_type === 'snmp' || device.deployment_type === 'both' || !device.deployment_type}
                    <div class="detail-row">
                      <span class="label">SNMP:</span>
                      <span class="value">
                        {device.snmp_config?.enabled !== false ? '✓ Enabled' : '✗ Disabled'}
                        ({device.snmp_config?.community || 'public'}, v{device.snmp_config?.version || '2c'})
                      </span>
                    </div>
                  {/if}
                  
                  {#if device.last_seen}
                    <div class="detail-row">
                      <span class="label">Last Seen:</span>
                      <span class="value">{new Date(device.last_seen).toLocaleString()}</span>
                    </div>
                  {/if}
                  
                  <div class="detail-row epc-id">
                    <span class="label">ID:</span>
                    <span class="value mono">{device.epc_id}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" onclick={closeModal}>Close</button>
    </div>
  </div>
</div>

<!-- Edit Modal for General Hardware -->
{#if showEditModal && selectedDeployment}
<div class="modal-overlay" onclick={() => showEditModal = false}>
  <div class="modal-content edit-modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2>✏️ Edit Deployment</h2>
      <button class="close-btn" onclick={() => showEditModal = false}>✕</button>
    </div>
    
    <div class="modal-body">
      <div class="form-group">
        <label>Name</label>
        <input type="text" bind:value={editForm.name} />
      </div>
      
      <div class="form-group">
        <label>Hardware Type</label>
        <input type="text" bind:value={editForm.hardware_type} />
      </div>
      
      <div class="form-group">
        <label>Status</label>
        <select bind:value={editForm.status}>
          <option value="deployed">Deployed</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
          <option value="retired">Retired</option>
        </select>
      </div>
      
      <div class="form-group">
        <label>Project</label>
        <select bind:value={editForm.planId}>
          <option value="">No project</option>
          {#each plans as plan}
            <option value={plan.id}>{plan.name}</option>
          {/each}
        </select>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" onclick={() => showEditModal = false}>Cancel</button>
      <button class="btn-primary" onclick={saveEdit} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    </div>
  </div>
</div>
{/if}

<!-- Edit Modal for EPC/SNMP Devices -->
{#if showEPCEditModal && selectedEPCDevice}
<div class="modal-overlay nested" onclick={() => showEPCEditModal = false}>
  <div class="modal-content edit-modal epc-edit" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2>✏️ Edit EPC/SNMP Device</h2>
      <button class="close-btn" onclick={() => showEPCEditModal = false}>✕</button>
    </div>
    
    <div class="modal-body">
      <div class="device-info-banner">
        <strong>Site:</strong> {selectedEPCDevice.site_name}
        <br>
        <strong>ID:</strong> <code>{selectedEPCDevice.epc_id}</code>
      </div>
      
      <!-- Device Code Section -->
      <div class="config-section">
        <h4>🔗 Device Linking</h4>
        {#if selectedEPCDevice.device_code}
          <p class="linked-info">✅ Device linked with code: <code class="device-code">{selectedEPCDevice.device_code}</code></p>
        {:else}
          <p class="hint">Enter the code shown on the device's status page to link it.</p>
          <div class="link-device-row">
            <input type="text" bind:value={epcEditForm.device_code} placeholder="e.g., ABCD1234" maxlength="8" class="device-code-input" />
            <button class="btn-link" onclick={linkDeviceCode} disabled={isSaving || !epcEditForm.device_code}>
              🔗 Link
            </button>
          </div>
        {/if}
      </div>
      
      <div class="form-group">
        <label>Deployment Type</label>
        <select bind:value={epcEditForm.deployment_type}>
          <option value="epc">📡 EPC Only - LTE Core Network</option>
          <option value="snmp">📊 SNMP Agent Only - Network Monitoring</option>
          <option value="both">📡📊 EPC + SNMP - Full Package</option>
        </select>
      </div>
      
      {#if epcEditForm.deployment_type === 'epc' || epcEditForm.deployment_type === 'both'}
        <div class="config-section">
          <h4>📡 EPC Configuration</h4>
          <div class="form-row">
            <div class="form-group">
              <label>MCC</label>
              <input type="text" bind:value={epcEditForm.hss_config.mcc} />
            </div>
            <div class="form-group">
              <label>MNC</label>
              <input type="text" bind:value={epcEditForm.hss_config.mnc} />
            </div>
            <div class="form-group">
              <label>TAC</label>
              <input type="text" bind:value={epcEditForm.hss_config.tac} />
            </div>
          </div>
          <div class="form-group">
            <label>APN Name</label>
            <input type="text" bind:value={epcEditForm.hss_config.apnName} />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Primary DNS</label>
              <input type="text" bind:value={epcEditForm.hss_config.dnsPrimary} />
            </div>
            <div class="form-group">
              <label>Secondary DNS</label>
              <input type="text" bind:value={epcEditForm.hss_config.dnsSecondary} />
            </div>
          </div>
        </div>
      {/if}
      
      {#if epcEditForm.deployment_type === 'snmp' || epcEditForm.deployment_type === 'both'}
        <div class="config-section">
          <h4>📊 SNMP Configuration</h4>
          <div class="form-row checkbox-row">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={epcEditForm.snmp_config.enabled} />
              SNMP Enabled
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={epcEditForm.snmp_config.autoDiscovery} />
              Auto-Discovery
            </label>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Community String</label>
              <input type="text" bind:value={epcEditForm.snmp_config.community} />
            </div>
            <div class="form-group">
              <label>Version</label>
              <select bind:value={epcEditForm.snmp_config.version}>
                <option value="1">SNMPv1</option>
                <option value="2c">SNMPv2c</option>
                <option value="3">SNMPv3</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Polling Interval (seconds)</label>
            <input type="number" bind:value={epcEditForm.snmp_config.pollingInterval} min="10" max="3600" />
          </div>
        </div>
      {/if}
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" onclick={() => showEPCEditModal = false}>Cancel</button>
      <button class="btn-primary" onclick={saveEPCEdit} disabled={isSaving}>
        {isSaving ? 'Saving...' : '💾 Save Changes'}
      </button>
    </div>
  </div>
</div>
{/if}
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
    border-radius: var(--border-radius-lg);
    width: 90%;
    max-width: 800px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-xl);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg);
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
  
  .modal-body {
    padding: var(--spacing-lg);
    overflow-y: auto;
    flex: 1;
  }
  
  .modal-footer {
    padding: var(--spacing-lg);
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }
  
  .deployments-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .deployment-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    padding: 1rem;
  }
  
  .deployment-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
  }
  
  .deployment-header h3 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }
  
  .deployment-type {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background: var(--bg-tertiary);
    border-radius: var(--border-radius-sm);
    font-size: 0.875rem;
    margin-right: 0.5rem;
  }
  
  .deployment-status {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: var(--border-radius-sm);
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .deployment-status.deployed {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
  }
  
  .deployment-details {
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .detail-row {
    display: flex;
    gap: 0.5rem;
  }
  
  .detail-row .label {
    font-weight: 600;
    color: var(--text-secondary);
  }
  
  .detail-row .value {
    color: var(--text-primary);
  }
  
  .deployment-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .btn-edit, .btn-delete {
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    font-size: 0.875rem;
  }
  
  .btn-edit {
    background: var(--brand-primary);
    color: white;
  }
  
  .btn-delete {
    background: var(--error-color);
    color: white;
  }
  
  .btn-primary, .btn-secondary {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: var(--border-radius-md);
    cursor: pointer;
    font-weight: 600;
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
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
    font-weight: 600;
  }
  
  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  
  .error-banner {
    background: var(--error-color);
    color: white;
    padding: 1rem;
    margin: var(--spacing-lg);
    border-radius: var(--border-radius-md);
  }
  
  .loading, .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
  }
  
  .edit-modal {
    max-width: 500px;
  }
  
  .edit-modal.epc-edit {
    max-width: 600px;
  }
  
  .modal-content.large {
    max-width: 900px;
  }
  
  .modal-overlay.nested {
    z-index: 1100;
  }
  
  /* Tabs */
  .tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border-color);
    padding: 0 var(--spacing-lg);
  }
  
  .tab-btn {
    padding: 1rem 1.5rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-weight: 500;
    color: var(--text-secondary);
    transition: all 0.2s;
  }
  
  .tab-btn:hover {
    color: var(--text-primary);
  }
  
  .tab-btn.active {
    color: var(--brand-primary);
    border-bottom-color: var(--brand-primary);
  }
  
  /* EPC Device Styles */
  .epc-device {
    border-left: 4px solid var(--brand-primary);
  }
  
  .device-code {
    background: #ecfdf5;
    color: #047857;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9rem;
    letter-spacing: 1px;
  }
  
  .not-linked {
    color: var(--text-secondary);
    font-style: italic;
  }
  
  .epc-id {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-color);
    font-size: 0.75rem;
  }
  
  .mono {
    font-family: monospace;
    font-size: 0.75rem;
  }
  
  .hint {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-top: 0.5rem;
  }
  
  /* EPC Edit Form Styles */
  .config-section {
    background: var(--bg-secondary);
    border-radius: var(--border-radius-md);
    padding: 1rem;
    margin-bottom: 1rem;
  }
  
  .config-section h4 {
    margin: 0 0 1rem 0;
    font-size: 0.95rem;
    color: var(--text-primary);
  }
  
  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 1rem;
  }
  
  .form-row .form-group {
    margin-bottom: 0;
  }
  
  .checkbox-row {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 1rem;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: normal;
    cursor: pointer;
  }
  
  .checkbox-label input[type="checkbox"] {
    width: auto;
  }
  
  .device-info-banner {
    background: var(--bg-secondary);
    padding: 0.75rem 1rem;
    border-radius: var(--border-radius-md);
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  
  .device-info-banner code {
    background: var(--bg-primary);
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-size: 0.8rem;
  }
  
  .linked-info {
    color: #047857;
    font-weight: 500;
  }
  
  .link-device-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  
  .device-code-input {
    flex: 1;
    max-width: 150px;
    text-transform: uppercase;
    font-family: monospace;
    letter-spacing: 1px;
  }
  
  .btn-link {
    padding: 0.5rem 1rem;
    background: var(--brand-primary);
    color: white;
    border: none;
    border-radius: var(--border-radius-md);
    cursor: pointer;
    font-weight: 500;
  }
  
  .btn-link:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Status Badges for EPC */
  .status-registered {
    background: #e0e7ff;
    color: #3730a3;
  }
  
  .status-online {
    background: #d1fae5;
    color: #065f46;
  }
  
  .status-offline {
    background: #fee2e2;
    color: #991b1b;
  }
  
  .status-error {
    background: #fef3c7;
    color: #92400e;
  }
</style>

