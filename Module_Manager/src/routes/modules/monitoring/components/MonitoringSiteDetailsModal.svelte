<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { coverageMapService } from '../../coverage-map/lib/coverageMapService.mongodb';
  import { auth } from '$lib/firebase';
  import { authService } from '$lib/services/authService';
  import { API_CONFIG } from '$lib/config/api';
  import { currentTenant } from '$lib/stores/tenantStore';
  import type { TowerSite } from '../../coverage-map/lib/models';

  export let show = false;
  export let site: TowerSite | null = null;
  export let tenantId: string = '';
  export let networkDevices: any[] = [];

  const dispatch = createEventDispatcher();

  let hardwareDeployments: any[] = [];
  let epcDevices: any[] = [];
  let equipment: any[] = [];
  let sectors: any[] = [];
  let deviceUptimes: Map<string, any> = new Map();
  let isLoading = false;
  let loadingUptimes = false;
  let error = '';
  let activeTab: 'hardware' | 'devices' | 'equipment' | 'sectors' = 'devices';

  $: if (show && site && tenantId) {
    loadSiteDetails();
  }

  async function loadSiteDetails() {
    if (!site || !tenantId) return;

    isLoading = true;
    error = '';

    try {
      const siteId = site.id || site._id;

      // Load all deployed hardware at this site
      const allDeployments = await coverageMapService.getAllHardwareDeployments(tenantId);
      hardwareDeployments = allDeployments.filter((d: any) => {
        const deploymentSiteId = d.siteId?._id || d.siteId?.id || d.siteId;
        return String(deploymentSiteId) === String(siteId);
      });

      // Load EPC devices at this site
      const user = auth().currentUser;
      if (user) {
        const token = await authService.getAuthTokenForApi();
        try {
          const response = await fetch(`${API_CONFIG.PATHS.HSS}/epc/remote/list`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Tenant-ID': tenantId
            }
          });
          if (response.ok) {
            const data = await response.json();
            const allEPCDevices = data.epcs || [];
            epcDevices = allEPCDevices.filter((device: any) => {
              const deviceSiteId = device.siteId?._id || device.siteId?.id || device.siteId || device.site_id;
              return String(deviceSiteId) === String(siteId) || device.site_name === site.name;
            });
          }
        } catch (err) {
          console.error('Error loading EPC devices:', err);
        }
      }

      // Load equipment at this site
      const allEquipment = await coverageMapService.getEquipment(tenantId);
      equipment = allEquipment.filter((eq: any) => {
        const eqSiteId = eq.siteId?._id || eq.siteId?.id || eq.siteId;
        return String(eqSiteId) === String(siteId);
      });

      // Load sectors at this site
      const allSectors = await coverageMapService.getSectors(tenantId);
      sectors = allSectors.filter((s: any) => {
        const sectorSiteId = s.towerId?._id || s.towerId?.id || s.towerId || s.siteId?._id || s.siteId?.id || s.siteId;
        return String(sectorSiteId) === String(siteId);
      });

      // Load uptime data for all devices at this site
      await loadDeviceUptimes();
    } catch (err: any) {
      console.error('Error loading site details:', err);
      error = err.message || 'Failed to load site details';
    } finally {
      isLoading = false;
    }
  }

  async function loadDeviceUptimes() {
    if (!site || !tenantId) return;

    loadingUptimes = true;
    const user = auth().currentUser;
    if (!user) {
      loadingUptimes = false;
      return;
    }

    const token = await authService.getAuthTokenForApi();
    const siteId = site.id || site._id;
    
    // Get all devices at this site from networkDevices prop
    const siteDevices = getSiteDevices();
    
    // Also include devices from hardware deployments and equipment at this site
    const allSiteDevices = [
      ...siteDevices,
      ...hardwareDeployments.map((d: any) => ({
        id: `deployment-${d._id || d.id}`,
        name: d.name,
        type: d.hardware_type || 'other',
        status: 'unknown',
        ipAddress: d.config?.ipAddress || d.config?.ip_address || d.config?.management_ip || null,
        siteId: String(siteId)
      })),
      ...equipment.map((eq: any) => ({
        id: eq.id || eq._id,
        name: eq.name,
        type: eq.type || 'other',
        status: 'unknown',
        ipAddress: eq.notes ? (() => {
          try {
            const notes = typeof eq.notes === 'string' ? JSON.parse(eq.notes) : eq.notes;
            return notes.management_ip || notes.ip_address || null;
          } catch {
            return null;
          }
        })() : null,
        siteId: String(siteId)
      }))
    ];

    const newDeviceUptimes = new Map();
    for (const device of allSiteDevices) {
      // Use device ID - could be network equipment ID, deployment ID, or equipment ID
      const deviceId = device.id;
      
      if (device.ipAddress || deviceId) {
        try {
          // Try to get ping data if device has an ID that can be used
          // Only try if it's a network equipment ID (not deployment- or inventory- prefix)
          if (deviceId && !deviceId.startsWith('deployment-') && !deviceId.startsWith('inventory-')) {
            const response = await fetch(`${API_CONFIG.PATHS.MONITORING_GRAPHS}/ping/${deviceId}?hours=168`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'X-Tenant-ID': tenantId
              }
            });
            if (response.ok) {
              const data = await response.json();
              newDeviceUptimes.set(deviceId, data.stats);
            } else {
              // If device status is "unknown", keep it as unknown instead of offline
              const currentStatus = device.status === 'unknown' ? 'unknown' : 'offline';
              newDeviceUptimes.set(deviceId, { uptime_percent: 0, current_status: currentStatus, message: 'No data' });
            }
          } else {
            // For deployment/inventory devices without monitoring data yet, show as unknown
            newDeviceUptimes.set(deviceId, { uptime_percent: 0, current_status: 'unknown', message: 'Configure monitoring' });
          }
        } catch (error) {
          console.error(`Error loading uptime for device ${deviceId}:`, error);
          // If device status is "unknown", keep it as unknown instead of offline
          const currentStatus = device.status === 'unknown' ? 'unknown' : 'offline';
          newDeviceUptimes.set(deviceId, { uptime_percent: 0, current_status: currentStatus, message: 'Error' });
        }
      } else {
        // Device without IP - show as unknown (grey) not offline
        newDeviceUptimes.set(deviceId, { uptime_percent: 0, current_status: 'unknown', message: 'No IP - Configure IP address' });
      }
    }
    deviceUptimes = newDeviceUptimes;
    loadingUptimes = false;
  }

  function closeModal() {
    show = false;
    dispatch('close');
  }

  function getUptimeColor(uptime: number): string {
    if (uptime >= 99) return 'text-green-500';
    if (uptime >= 95) return 'text-yellow-500';
    return 'text-red-500';
  }

  function getStatusIndicator(status: string): string {
    switch (status) {
      case 'online': return '🟢 Online';
      case 'offline': return '🔴 Offline';
      case 'unknown': return '⚪ Unknown';
      default: return '⚪ Unknown';
    }
  }
  
  // Calculate site status based on devices at this site
  function getSiteStatus(): 'active' | 'inactive' | 'maintenance' {
    const siteDevices = getSiteDevices();
    
    if (siteDevices.length === 0) {
      // No devices at site - check if site has hardware/equipment
      if (hardwareDeployments.length > 0 || equipment.length > 0 || epcDevices.length > 0) {
        return 'maintenance'; // Has hardware but no monitoring devices yet
      }
      return 'inactive'; // Truly no devices
    }
    
    // Count device statuses
    const onlineDevices = siteDevices.filter(d => {
      const uptimeStats = deviceUptimes.get(d.id);
      return d.status === 'online' || uptimeStats?.current_status === 'online';
    }).length;
    
    const offlineDevices = siteDevices.filter(d => {
      const uptimeStats = deviceUptimes.get(d.id);
      return d.status === 'offline' || uptimeStats?.current_status === 'offline';
    }).length;
    
    const unknownDevices = siteDevices.filter(d => {
      const uptimeStats = deviceUptimes.get(d.id);
      const status = uptimeStats?.current_status || d.status || 'unknown';
      return status === 'unknown';
    }).length;
    
    // If we have online devices, calculate based on online vs offline
    if (onlineDevices > 0 || offlineDevices > 0) {
      const monitoredDevices = onlineDevices + offlineDevices;
      if (monitoredDevices > 0) {
        const uptimePercent = Math.round((onlineDevices / monitoredDevices) * 100);
        if (uptimePercent === 100) return 'active';
        if (uptimePercent === 0) return 'inactive';
        return 'maintenance';
      }
    }
    
    // If all devices are unknown but we have devices, show as maintenance
    if (unknownDevices === siteDevices.length && siteDevices.length > 0) {
      return 'maintenance'; // Devices exist but monitoring hasn't started
    }
    
    // Default: if we have devices but no clear status, show as maintenance
    return 'maintenance';
  }

  // Get all devices at this site (from networkDevices prop, hardware deployments, equipment, and EPC devices)
  function getSiteDevices(): any[] {
    if (!site) return [];
    const siteId = site.id || site._id;
    
    console.log('[MonitoringSiteDetailsModal] Getting devices for site:', site.name, 'siteId:', siteId, 'siteId type:', typeof siteId);
    
    // Debug: Log all networkDevices and their siteIds
    if (networkDevices && networkDevices.length > 0) {
      console.log('[MonitoringSiteDetailsModal] All networkDevices:', networkDevices.map((d: any) => ({
        id: d.id,
        name: d.name,
        siteId: d.siteId,
        site_id: d.site_id,
        siteIdType: typeof d.siteId,
        site_idType: typeof d.site_id
      })));
    } else {
      console.log('[MonitoringSiteDetailsModal] No networkDevices available');
    }
    
    // Get devices from networkDevices prop
    const devicesFromNetwork = (networkDevices || []).filter((device: any) => {
      // Try multiple ways to get siteId from device
      const deviceSiteId = device.siteId?._id || device.siteId?.id || device.siteId || 
                          device.site_id?._id || device.site_id?.id || device.site_id;
      
      // Normalize both IDs to strings for comparison
      const normalizedSiteId = String(siteId);
      const normalizedDeviceSiteId = deviceSiteId ? String(deviceSiteId) : null;
      
      const matches = normalizedSiteId && normalizedDeviceSiteId && normalizedSiteId === normalizedDeviceSiteId;
      
      if (matches) {
        console.log('[MonitoringSiteDetailsModal] ✅ Found device from networkDevices:', device.name, 
          'deviceSiteId:', normalizedDeviceSiteId, 'matches siteId:', normalizedSiteId);
      } else if (deviceSiteId) {
        console.log('[MonitoringSiteDetailsModal] ❌ Device', device.name, 'has siteId', normalizedDeviceSiteId, 
          'but site is', normalizedSiteId, '- NO MATCH');
      }
      
      return matches;
    });
    
    // Include EPC devices at this site
    const devicesFromEPC = epcDevices.map((epc: any) => {
      const epcSiteId = epc.siteId?._id || epc.siteId?.id || epc.siteId || epc.site_id;
      if (siteId && epcSiteId && String(epcSiteId) === String(siteId)) {
        console.log('[MonitoringSiteDetailsModal] Found EPC device:', epc.name || epc.epcId, 'siteId:', epcSiteId);
        return {
          id: epc.id || epc._id || epc.epcId,
          name: epc.name || epc.site_name || epc.epcId || 'EPC Device',
          type: 'epc',
          status: epc.status || 'unknown',
          ipAddress: epc.ipAddress || epc.ip_address || null,
          siteId: String(siteId),
          isEPC: true
        };
      }
      // Also try matching by site name as fallback
      if (epc.site_name && site.name && epc.site_name.toLowerCase() === site.name.toLowerCase()) {
        console.log('[MonitoringSiteDetailsModal] Found EPC device by name match:', epc.site_name);
        return {
          id: epc.id || epc._id || epc.epcId,
          name: epc.name || epc.site_name || epc.epcId || 'EPC Device',
          type: 'epc',
          status: epc.status || 'unknown',
          ipAddress: epc.ipAddress || epc.ip_address || null,
          siteId: String(siteId),
          isEPC: true
        };
      }
      return null;
    }).filter(Boolean);
    
    // Also include hardware deployments at this site as devices
    const devicesFromDeployments = hardwareDeployments.map((d: any) => {
      const deploymentSiteId = d.siteId?._id || d.siteId?.id || d.siteId;
      if (siteId && deploymentSiteId && String(deploymentSiteId) === String(siteId)) {
        return {
          id: `deployment-${d._id || d.id}`,
          name: d.name || 'Hardware Deployment',
          type: d.hardware_type || 'other',
          status: 'unknown',
          ipAddress: d.config?.ipAddress || d.config?.ip_address || d.config?.management_ip || null,
          siteId: String(siteId),
          isHardwareDeployment: true
        };
      }
      return null;
    }).filter(Boolean);
    
    // Also include equipment at this site as devices
    const devicesFromEquipment = equipment.map((eq: any) => {
      const eqSiteId = eq.siteId?._id || eq.siteId?.id || eq.siteId;
      if (siteId && eqSiteId && String(eqSiteId) === String(siteId)) {
        let ipAddress = null;
        if (eq.notes) {
          try {
            const notes = typeof eq.notes === 'string' ? JSON.parse(eq.notes) : eq.notes;
            ipAddress = notes.management_ip || notes.ip_address || null;
          } catch {
            // Ignore parse errors
          }
        }
        return {
          id: eq.id || eq._id,
          name: eq.name || 'Equipment',
          type: eq.type || 'other',
          status: 'unknown',
          ipAddress: ipAddress,
          siteId: String(siteId),
          isEquipment: true
        };
      }
      return null;
    }).filter(Boolean);
    
    const allDevices = [...devicesFromNetwork, ...devicesFromEPC, ...devicesFromDeployments, ...devicesFromEquipment];
    console.log('[MonitoringSiteDetailsModal] Total devices found:', allDevices.length, 
      '(network:', devicesFromNetwork.length, 
      'epc:', devicesFromEPC.length,
      'deployments:', devicesFromDeployments.length,
      'equipment:', devicesFromEquipment.length, ')');
    
    return allDevices;
  }
</script>

{#if show && site}
  <div class="modal-overlay" onclick={closeModal}>
    <div class="modal-content large" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>📋 Site Details: {site.name}</h2>
        <button class="close-btn" onclick={closeModal}>✕</button>
      </div>
      
      {#if error}
        <div class="error-banner">{error}</div>
      {/if}
      
      <!-- Site Info -->
      <div class="site-info">
        <div class="info-row">
          <span class="label">Type:</span>
          <span class="value">{site.type || 'tower'}</span>
        </div>
        {#if site.location?.address}
          <div class="info-row">
            <span class="label">Address:</span>
            <span class="value">{site.location.address}</span>
          </div>
        {/if}
        {#if site.location?.latitude && site.location?.longitude}
          <div class="info-row">
            <span class="label">Coordinates:</span>
            <span class="value">{site.location.latitude.toFixed(6)}, {site.location.longitude.toFixed(6)}</span>
          </div>
        {/if}
        <div class="info-row">
          <span class="label">Status:</span>
          <span class="value status-badge {getSiteStatus()}">{getSiteStatus()}</span>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab-btn" class:active={activeTab === 'devices'} onclick={() => activeTab = 'devices'}>
          📊 Devices ({getSiteDevices().length})
        </button>
        <button class="tab-btn" class:active={activeTab === 'hardware'} onclick={() => activeTab = 'hardware'}>
          🔧 Hardware ({hardwareDeployments.length})
        </button>
        <button class="tab-btn" class:active={activeTab === 'equipment'} onclick={() => activeTab = 'equipment'}>
          📦 Equipment ({equipment.length})
        </button>
        <button class="tab-btn" class:active={activeTab === 'sectors'} onclick={() => activeTab = 'sectors'}>
          📶 Sectors ({sectors.length})
        </button>
      </div>
      
      <div class="modal-body">
        {#if isLoading}
          <div class="loading">Loading site details...</div>
        {:else if activeTab === 'devices'}
          <!-- Devices with Uptime -->
          {#if getSiteDevices().length === 0}
            <div class="empty-state">
              <p>No devices found at this site</p>
            </div>
          {:else}
            <div class="items-list">
              {#each getSiteDevices() as device (device.id)}
                {@const uptimeStats = deviceUptimes.get(device.id)}
                <div class="item-card device-card">
                  <div class="item-header">
                    <h3>{device.name || 'Unknown Device'}</h3>
                    <span class="status-badge {getUptimeColor(uptimeStats?.uptime_percent || 0)}">
                      {getStatusIndicator(uptimeStats?.current_status || device.status || 'unknown')}
                    </span>
                  </div>
                  <div class="item-details">
                    <div class="detail-row">
                      <span class="label">Type:</span>
                      <span class="value">{device.type || 'N/A'}</span>
                    </div>
                    {#if device.ipAddress || device.ip_address}
                      <div class="detail-row">
                        <span class="label">IP Address:</span>
                        <span class="value mono">{device.ipAddress || device.ip_address}</span>
                      </div>
                    {/if}
                    {#if device.macAddress || device.mac_address}
                      <div class="detail-row">
                        <span class="label">MAC Address:</span>
                        <span class="value mono">{device.macAddress || device.mac_address}</span>
                      </div>
                    {/if}
                    <div class="detail-row">
                      <span class="label">Uptime:</span>
                      <span class="value {getUptimeColor(uptimeStats?.uptime_percent || 0)}">
                        {uptimeStats?.uptime_percent !== undefined ? `${uptimeStats.uptime_percent}%` : 'N/A'}
                      </span>
                    </div>
                    {#if uptimeStats?.avg_response_time_ms}
                      <div class="detail-row">
                        <span class="label">Avg. Response:</span>
                        <span class="value">{uptimeStats.avg_response_time_ms} ms</span>
                      </div>
                    {/if}
                  </div>
                  {#if device.ipAddress && !device.isHardwareDeployment && !device.isEquipment}
                    <div class="item-actions">
                        <button 
                          class="btn btn-sm btn-primary" 
                          onclick={() => { closeModal(); window.location.href = `/modules/monitoring?deviceId=${device.id}&tab=graphs`; }}
                          title="View Graphs"
                        >
                        📊 View Graphs
                      </button>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {:else if activeTab === 'hardware'}
          <!-- Hardware Deployments -->
          {#if hardwareDeployments.length === 0}
            <div class="empty-state">
              <p>No hardware deployments found at this site</p>
            </div>
          {:else}
            <div class="items-list">
              {#each hardwareDeployments as deployment}
                <div class="item-card">
                  <div class="item-header">
                    <h3>{deployment.name || 'Unnamed Deployment'}</h3>
                    <span class="status-badge {deployment.status || 'deployed'}">{deployment.status || 'deployed'}</span>
                  </div>
                  <div class="item-details">
                    <div class="detail-row">
                      <span class="label">Type:</span>
                      <span class="value">{deployment.hardware_type || 'Unknown'}</span>
                    </div>
                    {#if deployment.config?.ipAddress || deployment.config?.ip_address}
                      <div class="detail-row">
                        <span class="label">IP Address:</span>
                        <span class="value mono">{deployment.config.ipAddress || deployment.config.ip_address}</span>
                      </div>
                    {/if}
                    {#if deployment.config?.macAddress || deployment.config?.mac_address}
                      <div class="detail-row">
                        <span class="label">MAC Address:</span>
                        <span class="value mono">{deployment.config.macAddress || deployment.config.mac_address}</span>
                      </div>
                    {/if}
                    {#if deployment.deployedAt}
                      <div class="detail-row">
                        <span class="label">Deployed:</span>
                        <span class="value">{new Date(deployment.deployedAt).toLocaleDateString()}</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {:else if activeTab === 'equipment'}
          <!-- Equipment -->
          {#if equipment.length === 0}
            <div class="empty-state">
              <p>No equipment found at this site</p>
            </div>
          {:else}
            <div class="items-list">
              {#each equipment as eq}
                <div class="item-card">
                  <div class="item-header">
                    <h3>{eq.name || 'Unnamed Equipment'}</h3>
                    <span class="status-badge {eq.status || 'active'}">{eq.status || 'active'}</span>
                  </div>
                  <div class="item-details">
                    <div class="detail-row">
                      <span class="label">Type:</span>
                      <span class="value">{eq.type || 'Unknown'}</span>
                    </div>
                    {#if eq.manufacturer || eq.model}
                      <div class="detail-row">
                        <span class="label">Model:</span>
                        <span class="value">{[eq.manufacturer, eq.model].filter(Boolean).join(' ')}</span>
                      </div>
                    {/if}
                    {#if eq.ipAddress || eq.networkConfig?.management_ip}
                      <div class="detail-row">
                        <span class="label">IP Address:</span>
                        <span class="value mono">{eq.ipAddress || eq.networkConfig?.management_ip}</span>
                      </div>
                    {/if}
                    {#if eq.macAddress}
                      <div class="detail-row">
                        <span class="label">MAC Address:</span>
                        <span class="value mono">{eq.macAddress}</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {:else if activeTab === 'sectors'}
          <!-- Sectors -->
          {#if sectors.length === 0}
            <div class="empty-state">
              <p>No sectors found at this site</p>
            </div>
          {:else}
            <div class="items-list">
              {#each sectors as sector}
                <div class="item-card">
                  <div class="item-header">
                    <h3>{sector.name || `Sector ${sector.azimuth}°`}</h3>
                    <span class="status-badge {sector.status || 'active'}">{sector.status || 'active'}</span>
                  </div>
                  <div class="item-details">
                    {#if sector.azimuth}
                      <div class="detail-row">
                        <span class="label">Azimuth:</span>
                        <span class="value">{sector.azimuth}°</span>
                      </div>
                    {/if}
                    {#if sector.technology}
                      <div class="detail-row">
                        <span class="label">Technology:</span>
                        <span class="value">{sector.technology}</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
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
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--card-bg, #ffffff);
    border-radius: 8px;
    padding: 0;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-content.large {
    max-width: 900px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: var(--bg-secondary, #f3f4f6);
  }

  .error-banner {
    background: #fee2e2;
    color: #991b1b;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid #fecaca;
  }

  .site-info {
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    background: var(--bg-secondary, #f9fafb);
  }

  .info-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .info-row:last-child {
    margin-bottom: 0;
  }

  .info-row .label {
    font-weight: 500;
    min-width: 100px;
    color: var(--text-secondary, #6b7280);
  }

  .info-row .value {
    color: var(--text-primary, #111827);
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    overflow-x: auto;
  }

  .tab-btn {
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 4px;
    font-size: 0.875rem;
    white-space: nowrap;
  }

  .tab-btn:hover {
    background: var(--bg-secondary, #f3f4f6);
  }

  .tab-btn.active {
    background: var(--primary, #3b82f6);
    color: white;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary, #6b7280);
  }

  .empty-state {
    text-align: center;
    padding: 3rem 2rem;
    color: var(--text-secondary, #6b7280);
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .item-card {
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 8px;
    padding: 1rem;
    background: var(--card-bg, #ffffff);
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .item-header h3 {
    margin: 0;
    font-size: 1rem;
  }

  .item-details {
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
    font-weight: 500;
    min-width: 120px;
    color: var(--text-secondary, #6b7280);
  }

  .detail-row .value {
    color: var(--text-primary, #111827);
  }

  .detail-row .value.mono {
    font-family: monospace;
  }

  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .status-badge.active,
  .status-badge.deployed {
    background: #d1fae5;
    color: #065f46;
  }

  .status-badge.text-green-500 {
    color: #10b981;
  }

  .status-badge.text-yellow-500 {
    color: #f59e0b;
  }

  .status-badge.text-red-500 {
    color: #ef4444;
  }

  .text-green-500 {
    color: #10b981;
  }

  .text-yellow-500 {
    color: #f59e0b;
  }

  .text-red-500 {
    color: #ef4444;
  }

  .item-actions {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
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

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
  }

  .btn-primary {
    background: var(--primary, #3b82f6);
    color: white;
  }

  .btn-primary:hover {
    background: var(--primary-dark, #2563eb);
  }
</style>

