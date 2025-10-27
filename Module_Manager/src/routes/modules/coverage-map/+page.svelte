<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import CoverageMapView from './components/CoverageMapView.svelte';
  import FilterPanel from './components/FilterPanel.svelte';
  import AddSiteModal from './components/AddSiteModal.svelte';
  import AddNOCModal from './components/AddNOCModal.svelte';
  import AddWarehouseModal from './components/AddWarehouseModal.svelte';
  import AddVehicleModal from './components/AddVehicleModal.svelte';
  import AddRMAModal from './components/AddRMAModal.svelte';
  import AddSectorModal from './components/AddSectorModal.svelte';
  import SettingsButton from '$lib/components/SettingsButton.svelte';
  import AddCPEModal from './components/AddCPEModal.svelte';
  import AddBackhaulLinkModal from './components/AddBackhaulLinkModal.svelte';
  import AddInventoryModal from './components/AddInventoryModal.svelte';
  import MapContextMenu from './components/MapContextMenu.svelte';
  import TowerActionsMenu from './components/TowerActionsMenu.svelte';
  import EPCDeploymentModal from '../deploy/components/EPCDeploymentModal.svelte';
  import HSSRegistrationModal from './components/HSSRegistrationModal.svelte';
  import { coverageMapService } from './lib/coverageMapService.mongodb';
  import { reportGenerator } from './lib/reportGenerator';
  import type { 
    TowerSite, Sector, CPEDevice, NetworkEquipment, 
    CoverageMapFilters, Location 
  } from './lib/models';
  
  // Data
  let towers: TowerSite[] = [];
  let sectors: Sector[] = [];
  let cpeDevices: CPEDevice[] = [];
  let equipment: NetworkEquipment[] = [];
  
  // UI State
  let isLoading = true;
  let error = '';
  let success = '';
  let showFilters = false;
  let showMainMenu = false;
  let showStats = false;
  let currentBasemap = 'topo-vector';
  
  // Modals
  let showAddSiteModal = false;
  let showAddNOCModal = false;
  let showAddWarehouseModal = false;
  let showAddVehicleModal = false;
  let showAddRMAModal = false;
  let showAddSectorModal = false;
  let showAddCPEModal = false;
  let showAddBackhaulModal = false;
  let showAddInventoryModal = false;
  let showContextMenu = false;
  let showTowerActionsMenu = false;
  let showEPCDeploymentModal = false;
  let showHSSRegistrationModal = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let contextMenuLat = 0;
  let contextMenuLon = 0;
  let selectedSiteForSector: TowerSite | null = null;
  let selectedSiteForBackhaul: TowerSite | null = null;
  let selectedSiteForInventory: TowerSite | null = null;
  let selectedTowerForMenu: TowerSite | null = null;
  let selectedTowerForEPC: TowerSite | null = null;
  let towerMenuX = 0;
  let towerMenuY = 0;
  let initialSiteType: 'tower' | 'noc' | null = null;
  
  // Filters
  let filters: CoverageMapFilters = {
    showTowers: true,
    showSectors: true,
    showCPE: true,
    showEquipment: false,
    showBackhaul: true,
    showFiber: true,
    showWirelessLicensed: true,
    showWirelessUnlicensed: true,
    bandFilters: [],
    statusFilter: [],
    technologyFilter: [],
    locationTypeFilter: []
  };
  
  // References
  let mapComponent: any;
  
  // Tenant info
  $: tenantId = $currentTenant?.id || '';
  $: tenantName = $currentTenant?.displayName || 'Organization';
  
  // Check if stats should be hidden (for plan module)
  $: hideStats = $page.url.searchParams.get('hideStats') === 'true';
  
  onMount(async () => {
    if (tenantId) {
      await loadAllData();
    }
    isLoading = false;
  });
  
  // Watch for tenant changes
  $: if (browser && tenantId) {
    loadAllData();
  }
  
  async function loadAllData() {
    isLoading = true;
    error = '';
    
    try {
      const [
        loadedTowers,
        loadedSectors,
        loadedCPE,
        loadedEquipment
      ] = await Promise.all([
        coverageMapService.getTowerSites(tenantId),
        coverageMapService.getSectors(tenantId),
        coverageMapService.getCPEDevices(tenantId),
        coverageMapService.getEquipment(tenantId)
      ]);
      
      towers = loadedTowers;
      sectors = loadedSectors;
      cpeDevices = loadedCPE;
      equipment = loadedEquipment;
      
      console.log(`Loaded: ${towers.length} towers, ${sectors.length} sectors, ${cpeDevices.length} CPE, ${equipment.length} equipment`);
    } catch (err: any) {
      console.error('Failed to load data:', err);
      error = err.message || 'Failed to load network data';
    } finally {
      isLoading = false;
    }
  }
  
  function handleFiltersChange(event: CustomEvent<CoverageMapFilters>) {
    filters = event.detail;
  }
  
  function changeBasemap(basemapId: string) {
    currentBasemap = basemapId;
    if (mapComponent) {
      mapComponent.changeBasemap(basemapId);
    }
  }
  
  async function handleExportCSV() {
    const report = {
      towers,
      sectors,
      cpeDevices,
      equipment,
      generatedAt: new Date(),
      tenantName
    };
    
    const csv = reportGenerator.generateCSV(report);
    const filename = `network-equipment-${Date.now()}.csv`;
    reportGenerator.downloadCSV(csv, filename);
    
    success = 'Equipment report downloaded as CSV';
    setTimeout(() => success = '', 3000);
  }
  
  async function handleExportPDF() {
    const report = {
      towers,
      sectors,
      cpeDevices,
      equipment,
      generatedAt: new Date(),
      tenantName
    };
    
    const html = reportGenerator.generatePDFHTML(report);
    reportGenerator.printPDF(html);
    
    success = 'Opening PDF print dialog...';
    setTimeout(() => success = '', 3000);
  }
  
  async function handleImportFromCBRS() {
    const result = await coverageMapService.importFromCBRS(tenantId);
    if (result.errors.length > 0) {
      error = result.errors.join(', ');
    } else {
      success = `Imported ${result.imported} devices from CBRS module`;
      await loadAllData();
    }
    setTimeout(() => { error = ''; success = ''; }, 5000);
  }
  
  async function handleImportFromACS() {
    const result = await coverageMapService.importFromACS(tenantId);
    if (result.errors.length > 0) {
      error = result.errors.join(', ');
    } else {
      success = `Imported ${result.imported} devices from ACS module`;
      await loadAllData();
    }
    setTimeout(() => { error = ''; success = ''; }, 5000);
  }
  
  function handleMapRightClick(event: CustomEvent) {
    const { latitude, longitude, screenX, screenY } = event.detail;
    console.log('Right-click at:', latitude, longitude);
    
    // Show context menu
    showContextMenu = true;
    contextMenuX = screenX;
    contextMenuY = screenY;
    contextMenuLat = latitude;
    contextMenuLon = longitude;
  }
  
  function handleContextMenuAction(event: CustomEvent) {
    const { action, latitude, longitude } = event.detail;
    
    contextMenuLat = latitude;
    contextMenuLon = longitude;
    
    switch (action) {
      case 'add-site':
        initialSiteType = 'tower';
        showAddSiteModal = true;
        break;
      case 'add-noc':
        showAddNOCModal = true;
        break;
      case 'add-warehouse':
        showAddWarehouseModal = true;
        break;
      case 'add-vehicle':
        showAddVehicleModal = true;
        break;
      case 'add-rma':
        showAddRMAModal = true;
        break;
      case 'add-cpe':
        showAddCPEModal = true;
        break;
      case 'copy-coords':
        navigator.clipboard.writeText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        success = 'Coordinates copied to clipboard';
        setTimeout(() => success = '', 3000);
        break;
    }
    
    showContextMenu = false;
  }
  
  function handleAssetClick(event: CustomEvent) {
    const { type, id, data, screenX, screenY } = event.detail;
    console.log(`Clicked ${type}:`, id, data);
    
    // Check if this is a read-only item from ACS or CBRS
    if (data.modules?.acs || data.modules?.cbrs) {
      success = `This ${type} is managed by the ${data.modules.acs ? 'ACS' : 'CBRS'} module (read-only)`;
      setTimeout(() => success = '', 5000);
      return;
    }
    
    // Handle tower clicks - show actions menu
    if (type === 'tower') {
      const tower = towers.find(t => t.id === id);
      if (tower) {
        selectedTowerForMenu = tower;
        towerMenuX = screenX;
        towerMenuY = screenY;
        showTowerActionsMenu = true;
      }
    }
  }
  
  function handleTowerAction(event: CustomEvent) {
    const { action, tower } = event.detail;
    
    switch (action) {
      case 'edit-site':
        success = 'Edit functionality coming soon';
        setTimeout(() => success = '', 3000);
        break;
      case 'add-sector':
        selectedSiteForSector = tower;
        showAddSectorModal = true;
        break;
      case 'add-backhaul':
        selectedSiteForBackhaul = tower;
        showAddBackhaulModal = true;
        break;
      case 'add-inventory':
        selectedSiteForInventory = tower;
        showAddInventoryModal = true;
        break;
      case 'view-inventory':
        goto(`/modules/inventory?siteId=${tower.id}&siteName=${encodeURIComponent(tower.name)}`);
        break;
      case 'deploy-epc':
        selectedTowerForEPC = tower;
        showEPCDeploymentModal = true;
        break;
      case 'register-hss':
        selectedTowerForEPC = tower;
        showHSSRegistrationModal = true;
        break;
      case 'view-details':
        success = `Viewing ${tower.name}`;
        setTimeout(() => success = '', 3000);
        break;
      case 'delete-site':
        if (confirm(`Delete ${tower.name}?`)) {
          deleteTowerSite(tower.id);
        }
        break;
    }
  }
  
  async function deleteTowerSite(siteId: string) {
    try {
      await coverageMapService.deleteTowerSite(tenantId, siteId);
      success = 'Tower site deleted';
      setTimeout(() => success = '', 3000);
      await loadAllData();
    } catch (err: any) {
      error = err.message || 'Failed to delete site';
      setTimeout(() => error = '', 5000);
    }
  }
  
  function handleAddSite() {
    contextMenuLat = null;
    contextMenuLon = null;
    showAddSiteModal = true;
  }
  
  function handleAddSector(site: TowerSite | null = null) {
    selectedSiteForSector = site;
    showAddSectorModal = true;
  }
  
  function handleAddCPE() {
    contextMenuLat = null;
    contextMenuLon = null;
    showAddCPEModal = true;
  }
  
  async function handleModalSaved() {
    success = 'Equipment added successfully';
    setTimeout(() => success = '', 3000);
    await loadAllData();
  }
</script>

<TenantGuard>
<div class="fullscreen-map">
  <!-- Full Screen Map -->
  {#if isLoading}
    <div class="loading-overlay">
      <div class="spinner"></div>
      <p>Loading network assets...</p>
    </div>
  {:else}
    <CoverageMapView 
      bind:this={mapComponent}
      {towers}
      {sectors}
      {cpeDevices}
      {equipment}
      {filters}
      on:map-right-click={handleMapRightClick}
      on:asset-click={handleAssetClick}
    />
  {/if}

  <!-- Floating Control Panel -->
  <div class="floating-controls">
    <button class="control-btn" on:click={() => goto('/dashboard')} title="Back to Dashboard">
      ←
    </button>
    <button class="control-btn" on:click={() => showFilters = !showFilters} title="Toggle Filters">
      🔍
    </button>
    <button class="control-btn" on:click={() => showStats = !showStats} title="Toggle Statistics">
      📊
    </button>
    <button class="control-btn main-menu-btn" on:click={() => showMainMenu = !showMainMenu} title="Main Menu">
      ☰
    </button>
  </div>

  <!-- Main Menu Modal -->
  {#if showMainMenu}
  <div class="modal-overlay" on:click={() => showMainMenu = false}>
    <div class="modal-content main-menu-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>🗺️ Coverage Map Controls</h3>
        <button class="close-btn" on:click={() => showMainMenu = false}>✕</button>
      </div>
      
      <div class="modal-body">
        <!-- Basemap Switcher -->
        <div class="menu-section">
          <h4>🗺️ Map View</h4>
          <div class="basemap-switcher">
            <button 
              class="basemap-btn" 
              class:active={currentBasemap === 'streets-vector'}
              on:click={() => changeBasemap('streets-vector')}
            >
              🛣️ Streets
            </button>
            <button 
              class="basemap-btn" 
              class:active={currentBasemap === 'hybrid'}
              on:click={() => changeBasemap('hybrid')}
            >
              🛰️ Satellite
            </button>
            <button 
              class="basemap-btn" 
              class:active={currentBasemap === 'topo-vector'}
              on:click={() => changeBasemap('topo-vector')}
            >
              🗺️ Topographic
            </button>
          </div>
        </div>

        <!-- Add Equipment -->
        <div class="menu-section">
          <h4>➕ Add Equipment</h4>
          <div class="action-grid">
            <button class="action-btn" on:click={handleAddSite}>
              📡 Tower Site
            </button>
            <button class="action-btn" on:click={() => handleAddSector(null)}>
              📶 Sector
            </button>
            <button class="action-btn" on:click={handleAddCPE}>
              📱 CPE Device
            </button>
            <button class="action-btn" on:click={() => showAddNOCModal = true}>
              🏢 NOC
            </button>
            <button class="action-btn" on:click={() => showAddWarehouseModal = true}>
              🏭 Warehouse
            </button>
            <button class="action-btn" on:click={() => showAddVehicleModal = true}>
              🚛 Vehicle
            </button>
          </div>
        </div>

        <!-- Import/Export -->
        <div class="menu-section">
          <h4>📥 Import & Export</h4>
          <div class="action-grid">
            <button class="action-btn" on:click={handleImportFromCBRS}>
              📡 Import from CBRS
            </button>
            <button class="action-btn" on:click={handleImportFromACS}>
              📱 Import from ACS
            </button>
            <button class="action-btn" on:click={handleExportCSV}>
              📊 Export CSV
            </button>
            <button class="action-btn" on:click={handleExportPDF}>
              🖨️ Print PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  {/if}

  <!-- Filters Modal -->
  {#if showFilters}
  <div class="modal-overlay" on:click={() => showFilters = false}>
    <div class="modal-content filters-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>🔍 Map Filters</h3>
        <button class="close-btn" on:click={() => showFilters = false}>✕</button>
      </div>
      <div class="modal-body">
        <FilterPanel {filters} on:change={handleFiltersChange} />
      </div>
    </div>
  </div>
  {/if}

  <!-- Statistics Modal -->
  {#if showStats && !hideStats}
  <div class="modal-overlay" on:click={() => showStats = false}>
    <div class="modal-content stats-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>📊 Network Statistics</h3>
        <button class="close-btn" on:click={() => showStats = false}>✕</button>
      </div>
      <div class="modal-body">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">📡</div>
            <div class="stat-content">
              <div class="stat-value">{towers.length}</div>
              <div class="stat-label">Tower Sites</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">📶</div>
            <div class="stat-content">
              <div class="stat-value">{sectors.length}</div>
              <div class="stat-label">Sectors</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">📱</div>
            <div class="stat-content">
              <div class="stat-value">{cpeDevices.length}</div>
              <div class="stat-label">CPE Devices</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">🔧</div>
            <div class="stat-content">
              <div class="stat-value">{equipment.length}</div>
              <div class="stat-label">Equipment</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  {/if}

  <!-- Messages -->
  {#if error}
    <div class="message-banner error">
      <span>⚠️</span>
      <span>{error}</span>
      <button class="dismiss-btn" on:click={() => error = ''}>✕</button>
    </div>
  {/if}
  
  {#if success}
    <div class="message-banner success">
      <span>✅</span>
      <span>{success}</span>
      <button class="dismiss-btn" on:click={() => success = ''}>✕</button>
    </div>
  {/if}
</div>

<!-- Modals -->
<AddSiteModal 
  bind:show={showAddSiteModal}
  initialLatitude={contextMenuLat}
  initialLongitude={contextMenuLon}
  initialType={initialSiteType}
  {tenantId}
  on:saved={handleModalSaved}
/>

<AddNOCModal 
  bind:show={showAddNOCModal}
  initialLatitude={contextMenuLat}
  initialLongitude={contextMenuLon}
  {tenantId}
  on:saved={handleModalSaved}
/>

<AddWarehouseModal 
  bind:show={showAddWarehouseModal}
  initialLatitude={contextMenuLat}
  initialLongitude={contextMenuLon}
  {tenantId}
  on:saved={handleModalSaved}
/>

<AddVehicleModal 
  bind:show={showAddVehicleModal}
  initialLatitude={contextMenuLat}
  initialLongitude={contextMenuLon}
  {tenantId}
  on:saved={handleModalSaved}
/>

<AddRMAModal 
  bind:show={showAddRMAModal}
  initialLatitude={contextMenuLat}
  initialLongitude={contextMenuLon}
  {tenantId}
  on:saved={handleModalSaved}
/>

<AddSectorModal 
  bind:show={showAddSectorModal}
  sites={towers}
  selectedSite={selectedSiteForSector}
  {tenantId}
  on:saved={handleModalSaved}
/>

<AddCPEModal 
  bind:show={showAddCPEModal}
  sites={towers}
  initialLatitude={contextMenuLat}
  initialLongitude={contextMenuLon}
  {tenantId}
  on:saved={handleModalSaved}
/>

<AddBackhaulLinkModal 
  bind:show={showAddBackhaulModal}
  fromSite={selectedSiteForBackhaul}
  sites={towers}
  {tenantId}
  on:saved={handleModalSaved}
/>

<AddInventoryModal 
  bind:show={showAddInventoryModal}
  site={selectedSiteForInventory}
  {tenantId}
  on:saved={handleModalSaved}
/>

<!-- Context Menus -->
<MapContextMenu 
  bind:show={showContextMenu}
  x={contextMenuX}
  y={contextMenuY}
  latitude={contextMenuLat}
  longitude={contextMenuLon}
  on:action={handleContextMenuAction}
/>

<TowerActionsMenu 
  bind:show={showTowerActionsMenu}
  tower={selectedTowerForMenu}
  x={towerMenuX}
  y={towerMenuY}
  on:action={handleTowerAction}
/>

<!-- EPC Deployment Modal -->
<EPCDeploymentModal
  bind:show={showEPCDeploymentModal}
  tenantId={tenantId}
  siteData={selectedTowerForEPC}
  on:close={() => {
    showEPCDeploymentModal = false;
    selectedTowerForEPC = null;
  }}
/>

<!-- HSS Registration Modal -->
<HSSRegistrationModal
  bind:show={showHSSRegistrationModal}
  tenantId={tenantId}
  siteData={selectedTowerForEPC}
  on:close={() => {
    showHSSRegistrationModal = false;
    selectedTowerForEPC = null;
  }}
/>

<!-- Global Settings Button -->
<SettingsButton />
</TenantGuard>

<style>
  .fullscreen-map {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    background: #000;
    z-index: 1;
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: white;
    z-index: 1000;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(255, 255, 255, 0.2);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .floating-controls {
    position: fixed;
    top: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 100;
  }

  .control-btn {
    width: 50px;
    height: 50px;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
  }

  .control-btn:hover {
    background: rgba(124, 58, 237, 0.8);
    border-color: rgba(124, 58, 237, 0.5);
    transform: scale(1.1);
  }

  .main-menu-btn {
    background: rgba(124, 58, 237, 0.8);
    border-color: rgba(124, 58, 237, 0.5);
  }

  .quick-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }


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
    backdrop-filter: blur(5px);
  }

  .modal-content {
    background: var(--card-bg);
    border-radius: 12px;
    max-width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  .main-menu-modal {
    width: 600px;
  }

  .filters-modal {
    width: 400px;
  }

  .stats-modal {
    width: 500px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h3 {
    margin: 0;
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .modal-body {
    padding: 1.5rem;
  }

  .menu-section {
    margin-bottom: 2rem;
  }

  .menu-section h4 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1.1rem;
  }

  .basemap-switcher {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .basemap-btn {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
  }

  .basemap-btn:hover {
    background: var(--bg-hover);
  }

  .basemap-btn.active {
    background: var(--brand-primary);
    color: white;
    border-color: var(--brand-primary);
  }

  .action-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .action-btn {
    padding: 1rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    font-size: 0.875rem;
  }

  .action-btn:hover {
    background: var(--bg-hover);
    border-color: var(--brand-primary);
    transform: translateY(-2px);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .stat-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .stat-icon {
    font-size: 2rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--brand-primary);
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .message-banner {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 1rem 1.5rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    z-index: 1001;
    max-width: 500px;
    backdrop-filter: blur(10px);
  }

  .message-banner.error {
    background: rgba(239, 68, 68, 0.9);
    color: white;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .message-banner.success {
    background: rgba(34, 197, 94, 0.9);
    color: white;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .dismiss-btn {
    margin-left: auto;
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
    padding: 0.25rem;
    border-radius: 4px;
  }

  .dismiss-btn:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }

  @media (max-width: 768px) {
    .floating-controls {
      top: 10px;
      right: 10px;
    }

    .control-btn {
      width: 45px;
      height: 45px;
      font-size: 1.25rem;
    }

    .main-menu-modal,
    .filters-modal,
    .stats-modal {
      width: 95vw;
      margin: 10px;
    }

    .action-grid {
      grid-template-columns: 1fr;
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }

    .basemap-switcher {
      grid-template-columns: 1fr;
    }
  }
</style>