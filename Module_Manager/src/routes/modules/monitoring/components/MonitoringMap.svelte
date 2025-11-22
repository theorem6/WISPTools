<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import CoverageMapView from '../../coverage-map/components/CoverageMapView.svelte';
  import type { TowerSite, Sector, CPEDevice, NetworkEquipment, CoverageMapFilters } from '../../coverage-map/lib/models';
  
  const dispatch = createEventDispatcher();
  
  export let devices = [];
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
  
  // Watch for device changes
  $: if (devices) {
    convertDevicesToEquipment();
  }
</script>

<div class="monitoring-map" style="height: {height};">
  <!-- Monitoring-specific controls overlay -->
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
</style>
