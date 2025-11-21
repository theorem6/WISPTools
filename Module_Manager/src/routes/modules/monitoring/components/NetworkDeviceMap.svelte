<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  
  const dispatch = createEventDispatcher();
  
  export let devices = [];
  export let showControls = true;
  export let height = '600px';
  
  let mapContainer;
  let map = null;
  let deviceLayers = new Map();
  let selectedDevice = null;
  let showDeviceDetails = false;
  
  // Map configuration
  let mapConfig = {
    center: [39.8283, -98.5795], // Center of USA
    zoom: 4,
    style: 'streets-v11'
  };
  
  // Device type configurations
  const deviceTypeConfig = {
    epc: {
      color: '#10b981', // emerald
      icon: '📡',
      size: 12,
      label: 'EPC'
    },
    mikrotik_router: {
      color: '#3b82f6', // blue
      icon: '🌐',
      size: 10,
      label: 'Router'
    },
    mikrotik_ap: {
      color: '#8b5cf6', // purple
      icon: '📶',
      size: 8,
      label: 'Access Point'
    },
    mikrotik_switch: {
      color: '#f59e0b', // amber
      icon: '🔀',
      size: 8,
      label: 'Switch'
    },
    mikrotik_cpe: {
      color: '#ef4444', // red
      icon: '📱',
      size: 6,
      label: 'CPE'
    },
    mikrotik_lte: {
      color: '#ec4899', // pink
      icon: '📡',
      size: 8,
      label: 'LTE Router'
    },
    unknown: {
      color: '#6b7280', // gray
      icon: '❓',
      size: 6,
      label: 'Unknown'
    }
  };
  
  // Filter and display options
  let filters = {
    showEPCs: true,
    showMikrotik: true,
    showOnline: true,
    showOffline: true,
    showUnknown: true,
    deviceTypes: Object.keys(deviceTypeConfig).reduce((acc, type) => {
      acc[type] = true;
      return acc;
    }, {})
  };
  
  let displayOptions = {
    showLabels: true,
    showConnections: true,
    showSignalStrength: false,
    clusterDevices: true,
    showHeatmap: false
  };
  
  onMount(async () => {
    await initializeMap();
    if (devices.length > 0) {
      updateDeviceMarkers();
    }
  });
  
  // Watch for device changes
  $: if (map && devices) {
    updateDeviceMarkers();
  }
  
  async function initializeMap() {
    try {
      // Initialize Leaflet map (using Leaflet instead of Mapbox for simplicity)
      const L = await import('leaflet');
      
      map = L.map(mapContainer).setView(mapConfig.center, mapConfig.zoom);
      
      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
      
      // Add map event listeners
      map.on('click', handleMapClick);
      map.on('zoomend', handleZoomChange);
      
      console.log('[Network Map] Map initialized');
    } catch (error) {
      console.error('[Network Map] Failed to initialize map:', error);
    }
  }
  
  async function updateDeviceMarkers() {
    if (!map) return;
    
    const L = await import('leaflet');
    
    // Clear existing markers
    deviceLayers.forEach(layer => {
      map.removeLayer(layer);
    });
    deviceLayers.clear();
    
    // Filter devices based on current filters
    const filteredDevices = devices.filter(device => {
      if (!filters.showOnline && device.status === 'online') return false;
      if (!filters.showOffline && device.status === 'offline') return false;
      if (!filters.showUnknown && device.status === 'unknown') return false;
      
      const deviceType = getDeviceType(device);
      if (!filters.deviceTypes[deviceType]) return false;
      
      if (deviceType.startsWith('mikrotik') && !filters.showMikrotik) return false;
      if (deviceType === 'epc' && !filters.showEPCs) return false;
      
      return true;
    });
    
    // Group devices for clustering if enabled
    if (displayOptions.clusterDevices) {
      const markerClusterGroup = L.markerClusterGroup({
        iconCreateFunction: function(cluster) {
          const childCount = cluster.getChildCount();
          let className = 'marker-cluster-';
          
          if (childCount < 10) {
            className += 'small';
          } else if (childCount < 100) {
            className += 'medium';
          } else {
            className += 'large';
          }
          
          return new L.DivIcon({
            html: '<div><span>' + childCount + '</span></div>',
            className: 'marker-cluster ' + className,
            iconSize: new L.Point(40, 40)
          });
        }
      });
      
      filteredDevices.forEach(device => {
        const marker = createDeviceMarker(device, L);
        if (marker) {
          markerClusterGroup.addLayer(marker);
        }
      });
      
      map.addLayer(markerClusterGroup);
      deviceLayers.set('cluster', markerClusterGroup);
    } else {
      // Add individual markers
      filteredDevices.forEach(device => {
        const marker = createDeviceMarker(device, L);
        if (marker) {
          map.addLayer(marker);
          deviceLayers.set(device.id, marker);
        }
      });
    }
    
    // Draw connections if enabled
    if (displayOptions.showConnections) {
      drawDeviceConnections(filteredDevices, L);
    }
    
    // Fit map to show all devices
    if (filteredDevices.length > 0) {
      const group = new L.featureGroup(Array.from(deviceLayers.values()));
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }
  
  function createDeviceMarker(device, L) {
    if (!device.location || !device.location.coordinates) {
      return null;
    }
    
    const { latitude, longitude } = device.location.coordinates;
    if (!latitude || !longitude) return null;
    
    const deviceType = getDeviceType(device);
    const config = deviceTypeConfig[deviceType] || deviceTypeConfig.unknown;
    
    // Create custom icon
    const iconHtml = `
      <div class="device-marker ${device.status}" style="background-color: ${config.color}">
        <span class="device-icon">${config.icon}</span>
        ${displayOptions.showLabels ? `<span class="device-label">${device.name || device.id}</span>` : ''}
      </div>
    `;
    
    const icon = L.divIcon({
      html: iconHtml,
      className: 'custom-device-marker',
      iconSize: [config.size * 2, config.size * 2],
      iconAnchor: [config.size, config.size]
    });
    
    const marker = L.marker([latitude, longitude], { icon })
      .bindPopup(createDevicePopup(device))
      .on('click', () => selectDevice(device));
    
    return marker;
  }
  
  function createDevicePopup(device) {
    const deviceType = getDeviceType(device);
    const config = deviceTypeConfig[deviceType] || deviceTypeConfig.unknown;
    
    let metricsHtml = '';
    if (device.metrics) {
      metricsHtml = `
        <div class="device-metrics">
          ${device.metrics.cpuUsage ? `<div>CPU: ${device.metrics.cpuUsage.toFixed(1)}%</div>` : ''}
          ${device.metrics.memoryUsage ? `<div>Memory: ${device.metrics.memoryUsage.toFixed(1)}%</div>` : ''}
          ${device.metrics.activeUsers ? `<div>Users: ${device.metrics.activeUsers}</div>` : ''}
          ${device.metrics.signalStrength ? `<div>Signal: ${device.metrics.signalStrength} dBm</div>` : ''}
        </div>
      `;
    }
    
    return `
      <div class="device-popup">
        <div class="device-popup-header">
          <span class="device-popup-icon">${config.icon}</span>
          <div>
            <h4>${device.name || device.id}</h4>
            <span class="device-type">${config.label}</span>
          </div>
          <span class="status-badge ${device.status}">${device.status}</span>
        </div>
        <div class="device-popup-details">
          <div><strong>IP:</strong> ${device.ipAddress || 'Unknown'}</div>
          ${device.location?.address ? `<div><strong>Location:</strong> ${device.location.address}</div>` : ''}
          ${device.lastSeen ? `<div><strong>Last Seen:</strong> ${new Date(device.lastSeen).toLocaleString()}</div>` : ''}
          ${metricsHtml}
        </div>
        <div class="device-popup-actions">
          <button onclick="window.viewDeviceDetails('${device.id}')">View Details</button>
          ${device.type === 'mikrotik' ? `<button onclick="window.configureDevice('${device.id}')">Configure</button>` : ''}
        </div>
      </div>
    `;
  }
  
  function drawDeviceConnections(devices, L) {
    // This is a simplified connection drawing - in a real implementation,
    // you would use network topology data to determine actual connections
    
    const epcs = devices.filter(d => getDeviceType(d) === 'epc');
    const routers = devices.filter(d => getDeviceType(d) === 'mikrotik_router');
    const aps = devices.filter(d => getDeviceType(d) === 'mikrotik_ap');
    
    // Draw connections from EPCs to nearest routers
    epcs.forEach(epc => {
      const nearestRouter = findNearestDevice(epc, routers);
      if (nearestRouter) {
        drawConnection(epc, nearestRouter, L, '#10b981', 2);
      }
    });
    
    // Draw connections from routers to APs
    routers.forEach(router => {
      const nearbyAPs = aps.filter(ap => 
        calculateDistance(router.location.coordinates, ap.location.coordinates) < 50 // 50km radius
      );
      
      nearbyAPs.forEach(ap => {
        drawConnection(router, ap, L, '#3b82f6', 1);
      });
    });
  }
  
  function drawConnection(device1, device2, L, color = '#6b7280', weight = 1) {
    if (!device1.location?.coordinates || !device2.location?.coordinates) return;
    
    const latlngs = [
      [device1.location.coordinates.latitude, device1.location.coordinates.longitude],
      [device2.location.coordinates.latitude, device2.location.coordinates.longitude]
    ];
    
    const polyline = L.polyline(latlngs, {
      color: color,
      weight: weight,
      opacity: 0.6,
      dashArray: weight === 1 ? '5, 5' : null
    }).addTo(map);
    
    deviceLayers.set(`connection-${device1.id}-${device2.id}`, polyline);
  }
  
  function findNearestDevice(device, candidates) {
    if (!device.location?.coordinates || candidates.length === 0) return null;
    
    let nearest = null;
    let minDistance = Infinity;
    
    candidates.forEach(candidate => {
      if (candidate.location?.coordinates) {
        const distance = calculateDistance(
          device.location.coordinates,
          candidate.location.coordinates
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearest = candidate;
        }
      }
    });
    
    return nearest;
  }
  
  function calculateDistance(coord1, coord2) {
    // Haversine formula for calculating distance between two coordinates
    const R = 6371; // Earth's radius in km
    const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
    const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1.latitude * Math.PI / 180) * Math.cos(coord2.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  function getDeviceType(device) {
    if (device.type === 'epc') return 'epc';
    if (device.type === 'mikrotik') {
      return `mikrotik_${device.deviceType || 'router'}`;
    }
    return 'unknown';
  }
  
  function selectDevice(device) {
    selectedDevice = device;
    showDeviceDetails = true;
    dispatch('deviceSelected', device);
  }
  
  function handleMapClick(e) {
    // Deselect device when clicking on empty map
    selectedDevice = null;
    showDeviceDetails = false;
  }
  
  function handleZoomChange(e) {
    // Adjust marker sizes based on zoom level
    const zoom = map.getZoom();
    const scale = Math.max(0.5, Math.min(2, zoom / 10));
    
    // Update marker sizes (implementation would depend on marker library)
  }
  
  function toggleFilter(filterType, value) {
    if (filterType === 'deviceType') {
      filters.deviceTypes[value] = !filters.deviceTypes[value];
    } else {
      filters[filterType] = !filters[filterType];
    }
    updateDeviceMarkers();
  }
  
  function toggleDisplayOption(option) {
    displayOptions[option] = !displayOptions[option];
    updateDeviceMarkers();
  }
  
  // Export functions for popup buttons
  if (typeof window !== 'undefined') {
    window.viewDeviceDetails = (deviceId) => {
      const device = devices.find(d => d.id === deviceId);
      if (device) {
        dispatch('viewDeviceDetails', device);
      }
    };
    
    window.configureDevice = (deviceId) => {
      const device = devices.find(d => d.id === deviceId);
      if (device) {
        dispatch('configureDevice', device);
      }
    };
  }
</script>

<div class="network-map-container" style="height: {height}">
  <!-- Map Controls -->
  {#if showControls}
    <div class="map-controls">
      <div class="control-panel">
        <div class="control-section">
          <h4>Device Filters</h4>
          <div class="filter-group">
            <label>
              <input type="checkbox" bind:checked={filters.showEPCs} on:change={() => updateDeviceMarkers()} />
              📡 EPCs ({devices.filter(d => getDeviceType(d) === 'epc').length})
            </label>
            <label>
              <input type="checkbox" bind:checked={filters.showMikrotik} on:change={() => updateDeviceMarkers()} />
              🌐 Mikrotik ({devices.filter(d => d.type === 'mikrotik').length})
            </label>
          </div>
          
          <div class="filter-group">
            <label>
              <input type="checkbox" bind:checked={filters.showOnline} on:change={() => updateDeviceMarkers()} />
              🟢 Online ({devices.filter(d => d.status === 'online').length})
            </label>
            <label>
              <input type="checkbox" bind:checked={filters.showOffline} on:change={() => updateDeviceMarkers()} />
              🔴 Offline ({devices.filter(d => d.status === 'offline').length})
            </label>
          </div>
        </div>
        
        <div class="control-section">
          <h4>Display Options</h4>
          <div class="filter-group">
            <label>
              <input type="checkbox" bind:checked={displayOptions.showLabels} on:change={() => updateDeviceMarkers()} />
              Show Labels
            </label>
            <label>
              <input type="checkbox" bind:checked={displayOptions.showConnections} on:change={() => updateDeviceMarkers()} />
              Show Connections
            </label>
            <label>
              <input type="checkbox" bind:checked={displayOptions.clusterDevices} on:change={() => updateDeviceMarkers()} />
              Cluster Devices
            </label>
          </div>
        </div>
        
        <div class="control-section">
          <h4>Legend</h4>
          <div class="legend">
            {#each Object.entries(deviceTypeConfig) as [type, config]}
              <div class="legend-item">
                <span class="legend-icon" style="color: {config.color}">{config.icon}</span>
                <span class="legend-label">{config.label}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Map Container -->
  <div class="map" bind:this={mapContainer}></div>
  
  <!-- Device Details Panel -->
  {#if showDeviceDetails && selectedDevice}
    <div class="device-details-panel">
      <div class="panel-header">
        <h3>{selectedDevice.name || selectedDevice.id}</h3>
        <button class="close-btn" on:click={() => showDeviceDetails = false}>✕</button>
      </div>
      
      <div class="panel-content">
        <div class="device-info">
          <div class="info-row">
            <label>Type:</label>
            <span>{deviceTypeConfig[getDeviceType(selectedDevice)]?.label || 'Unknown'}</span>
          </div>
          <div class="info-row">
            <label>Status:</label>
            <span class="status-badge {selectedDevice.status}">{selectedDevice.status}</span>
          </div>
          <div class="info-row">
            <label>IP Address:</label>
            <span>{selectedDevice.ipAddress || 'Unknown'}</span>
          </div>
          {#if selectedDevice.location?.address}
            <div class="info-row">
              <label>Location:</label>
              <span>{selectedDevice.location.address}</span>
            </div>
          {/if}
          {#if selectedDevice.lastSeen}
            <div class="info-row">
              <label>Last Seen:</label>
              <span>{new Date(selectedDevice.lastSeen).toLocaleString()}</span>
            </div>
          {/if}
        </div>
        
        {#if selectedDevice.metrics}
          <div class="device-metrics">
            <h4>Current Metrics</h4>
            {#if selectedDevice.metrics.cpuUsage}
              <div class="metric-row">
                <label>CPU Usage:</label>
                <div class="metric-bar">
                  <div class="metric-fill" style="width: {selectedDevice.metrics.cpuUsage}%"></div>
                  <span>{selectedDevice.metrics.cpuUsage.toFixed(1)}%</span>
                </div>
              </div>
            {/if}
            {#if selectedDevice.metrics.memoryUsage}
              <div class="metric-row">
                <label>Memory Usage:</label>
                <div class="metric-bar">
                  <div class="metric-fill" style="width: {selectedDevice.metrics.memoryUsage}%"></div>
                  <span>{selectedDevice.metrics.memoryUsage.toFixed(1)}%</span>
                </div>
              </div>
            {/if}
            {#if selectedDevice.metrics.activeUsers}
              <div class="metric-row">
                <label>Active Users:</label>
                <span>{selectedDevice.metrics.activeUsers}</span>
              </div>
            {/if}
          </div>
        {/if}
        
        <div class="panel-actions">
          <button class="btn btn-primary" on:click={() => dispatch('viewDeviceDetails', selectedDevice)}>
            View Full Details
          </button>
          {#if selectedDevice.type === 'mikrotik'}
            <button class="btn btn-secondary" on:click={() => dispatch('configureDevice', selectedDevice)}>
              Configure Device
            </button>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .network-map-container {
    position: relative;
    width: 100%;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border-color, #e5e7eb);
  }
  
  .map {
    width: 100%;
    height: 100%;
    background: var(--bg-secondary, #f9fafb);
  }
  
  .map-controls {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 1000;
    background: var(--card-bg, white);
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    max-width: 300px;
  }
  
  .control-panel {
    padding: 1rem;
  }
  
  .control-section {
    margin-bottom: 1.5rem;
  }
  
  .control-section:last-child {
    margin-bottom: 0;
  }
  
  .control-section h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
  }
  
  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .filter-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-primary, #111827);
    cursor: pointer;
  }
  
  .filter-group input[type="checkbox"] {
    margin: 0;
  }
  
  .legend {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }
  
  .legend-icon {
    font-size: 1rem;
  }
  
  .legend-label {
    color: var(--text-primary, #111827);
  }
  
  .device-details-panel {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 300px;
    background: var(--card-bg, white);
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 1000;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }
  
  .panel-header h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-primary, #111827);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: var(--text-secondary, #6b7280);
    padding: 0.25rem;
    border-radius: 4px;
  }
  
  .close-btn:hover {
    background: var(--bg-hover, #f3f4f6);
  }
  
  .panel-content {
    padding: 1rem;
  }
  
  .device-info {
    margin-bottom: 1rem;
  }
  
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0;
    font-size: 0.875rem;
  }
  
  .info-row label {
    font-weight: 500;
    color: var(--text-secondary, #6b7280);
  }
  
  .status-badge {
    padding: 0.125rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
  }
  
  .status-badge.online {
    background: rgba(34, 197, 94, 0.1);
    color: #166534;
  }
  
  .status-badge.offline {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }
  
  .status-badge.unknown {
    background: rgba(107, 114, 128, 0.1);
    color: #374151;
  }
  
  .device-metrics {
    margin-bottom: 1rem;
  }
  
  .device-metrics h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
  }
  
  .metric-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }
  
  .metric-row label {
    font-weight: 500;
    color: var(--text-secondary, #6b7280);
  }
  
  .metric-bar {
    position: relative;
    width: 100px;
    height: 16px;
    background: var(--bg-secondary, #f3f4f6);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .metric-fill {
    height: 100%;
    background: var(--primary, #3b82f6);
    transition: width 0.3s ease;
  }
  
  .metric-bar span {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-primary, #111827);
  }
  
  .panel-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--primary, #3b82f6);
    color: white;
  }
  
  .btn-primary:hover {
    background: #2563eb;
  }
  
  .btn-secondary {
    background: var(--bg-tertiary, #6b7280);
    color: white;
  }
  
  .btn-secondary:hover {
    background: #4b5563;
  }
  
  /* Global styles for map markers */
  :global(.custom-device-marker) {
    background: transparent !important;
    border: none !important;
  }
  
  :global(.device-marker) {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    cursor: pointer;
    transition: all 0.2s;
  }
  
  :global(.device-marker:hover) {
    transform: scale(1.1);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }
  
  :global(.device-marker.offline) {
    opacity: 0.6;
    filter: grayscale(50%);
  }
  
  :global(.device-icon) {
    font-size: 0.875rem;
  }
  
  :global(.device-label) {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 0.125rem 0.25rem;
    border-radius: 3px;
    font-size: 0.75rem;
    white-space: nowrap;
    margin-top: 2px;
  }
  
  /* Leaflet popup styles */
  :global(.leaflet-popup-content) {
    margin: 0 !important;
  }
  
  :global(.device-popup) {
    min-width: 250px;
  }
  
  :global(.device-popup-header) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e5e7eb;
  }
  
  :global(.device-popup-icon) {
    font-size: 1.25rem;
  }
  
  :global(.device-popup-header h4) {
    margin: 0;
    font-size: 1rem;
  }
  
  :global(.device-type) {
    font-size: 0.75rem;
    color: #6b7280;
  }
  
  :global(.device-popup-details) {
    margin-bottom: 1rem;
  }
  
  :global(.device-popup-details > div) {
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
  }
  
  :global(.device-metrics) {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #e5e7eb;
  }
  
  :global(.device-popup-actions) {
    display: flex;
    gap: 0.5rem;
  }
  
  :global(.device-popup-actions button) {
    flex: 1;
    padding: 0.5rem;
    border: none;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
    background: #3b82f6;
    color: white;
  }
  
  :global(.device-popup-actions button:hover) {
    background: #2563eb;
  }
</style>
