<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import CoverageMapView from '../../coverage-map/components/CoverageMapView.svelte';
  import { coverageMapService } from '../../coverage-map/lib/coverageMapService.mongodb';
  import type { TowerSite, Sector, CPEDevice, NetworkEquipment, CoverageMapFilters } from '../../coverage-map/lib/models';
  
  const dispatch = createEventDispatcher();
  
  export let devices = [];
  export let alerts = [];
  export let dashboardData = null;
  export let networkDevices = [];
  export let height = '600px';
  
  // Convert monitoring devices to network equipment for the map
  let equipment: NetworkEquipment[] = [];
  let towers: TowerSite[] = [];
  let sectors: Sector[] = [];
  let cpeDevices: CPEDevice[] = [];
  
  $: tenantId = $currentTenant?.id || '';
  
  // Monitoring-specific filters (show all network equipment)
  let filters: CoverageMapFilters = {
    showTowers: true,
    showSectors: true,
    showCPE: true,
    showEquipment: true,
    showBackhaul: true,
    showVehicles: false,
    showWarehouses: false,
    showNOCs: false,
    showRMA: false,
    showInventory: false,
    showCoverage: false,
    showLabels: true,
    showConnections: true,
    towerTypes: [],
    sectorTypes: [],
    equipmentTypes: [],
    statusFilter: 'all'
  };
  
  // Helper function to check if coordinates are valid (not 0,0 or null)
  function hasValidCoordinates(lat: number | null | undefined, lon: number | null | undefined): boolean {
    if (lat == null || lon == null) return false;
    if (typeof lat !== 'number' || typeof lon !== 'number') return false;
    if (lat === 0 && lon === 0) return false; // 0,0 is in the ocean
    if (lat < -90 || lat > 90) return false; // Invalid latitude range
    if (lon < -180 || lon > 180) return false; // Invalid longitude range
    return true;
  }

  // Calculate system uptime percentage
  function getSystemUptimePercent(): number {
    if (!networkDevices || networkDevices.length === 0) return 0;
    const onlineDevices = networkDevices.filter(d => d.status === 'online').length;
    return Math.round((onlineDevices / networkDevices.length) * 100);
  }

  // Convert devices to equipment format for the map
  function convertDevicesToEquipment() {
    // Calculate system uptime first
    const systemUptime = getSystemUptimePercent();
    
    // Filter devices: only show devices with valid coordinates (monitoring shows all devices, not just deployed)
    let validDevices = 0;
    let skippedDevices = 0;
    
    equipment = devices
      .filter(device => {
        // Only include devices with valid location coordinates
        const lat = device.location?.coordinates?.latitude || device.location?.latitude;
        const lon = device.location?.coordinates?.longitude || device.location?.longitude;
        const hasValid = hasValidCoordinates(lat, lon);
        
        if (hasValid) {
          validDevices++;
        } else {
          skippedDevices++;
        }
        
        return hasValid;
      })
      .map(device => {
        const lat = device.location?.coordinates?.latitude || device.location?.latitude || 0;
        const lon = device.location?.coordinates?.longitude || device.location?.longitude || 0;
        
        const equipmentItem = {
          id: device.id,
          name: device.name,
          type: getEquipmentType(device),
          status: device.status,
          location: {
            latitude: lat,
            longitude: lon,
            address: device.location?.address || 'Unknown Location'
          },
          ipAddress: device.ipAddress,
          lastSeen: new Date().toISOString(),
          metrics: device.metrics || {},
          monitoringData: {
            cpuUsage: device.metrics?.cpuUsage,
            memoryUsage: device.metrics?.memoryUsage,
            uptime: device.metrics?.uptime,
            throughput: device.metrics?.throughput,
            connectedClients: device.metrics?.connectedClients,
            signalStrength: device.metrics?.signalStrength
          }
        };
        
        return equipmentItem;
      });
    
    // Summary log only
    if (devices.length > 0) {
      console.log(`[MonitoringMap] Processed ${devices.length} devices: ${validDevices} with valid locations, ${skippedDevices} skipped (no valid coordinates), system uptime: ${systemUptime}%`);
    }
    // Note: Towers are now loaded separately via loadSites() function
  }
  
  function getEquipmentType(device) {
    switch (device.type) {
      case 'epc':
        return 'EPC Core';
      case 'mikrotik':
        switch (device.deviceType) {
          case 'router': return 'Router';
          case 'ap': return 'Access Point';
          case 'cpe': return 'CPE';
          default: return 'Network Device';
        }
      case 'snmp':
        return device.deviceType === 'switch' ? 'Switch' : 'SNMP Device';
      default:
        return 'Unknown Device';
    }
  }
  
  // Handle map events
  function handleMapEvent(event) {
    dispatch(event.type, event.detail);
  }
  
  // Calculate distance between two coordinates (in kilometers)
  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  // Handle site click - find devices at this site and show modal
  function handleSiteClick(site: any) {
    const siteId = site.siteId || site.id;
    const deviceId = site.deviceId || site.id?.replace('tower-', '');
    
    // Get site location
    const siteLat = site.location?.latitude || site.location?.coordinates?.latitude;
    const siteLon = site.location?.longitude || site.location?.coordinates?.longitude;
    
    const siteDevices = networkDevices.filter(device => {
      // First try matching by siteId
      const deviceSiteId = device.siteId || device.site_id;
      if (siteId && deviceSiteId && String(deviceSiteId) === String(siteId)) {
        return true;
      }
      
      // Fallback to matching by deviceId (for device-based towers)
      const dId = device.id || device._id;
      if (deviceId && dId && String(dId) === String(deviceId)) {
        return true;
      }
      
      // Fallback to location proximity (within 0.5km / 500m)
      if (siteLat && siteLon && hasValidCoordinates(siteLat, siteLon)) {
        const deviceLat = device.location?.coordinates?.latitude || device.location?.latitude;
        const deviceLon = device.location?.coordinates?.longitude || device.location?.longitude;
        
        if (hasValidCoordinates(deviceLat, deviceLon)) {
          const distance = getDistance(siteLat, siteLon, deviceLat, deviceLon);
          if (distance < 0.5) { // Within 500 meters
            return true;
          }
        }
      }
      
      return false;
    });
    
    // Dispatch event to parent to show devices modal
    dispatch('siteSelected', { site, devices: siteDevices });
  }

  // Helper function to get alert severity color
  function getAlertSeverityColor(severity) {
    switch (severity?.toLowerCase()) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
      default: return '#6b7280';
    }
  }

  // Calculate uptime percentage (device availability)
  function calculateUptime() {
    if (!networkDevices || networkDevices.length === 0) return 0;
    const onlineDevices = networkDevices.filter(d => d.status === 'online').length;
    return Math.round((onlineDevices / networkDevices.length) * 100);
  }
  
  // Get EPC system uptime (actual system runtime)
  function getEPCSystemUptime() {
    if (!networkDevices || networkDevices.length === 0) return null;
    
    // Find EPC devices with uptime metrics
    const epcDevices = networkDevices.filter(d => d.type === 'epc' && d.metrics?.uptime);
    
    if (epcDevices.length === 0) return null;
    
    // Return the longest uptime (most reliable EPC)
    const uptimes = epcDevices
      .map(d => {
        const uptimeStr = d.metrics?.uptime;
        if (!uptimeStr) return null;
        
        // Parse formatted uptime string (e.g., "10d 5h 30m" or "5h 30m" or "30m")
        // Or if it's a number (seconds), convert it
        if (typeof uptimeStr === 'number') {
          return uptimeStr;
        }
        
        // Parse formatted string
        const daysMatch = uptimeStr.match(/(\d+)d/);
        const hoursMatch = uptimeStr.match(/(\d+)h/);
        const minutesMatch = uptimeStr.match(/(\d+)m/);
        
        const days = daysMatch ? parseInt(daysMatch[1]) : 0;
        const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
        const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
        
        return (days * 24 * 60 * 60) + (hours * 60 * 60) + (minutes * 60);
      })
      .filter(u => u !== null && u > 0);
    
    if (uptimes.length === 0) return null;
    
    // Return the longest uptime in seconds
    const maxUptime = Math.max(...uptimes);
    
    // Format it nicely
    const days = Math.floor(maxUptime / (24 * 60 * 60));
    const hours = Math.floor((maxUptime % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((maxUptime % (60 * 60)) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
  
  // Calculate uptime percentage for a site based on devices
  function calculateSiteUptime(siteId: string): number {
    if (!networkDevices || networkDevices.length === 0) return 0;
    
    // Find all devices at this site
    const siteDevices = networkDevices.filter(device => {
      const deviceSiteId = device.siteId || device.site_id;
      return deviceSiteId && (String(deviceSiteId) === String(siteId));
    });
    
    if (siteDevices.length === 0) return 0;
    
    // Calculate uptime based on device statuses
    const onlineDevices = siteDevices.filter(d => d.status === 'online').length;
    return Math.round((onlineDevices / siteDevices.length) * 100);
  }
  
  // Get worst alert severity for devices at a site
  function getWorstAlertSeverity(siteId: string): 'critical' | 'error' | 'warning' | 'info' | null {
    if (!alerts || alerts.length === 0) return null;
    if (!networkDevices || networkDevices.length === 0) return null;
    
    // Find all devices at this site
    const siteDevices = networkDevices.filter(device => {
      const deviceSiteId = device.siteId || device.site_id;
      return deviceSiteId && (String(deviceSiteId) === String(siteId));
    });
    
    if (siteDevices.length === 0) return null;
    
    // Get device IDs at this site
    const siteDeviceIds = new Set(siteDevices.map(d => String(d.id || d._id)));
    
    // Find alerts for devices at this site
    const siteAlerts = alerts.filter((alert: any) => {
      const alertDeviceId = alert.deviceId || alert.device_id;
      return alertDeviceId && siteDeviceIds.has(String(alertDeviceId));
    });
    
    if (siteAlerts.length === 0) return null;
    
    // Determine worst severity (critical > error > warning > info)
    const severityOrder: Record<string, number> = { critical: 4, error: 3, warning: 2, info: 1 };
    let worstSeverity: 'critical' | 'error' | 'warning' | 'info' | null = null;
    let worstOrder = 0;
    
    siteAlerts.forEach((alert: any) => {
      const severity = alert.severity?.toLowerCase();
      const order = severityOrder[severity] || 0;
      if (order > worstOrder) {
        worstOrder = order;
        worstSeverity = severity as 'critical' | 'error' | 'warning' | 'info';
      }
    });
    
    return worstSeverity;
  }
  
  // Get site status based on uptime and alerts
  function getSiteStatus(siteId: string, systemUptime: number): 'active' | 'inactive' | 'maintenance' {
    const worstAlert = getWorstAlertSeverity(siteId);
    
    // Priority: alerts > system uptime > site-specific uptime
    if (worstAlert === 'critical' || worstAlert === 'error') {
      return 'inactive'; // Red
    } else if (worstAlert === 'warning') {
      return 'maintenance'; // Yellow
    } else if (systemUptime === 100) {
      return 'active'; // Green - system is 100% uptime
    } else {
      const siteUptime = calculateSiteUptime(siteId);
      if (siteUptime === 100) return 'active';
      if (siteUptime === 0) return 'inactive';
      return 'maintenance';
    }
  }
  
  // Check if a site is a fake New York test site
  function isFakeNewYorkSite(site: any): boolean {
    if (!site || !site.location) return false;
    
    const lat = site.location.latitude || site.location.coordinates?.latitude;
    const lon = site.location.longitude || site.location.coordinates?.longitude;
    const name = (site.name || '').toLowerCase();
    
    // Check for New York coordinates (from test script)
    const fakeCoords = [
      { lat: 40.7128, lon: -74.0060 },
      { lat: 40.7589, lon: -73.9851 },
      { lat: 40.7505, lon: -73.9934 },
      { lat: 40.7282, lon: -73.9942 },
      { lat: 40.7614, lon: -73.9776 }
    ];
    
    if (lat && lon) {
      for (const coord of fakeCoords) {
        if (Math.abs(lat - coord.lat) < 0.01 && Math.abs(lon - coord.lon) < 0.01) {
          return true;
        }
      }
    }
    
    // Check for fake site names
    const fakeNames = ['main tower site', 'secondary tower', 'noc facility', 'customer site a', 'customer site b'];
    if (fakeNames.some(n => name.includes(n))) {
      return true;
    }
    
    return false;
  }
  
  // Load sites from database and merge with device-based towers
  async function loadSites() {
    if (!tenantId) {
      towers = [];
      return;
    }
    
    try {
      // Load actual sites from database
      const loadedSites = await coverageMapService.getTowerSites(tenantId);
      
      // Filter out fake New York sites
      const realSites = loadedSites.filter((site: any) => !isFakeNewYorkSite(site));
      
      // Calculate system uptime for status determination
      const systemUptime = getSystemUptimePercent();
      
      // Process sites with status calculation
      const processedSites = realSites.map((site: any) => {
        const siteId = site.id || site._id;
        const status = getSiteStatus(siteId, systemUptime);
        
        return {
          ...site,
          id: siteId,
          status: status,
          uptimePercent: calculateSiteUptime(siteId),
          worstAlertSeverity: getWorstAlertSeverity(siteId)
        };
      });
      
      // Also create device-based towers (for devices without sites but with valid locations)
      const deviceTowers = devices
        .filter(device => {
          // Only create tower if device doesn't already have a site in the database
          const deviceSiteId = device.siteId || device.site_id;
          if (deviceSiteId) {
            // Check if site already exists in database
            const existingSite = processedSites.find(s => String(s.id) === String(deviceSiteId));
            if (existingSite) return false; // Site already exists, skip device tower
          }
          
          // Only create towers for devices with valid coordinates
          const lat = device.location?.coordinates?.latitude || device.location?.latitude;
          const lon = device.location?.coordinates?.longitude || device.location?.longitude;
          if (!hasValidCoordinates(lat, lon)) return false;
          
          // Only create towers for major devices (EPCs, routers) - not every device needs a tower
          return device.type === 'epc' || (device.type === 'mikrotik' && device.deviceType === 'router');
        })
        .map(device => {
          const lat = device.location?.coordinates?.latitude || device.location?.latitude || 0;
          const lon = device.location?.coordinates?.longitude || device.location?.longitude || 0;
          const systemUptime = getSystemUptimePercent();
          const status = getSiteStatus(device.id, systemUptime);
          
          return {
            id: `tower-${device.id}`,
            name: `${device.name} Site`,
            type: 'tower',
            status: status,
            location: {
              latitude: lat,
              longitude: lon,
              address: device.location?.address || 'Unknown Location'
            },
            height: 50,
            equipment: [device.id],
            deviceId: device.id
          };
        });
      
      // Merge database sites with device-based towers
      towers = [...processedSites, ...deviceTowers];
    } catch (error) {
      console.error('[MonitoringMap] Failed to load sites:', error);
      towers = [];
    }
  }
  
  // Watch for device changes
  $: if (devices) {
    convertDevicesToEquipment();
  }
  
  // Watch for tenant, devices, and alerts to reload sites with updated status
  $: if (tenantId) {
    loadSites();
  }
  
  // Load sites on mount
  onMount(() => {
    if (tenantId) {
      loadSites();
    }
  });
</script>

<div class="monitoring-map" style="height: {height};">
  <!-- Combined Monitoring Panel - Right Side -->
  <div class="combined-controls">
    <div class="combined-panel">
      <!-- System Status Section - Top -->
      <div class="status-section">
        <div class="section-header">
          <h3>📊 System Status</h3>
          <button class="refresh-btn" on:click={() => dispatch('refreshData')} title="Refresh Data">
            🔄
          </button>
        </div>
        <div class="status-cards">
          <div class="status-card critical">
            <div class="status-icon">🚨</div>
            <div class="status-content">
              <div class="status-value">{dashboardData?.summary?.critical_alerts || 0}</div>
              <div class="status-label">Critical</div>
            </div>
          </div>
          
          <div class="status-card warning">
            <div class="status-icon">⚠️</div>
            <div class="status-content">
              <div class="status-value">{dashboardData?.summary?.total_alerts || 0}</div>
              <div class="status-label">Alerts</div>
            </div>
          </div>
          
          <div class="status-card success">
            <div class="status-icon">✅</div>
            <div class="status-content">
              <div class="status-value">{networkDevices.filter(d => d.status === 'online').length}</div>
              <div class="status-label">Online</div>
            </div>
          </div>
          
          <div class="status-card info">
            <div class="status-icon">📊</div>
            <div class="status-content">
              <div class="status-value">{calculateUptime()}%</div>
              <div class="status-label">Device Uptime</div>
            </div>
          </div>
          
          {#if getEPCSystemUptime()}
            <div class="status-card success">
              <div class="status-icon">⏱️</div>
              <div class="status-content">
                <div class="status-value" style="font-size: 0.9rem;">{getEPCSystemUptime()}</div>
                <div class="status-label">EPC System Uptime</div>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Active Alerts Section - Bottom -->
      <div class="alerts-section">
        <div class="section-header">
          <h3>🚨 Active Alerts</h3>
          <span class="alerts-count">{alerts.length}</span>
        </div>

        <div class="alerts-list">
          {#if alerts.length > 0}
            {#each alerts as alert, index}
              <div 
                class="alert-item clickable" 
                style="border-left-color: {getAlertSeverityColor(alert.severity)}"
                on:click={() => dispatch('alertClick', alert)}
                on:keydown={(e) => e.key === 'Enter' && dispatch('alertClick', alert)}
                tabindex="0"
                role="button"
              >
                <div class="alert-content">
                  <div class="alert-header">
                    <div class="alert-severity {alert.severity?.toLowerCase()}">{alert.severity}</div>
                    <div class="alert-time">{new Date(alert.timestamp).toLocaleTimeString()}</div>
                  </div>
                  <div class="alert-message">{alert.message}</div>
                  <div class="alert-actions">
                    <button 
                      class="alert-action-btn details"
                      on:click|stopPropagation={() => dispatch('showAlertDetails', alert)}
                    >
                      📋 Details
                    </button>
                    <button 
                      class="alert-action-btn ticket"
                      on:click|stopPropagation={() => dispatch('createTicketFromAlert', alert)}
                    >
                      🎫 Create Ticket
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          {:else}
            <div class="no-alerts">
              <div class="no-alerts-icon">✅</div>
              <div class="no-alerts-text">No active alerts</div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Coverage Map with hidden plan/deploy elements -->
  <div class="map-wrapper">
    <CoverageMapView
      {towers}
      {sectors}
      {cpeDevices}
      {equipment}
      {filters}
      externalPlanFeatures={[]}
      marketingLeads={[]}
      planId={null}
      isPlanMode={false}
      isDeployMode={false}
      showFilterPanel={true}
      showMainMenu={false}
      on:siteSelected={(e) => {
        const site = e.detail;
        if (site) {
          handleSiteClick(site);
        }
        handleMapEvent(e);
      }}
      on:asset-click={(e) => {
        // Handle asset-click events from map (towers emit this)
        const asset = e.detail;
        if (asset && asset.type === 'tower' && asset.id) {
          const site = towers.find(t => String(t.id) === String(asset.id));
          if (site) {
            // Right-click opens comprehensive site details modal
            if (asset.isRightClick) {
              dispatch('siteRightClick', { site });
            } else {
              // Left-click shows devices modal
              handleSiteClick(site);
            }
          }
        }
        handleMapEvent(e);
      }}
      on:sectorSelected={handleMapEvent}
      on:cpeSelected={handleMapEvent}
      on:equipmentSelected={handleMapEvent}
      on:mapClick={handleMapEvent}
      on:contextMenu={handleMapEvent}
    />
  </div>
</div>

<style>
  .monitoring-map {
    width: 100%;
    height: 100%;
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    background: var(--bg-secondary, #f9fafb);
  }
  
  .combined-controls {
    position: absolute;
    top: 20px; /* Same height as exit menu */
    right: 10px;
    z-index: 1000;
    pointer-events: none;
  }
  
  .combined-panel {
    background: var(--color-background-primary);
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid var(--color-border);
    pointer-events: auto;
    width: 350px;
    max-height: calc(100vh - 60px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  
  .section-header h3 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 1.1rem;
    font-weight: 600;
  }

  .refresh-btn {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s ease;
    color: var(--color-text-secondary);
  }

  .refresh-btn:hover {
    background: var(--color-background-secondary);
    color: var(--color-text-primary);
    transform: translateY(-1px);
  }
  
  .combined-panel h4 {
    margin: 1.5rem 0 0.75rem 0;
    color: var(--color-text-primary);
    font-size: 0.95rem;
    font-weight: 600;
  }

  /* Status Section */
  .status-section {
    flex-shrink: 0;
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 2px solid var(--color-border);
  }

  .status-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }
  
  /* If there are 5 cards, make them wrap nicely */
  .status-cards:has(> :nth-child(5)) {
    grid-template-columns: repeat(3, 1fr);
  }

  .status-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem;
    background: var(--color-background-primary);
    border-radius: 8px;
    border: 1px solid var(--color-border);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
  }

  .status-card:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .status-card.critical {
    border-left: 4px solid var(--color-danger);
  }

  .status-card.warning {
    border-left: 4px solid var(--color-warning);
  }

  .status-card.success {
    border-left: 4px solid var(--color-success);
  }

  .status-card.info {
    border-left: 4px solid var(--color-info);
  }

  .status-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .status-content {
    flex: 1;
    min-width: 0;
  }

  .status-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1.2;
    margin-bottom: 0.25rem;
  }

  .status-label {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }
  
  
  .map-wrapper {
    width: 100%;
    height: 100%;
  }
  
  /* Hide ALL plan/deploy specific UI elements */
  :global(.monitoring-map .layer-panel),
  :global(.monitoring-map .plan-panel),
  :global(.monitoring-map .deploy-panel),
  :global(.monitoring-map .project-panel),
  :global(.monitoring-map .marketing-panel),
  :global(.monitoring-map .plan-controls),
  :global(.monitoring-map .deploy-controls),
  :global(.monitoring-map .filter-panel),
  :global(.monitoring-map .esri-ui-top-left > div:not(.esri-zoom)),
  :global(.monitoring-map .esri-ui-top-right > div),
  :global(.monitoring-map .esri-ui-bottom-left > div),
  :global(.monitoring-map .esri-ui-bottom-right > div:not(.esri-attribution)) {
    display: none !important;
  }
  
  /* Override coverage map styles for monitoring */
  :global(.monitoring-map .esri-view) {
    border-radius: 8px;
  }

  /* Alerts Section */
  .alerts-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .alerts-count {
    background: var(--color-danger);
    color: var(--color-text-inverse);
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .alerts-list {
    flex: 1;
    overflow-y: auto;
    margin: 1rem 0 0 0;
    padding-right: 0.5rem;
    min-height: 0;
  }

  /* Custom scrollbar for alerts list */
  .alerts-list::-webkit-scrollbar {
    width: 6px;
  }

  .alerts-list::-webkit-scrollbar-track {
    background: var(--color-background-secondary);
    border-radius: 3px;
  }

  .alerts-list::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
  }

  .alerts-list::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-tertiary);
  }

  .alert-item {
    padding: 1rem;
    border-bottom: 1px solid var(--color-border);
    border-left: 4px solid transparent;
    transition: all 0.2s ease;
    border-radius: 8px;
    margin-bottom: 0.75rem;
    background: var(--color-background-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .alert-item.clickable {
    cursor: pointer;
  }

  .alert-item.clickable:hover {
    background: var(--color-background-secondary);
    border-left-width: 6px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .alert-item.clickable:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  .alert-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .alert-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .alert-severity {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    letter-spacing: 0.025em;
  }

  .alert-severity.critical {
    color: var(--color-danger);
    background: rgba(239, 68, 68, 0.1);
  }

  .alert-severity.warning {
    color: var(--color-warning);
    background: rgba(245, 158, 11, 0.1);
  }

  .alert-severity.info {
    color: var(--color-info);
    background: rgba(59, 130, 246, 0.1);
  }

  .alert-message {
    font-size: 0.875rem;
    color: var(--color-text-primary);
    line-height: 1.5;
    font-weight: 500;
  }

  .alert-time {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .alert-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .alert-action-btn {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-background-primary);
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .alert-action-btn:hover {
    background: var(--color-background-secondary);
    border-color: var(--color-primary);
    color: var(--color-primary);
    transform: translateY(-1px);
  }

  .alert-action-btn.details:hover {
    border-color: var(--color-info);
    color: var(--color-info);
  }

  .alert-action-btn.ticket:hover {
    border-color: var(--color-success);
    color: var(--color-success);
  }

  .no-alerts {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    text-align: center;
    color: var(--color-text-secondary);
  }

  .no-alerts-icon {
    font-size: 2rem;
    margin-bottom: 0.75rem;
  }

  .no-alerts-text {
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
    color: var(--color-text-primary);
  }
</style>
