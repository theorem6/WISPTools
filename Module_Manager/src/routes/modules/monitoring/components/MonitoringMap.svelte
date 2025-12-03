<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import CoverageMapView from '../../coverage-map/components/CoverageMapView.svelte';
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

  // Convert devices to equipment format for the map
  function convertDevicesToEquipment() {
    console.log('[MonitoringMap] Converting devices:', devices);
    
    equipment = devices
      .filter(device => {
        // Only include deployed devices with valid location coordinates
        // Check if device is deployed (has siteId or isDeployed flag)
        const isDeployed = device.isDeployed === true || !!device.siteId;
        if (!isDeployed) {
          console.log('[MonitoringMap] Skipping non-deployed device:', device.name || device.id, {
            isDeployed: device.isDeployed,
            siteId: device.siteId,
            hasLocation: !!device.location
          });
          return false;
        }
        
        // Only include devices with valid location coordinates
        const lat = device.location?.coordinates?.latitude || device.location?.latitude;
        const lon = device.location?.coordinates?.longitude || device.location?.longitude;
        const hasValid = hasValidCoordinates(lat, lon);
        if (!hasValid) {
          console.log('[MonitoringMap] Skipping deployed device without valid coordinates:', device.name || device.id, {
            lat,
            lon,
            hasLocation: !!device.location,
            locationType: typeof device.location
          });
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
          // Ensure location has the right structure with valid coordinates
          location: {
            latitude: lat,
            longitude: lon,
            address: device.location?.address || 'Unknown Location'
          },
          ipAddress: device.ipAddress,
          lastSeen: new Date().toISOString(),
          metrics: device.metrics || {},
          // Additional monitoring-specific fields
          monitoringData: {
            cpuUsage: device.metrics?.cpuUsage,
            memoryUsage: device.metrics?.memoryUsage,
            uptime: device.metrics?.uptime,
            throughput: device.metrics?.throughput,
            connectedClients: device.metrics?.connectedClients,
            signalStrength: device.metrics?.signalStrength
          }
        };
        
        console.log('[MonitoringMap] Converted device:', device.name, 'to equipment with location:', equipmentItem.location);
        return equipmentItem;
      });
    
    // Also create some towers for devices that need them (only deployed devices with valid coordinates)
    towers = devices
      .filter(device => {
        // Only deployed devices
        const isDeployed = device.isDeployed !== false && (device.siteId || device.isDeployed === true);
        if (!isDeployed) return false;
        
        const lat = device.location?.coordinates?.latitude || device.location?.latitude;
        const lon = device.location?.coordinates?.longitude || device.location?.longitude;
        return hasValidCoordinates(lat, lon) && (device.type === 'epc' || (device.type === 'mikrotik' && device.deviceType === 'router'));
      })
      .map(device => {
        const lat = device.location?.coordinates?.latitude || device.location?.latitude || 0;
        const lon = device.location?.coordinates?.longitude || device.location?.longitude || 0;
        
        return {
          id: `tower-${device.id}`,
          name: `${device.name} Site`,
          type: 'tower',
          status: device.status,
          location: {
            latitude: lat,
            longitude: lon,
            address: device.location?.address || 'Unknown Location'
          },
          height: 50,
          equipment: [device.id]
        };
      });
    
    console.log('[MonitoringMap] Converted devices to equipment:', equipment.length, 'towers:', towers.length, '(filtered out devices without valid coordinates)');
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
    console.log('[MonitoringMap] Map event:', event.type, event.detail);
    dispatch(event.type, event.detail);
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

  // Calculate uptime percentage
  function calculateUptime() {
    if (!networkDevices || networkDevices.length === 0) return 0;
    const onlineDevices = networkDevices.filter(d => d.status === 'online').length;
    return Math.round((onlineDevices / networkDevices.length) * 100);
  }
  
  // Watch for device changes
  $: if (devices) {
    convertDevicesToEquipment();
  }
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
              <div class="status-label">Uptime</div>
            </div>
          </div>
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
      on:siteSelected={handleMapEvent}
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
