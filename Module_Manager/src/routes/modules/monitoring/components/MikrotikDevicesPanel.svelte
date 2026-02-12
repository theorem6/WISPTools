<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/firebase';
  import { authService } from '$lib/services/authService';
  import { API_CONFIG } from '$lib/config/api';
  import { currentTenant } from '$lib/stores/tenantStore';
  
  export let tenantId: string = '';
  
  let mikrotikDevices: any[] = [];
  let loading = false;
  let error: string | null = null;
  
  $: if ($currentTenant?.id) {
    tenantId = $currentTenant.id;
    if (tenantId) {
      loadMikrotikDevices();
    }
  }
  
  async function loadMikrotikDevices() {
    if (!tenantId) return;
    
    loading = true;
    error = null;
    
    try {
      const user = auth().currentUser;
      if (!user) {
        error = 'Not authenticated';
        return;
      }
      
      const token = await authService.getAuthTokenForApi();
      
      // Load from SNMP discovered devices (filter for Mikrotik)
      const snmpResponse = await fetch(`${API_CONFIG.PATHS.SNMP_MONITORING}/discovered`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (snmpResponse.ok) {
        const snmpData = await snmpResponse.json();
        const snmpDevices = snmpData.devices || [];
        
        // Filter for Mikrotik devices
        mikrotikDevices = snmpDevices.filter((d: any) => 
          d.device_type === 'mikrotik' || 
          d.manufacturer?.toLowerCase().includes('mikrotik') ||
          d.sysDescr?.toLowerCase().includes('mikrotik') ||
          d.sysDescr?.toLowerCase().includes('routeros')
        );
      }
      
      // Also load from Mikrotik API
      const mikrotikResponse = await fetch(`${API_CONFIG.PATHS.MIKROTIK}/devices`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (mikrotikResponse.ok) {
        const mikrotikData = await mikrotikResponse.json();
        const apiDevices = mikrotikData.devices || [];
        
        // Merge with SNMP discovered devices (avoid duplicates by IP/name)
        const existingIPs = new Set(mikrotikDevices.map((d: any) => d.ipAddress || d.ip_address));
        apiDevices.forEach((device: any) => {
          const deviceIP = device.managementIP || device.ip_address || device.ipAddress;
          if (!existingIPs.has(deviceIP)) {
            mikrotikDevices.push({
              ...device,
              ip_address: deviceIP,
              device_type: 'mikrotik',
              discovered_via: 'api'
            });
          }
        });
      }
      
      console.log('[Mikrotik Devices] Loaded', mikrotikDevices.length, 'Mikrotik devices');
    } catch (err: any) {
      console.error('[Mikrotik Devices] Error loading devices:', err);
      error = err.message || 'Failed to load devices';
    } finally {
      loading = false;
    }
  }
  
  function getDeviceTypeLabel(device: any) {
    if (device.deviceType) return device.deviceType;
    if (device.type) return device.type;
    if (device.device_type) {
      if (device.device_type === 'access_point') return 'Access Point';
      if (device.device_type === 'switch') return 'Switch';
      if (device.device_type === 'router') return 'Router';
    }
    return 'Unknown';
  }
  
  function getRouterOSVersion(device: any) {
    return device.mikrotik?.routerOS_version || 
           device.routerOS_version || 
           device.notes?.mikrotik?.routerOS_version || 
           'Unknown';
  }
  
  function getBoardName(device: any) {
    return device.mikrotik?.board_name || 
           device.board_name || 
           device.notes?.mikrotik?.board_name || 
           device.model || 
           'Unknown';
  }
  
  onMount(() => {
    if (tenantId) {
      loadMikrotikDevices();
    }
  });
</script>

<div class="mikrotik-devices-panel">
  <div class="panel-header">
    <h2>🖥️ Mikrotik Devices</h2>
    <button class="btn btn-secondary" on:click={loadMikrotikDevices} disabled={loading}>
      {loading ? 'Loading...' : '🔄 Refresh'}
    </button>
  </div>
  
  {#if loading}
    <div class="loading-state">
      <p>⏳ Loading Mikrotik devices...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p>⚠️ Error: {error}</p>
      <button class="btn btn-primary" on:click={loadMikrotikDevices}>Retry</button>
    </div>
  {:else if mikrotikDevices.length === 0}
    <div class="empty-state">
      <p>📡 No Mikrotik devices found</p>
      <p class="hint">Mikrotik devices discovered via SNMP/CDP/LLDP will appear here</p>
    </div>
  {:else}
    <div class="devices-grid">
      {#each mikrotikDevices as device (device.id || device._id || device.ip_address)}
        <div class="device-card">
          <div class="device-header">
            <h3>{device.name || device.identity || device.sysName || `Mikrotik-${device.ip_address || device.ipAddress}`}</h3>
            <span class="device-type">{getDeviceTypeLabel(device)}</span>
          </div>
          
          <div class="device-details">
            <div class="detail-row">
              <span class="label">IP Address:</span>
              <span class="value">{device.ip_address || device.ipAddress || 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="label">Board:</span>
              <span class="value">{getBoardName(device)}</span>
            </div>
            <div class="detail-row">
              <span class="label">RouterOS:</span>
              <span class="value">{getRouterOSVersion(device)}</span>
            </div>
            {#if device.mikrotik?.serial_number || device.serialNumber}
              <div class="detail-row">
                <span class="label">Serial:</span>
                <span class="value">{device.mikrotik?.serial_number || device.serialNumber || 'N/A'}</span>
              </div>
            {/if}
            {#if device.discovered_via}
              <div class="detail-row">
                <span class="label">Discovered via:</span>
                <span class="value">{device.discovered_via.toUpperCase()}</span>
              </div>
            {/if}
          </div>
          
          <div class="device-actions">
            <button class="btn btn-primary" on:click={() => console.log('View details:', device)}>
              View Details
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .mikrotik-devices-panel {
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
</style>

