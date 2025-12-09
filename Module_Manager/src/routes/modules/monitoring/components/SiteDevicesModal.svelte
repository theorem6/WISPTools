<script lang="ts">
  import { auth } from '$lib/firebase';
  import { API_CONFIG } from '$lib/config/api';
  import { currentTenant } from '$lib/stores/tenantStore';

  export let site: any = null;
  export let open = false;
  export let networkDevices: any[] = [];
  export let tenantId: string = '';

  let siteDevices: any[] = [];
  let deviceUptimes: Map<string, any> = new Map();
  let loading = false;
  let loadingUptimes = false;

  $: if (open && site && networkDevices) {
    loadSiteDevices();
  }

  $: tenantId = $currentTenant?.id || '';

  async function loadSiteDevices() {
    if (!site) return;

    loading = true;
    
    // Find all devices at this site
    // Try to find by siteId first (real site from database)
    const siteId = site.siteId || site.id || site._id;
    const deviceId = site.deviceId || site.id?.replace('tower-', '');

    // Get devices from networkDevices array
    const devicesFromNetwork = (networkDevices || []).filter(device => {
      // First try matching by siteId - find ALL devices at this site
      const deviceSiteId = device.siteId || device.site_id;
      if (siteId && deviceSiteId && String(deviceSiteId) === String(siteId)) {
        return true;
      }
      // Fallback to matching by deviceId (for device-based towers)
      const dId = device.id || device._id;
      if (deviceId && dId && String(dId) === String(deviceId)) {
        return true;
      }
      return false;
    });

    // Also load hardware deployments and equipment for this site
    let additionalDevices: any[] = [];
    try {
      const { coverageMapService } = await import('../../coverage-map/lib/coverageMapService.mongodb');
      
      // Load hardware deployments
      const allDeployments = await coverageMapService.getAllHardwareDeployments(tenantId);
      const siteDeployments = allDeployments.filter((d: any) => {
        const deploymentSiteId = d.siteId?._id || d.siteId?.id || d.siteId;
        return siteId && deploymentSiteId && String(deploymentSiteId) === String(siteId);
      });
      
      // Convert deployments to device format
      additionalDevices.push(...siteDeployments.map((d: any) => ({
        id: `deployment-${d._id || d.id}`,
        name: d.name || 'Hardware Deployment',
        type: d.hardware_type || 'other',
        status: 'unknown',
        ipAddress: d.config?.ipAddress || d.config?.ip_address || d.config?.management_ip || null,
        siteId: String(siteId),
        isHardwareDeployment: true
      })));
      
      // Load equipment
      const allEquipment = await coverageMapService.getEquipment(tenantId);
      const siteEquipment = allEquipment.filter((eq: any) => {
        const eqSiteId = eq.siteId?._id || eq.siteId?.id || eq.siteId;
        return siteId && eqSiteId && String(eqSiteId) === String(siteId);
      });
      
      // Convert equipment to device format
      additionalDevices.push(...siteEquipment.map((eq: any) => {
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
      }));
    } catch (err) {
      console.error('[SiteDevicesModal] Error loading additional devices:', err);
    }

    // Combine all devices
    siteDevices = [...devicesFromNetwork, ...additionalDevices];

    loading = false;
    await loadDeviceUptimes();
  }

  async function loadDeviceUptimes() {
    if (siteDevices.length === 0 || !tenantId) {
      deviceUptimes.clear();
      return;
    }

    loadingUptimes = true;
    const user = auth().currentUser;
    if (!user) {
      loadingUptimes = false;
      return;
    }
    const token = await user.getIdToken();

    const newDeviceUptimes = new Map();
    for (const device of siteDevices) {
      if (device.ipAddress || device.id) {
        try {
          const response = await fetch(`${API_CONFIG.PATHS.MONITORING_GRAPHS}/ping/${device.id}?hours=168`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Tenant-ID': tenantId
            }
          });
          if (response.ok) {
            const data = await response.json();
            newDeviceUptimes.set(device.id, data.stats);
          } else {
            console.warn(`[SiteDevicesModal] Failed to load uptime for device ${device.id}:`, response.statusText);
            // If device status is "unknown", keep it as unknown instead of offline
            const currentStatus = device.status === 'unknown' ? 'unknown' : 'offline';
            newDeviceUptimes.set(device.id, { uptime_percent: 0, current_status: currentStatus, message: 'No data' });
          }
        } catch (error) {
          console.error(`[SiteDevicesModal] Error loading uptime for device ${device.id}:`, error);
          // If device status is "unknown", keep it as unknown instead of offline
          const currentStatus = device.status === 'unknown' ? 'unknown' : 'offline';
          newDeviceUptimes.set(device.id, { uptime_percent: 0, current_status: currentStatus, message: 'Error' });
        }
      } else {
        // Device without IP - show as unknown (grey) not offline
        newDeviceUptimes.set(device.id, { uptime_percent: 0, current_status: 'unknown', message: 'No IP - Configure IP address' });
      }
    }
    deviceUptimes = newDeviceUptimes;
    loadingUptimes = false;
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

  function closeModal() {
    open = false;
    siteDevices = [];
    deviceUptimes.clear();
  }
</script>

{#if open && site}
  <div class="modal-overlay" on:click={closeModal}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h3>Devices at {site.name}</h3>
        <button class="modal-close" on:click={closeModal}>×</button>
      </div>
      <div class="modal-body">
        {#if loading || loadingUptimes}
          <p>Loading devices and uptime data...</p>
        {:else if siteDevices.length === 0}
          <p>No devices found at this site.</p>
        {:else}
          <div class="device-list">
            {#each siteDevices as device (device.id)}
              {@const uptimeStats = deviceUptimes.get(device.id)}
              <div class="device-item">
                <div class="device-header">
                  <h4>{device.name || 'Unknown Device'}</h4>
                  <span class="device-status {getUptimeColor(uptimeStats?.uptime_percent || 0)}">
                    {getStatusIndicator(uptimeStats?.current_status || device.status || 'unknown')}
                  </span>
                </div>
                <div class="device-details">
                  <p><strong>Type:</strong> {device.type || 'N/A'}</p>
                  {#if device.model}
                    <p><strong>Model:</strong> {device.model}</p>
                  {/if}
                  {#if device.ipAddress}
                    <p><strong>IP Address:</strong> {device.ipAddress}</p>
                  {/if}
                  <p><strong>Uptime:</strong> 
                    <span class="{getUptimeColor(uptimeStats?.uptime_percent || 0)}">
                      {uptimeStats?.uptime_percent !== undefined ? `${uptimeStats.uptime_percent}%` : 'N/A'}
                    </span>
                  </p>
                  {#if uptimeStats?.avg_response_time_ms}
                    <p><strong>Avg. Response:</strong> {uptimeStats.avg_response_time_ms} ms</p>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
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
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--bg-panel, #fff);
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    border-bottom: 1px solid var(--border-color, #eee);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text-primary, #333);
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary, #666);
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-close:hover {
    background: var(--bg-hover, #f0f0f0);
    border-radius: 4px;
  }

  .modal-body {
    padding: 20px;
    flex-grow: 1;
  }

  .device-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .device-item {
    background: var(--bg-card, #f9fafb);
    border: 1px solid var(--border-color, #eee);
    border-radius: 6px;
    padding: 15px;
  }

  .device-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .device-header h4 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text-primary, #333);
  }

  .device-status {
    font-weight: bold;
    font-size: 0.9rem;
  }

  .device-details p {
    margin: 5px 0;
    font-size: 0.9rem;
    color: var(--text-secondary, #555);
  }

  .device-details strong {
    color: var(--text-primary, #333);
  }

  .text-green-500 { color: #22c55e; }
  .text-yellow-500 { color: #eab308; }
  .text-red-500 { color: #ef4444; }
</style>
