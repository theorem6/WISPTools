<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  
  // Module data
  let moduleData = {
    title: 'GenieACS CPE Management',
    description: 'TR-069 device management and CPE monitoring',
    icon: 'device-hub'
  };

  // Component state
  let mapContainer: HTMLDivElement;
  let cpeDevices: any[] = [];
  let selectedCPE: any = null;
  let showPerformanceModal = false;
  let isLoading = true;
  let error: string | null = null;
  let map: any = null;

  onMount(async () => {
    try {
      // Load sample CPE devices for demonstration
      await loadSampleCPEDevices();
      
      // Initialize map
      await initializeMap();
      
      isLoading = false;
    } catch (err) {
      console.error('Failed to initialize GenieACS module:', err);
      error = err.message;
      isLoading = false;
    }
  });

  onDestroy(() => {
    if (map) {
      map.remove();
    }
  });

  async function loadSampleCPEDevices() {
    // Sample CPE devices for demonstration
    cpeDevices = [
      {
        id: 'nokia-lte-router-001',
        manufacturer: 'Nokia',
        status: 'Online',
        location: {
          latitude: 40.7128,
          longitude: -74.0060
        },
        lastContact: new Date(),
        parameters: {
          SoftwareVersion: '1.2.3',
          HardwareVersion: 'HW-2.1'
        }
      },
      {
        id: 'huawei-lte-cpe-002',
        manufacturer: 'Huawei',
        status: 'Online',
        location: {
          latitude: 40.7589,
          longitude: -73.9851
        },
        lastContact: new Date(),
        parameters: {
          SoftwareVersion: '2.1.0',
          HardwareVersion: 'HW-3.0'
        }
      },
      {
        id: 'zte-lte-modem-003',
        manufacturer: 'ZTE',
        status: 'Offline',
        location: {
          latitude: 40.6892,
          longitude: -74.0445
        },
        lastContact: new Date(Date.now() - 300000), // 5 minutes ago
        parameters: {
          SoftwareVersion: '1.8.2',
          HardwareVersion: 'HW-1.5'
        }
      }
    ];
    console.log(`Loaded ${cpeDevices.length} sample CPE devices`);
  }

  async function initializeMap() {
    if (!mapContainer) return;

    try {
      // Dynamically import Leaflet
      const L = await import('leaflet');
      
      // Initialize map centered on New York area
      map = L.default.map(mapContainer).setView([40.7128, -74.0060], 10);

      // Add OpenStreetMap tiles
      L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      // Add CPE device markers
      addCPEMarkers();

      console.log('Map initialized successfully');
    } catch (err) {
      console.error('Failed to initialize map:', err);
      // Fallback to placeholder if map fails
    }
  }

  function addCPEMarkers() {
    if (!map) return;

    // Clear existing markers
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    // Add markers for each CPE device
    cpeDevices.forEach(device => {
      if (device.location) {
        const L = require('leaflet');
        
        // Create custom icon based on status
        const iconHtml = device.status === 'Online' 
          ? '<div class="cpe-marker online">📡</div>'
          : '<div class="cpe-marker offline">📡</div>';
        
        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-cpe-icon',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        // Create marker
        const marker = L.marker([device.location.latitude, device.location.longitude], {
          icon: customIcon
        });

        // Add popup with device info
        const popupContent = `
          <div class="cpe-popup">
            <h4>${device.manufacturer} - ${device.id}</h4>
            <p><strong>Status:</strong> <span class="status-${device.status.toLowerCase()}">${device.status}</span></p>
            <p><strong>Location:</strong> ${device.location.latitude.toFixed(4)}, ${device.location.longitude.toFixed(4)}</p>
            <p><strong>Last Contact:</strong> ${device.lastContact ? new Date(device.lastContact).toLocaleString() : 'Unknown'}</p>
            <button onclick="window.showCPEPerformance('${device.id}')" class="btn btn-sm btn-primary">View Performance</button>
          </div>
        `;
        
        marker.bindPopup(popupContent);
        marker.addTo(map);

        // Add click handler
        marker.on('click', () => {
          handleCPEClick(device);
        });
      }
    });

    // Fit map to show all markers
    if (cpeDevices.length > 0) {
      const group = new (require('leaflet')).featureGroup();
      cpeDevices.forEach(device => {
        if (device.location) {
          group.addLayer(require('leaflet').marker([device.location.latitude, device.location.longitude]));
        }
      });
      if (group.getLayers().length > 0) {
        map.fitBounds(group.getBounds().pad(0.1));
      }
    }
  }

  async function syncCPEDevices() {
    isLoading = true;
    try {
      // Simulate sync delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadSampleCPEDevices();
      
      // Update map markers
      if (map) {
        addCPEMarkers();
      }
      
      console.log('CPE devices synced successfully');
    } catch (err) {
      console.error('Failed to sync CPE devices:', err);
      error = err.message;
    }
    isLoading = false;
  }

  async function refreshCPEData() {
    await loadSampleCPEDevices();
    if (map) {
      addCPEMarkers();
    }
  }

  function handleCPEClick(cpe: any) {
    selectedCPE = cpe;
    showPerformanceModal = true;
  }

  function closePerformanceModal() {
    showPerformanceModal = false;
    selectedCPE = null;
  }

  // Reactive statements for future map integration
  // $: if (mapInstance && cpeDevices.length > 0) {
  //   mapper.updateCPEDevices(cpeDevices);
  // }
</script>

<svelte:head>
  <title>GenieACS CPE Management - LTE WISP Platform</title>
  <meta name="description" content="TR-069 device management and CPE monitoring with GPS mapping" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</svelte:head>

<div class="genieacs-module">
  <!-- Module Header -->
  <div class="module-header">
    <div class="header-content">
      <div class="module-info">
        <h1 class="module-title">
          <span class="module-icon">📡</span>
          {moduleData.title}
        </h1>
        <p class="module-description">{moduleData.description}</p>
      </div>
      
      <div class="module-actions">
        <button 
          class="btn btn-primary" 
          on:click={syncCPEDevices}
          disabled={isLoading}
        >
          {#if isLoading}
            <span class="spinner"></span>
            Syncing...
          {:else}
            🔄 Sync CPE Devices
          {/if}
        </button>
        
        <button 
          class="btn btn-secondary" 
          on:click={refreshCPEData}
          disabled={isLoading}
        >
          🔄 Refresh Data
        </button>
      </div>
    </div>
  </div>

  <!-- Error Display -->
  {#if error}
    <div class="error-banner">
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <span class="error-message">{error}</span>
        <button class="btn btn-sm" on:click={() => error = null}>✕</button>
      </div>
    </div>
  {/if}

  <!-- Module Content -->
  <div class="module-content">
    <!-- CPE Statistics -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📱</div>
        <div class="stat-content">
          <div class="stat-number">{cpeDevices.length}</div>
          <div class="stat-label">Total CPEs</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">🟢</div>
        <div class="stat-content">
          <div class="stat-number">
            {cpeDevices.filter(d => d.status === 'Online').length}
          </div>
          <div class="stat-label">Online</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">🔴</div>
        <div class="stat-content">
          <div class="stat-number">
            {cpeDevices.filter(d => d.status === 'Offline').length}
          </div>
          <div class="stat-label">Offline</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">📍</div>
        <div class="stat-content">
          <div class="stat-number">
            {cpeDevices.filter(d => d.location).length}
          </div>
          <div class="stat-label">With GPS</div>
        </div>
      </div>
    </div>

    <!-- Map Section Placeholder -->
    <div class="map-section">
      <div class="map-header">
        <h3>CPE Device Map</h3>
        <div class="map-controls">
          <div class="legend">
            <div class="legend-item">
              <span class="legend-color online"></span>
              <span>Online CPEs</span>
            </div>
            <div class="legend-item">
              <span class="legend-color offline"></span>
              <span>Offline CPEs</span>
            </div>
            <div class="legend-item">
              <span class="legend-color error"></span>
              <span>Error CPEs</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="map-container">
        <div bind:this={mapContainer} class="leaflet-map"></div>
        
        {#if isLoading}
          <div class="map-loading">
            <div class="loading-spinner"></div>
            <p>Loading CPE devices and map...</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- CPE Device List -->
    <div class="cpe-list-section">
      <div class="section-header">
        <h3>CPE Device List</h3>
        <div class="list-controls">
          <input 
            type="text" 
            placeholder="Search CPE devices..." 
            class="search-input"
          />
        </div>
      </div>
      
      <div class="cpe-table">
        <table>
          <thead>
            <tr>
              <th>Device ID</th>
              <th>Manufacturer</th>
              <th>Status</th>
              <th>Location</th>
              <th>Last Contact</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each cpeDevices as cpe}
              <tr class="cpe-row" class:online={cpe.status === 'Online'} class:offline={cpe.status === 'Offline'}>
                <td class="device-id">{cpe.id}</td>
                <td class="manufacturer">{cpe.manufacturer}</td>
                <td class="status">
                  <span class="status-badge {cpe.status.toLowerCase()}">
                    {cpe.status}
                  </span>
                </td>
                <td class="location">
                  {#if cpe.location}
                    📍 {cpe.location.latitude.toFixed(4)}, {cpe.location.longitude.toFixed(4)}
                  {:else}
                    No GPS data
                  {/if}
                </td>
                <td class="last-contact">
                  {cpe.lastContact ? new Date(cpe.lastContact).toLocaleString() : 'Unknown'}
                </td>
                <td class="actions">
                  <button 
                    class="btn btn-sm btn-primary"
                    on:click={() => handleCPEClick(cpe)}
                  >
                    📊 View Performance
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- CPE Performance Modal Placeholder -->
  {#if showPerformanceModal && selectedCPE}
    <div class="modal-overlay" on:click={closePerformanceModal}>
      <div class="modal-content" on:click|stopPropagation>
        <div class="modal-header">
          <h3>CPE Performance Data</h3>
          <button class="modal-close" on:click={closePerformanceModal}>✕</button>
        </div>
        <div class="modal-body">
          <div class="cpe-info">
            <h4>{selectedCPE.manufacturer} - {selectedCPE.id}</h4>
            <p><strong>Status:</strong> {selectedCPE.status}</p>
            <p><strong>Last Contact:</strong> {selectedCPE.lastContact ? new Date(selectedCPE.lastContact).toLocaleString() : 'Unknown'}</p>
            {#if selectedCPE.location}
              <p><strong>Location:</strong> {selectedCPE.location.latitude.toFixed(4)}, {selectedCPE.location.longitude.toFixed(4)}</p>
            {/if}
          </div>
          <div class="performance-placeholder">
            <div class="placeholder-icon">📊</div>
            <h4>Performance Analytics Coming Soon</h4>
            <p>Real-time performance metrics and historical data visualization will be available here.</p>
            <div class="metrics-preview">
              <div class="metric">Signal Strength: -45 dBm</div>
              <div class="metric">Data Usage: 2.3 GB</div>
              <div class="metric">Uptime: 99.2%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .genieacs-module {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .module-header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 1.5rem 2rem;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1200px;
    margin: 0 auto;
  }

  .module-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .module-icon {
    font-size: 1.25rem;
  }

  .module-description {
    color: var(--text-secondary);
    margin: 0;
  }

  .module-actions {
    display: flex;
    gap: 1rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.375rem;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--accent-color);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-hover);
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error-banner {
    background: #fee2e2;
    border: 1px solid #fecaca;
    color: #dc2626;
    padding: 1rem 2rem;
    margin: 0 2rem;
    border-radius: 0.375rem;
  }

  .error-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .module-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .stat-icon {
    font-size: 2rem;
  }

  .stat-number {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--accent-color);
  }

  .stat-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .map-section {
    margin-bottom: 2rem;
  }

  .map-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .map-container {
    position: relative;
    height: 500px;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .leaflet-map {
    width: 100%;
    height: 100%;
    border-radius: 0.5rem;
  }

  /* Custom CPE marker styles */
  .cpe-marker {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 2px solid white;
    font-size: 16px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .cpe-marker.online {
    background: #10b981;
    color: white;
  }

  .cpe-marker.offline {
    background: #ef4444;
    color: white;
  }

  .custom-cpe-icon {
    background: transparent !important;
    border: none !important;
  }

  /* Popup styles */
  .cpe-popup {
    font-family: inherit;
    min-width: 200px;
  }

  .cpe-popup h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: var(--text-primary);
  }

  .cpe-popup p {
    margin: 0.25rem 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .status-online {
    color: #10b981;
    font-weight: 600;
  }

  .status-offline {
    color: #ef4444;
    font-weight: 600;
  }

  .btn {
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    cursor: pointer;
    margin-top: 0.5rem;
  }

  .btn-primary {
    background: var(--accent-color);
    color: white;
  }

  .map-loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    z-index: 1000;
  }

  .legend {
    display: flex;
    gap: 1rem;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .legend-color.online {
    background: #10b981;
  }

  .legend-color.offline {
    background: #ef4444;
  }

  .legend-color.error {
    background: #f59e0b;
  }

  .cpe-list-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .section-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .search-input {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .cpe-table {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }

  th {
    background: var(--bg-tertiary);
    font-weight: 600;
    color: var(--text-secondary);
  }

  .cpe-row.online {
    border-left: 3px solid #10b981;
  }

  .cpe-row.offline {
    border-left: 3px solid #ef4444;
  }

  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
  }

  .status-badge.online {
    background: #dcfce7;
    color: #166534;
  }

  .status-badge.offline {
    background: #fee2e2;
    color: #dc2626;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color);
    border-top: 4px solid var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Modal Styles */
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
    background: var(--bg-primary);
    border-radius: 0.5rem;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem;
    border-radius: 0.25rem;
    transition: background-color 0.2s;
  }

  .modal-close:hover {
    background: var(--bg-hover);
  }

  .modal-body {
    padding: 1.5rem;
  }

  .cpe-info {
    margin-bottom: 2rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
  }

  .performance-placeholder {
    text-align: center;
    padding: 2rem;
  }

  .placeholder-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .metrics-preview {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }

  .metric {
    padding: 0.75rem;
    background: var(--bg-tertiary);
    border-radius: 0.25rem;
    font-family: monospace;
    color: var(--text-secondary);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }

    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .map-header {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }

    .section-header {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }
  }
</style>
