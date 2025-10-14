<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import MainMenu from './components/MainMenu.svelte';
  import HelpModal from '$lib/components/HelpModal.svelte';
  import TenantGuard from '$lib/components/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { acsCpeDocs } from '$lib/docs/acs-cpe-docs';
  import { loadCPEDevices, syncCPEDevices as syncCPEDevicesService } from './lib/cpeDataService';
  
  // Module data
  let moduleData = {
    title: 'ACS CPE Management',
    description: 'TR-069 device management and CPE monitoring',
    icon: 'device-hub'
  };

  // Component state
  let mapContainer: HTMLDivElement;
  let cpeDevices: any[] = [];
  let selectedCPE: any = null;
  let showPerformanceModal = false;
  let showHelpModal = false;
  let isLoading = true;
  let error: string | null = null;
  let map: any = null;
  let isSyncing = false;
  let syncMessage = '';
  
  // Multi-tenant state - use tenant store
  $: tenantName = $currentTenant?.displayName || 'No Tenant Selected';
  $: tenantId = $currentTenant?.id || '';
  
  // Documentation content
  const helpContent = acsCpeDocs;

  onMount(async () => {
    try {
      if (browser) {
        console.log('[ACS Module] Initializing...');
        console.log('[ACS Module] Tenant:', tenantName);
      }
      
      // Load CPE devices using authenticated multi-tenant service
      await loadDevices();
      
      // Initialize map
      await initializeMap();
      
      isLoading = false;
    } catch (err: any) {
      console.error('[ACS Module] Failed to initialize:', err);
      error = err?.message || 'Failed to initialize';
      isLoading = false;
    }
  });

  onDestroy(() => {
    if (map) {
      map.remove();
    }
  });

  async function loadDevices() {
    try {
      console.log(`Loading devices for tenant: ${tenantName} (${tenantId})`);
      
      // Use multi-tenant authenticated service
      cpeDevices = await loadCPEDevices();
      
      console.log(`Loaded ${cpeDevices.length} devices for tenant ${tenantName}`);
      
      // Show tenant info in console
      if (cpeDevices.length > 0 && cpeDevices[0].tenantId) {
        console.log('✓ Devices are tenant-filtered');
      }
      
    } catch (error: any) {
      console.error('Error loading CPE devices:', error);
      error = error?.message || 'Failed to load devices';
    }
  }

  async function handleSync() {
    isSyncing = true;
    syncMessage = '';
    
    try {
      console.log(`Syncing devices for tenant: ${tenantName}`);
      const result = await syncCPEDevicesService();
      
      if (result.success) {
        syncMessage = result.message;
        cpeDevices = result.devices || [];
        
        // Reinitialize map with new devices
        if (map) {
          await initializeMap();
        }
        
        setTimeout(() => {
          syncMessage = '';
        }, 3000);
      } else {
        syncMessage = `Error: ${result.message}`;
      }
    } catch (error: any) {
      syncMessage = `Error: ${error?.message || 'Sync failed'}`;
    } finally {
      isSyncing = false;
    }
  }

  function loadFallbackSampleData() {
    // Sample CPE devices for demonstration (fallback)
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
        },
        tenantId: tenantId
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
    console.log(`Loaded ${cpeDevices.length} sample CPE devices (fallback)`);
  }

  async function initializeMap() {
    if (!mapContainer) return;

    try {
      // Dynamically import ArcGIS modules
      const [
        { default: Map },
        { default: MapView },
        { default: GraphicsLayer },
        { default: SimpleMarkerSymbol },
        { default: Graphic },
        { default: Point }
      ] = await Promise.all([
        import('@arcgis/core/Map.js'),
        import('@arcgis/core/views/MapView.js'),
        import('@arcgis/core/layers/GraphicsLayer.js'),
        import('@arcgis/core/symbols/SimpleMarkerSymbol.js'),
        import('@arcgis/core/Graphic.js'),
        import('@arcgis/core/geometry/Point.js')
      ]);

      // Check for dark mode
      const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
      const basemap = isDarkMode ? 'dark-gray-vector' : 'streets-navigation-vector';

      // Initialize ArcGIS map
      map = new Map({
        basemap: basemap
      });

      // Create map view
      const view = new MapView({
        container: mapContainer,
        map: map,
        center: [-74.0060, 40.7128], // [longitude, latitude] for New York
        zoom: 10
      });

      // Create graphics layer for CPE devices
      const graphicsLayer = new GraphicsLayer();
      map.add(graphicsLayer);

      // Store view and layer for later use
      map._view = view;
      map._graphicsLayer = graphicsLayer;

      // Add click handler to the view (not individual graphics)
      view.on('click', async (event) => {
        const response = await view.hitTest(event);
        if (response.results.length > 0) {
          const graphic = response.results[0].graphic;
          if (graphic && graphic.attributes && graphic.attributes.device) {
            handleCPEClick(graphic.attributes.device);
          }
        }
      });

      // Add CPE device markers
      await addCPEMarkers();

      console.log('ArcGIS map initialized successfully');
    } catch (err) {
      console.error('Failed to initialize ArcGIS map:', err);
      // Fallback to placeholder if ArcGIS fails
      mapContainer.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          background: var(--bg-tertiary);
          border-radius: 0.5rem;
          text-align: center;
          padding: 2rem;
        ">
          <div style="font-size: 4rem; margin-bottom: 1rem;">🗺️</div>
          <h4 style="margin-bottom: 1rem; color: var(--text-primary);">ArcGIS Map Loading...</h4>
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
            Interactive map with GPS-enabled CPE devices
          </p>
        </div>
      `;
    }
  }

  async function addCPEMarkers() {
    if (!map || !map._graphicsLayer) return;

    try {
      // Import ArcGIS modules
      const [
        { default: Graphic },
        { default: Point },
        { default: SimpleMarkerSymbol }
      ] = await Promise.all([
        import('@arcgis/core/Graphic.js'),
        import('@arcgis/core/geometry/Point.js'),
        import('@arcgis/core/symbols/SimpleMarkerSymbol.js')
      ]);

      // Clear existing graphics
      map._graphicsLayer.removeAll();

      // Add markers for each CPE device
      cpeDevices.forEach(device => {
        if (device.location) {
          // Create symbol based on status
          const symbol = new SimpleMarkerSymbol({
            style: 'circle',
            color: device.status === 'Online' ? '#10b981' : '#ef4444',
            size: '16px',
            outline: {
              color: 'white',
              width: 2
            }
          });

          // Create point geometry
          const point = new Point({
            longitude: device.location.longitude,
            latitude: device.location.latitude
          });

          // Create graphic
          const graphic = new Graphic({
            geometry: point,
            symbol: symbol,
            attributes: {
              id: device.id,
              manufacturer: device.manufacturer,
              status: device.status,
              location: `${device.location.latitude.toFixed(4)}, ${device.location.longitude.toFixed(4)}`,
              lastContact: device.lastContact ? new Date(device.lastContact).toLocaleString() : 'Unknown',
              device: device
            }
          });

          // Note: Click handlers are added to MapView, not Graphics
          map._graphicsLayer.add(graphic);
        }
      });

      // Fit map to show all markers if we have devices
      if (cpeDevices.length > 0 && map._view && map._graphicsLayer.graphics.length > 0) {
        try {
          // Wait for view to be ready before animating
          await map._view.when();
          await map._view.goTo({
            target: map._graphicsLayer.graphics,
            padding: 50
          });
        } catch (goToError) {
          console.warn('Could not animate to markers, skipping:', goToError);
          // Continue without animation - not critical
        }
      }

      console.log(`Added ${cpeDevices.length} CPE markers to ArcGIS map`);
    } catch (err) {
      console.error('Failed to add CPE markers:', err);
    }
  }

  async function refreshCPEData() {
    await loadDevices();
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
  <title>ACS CPE Management - LTE WISP Platform</title>
  <meta name="description" content="TR-069 device management and CPE monitoring with GPS mapping" />
</svelte:head>

<TenantGuard>
<div class="acs-module">
  <!-- Main Navigation -->
  <MainMenu />
  
  <!-- Help Button -->
  <button class="help-button" on:click={() => showHelpModal = true} aria-label="Open Help">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  </button>
  
  <!-- Module Header -->
  <div class="module-header">
    <div class="header-content">
      <div class="header-top">
        <a href="/modules" class="back-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Modules
        </a>
      </div>
      <div class="module-info">
        <h1 class="module-title">
          <span class="module-icon">📡</span>
          {moduleData.title}
        </h1>
        <p class="module-description">{moduleData.description}</p>
        
        <!-- Multi-Tenant Info -->
        {#if tenantName}
          <div class="tenant-badge">
            <span class="tenant-icon">🏢</span>
            <span class="tenant-text">{tenantName}</span>
            <span class="tenant-label">Organization</span>
          </div>
        {/if}
      </div>
      
      <div class="module-actions">
        {#if syncMessage}
          <div class="sync-message {syncMessage.includes('Error') ? 'error' : 'success'}">
            {syncMessage}
          </div>
        {/if}
        
        <button 
          class="btn btn-primary" 
          on:click={handleSync}
          disabled={isLoading || isSyncing}
        >
          {#if isSyncing}
            <span class="spinner"></span>
            Syncing Tenant Devices...
          {:else}
            🔄 Sync Devices from GenieACS
          {/if}
        </button>
        
        <button 
          class="btn btn-secondary" 
          on:click={loadDevices}
          disabled={isLoading || isSyncing}
        >
          🔄 Refresh View
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
      <div class="stat-card tenant-stat">
        <div class="stat-icon">🏢</div>
        <div class="stat-content">
          <div class="stat-number">{tenantName || 'No Tenant'}</div>
          <div class="stat-label">Current Organization</div>
        </div>
      </div>
      
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
        <div bind:this={mapContainer} class="arcgis-map"></div>
        
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
  
  <!-- Help Modal -->
  <HelpModal 
    show={showHelpModal}
    title="ACS CPE Management Help"
    content={helpContent}
    on:close={() => showHelpModal = false}
  />
</div>
</TenantGuard>

<style>
  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
  }

  .back-button:hover {
    color: var(--accent-color);
    background: var(--bg-secondary);
    border-color: var(--accent-color);
  }

  .back-button svg {
    flex-shrink: 0;
  }

  .header-top {
    margin-bottom: 1rem;
  }

  .help-button {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--primary-color);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
    z-index: 999;
  }
  
  .help-button:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }
  
  .help-button svg {
    width: 28px;
    height: 28px;
  }

  .acs-module {
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

  .tenant-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding: 0.5rem 1rem;
    background: rgba(124, 58, 237, 0.1);
    border: 1px solid rgba(124, 58, 237, 0.3);
    border-radius: 0.5rem;
  }

  .tenant-icon {
    font-size: 1.25rem;
  }

  .tenant-text {
    font-weight: 600;
    color: var(--brand-primary);
  }

  .tenant-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
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

  .sync-message {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .sync-message.success {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  .sync-message.error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .stat-card.tenant-stat {
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%);
    border-color: rgba(124, 58, 237, 0.3);
  }

  .stat-card.tenant-stat .stat-number {
    font-size: 1rem;
    font-weight: 600;
    color: var(--brand-primary);
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

  .arcgis-map {
    width: 100%;
    height: 100%;
    border-radius: 0.5rem;
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
