<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  
  // Import device-specific components
  import CPEPerformanceModal from '../../acs-cpe-management/components/CPEPerformanceModal.svelte';
  import TR069Actions from '../../acs-cpe-management/components/TR069Actions.svelte';
  import ParameterEditorModal from '../../acs-cpe-management/components/ParameterEditorModal.svelte';
  
  const dispatch = createEventDispatcher();
  
  export let show = false;
  export let device: any = null;
  export let deviceType: 'snmp' | 'tr069' | 'mikrotik' | 'epc' | 'network-equipment' | 'unknown' = 'unknown';
  
  let activeTab: 'overview' | 'metrics' | 'configuration' | 'actions' = 'overview';
  let deviceDetails: any = null;
  let deviceMetrics: any = null;
  let isLoading = false;
  let showTR069Actions = false;
  let showParameterEditor = false;
  
  $: if (show && device) {
    loadDeviceDetails();
  }
  
  // Determine device type from device object
  $: if (device && !deviceType) {
    deviceType = detectDeviceType(device);
  }
  
  function detectDeviceType(dev: any): 'snmp' | 'tr069' | 'mikrotik' | 'epc' | 'network-equipment' | 'unknown' {
    if (dev._id || dev.id) {
      // TR-069 device (from GenieACS)
      if (dev.parameters || dev._lastInform || dev.manufacturer) {
        return 'tr069';
      }
      // EPC device
      if (dev.epc_id || dev.deployment_type === 'epc' || dev.hss_config) {
        return 'epc';
      }
      // MikroTik device
      if (dev.identity?.includes('MikroTik') || dev.type?.includes('mikrotik') || dev.routeros_version) {
        return 'mikrotik';
      }
      // SNMP device
      if (dev.snmp_config || dev.snmp_version || dev.community) {
        return 'snmp';
      }
      // Network equipment
      if (dev.type === 'network_equipment' || dev.equipmentType) {
        return 'network-equipment';
      }
    }
    return 'unknown';
  }
  
  async function loadDeviceDetails() {
    if (!device || !$currentTenant?.id) return;
    
    isLoading = true;
    
    try {
      const user = authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();
      
      // Load device-specific details based on type
      switch (deviceType) {
        case 'tr069':
          await loadTR069Details(token);
          break;
        case 'snmp':
          await loadSNMPDetails(token);
          break;
        case 'mikrotik':
          await loadMikrotikDetails(token);
          break;
        case 'epc':
          await loadEPCDetails(token);
          break;
        default:
          deviceDetails = device;
      }
    } catch (error) {
      console.error('Error loading device details:', error);
    } finally {
      isLoading = false;
    }
  }
  
  async function loadTR069Details(token: string) {
    try {
      // Load device parameters from GenieACS
      const response = await fetch(`/api/tr069/device-metrics?deviceId=${device.id || device._id}&hours=24`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        deviceMetrics = data.metrics || [];
        deviceDetails = {
          ...device,
          metrics: deviceMetrics,
          lastContact: device._lastInform || device.lastContact,
          manufacturer: device.manufacturer || device.parameters?.['InternetGatewayDevice.DeviceInfo.Manufacturer']?._value,
          model: device.model || device.parameters?.['InternetGatewayDevice.DeviceInfo.ModelName']?._value,
          serialNumber: device.serialNumber || device.parameters?.['InternetGatewayDevice.DeviceInfo.SerialNumber']?._value,
          firmware: device.firmware || device.parameters?.['InternetGatewayDevice.DeviceInfo.SoftwareVersion']?._value,
          ipAddress: device.ipAddress || device.parameters?.['InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress']?._value
        };
      } else {
        deviceDetails = device;
      }
    } catch (error) {
      console.error('Error loading TR-069 details:', error);
      deviceDetails = device;
    }
  }
  
  async function loadSNMPDetails(token: string) {
    try {
      // Load SNMP metrics
      const deviceId = device.id || device._id;
      const response = await fetch(`/api/monitoring/graphs/snmp/${deviceId}?hours=24`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        deviceMetrics = data.metrics || [];
        deviceDetails = {
          ...device,
          metrics: deviceMetrics,
          snmpVersion: device.snmp_version || device.snmp_config?.version || 'v2c',
          community: device.community || device.snmp_config?.community || 'public'
        };
      } else {
        deviceDetails = device;
      }
    } catch (error) {
      console.error('Error loading SNMP details:', error);
      deviceDetails = device;
    }
  }
  
  async function loadMikrotikDetails(token: string) {
    try {
      // Load MikroTik device info
      const deviceId = device.id || device._id;
      const response = await fetch(`/api/mikrotik/devices/${deviceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        deviceDetails = {
          ...device,
          ...data.device,
          routerosVersion: data.device?.routeros_version || device.routeros_version,
          identity: data.device?.identity || device.identity
        };
      } else {
        deviceDetails = device;
      }
    } catch (error) {
      console.error('Error loading MikroTik details:', error);
      deviceDetails = device;
    }
  }
  
  async function loadEPCDetails(token: string) {
    try {
      // Load EPC device info
      const deviceId = device.epc_id || device.id || device._id;
      const response = await fetch(`/api/hss/epc/remote/${deviceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        deviceDetails = {
          ...device,
          ...data.epc,
          hssConfig: data.epc?.hss_config || device.hss_config,
          networkConfig: data.epc?.network_config || device.network_config
        };
      } else {
        deviceDetails = device;
      }
    } catch (error) {
      console.error('Error loading EPC details:', error);
      deviceDetails = device;
    }
  }
  
  function handleClose() {
    show = false;
    dispatch('close');
  }
  
  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }
  
  function getDeviceTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'tr069': 'TR-069 / ACS Device',
      'snmp': 'SNMP Device',
      'mikrotik': 'MikroTik Router',
      'epc': 'EPC / Core Network',
      'network-equipment': 'Network Equipment',
      'unknown': 'Unknown Device'
    };
    return labels[type] || 'Device';
  }
  
  function getDeviceTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'tr069': '📡',
      'snmp': '🔌',
      'mikrotik': '🌐',
      'epc': '📶',
      'network-equipment': '🔧',
      'unknown': '❓'
    };
    return icons[type] || '📱';
  }
  
  function getStatusBadge(status: string) {
    const statusMap: Record<string, { label: string; class: string }> = {
      'online': { label: 'Online', class: 'status-online' },
      'offline': { label: 'Offline', class: 'status-offline' },
      'active': { label: 'Active', class: 'status-online' },
      'inactive': { label: 'Inactive', class: 'status-offline' },
      'maintenance': { label: 'Maintenance', class: 'status-warning' },
      'connected': { label: 'Connected', class: 'status-online' },
      'disconnected': { label: 'Disconnected', class: 'status-offline' }
    };
    return statusMap[status?.toLowerCase()] || { label: status || 'Unknown', class: 'status-unknown' };
  }
</script>

{#if show && device}
  <div class="modal-overlay" onclick={handleBackdropClick}>
    <div class="modal-content unified-device-modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="header-left">
          <span class="device-icon">{getDeviceTypeIcon(deviceType)}</span>
          <div class="header-info">
            <h2>{device.name || device.id || device._id || 'Unknown Device'}</h2>
            <div class="device-meta">
              <span class="device-type">{getDeviceTypeLabel(deviceType)}</span>
              {#if deviceDetails?.status || device.status}
                <span class="status-badge {getStatusBadge(deviceDetails?.status || device.status).class}">
                  {getStatusBadge(deviceDetails?.status || device.status).label}
                </span>
              {/if}
            </div>
          </div>
        </div>
        <button class="close-button" onclick={handleClose} aria-label="Close">×</button>
      </div>
      
      <div class="modal-body">
        {#if isLoading}
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading device details...</p>
          </div>
        {:else}
          <!-- Tab Navigation -->
          <div class="tab-navigation">
            <button 
              class="tab-button" 
              class:active={activeTab === 'overview'}
              onclick={() => activeTab = 'overview'}
            >
              Overview
            </button>
            <button 
              class="tab-button" 
              class:active={activeTab === 'metrics'}
              onclick={() => activeTab = 'metrics'}
            >
              Metrics
            </button>
            {#if deviceType === 'tr069' || deviceType === 'snmp' || deviceType === 'mikrotik'}
              <button 
                class="tab-button" 
                class:active={activeTab === 'configuration'}
                onclick={() => activeTab = 'configuration'}
              >
                Configuration
              </button>
            {/if}
            {#if deviceType === 'tr069' || deviceType === 'mikrotik'}
              <button 
                class="tab-button" 
                class:active={activeTab === 'actions'}
                onclick={() => activeTab = 'actions'}
              >
                Actions
              </button>
            {/if}
          </div>
          
          <!-- Tab Content -->
          <div class="tab-content">
            {#if activeTab === 'overview'}
              <div class="overview-tab">
                <div class="details-grid">
                  <!-- Basic Information -->
                  <div class="detail-section">
                    <h3>Basic Information</h3>
                    <div class="detail-list">
                      {#if deviceDetails?.manufacturer || device.manufacturer}
                        <div class="detail-item">
                          <span class="label">Manufacturer:</span>
                          <span class="value">{deviceDetails?.manufacturer || device.manufacturer}</span>
                        </div>
                      {/if}
                      {#if deviceDetails?.model || device.model}
                        <div class="detail-item">
                          <span class="label">Model:</span>
                          <span class="value">{deviceDetails?.model || device.model}</span>
                        </div>
                      {/if}
                      {#if deviceDetails?.serialNumber || device.serialNumber}
                        <div class="detail-item">
                          <span class="label">Serial Number:</span>
                          <span class="value mono">{deviceDetails?.serialNumber || device.serialNumber}</span>
                        </div>
                      {/if}
                      {#if deviceDetails?.firmware || device.firmware || deviceDetails?.routerosVersion}
                        <div class="detail-item">
                          <span class="label">Firmware:</span>
                          <span class="value">{deviceDetails?.firmware || device.firmware || deviceDetails?.routerosVersion}</span>
                        </div>
                      {/if}
                      {#if deviceDetails?.ipAddress || device.ipAddress}
                        <div class="detail-item">
                          <span class="label">IP Address:</span>
                          <span class="value mono">{deviceDetails?.ipAddress || device.ipAddress}</span>
                        </div>
                      {/if}
                    </div>
                  </div>
                  
                  <!-- Location -->
                  {#if device.location || deviceDetails?.location}
                    <div class="detail-section">
                      <h3>Location</h3>
                      <div class="detail-list">
                        {#if device.location?.latitude || deviceDetails?.location?.latitude}
                          <div class="detail-item">
                            <span class="label">Coordinates:</span>
                            <span class="value mono">
                              {device.location?.latitude || deviceDetails?.location?.latitude}, 
                              {device.location?.longitude || deviceDetails?.location?.longitude}
                            </span>
                          </div>
                        {/if}
                        {#if device.location?.address || deviceDetails?.location?.address}
                          <div class="detail-item">
                            <span class="label">Address:</span>
                            <span class="value">{device.location?.address || deviceDetails?.location?.address}</span>
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/if}
                  
                  <!-- Type-Specific Information -->
                  {#if deviceType === 'tr069'}
                    <div class="detail-section">
                      <h3>TR-069 Information</h3>
                      <div class="detail-list">
                        {#if deviceDetails?.lastContact || device._lastInform}
                          <div class="detail-item">
                            <span class="label">Last Contact:</span>
                            <span class="value">
                              {new Date(deviceDetails?.lastContact || device._lastInform).toLocaleString()}
                            </span>
                          </div>
                        {/if}
                        {#if device._id || device.id}
                          <div class="detail-item">
                            <span class="label">Device ID:</span>
                            <span class="value mono">{device._id || device.id}</span>
                          </div>
                        {/if}
                      </div>
                    </div>
                  {:else if deviceType === 'snmp'}
                    <div class="detail-section">
                      <h3>SNMP Configuration</h3>
                      <div class="detail-list">
                        {#if deviceDetails?.snmpVersion || device.snmp_version}
                          <div class="detail-item">
                            <span class="label">SNMP Version:</span>
                            <span class="value">{deviceDetails?.snmpVersion || device.snmp_version}</span>
                          </div>
                        {/if}
                        {#if deviceDetails?.community || device.community}
                          <div class="detail-item">
                            <span class="label">Community:</span>
                            <span class="value mono">{deviceDetails?.community || device.community}</span>
                          </div>
                        {/if}
                      </div>
                    </div>
                  {:else if deviceType === 'epc'}
                    <div class="detail-section">
                      <h3>EPC Configuration</h3>
                      <div class="detail-list">
                        {#if deviceDetails?.hssConfig?.mcc || device.hss_config?.mcc}
                          <div class="detail-item">
                            <span class="label">MCC:</span>
                            <span class="value">{deviceDetails?.hssConfig?.mcc || device.hss_config?.mcc}</span>
                          </div>
                        {/if}
                        {#if deviceDetails?.hssConfig?.mnc || device.hss_config?.mnc}
                          <div class="detail-item">
                            <span class="label">MNC:</span>
                            <span class="value">{deviceDetails?.hssConfig?.mnc || device.hss_config?.mnc}</span>
                          </div>
                        {/if}
                        {#if deviceDetails?.hssConfig?.apnName || device.hss_config?.apnName}
                          <div class="detail-item">
                            <span class="label">APN:</span>
                            <span class="value">{deviceDetails?.hssConfig?.apnName || device.hss_config?.apnName}</span>
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
            {:else if activeTab === 'metrics'}
              <div class="metrics-tab">
                {#if deviceType === 'tr069' && deviceDetails}
                  <CPEPerformanceModal device={deviceDetails} show={true} on:close={() => {}} />
                {:else if deviceType === 'snmp' && deviceMetrics}
                  <div class="metrics-content">
                    <h3>SNMP Metrics (Last 24 Hours)</h3>
                    {#if deviceMetrics.length > 0}
                      <div class="metrics-grid">
                        <!-- SNMP metrics visualization would go here -->
                        <p>SNMP metrics visualization coming soon...</p>
                      </div>
                    {:else}
                      <p class="no-data">No metrics available for this device.</p>
                    {/if}
                  </div>
                {:else}
                  <div class="no-metrics">
                    <p>Metrics not available for this device type.</p>
                  </div>
                {/if}
              </div>
            {:else if activeTab === 'configuration'}
              <div class="configuration-tab">
                {#if deviceType === 'tr069'}
                  <div class="config-content">
                    <h3>TR-069 Parameters</h3>
                    <button class="btn btn-primary" onclick={() => showParameterEditor = true}>
                      Edit Parameters
                    </button>
                    {#if device.parameters}
                      <div class="parameters-list">
                        <!-- Parameter list would go here -->
                        <p>Parameter editor available via Actions tab.</p>
                      </div>
                    {/if}
                  </div>
                {:else if deviceType === 'snmp'}
                  <div class="config-content">
                    <h3>SNMP Configuration</h3>
                    <p>SNMP configuration editing coming soon...</p>
                  </div>
                {:else if deviceType === 'mikrotik'}
                  <div class="config-content">
                    <h3>MikroTik Configuration</h3>
                    <p>MikroTik configuration editing coming soon...</p>
                  </div>
                {/if}
              </div>
            {:else if activeTab === 'actions'}
              <div class="actions-tab">
                {#if deviceType === 'tr069'}
                  <div class="quick-actions">
                    <a href="/modules/acs-cpe-management/presets" class="btn btn-primary" target="_blank">
                      ⚙️ Manage Presets
                    </a>
                    <a href="/modules/acs-cpe-management/devices" class="btn btn-secondary" target="_blank">
                      📱 Full ACS Management
                    </a>
                  </div>
                  <TR069Actions 
                    device={deviceDetails || device} 
                    on:close={() => showTR069Actions = false}
                  />
                {:else if deviceType === 'mikrotik'}
                  <div class="actions-content">
                    <h3>MikroTik Actions</h3>
                    <p>MikroTik device actions coming soon...</p>
                  </div>
                {:else}
                  <div class="no-actions">
                    <p>Actions not available for this device type.</p>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if showParameterEditor && device}
  <ParameterEditorModal 
    bind:show={showParameterEditor}
    device={deviceDetails || device}
    on:close={() => showParameterEditor = false}
  />
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
    z-index: 10000;
    padding: 20px;
  }
  
  .unified-device-modal {
    background: white;
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
    padding: 20px 24px;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .device-icon {
    font-size: 32px;
  }
  
  .header-info h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #111827;
  }
  
  .device-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
  
  .device-type {
    font-size: 14px;
    color: #6b7280;
  }
  
  .status-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }
  
  .status-online {
    background: #d1fae5;
    color: #065f46;
  }
  
  .status-offline {
    background: #fee2e2;
    color: #991b1b;
  }
  
  .status-warning {
    background: #fef3c7;
    color: #92400e;
  }
  
  .status-unknown {
    background: #f3f4f6;
    color: #374151;
  }
  
  .close-button {
    background: none;
    border: none;
    font-size: 28px;
    color: #6b7280;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }
  
  .close-button:hover {
    background: #f3f4f6;
    color: #111827;
  }
  
  .modal-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .tab-navigation {
    display: flex;
    gap: 4px;
    padding: 0 24px;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }
  
  .tab-button {
    padding: 12px 20px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
    transition: all 0.2s;
  }
  
  .tab-button:hover {
    color: #111827;
    background: #f3f4f6;
  }
  
  .tab-button.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
    background: white;
  }
  
  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }
  
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    gap: 16px;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .details-grid {
    display: grid;
    gap: 24px;
  }
  
  .detail-section h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: #111827;
  }
  
  .detail-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 8px 0;
    border-bottom: 1px solid #f3f4f6;
  }
  
  .detail-item .label {
    font-weight: 500;
    color: #6b7280;
    min-width: 140px;
  }
  
  .detail-item .value {
    color: #111827;
    text-align: right;
    flex: 1;
  }
  
  .detail-item .value.mono {
    font-family: 'Courier New', monospace;
    font-size: 13px;
  }
  
  .metrics-content,
  .config-content,
  .actions-content {
    padding: 20px 0;
  }
  
  .metrics-content h3,
  .config-content h3,
  .actions-content h3 {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 600;
  }
  
  .no-data,
  .no-metrics,
  .no-actions {
    padding: 40px 20px;
    text-align: center;
    color: #6b7280;
  }
  
  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: #3b82f6;
    color: white;
  }
  
  .btn-primary:hover {
    background: #2563eb;
  }
</style>
