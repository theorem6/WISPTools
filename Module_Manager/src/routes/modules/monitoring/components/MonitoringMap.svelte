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

        <!-- Display Options -->
        <div class="monitoring-filters">
          <h4>Display Options</h4>
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

        <!-- Device Status Summary -->
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
    border-radius: var(--radius-lg);
    padding: var(--spacing-lg);
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--color-border);
    pointer-events: auto;
    width: 320px;
    max-height: calc(100vh - 60px);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-sm);
  }
  
  .section-header h3 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
  }

  .refresh-btn {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition: var(--transition-duration-normal) var(--transition-timing-ease-in-out);
    color: var(--color-text-secondary);
  }

  .refresh-btn:hover {
    background: var(--color-background-secondary);
    color: var(--color-text-primary);
  }
  
  .combined-panel h4 {
    margin: var(--spacing-md) 0 var(--spacing-sm) 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
  }

  /* Status Section */
  .status-section {
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--color-border);
  }

  .status-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-sm);
  }

  .status-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    background: var(--color-background-primary);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-sm);
    transition: var(--transition-duration-normal) var(--transition-timing-ease-in-out);
  }

  .status-card:hover {
    box-shadow: var(--shadow-md);
  }

  .status-card.critical {
    border-left: 3px solid var(--color-danger);
  }

  .status-card.warning {
    border-left: 3px solid var(--color-warning);
  }

  .status-card.success {
    border-left: 3px solid var(--color-success);
  }

  .status-card.info {
    border-left: 3px solid var(--color-info);
  }

  .status-icon {
    font-size: var(--font-size-base);
    flex-shrink: 0;
  }

  .status-content {
    flex: 1;
    min-width: 0;
  }

  .status-value {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    line-height: var(--line-height-tight);
  }

  .status-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    font-weight: var(--font-weight-medium);
    margin-top: var(--spacing-xs);
  }
  
  .monitoring-filters {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
  }
  
  .monitoring-filters label {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: var(--transition-duration-normal) var(--transition-timing-ease-in-out);
  }

  .monitoring-filters label:hover {
    color: var(--color-text-primary);
  }

  .monitoring-filters input[type="checkbox"] {
    accent-color: var(--color-primary);
  }
  
  .device-status {
    margin-top: var(--spacing-md);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--color-border);
  }
  
  .status-items {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }
  
  .status-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }
  
  .status-item.online .status-dot {
    background: var(--color-success);
  }
  
  .status-item.offline .status-dot {
    background: var(--color-danger);
  }
  
  .status-item.unknown .status-dot {
    background: var(--color-text-tertiary);
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
    border-top: 1px solid var(--color-border);
    padding-top: var(--spacing-md);
  }

  .alerts-count {
    background: var(--color-danger);
    color: var(--color-text-inverse);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-full);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
  }

  .alerts-list {
    max-height: 300px;
    overflow-y: auto;
    margin: var(--spacing-sm) 0;
  }

  .alert-item {
    padding: var(--spacing-sm);
    border-bottom: 1px solid var(--color-border);
    border-left: 4px solid transparent;
    transition: var(--transition-duration-normal) var(--transition-timing-ease-in-out);
    border-radius: var(--radius-sm);
    margin-bottom: var(--spacing-sm);
    background: var(--color-background-primary);
  }

  .alert-item.clickable {
    cursor: pointer;
  }

  .alert-item.clickable:hover {
    background: var(--color-background-secondary);
    border-left-width: 6px;
    box-shadow: var(--shadow-sm);
  }

  .alert-item.clickable:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  .alert-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .alert-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .alert-severity {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
  }

  .alert-severity.critical {
    color: var(--color-danger);
  }

  .alert-severity.warning {
    color: var(--color-warning);
  }

  .alert-severity.info {
    color: var(--color-info);
  }

  .alert-message {
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
    line-height: var(--line-height-normal);
  }

  .alert-time {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  .alert-actions {
    display: flex;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-xs);
  }

  .alert-action-btn {
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-background-primary);
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: var(--transition-duration-normal) var(--transition-timing-ease-in-out);
  }

  .alert-action-btn:hover {
    background: var(--color-background-secondary);
    border-color: var(--color-primary);
    color: var(--color-primary);
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
    padding: var(--spacing-xl) var(--spacing-md);
    text-align: center;
    color: var(--color-text-secondary);
  }

  .no-alerts-icon {
    font-size: var(--font-size-xl);
    margin-bottom: var(--spacing-sm);
  }

  .no-alerts-text {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    margin-bottom: var(--spacing-xs);
    color: var(--color-text-primary);
  }
</style>
