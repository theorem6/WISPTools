<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import MainMenu from './components/MainMenu.svelte';
  import HelpModal from '$lib/components/modals/HelpModal.svelte';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { acsCpeDocs } from '$lib/docs/acs-cpe-docs';
  import { loadCPEDevices, syncCPEDevices as syncCPEDevicesService } from './lib/cpeDataService';
  import { syncACSCPEToInventory } from '$lib/services/acsInventorySync';
  import ACSSetupWizard from '$lib/components/wizards/ACSSetupWizard.svelte';
  import CPEPerformanceModal from './components/CPEPerformanceModal.svelte';
  
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
  let isSyncingInventory = false;
  let inventorySyncMessage = '';
  let showSetupWizard = false;
  
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

  async function handleSyncToInventory() {
    if (!tenantId) {
      inventorySyncMessage = 'Error: No tenant selected';
      return;
    }

    if (cpeDevices.length === 0) {
      inventorySyncMessage = 'Error: No CPE devices to sync. Please sync from GenieACS first.';
      return;
    }

    isSyncingInventory = true;
    inventorySyncMessage = '';
    
    try {
      console.log(`[ACS] Syncing ${cpeDevices.length} CPE devices to inventory for tenant: ${tenantName}`);
      const result = await syncACSCPEToInventory(tenantId, cpeDevices);
      
      if (result.success) {
        inventorySyncMessage = `✅ Success! Created: ${result.created}, Updated: ${result.updated}, Skipped: ${result.skipped}`;
      } else {
        inventorySyncMessage = `⚠️ Completed with errors: ${result.errors.length} failures. Synced: ${result.synced}/${cpeDevices.length}`;
      }
      
      console.log('[ACS] Inventory sync result:', result);
      
      // Clear message after 5 seconds
      setTimeout(() => {
        inventorySyncMessage = '';
      }, 5000);
    } catch (error: any) {
      inventorySyncMessage = `❌ Error: ${error?.message || 'Inventory sync failed'}`;
      console.error('[ACS] Inventory sync error:', error);
    } finally {
      isSyncingInventory = false;
    }
  }

  // Removed loadFallbackSampleData() - no hardcoded test data
  // All CPE devices should come from GenieACS or MongoDB

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
        zoom: 10,
        navigation: {
          mouseWheelZoomEnabled: true // Re-enable mouse wheel zoom
        }
      });

      // Create graphics layer for CPE devices
      const graphicsLayer = new GraphicsLayer();
      map.add(graphicsLayer);

      // Store view and layer for later use
      map._view = view;
      map._graphicsLayer = graphicsLayer;

      // Require modifier key (Ctrl/Cmd) for mouse wheel zoom to prevent accidental zooming
      await view.when();
      if (view.container) {
        view.container.addEventListener('wheel', (event: WheelEvent) => {
          const hasModifier = event.ctrlKey || event.metaKey;
          if (!hasModifier) {
            event.preventDefault();
            event.stopPropagation();
          }
        }, { passive: false });
      }

      // Add click handler to the view (not individual graphics)
      view.on('click', async (event) => {
        const response = await view.hitTest(event);
        if (response.results.length > 0) {
          const graphicHit = response.results.find((result) => {
            return (result as any)?.graphic?.attributes?.device;
          });
          const attributes = (graphicHit as any)?.graphic?.attributes as Record<string, unknown> | undefined;
          const device = attributes?.device as unknown;
          if (device) {
            handleCPEClick(device);
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
            color: device.status === 'Online' ? 'var(--success)' : 'var(--danger)',
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

  // Reactive statements for performance analytics
  $: onlineCount = cpeDevices.filter(d => d.status === 'Online').length;
  $: totalCount = cpeDevices.length;
  $: uptimePercentage = totalCount > 0 ? ((onlineCount / totalCount) * 100).toFixed(0) : '0';

  // Calculate average RSSI from devices (placeholder - would need actual metrics)
  $: averageRSSI = -62.3; // Placeholder - in real implementation would calculate from device metrics
  $: signalQuality = 94.2; // Placeholder - in real implementation would calculate from device metrics
  $: averageUptime = '2.3h'; // Placeholder - in real implementation would calculate from device metrics
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
  <button class="help-button" onclick={() => showHelpModal = true} aria-label="Open Help" title="Help">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  </button>
  
  <!-- Module Header -->
  <div class="module-header">
    <div class="header-content">
      <div class="header-top">
        <a href="/dashboard" class="back-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          ← Back to Dashboard
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
        
        {#if inventorySyncMessage}
          <div class="sync-message {inventorySyncMessage.includes('❌') || inventorySyncMessage.includes('Error') ? 'error' : 'success'}">
            {inventorySyncMessage}
          </div>
        {/if}
        
        <button 
          class="btn btn-primary" 
            onclick={handleSync}
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
          onclick={() => showSetupWizard = true}
          disabled={isLoading}
          title="Configure GenieACS connection and settings"
        >
          ⚙️ Setup ACS
        </button>
        
        <button 
          class="btn btn-primary" 
            onclick={handleSyncToInventory}
          disabled={isLoading || isSyncingInventory || cpeDevices.length === 0}
          title={cpeDevices.length === 0 ? 'Sync from GenieACS first' : 'Sync CPE devices to inventory'}
        >
          {#if isSyncingInventory}
            <span class="spinner"></span>
            Syncing to Inventory...
          {:else}
            📦 Sync to Inventory
          {/if}
        </button>
        
        <button 
          class="btn btn-secondary" 
          onclick={loadDevices}
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
        <button class="btn btn-sm" onclick={() => error = null}>✕</button>
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

    <!-- Performance Analytics Section -->
    <div class="performance-analytics-section">
      <div class="section-header">
        <h3>📊 Performance Analytics</h3>
        <div class="analytics-controls">
          <select class="time-select">
            <option value="1h">Last Hour</option>
            <option value="6h" selected>Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
        </div>
      </div>

      <div class="analytics-content">
        <!-- Performance Summary Cards -->
        <div class="analytics-grid">
          <div class="analytics-card">
            <div class="analytics-icon">📶</div>
            <div class="analytics-metric">
              <div class="metric-value">{averageRSSI} dBm</div>
              <div class="metric-label">Average RSSI</div>
              <div class="metric-trend positive">↗️ +2.1 dBm</div>
            </div>
          </div>

          <div class="analytics-card">
            <div class="analytics-icon">📡</div>
            <div class="analytics-metric">
              <div class="metric-value">{onlineCount}/{totalCount}</div>
              <div class="metric-label">Online CPEs</div>
              <div class="metric-trend positive">{uptimePercentage}% uptime</div>
            </div>
          </div>

          <div class="analytics-card">
            <div class="analytics-icon">⚡</div>
            <div class="analytics-metric">
              <div class="metric-value">{signalQuality}%</div>
              <div class="metric-label">Signal Quality</div>
              <div class="metric-trend positive">↗️ +1.8%</div>
            </div>
          </div>

          <div class="analytics-card">
            <div class="analytics-icon">🔄</div>
            <div class="analytics-metric">
              <div class="metric-value">{averageUptime}</div>
              <div class="metric-label">Avg. Uptime</div>
              <div class="metric-trend neutral">⟷ Stable</div>
            </div>
          </div>
        </div>

        <!-- Performance Charts Placeholder -->
        <div class="performance-charts">
          <div class="chart-placeholder">
            <div class="chart-icon">📈</div>
            <h4>Network Performance Trends</h4>
            <p>Aggregated performance charts across all CPE devices will be displayed here</p>
            <div class="chart-preview">
              <div class="chart-bars">
                <div class="bar" style="height: 60%"></div>
                <div class="bar" style="height: 80%"></div>
                <div class="bar" style="height: 70%"></div>
                <div class="bar" style="height: 90%"></div>
                <div class="bar" style="height: 75%"></div>
                <div class="bar" style="height: 85%"></div>
              </div>
            </div>
          </div>
        </div>
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

      {#if !isLoading && cpeDevices.length === 0}
        <div class="empty-state">
          <h4>No CPE devices yet</h4>
          <p>Connect your GenieACS server and sync devices to populate this list.</p>
          <div class="empty-actions">
            <button class="btn btn-primary" onclick={() => showSetupWizard = true}>
              ⚙️ Run ACS Setup
            </button>
            <button class="btn btn-secondary" onclick={handleSync}>
              🔄 Sync from GenieACS
            </button>
          </div>
        </div>
      {:else}
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
                      onclick={() => handleCPEClick(cpe)}
                    >
                      📊 View Performance
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>

  <!-- CPE Performance Modal -->
  <CPEPerformanceModal
    device={selectedCPE}
    show={showPerformanceModal}
    on:close={closePerformanceModal}
  />
  
  <!-- Help Modal -->
  <HelpModal 
    show={showHelpModal}
    title="ACS CPE Management Help"
    content={helpContent}
    on:close={() => showHelpModal = false}
  />

  {#if showSetupWizard}
    <ACSSetupWizard
      show={showSetupWizard}
      autoStart={true}
      on:close={() => showSetupWizard = false}
      on:complete={() => { showSetupWizard = false; loadDevices(); }}
    />
  {/if}
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
    left: 2rem;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
    z-index: 999;
  }
  
  .help-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5), 0 4px 8px rgba(0, 0, 0, 0.15);
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  }
  
  .help-button:active {
    transform: translateY(0);
  }
  
  .help-button svg {
    width: 24px;
    height: 24px;
    stroke: white;
    fill: none;
    stroke-width: 2.5;
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
    background: var(--success-light);
    border: 1px solid var(--success);
    color: var(--success);
  }

  .sync-message.error {
    background: var(--danger-light);
    border: 1px solid var(--danger);
    color: var(--danger);
  }

  .empty-state {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 12px;
    padding: 1.5rem;
    text-align: center;
    color: #e2e8f0;
  }

  .empty-state h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
  }

  .empty-state p {
    margin: 0 0 1rem 0;
    color: rgba(226, 232, 240, 0.8);
  }

  .empty-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
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

  /* Performance Analytics Styles */
  .performance-analytics-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    overflow: hidden;
    margin-bottom: 2rem;
  }

  .analytics-content {
    padding: 1.5rem;
  }

  .analytics-controls {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .time-select {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .analytics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .analytics-card {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all 0.2s;
  }

  .analytics-card:hover {
    border-color: var(--accent-color);
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
  }

  .analytics-icon {
    font-size: 2.5rem;
    opacity: 0.8;
  }

  .analytics-metric {
    flex: 1;
  }

  .metric-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .metric-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.25rem;
  }

  .metric-trend {
    font-size: 0.75rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .metric-trend.positive {
    color: #10b981;
  }

  .metric-trend.negative {
    color: #ef4444;
  }

  .metric-trend.neutral {
    color: var(--text-secondary);
  }

  .performance-charts {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 2rem;
    text-align: center;
  }

  .chart-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .chart-icon {
    font-size: 3rem;
    opacity: 0.6;
  }

  .chart-placeholder h4 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.25rem;
  }

  .chart-placeholder p {
    margin: 0;
    color: var(--text-secondary);
    max-width: 400px;
  }

  .chart-preview {
    margin-top: 1rem;
    width: 100%;
    max-width: 300px;
  }

  .chart-bars {
    display: flex;
    align-items: end;
    justify-content: center;
    gap: 4px;
    height: 60px;
  }

  .bar {
    width: 20px;
    background: linear-gradient(180deg, var(--accent-color) 0%, rgba(59, 130, 246, 0.6) 100%);
    border-radius: 2px 2px 0 0;
    transition: all 0.3s;
  }

  .bar:nth-child(2n) {
    background: linear-gradient(180deg, #10b981 0%, rgba(16, 185, 129, 0.6) 100%);
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

    .analytics-grid {
      grid-template-columns: 1fr;
    }

    .analytics-card {
      padding: 1rem;
    }

    .metric-value {
      font-size: 1.5rem;
    }

    .performance-charts {
      padding: 1.5rem;
    }
  }
</style>