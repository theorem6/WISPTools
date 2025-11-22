<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import CoverageMapView from '../../coverage-map/components/CoverageMapView.svelte';
  import type { TowerSite, Sector, CPEDevice, NetworkEquipment, CoverageMapFilters } from '../../coverage-map/lib/models';
  
  const dispatch = createEventDispatcher();
  
  export let devices = [];
  export let alerts = [];
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
  
  // Convert devices to equipment format for the map
  function convertDevicesToEquipment() {
    console.log('[MonitoringMap] Converting devices:', devices);
    
    equipment = devices.map(device => {
      const equipmentItem = {
        id: device.id,
        name: device.name,
        type: getEquipmentType(device),
        status: device.status,
        // Ensure location has the right structure
        location: {
          latitude: device.location?.coordinates?.latitude || device.location?.latitude || 0,
          longitude: device.location?.coordinates?.longitude || device.location?.longitude || 0,
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
      
      console.log('[MonitoringMap] Converted device:', device.name, 'to equipment:', equipmentItem);
      return equipmentItem;
    });
    
    // Also create some towers for devices that need them
    towers = devices
      .filter(device => device.type === 'epc' || (device.type === 'mikrotik' && device.deviceType === 'router'))
      .map(device => ({
        id: `tower-${device.id}`,
        name: `${device.name} Site`,
        type: 'tower',
        status: device.status,
        location: {
          latitude: device.location?.coordinates?.latitude || device.location?.latitude || 0,
          longitude: device.location?.coordinates?.longitude || device.location?.longitude || 0,
          address: device.location?.address || 'Unknown Location'
        },
        height: 50,
        equipment: [device.id]
      }));
    
    console.log('[MonitoringMap] Converted devices to equipment:', equipment.length, 'towers:', towers.length);
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
  
  // Watch for device changes
  $: if (devices) {
    convertDevicesToEquipment();
  }
</script>

<div class="monitoring-map" style="height: {height};">
  <!-- Monitoring-specific controls overlay - Left Side -->
  <div class="monitoring-controls">
    <div class="monitoring-panel">
      <h3>🔍 Network Monitoring</h3>
      <div class="monitoring-filters">
        <label>
          <input type="checkbox" bind:checked={filters.showEquipment} />
          📡 Network Equipment ({equipment.length})
        </label>
        <label>
          <input type="checkbox" bind:checked={filters.showLabels} />
          🏷️ Show Labels
        </label>
        <label>
          <input type="checkbox" bind:checked={filters.showConnections} />
          🔗 Show Connections
        </label>
      </div>
      
      <div class="device-status">
        <h4>Device Status</h4>
        <div class="status-items">
          <div class="status-item online">
            <span class="status-dot"></span>
            Online: {equipment.filter(e => e.status === 'online').length}
          </div>
          <div class="status-item offline">
            <span class="status-dot"></span>
            Offline: {equipment.filter(e => e.status === 'offline').length}
          </div>
          <div class="status-item unknown">
            <span class="status-dot"></span>
            Unknown: {equipment.filter(e => e.status === 'unknown').length}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Active Alerts Panel - Right Side -->
  <div class="alerts-controls">
    <div class="alerts-panel">
      <div class="alerts-panel-header">
        <h3>🚨 Active Alerts</h3>
        <span class="alerts-count">{alerts.length}</span>
      </div>
      
      <div class="alerts-panel-actions">
        <button class="btn btn-sm btn-secondary" on:click={() => dispatch('refreshData')}>
          🔄 Refresh
        </button>
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
            <div class="no-alerts-subtext">All systems operating normally</div>
          </div>
        {/if}
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
  
  .monitoring-controls {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 1000;
    pointer-events: none;
  }

  .alerts-controls {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1000;
    pointer-events: none;
  }
  
  .monitoring-panel {
    background: var(--card-bg, white);
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid var(--border-color, #e5e7eb);
    pointer-events: auto;
    min-width: 250px;
  }
  
  .monitoring-panel h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary, #111827);
    font-size: 1.1rem;
    font-weight: 600;
  }
  
  .monitoring-panel h4 {
    margin: 1rem 0 0.5rem 0;
    color: var(--text-primary, #111827);
    font-size: 0.9rem;
    font-weight: 600;
  }
  
  .monitoring-filters {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .monitoring-filters label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary, #6b7280);
    cursor: pointer;
  }
  
  .device-status {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color, #e5e7eb);
  }
  
  .status-items {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .status-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  
  .status-item.online .status-dot {
    background: #10b981;
  }
  
  .status-item.offline .status-dot {
    background: #ef4444;
  }
  
  .status-item.unknown .status-dot {
    background: #6b7280;
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

  /* Alerts Panel Styling - Mirror of monitoring panel */
  .alerts-panel {
    background: var(--card-bg, white);
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid var(--border-color, #e5e7eb);
    pointer-events: auto;
    width: 280px;
    max-height: calc(100vh - 140px);
    display: flex;
    flex-direction: column;
  }

  .alerts-panel h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    color: var(--text-primary, #111827);
    font-weight: 600;
  }

  .alerts-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .alerts-count {
    background: #ef4444;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .alerts-panel-actions {
    margin-bottom: 0.75rem;
  }

  .alerts-list {
    flex: 1;
    overflow-y: auto;
    margin: -0.5rem;
    padding: 0.5rem;
  }

  .alert-item {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    border-left: 4px solid transparent;
    transition: all 0.2s ease;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }

  .alert-item.clickable {
    cursor: pointer;
  }

  .alert-item.clickable:hover {
    background: var(--bg-secondary, #f9fafb);
    border-left-width: 6px;
  }

  .alert-item.clickable:focus {
    outline: 2px solid var(--primary, #3b82f6);
    outline-offset: -2px;
  }

  .alert-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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
  }

  .alert-severity.critical {
    color: #ef4444;
  }

  .alert-severity.warning {
    color: #f59e0b;
  }

  .alert-severity.info {
    color: #3b82f6;
  }

  .alert-message {
    font-size: 0.875rem;
    color: var(--text-primary, #111827);
    line-height: 1.4;
  }

  .alert-time {
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
  }

  .alert-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .alert-action-btn {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 4px;
    background: var(--bg-primary, white);
    color: var(--text-secondary, #6b7280);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .alert-action-btn:hover {
    background: var(--bg-secondary, #f9fafb);
    border-color: var(--primary, #3b82f6);
    color: var(--primary, #3b82f6);
  }

  .alert-action-btn.details:hover {
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .alert-action-btn.ticket:hover {
    border-color: #10b981;
    color: #10b981;
  }

  .no-alerts {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-secondary, #6b7280);
  }

  .no-alerts-icon {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .no-alerts-text {
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .no-alerts-subtext {
    font-size: 0.75rem;
    opacity: 0.8;
  }
</style>
