<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import { loadCPEDevices, type CPEDevice } from '../../acs-cpe-management/lib/cpeDataService';
  
  const dispatch = createEventDispatcher();
  
  export let show = false;
  export let devices: any[] = []; // All devices from various sources
  
  let searchQuery = '';
  let selectedDeviceType: 'all' | 'snmp' | 'tr069' | 'mikrotik' | 'epc' | 'network-equipment' = 'all';
  let selectedStatus: 'all' | 'online' | 'offline' = 'all';
  let tr069Devices: CPEDevice[] = [];
  let isLoading = false;
  let refreshInterval: number | null = null;
  
  $: filteredDevices = filterDevices();
  
  onMount(async () => {
    await loadAllDevices();
    startAutoRefresh();
  });
  
  onDestroy(() => {
    stopAutoRefresh();
  });
  
  async function loadAllDevices() {
    if (!$currentTenant?.id) return;
    
    isLoading = true;
    
    try {
      // Load TR-069 devices
      tr069Devices = await loadCPEDevices();
      
      // Combine all devices
      const allDevices = [
        ...devices, // SNMP, MikroTik, EPC from props
        ...tr069Devices.map(d => ({ ...d, _deviceType: 'tr069' }))
      ];
      
      dispatch('devicesLoaded', { devices: allDevices });
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      isLoading = false;
    }
  }
  
  function filterDevices() {
    let filtered = [
      ...devices,
      ...tr069Devices.map(d => ({ ...d, _deviceType: 'tr069' }))
    ];
    
    // Filter by type
    if (selectedDeviceType !== 'all') {
      filtered = filtered.filter(d => {
        const type = detectDeviceType(d);
        return type === selectedDeviceType;
      });
    }
    
    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(d => {
        const status = d.status?.toLowerCase() || 'unknown';
        return status === selectedStatus;
      });
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d => {
        const name = (d.name || d.id || d._id || '').toLowerCase();
        const manufacturer = (d.manufacturer || '').toLowerCase();
        const model = (d.model || '').toLowerCase();
        const ip = (d.ipAddress || d.ip_address || '').toLowerCase();
        return name.includes(query) || manufacturer.includes(query) || 
               model.includes(query) || ip.includes(query);
      });
    }
    
    return filtered;
  }
  
  function detectDeviceType(dev: any): string {
    if (dev._deviceType) return dev._deviceType;
    if (dev.parameters || dev._lastInform) return 'tr069';
    if (dev.epc_id || dev.deployment_type === 'epc') return 'epc';
    if (dev.identity?.includes('MikroTik') || dev.routeros_version) return 'mikrotik';
    if (dev.snmp_config || dev.snmp_version) return 'snmp';
    if (dev.type === 'network_equipment') return 'network-equipment';
    return 'unknown';
  }
  
  function getDeviceTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'tr069': 'TR-069',
      'snmp': 'SNMP',
      'mikrotik': 'MikroTik',
      'epc': 'EPC',
      'network-equipment': 'Network',
      'unknown': 'Unknown'
    };
    return labels[type] || type;
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
      'connected': { label: 'Connected', class: 'status-online' },
      'disconnected': { label: 'Disconnected', class: 'status-offline' }
    };
    return statusMap[status?.toLowerCase()] || { label: status || 'Unknown', class: 'status-unknown' };
  }
  
  function handleDeviceClick(device: any) {
    dispatch('deviceSelected', { device, deviceType: detectDeviceType(device) });
  }
  
  function startAutoRefresh() {
    if (refreshInterval) return;
    refreshInterval = window.setInterval(() => {
      loadAllDevices();
    }, 30000); // Refresh every 30 seconds
  }
  
  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }
  
  function handleRefresh() {
    loadAllDevices();
  }
</script>

{#if show}
  <div class="device-panel">
    <div class="panel-header">
      <h2>Device Management</h2>
      <button class="close-button" onclick={() => dispatch('close')} aria-label="Close">×</button>
    </div>
    
    <div class="panel-controls">
      <!-- Search -->
      <div class="search-box">
        <input
          type="text"
          placeholder="Search devices..."
          bind:value={searchQuery}
          class="search-input"
        />
      </div>
      
      <!-- Filters -->
      <div class="filters">
        <select bind:value={selectedDeviceType} class="filter-select">
          <option value="all">All Types</option>
          <option value="tr069">TR-069 / ACS</option>
          <option value="snmp">SNMP</option>
          <option value="mikrotik">MikroTik</option>
          <option value="epc">EPC</option>
          <option value="network-equipment">Network Equipment</option>
        </select>
        
        <select bind:value={selectedStatus} class="filter-select">
          <option value="all">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
        
        <button class="refresh-button" onclick={handleRefresh} title="Refresh">
          🔄
        </button>
      </div>
    </div>
    
    <div class="panel-body">
      {#if isLoading}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading devices...</p>
        </div>
      {:else if filteredDevices.length === 0}
        <div class="empty-state">
          <p>No devices found</p>
          {#if searchQuery || selectedDeviceType !== 'all' || selectedStatus !== 'all'}
            <button class="btn-clear-filters" onclick={() => {
              searchQuery = '';
              selectedDeviceType = 'all';
              selectedStatus = 'all';
            }}>
              Clear Filters
            </button>
          {/if}
        </div>
      {:else}
        <div class="devices-list">
          {#each filteredDevices as device (device.id || device._id)}
            {@const deviceType = detectDeviceType(device)}
            {@const status = device.status || 'unknown'}
            {@const statusBadge = getStatusBadge(status)}
            
            <div 
              class="device-card"
              class:device-online={status === 'online' || status === 'active' || status === 'connected'}
              class:device-offline={status === 'offline' || status === 'inactive' || status === 'disconnected'}
              onclick={() => handleDeviceClick(device)}
            >
              <div class="device-header">
                <span class="device-icon">{getDeviceTypeIcon(deviceType)}</span>
                <div class="device-info">
                  <h3 class="device-name">{device.name || device.id || device._id || 'Unknown Device'}</h3>
                  <div class="device-meta">
                    <span class="device-type-badge">{getDeviceTypeLabel(deviceType)}</span>
                    <span class="status-badge {statusBadge.class}">{statusBadge.label}</span>
                  </div>
                </div>
              </div>
              
              <div class="device-details">
                {#if device.manufacturer || device.model}
                  <div class="detail-line">
                    <span class="detail-label">Device:</span>
                    <span class="detail-value">
                      {device.manufacturer || ''} {device.model || ''}
                    </span>
                  </div>
                {/if}
                
                {#if device.ipAddress || device.ip_address}
                  <div class="detail-line">
                    <span class="detail-label">IP:</span>
                    <span class="detail-value mono">{device.ipAddress || device.ip_address}</span>
                  </div>
                {/if}
                
                {#if device.location}
                  <div class="detail-line">
                    <span class="detail-label">Location:</span>
                    <span class="detail-value">
                      {device.location.latitude?.toFixed(4)}, {device.location.longitude?.toFixed(4)}
                    </span>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
    
    <div class="panel-footer">
      <div class="device-count">
        {filteredDevices.length} device{filteredDevices.length !== 1 ? 's' : ''}
      </div>
    </div>
  </div>
{/if}

<style>
  .device-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 400px;
    height: 100vh;
    background: white;
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    z-index: 1000;
    border-left: 1px solid #e5e7eb;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .panel-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #111827;
  }
  
  .close-button {
    background: none;
    border: none;
    font-size: 24px;
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
  
  .panel-controls {
    padding: 16px;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }
  
  .search-box {
    margin-bottom: 12px;
  }
  
  .search-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
  }
  
  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .filters {
    display: flex;
    gap: 8px;
  }
  
  .filter-select {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    background: white;
  }
  
  .refresh-button {
    padding: 8px 12px;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
  }
  
  .refresh-button:hover {
    background: #f3f4f6;
  }
  
  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }
  
  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    gap: 12px;
    color: #6b7280;
  }
  
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .btn-clear-filters {
    padding: 6px 12px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  }
  
  .devices-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .device-card {
    padding: 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    background: white;
  }
  
  .device-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
  }
  
  .device-card.device-online {
    border-left: 3px solid #10b981;
  }
  
  .device-card.device-offline {
    border-left: 3px solid #ef4444;
  }
  
  .device-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
  }
  
  .device-icon {
    font-size: 24px;
  }
  
  .device-info {
    flex: 1;
  }
  
  .device-name {
    margin: 0 0 4px 0;
    font-size: 14px;
    font-weight: 600;
    color: #111827;
  }
  
  .device-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .device-type-badge {
    padding: 2px 6px;
    background: #f3f4f6;
    color: #6b7280;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }
  
  .status-badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
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
  
  .status-unknown {
    background: #f3f4f6;
    color: #374151;
  }
  
  .device-details {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
  }
  
  .detail-line {
    display: flex;
    justify-content: space-between;
  }
  
  .detail-label {
    color: #6b7280;
    font-weight: 500;
  }
  
  .detail-value {
    color: #111827;
  }
  
  .detail-value.mono {
    font-family: 'Courier New', monospace;
  }
  
  .panel-footer {
    padding: 16px;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
  }
  
  .device-count {
    font-size: 12px;
    color: #6b7280;
    text-align: center;
  }
</style>
