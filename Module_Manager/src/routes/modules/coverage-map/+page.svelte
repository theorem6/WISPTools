<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/TenantGuard.svelte';
  import CoverageMapView from './components/CoverageMapView.svelte';
  import FilterPanel from './components/FilterPanel.svelte';
  import AddSiteModal from './components/AddSiteModal.svelte';
  import AddSectorModal from './components/AddSectorModal.svelte';
  import AddCPEModal from './components/AddCPEModal.svelte';
  import AddBackhaulLinkModal from './components/AddBackhaulLinkModal.svelte';
  import MapContextMenu from './components/MapContextMenu.svelte';
  import TowerActionsMenu from './components/TowerActionsMenu.svelte';
  import { coverageMapService } from './lib/coverageMapService.mongodb';  // Backend API via hssProxy
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
  let showFilters = true;
  let currentBasemap = 'streets-navigation-vector';
  
  // Modals
  let showAddSiteModal = false;
  let showAddSectorModal = false;
  let showAddCPEModal = false;
  let showAddBackhaulModal = false;
  let showContextMenu = false;
  let showTowerActionsMenu = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let contextMenuLat = 0;
  let contextMenuLon = 0;
  let selectedSiteForSector: TowerSite | null = null;
  let selectedSiteForBackhaul: TowerSite | null = null;
  let selectedTowerForMenu: TowerSite | null = null;
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
    
    switch (action) {
      case 'add-site':
        initialSiteType = 'tower';
        showAddSiteModal = true;
        contextMenuLat = latitude;
        contextMenuLon = longitude;
        break;
      case 'add-noc':
        initialSiteType = 'noc';
        showAddSiteModal = true;
        contextMenuLat = latitude;
        contextMenuLon = longitude;
        break;
      case 'add-cpe':
        showAddCPEModal = true;
        contextMenuLat = latitude;
        contextMenuLon = longitude;
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
    
    // TODO: Handle sector and CPE clicks
  }
  
  function handleTowerAction(event: CustomEvent) {
    const { action, tower } = event.detail;
    
    switch (action) {
      case 'edit-site':
        // TODO: Open edit modal
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
      case 'view-details':
        // TODO: Open details view
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
<div class="coverage-map-page">
  <!-- Header -->
  <div class="page-header">
    <div class="header-left">
      <button class="back-button" on:click={() => goto('/dashboard')}>
        ← Back to Dashboard
      </button>
      <div>
        <h1>🗺️ Coverage Map</h1>
        <p class="subtitle">{tenantName} - Comprehensive Network Asset View</p>
      </div>
    </div>
    
    <div class="header-actions">
      <!-- Basemap Switcher -->
      <div class="basemap-switcher">
        <button 
          class="basemap-btn" 
          class:active={currentBasemap === 'streets-navigation-vector'}
          on:click={() => changeBasemap('streets-navigation-vector')}
          title="Streets View"
        >
          🛣️
        </button>
        <button 
          class="basemap-btn" 
          class:active={currentBasemap === 'hybrid'}
          on:click={() => changeBasemap('hybrid')}
          title="Satellite View"
        >
          🛰️
        </button>
        <button 
          class="basemap-btn" 
          class:active={currentBasemap === 'topo-vector'}
          on:click={() => changeBasemap('topo-vector')}
          title="Topographic View"
        >
          🗺️
        </button>
      </div>
      
      <!-- Add Equipment Actions -->
      <div class="dropdown">
        <button class="btn-primary">
          ➕ Add Equipment
        </button>
        <div class="dropdown-content">
          <button on:click={handleAddSite}>
            📡 Add Tower Site
          </button>
          <button on:click={() => handleAddSector(null)}>
            📶 Add Sector
          </button>
          <button on:click={handleAddCPE}>
            📱 Add CPE Device
          </button>
        </div>
      </div>
      
      <!-- Actions -->
      <button class="btn-secondary" on:click={() => showFilters = !showFilters}>
        {showFilters ? '✕' : '🔍'} Filters
      </button>
      
      <div class="dropdown">
        <button class="btn-secondary">
          📥 Import
        </button>
        <div class="dropdown-content">
          <button on:click={handleImportFromCBRS}>Import from CBRS</button>
          <button on:click={handleImportFromACS}>Import from ACS</button>
        </div>
      </div>
      
      <div class="dropdown">
        <button class="btn-secondary">
          📊 Export Report
        </button>
        <div class="dropdown-content">
          <button on:click={handleExportCSV}>Download CSV</button>
          <button on:click={handleExportPDF}>Print PDF</button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Messages -->
  {#if error}
    <div class="alert alert-error">
      <span>⚠️</span>
      <span>{error}</span>
      <button class="dismiss-btn" on:click={() => error = ''}>✕</button>
    </div>
  {/if}
  
  {#if success}
    <div class="alert alert-success">
      <span>✅</span>
      <span>{success}</span>
      <button class="dismiss-btn" on:click={() => success = ''}>✕</button>
    </div>
  {/if}
  
  <!-- Statistics Bar -->
  <div class="stats-bar">
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
  
  <!-- Main Content -->
  {#if isLoading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading network assets...</p>
    </div>
  {:else}
    <div class="map-layout">
      <!-- Filter Panel -->
      {#if showFilters}
        <aside class="filters-sidebar">
          <FilterPanel {filters} on:change={handleFiltersChange} />
        </aside>
      {/if}
      
      <!-- Map -->
      <main class="map-main" class:full-width={!showFilters}>
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
      </main>
    </div>
  {/if}
  
  <!-- Modals -->
  <AddSiteModal 
    bind:show={showAddSiteModal}
    initialLatitude={contextMenuLat}
    initialLongitude={contextMenuLon}
    initialType={initialSiteType}
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
</div>
</TenantGuard>

<style>
  .coverage-map-page {
    min-height: 100vh;
    background: var(--bg-primary);
    padding: 2rem;
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .header-left {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .back-button {
    background: none;
    border: 1px solid var(--border-color);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--text-secondary);
    width: fit-content;
    transition: all 0.2s;
  }
  
  .back-button:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--brand-primary);
  }
  
  h1 {
    font-size: 2rem;
    margin: 0;
    color: var(--text-primary);
  }
  
  .subtitle {
    color: var(--text-secondary);
    margin: 0;
  }
  
  .header-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }
  
  .basemap-switcher {
    display: flex;
    gap: 0.25rem;
    background: var(--card-bg);
    padding: 0.25rem;
    border-radius: 6px;
    border: 1px solid var(--border-color);
  }
  
  .basemap-btn {
    background: none;
    border: none;
    padding: 0.5rem 0.75rem;
    font-size: 1.25rem;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .basemap-btn:hover {
    background: var(--bg-hover);
  }
  
  .basemap-btn.active {
    background: var(--brand-primary);
  }
  
  .btn-primary, .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--brand-primary);
    color: white;
  }
  
  .btn-primary:hover {
    background: var(--brand-primary-hover);
    transform: translateY(-2px);
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }
  
  .dropdown {
    position: relative;
  }
  
  .dropdown-content {
    display: none;
    position: absolute;
    right: 0;
    top: 100%;
    margin-top: 0.5rem;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    min-width: 200px;
    z-index: 100;
  }
  
  .dropdown:hover .dropdown-content {
    display: block;
  }
  
  .dropdown-content button {
    display: block;
    width: 100%;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    color: var(--text-primary);
    transition: background 0.2s;
  }
  
  .dropdown-content button:hover {
    background: var(--bg-hover);
  }
  
  .alert {
    padding: 1rem 1.5rem;
    border-radius: 6px;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }
  
  .alert-success {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }
  
  .dismiss-btn {
    margin-left: auto;
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
  }
  
  .dismiss-btn:hover {
    opacity: 1;
  }
  
  .stats-bar {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .stat-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .stat-icon {
    font-size: 2.5rem;
  }
  
  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--brand-primary);
  }
  
  .stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    gap: 1rem;
  }
  
  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(124, 58, 237, 0.2);
    border-top-color: var(--brand-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .map-layout {
    display: flex;
    gap: 1rem;
    height: calc(100vh - 400px);
    min-height: 600px;
  }
  
  .filters-sidebar {
    width: 300px;
    flex-shrink: 0;
  }
  
  .map-main {
    flex: 1;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .map-main.full-width {
    width: 100%;
  }
  
  @media (max-width: 1024px) {
    .coverage-map-page {
      padding: 1rem;
    }
    
    .page-header {
      flex-direction: column;
      align-items: stretch;
    }
    
    .header-actions {
      justify-content: flex-start;
    }
    
    .map-layout {
      flex-direction: column;
      height: auto;
    }
    
    .filters-sidebar {
      width: 100%;
      max-height: 400px;
    }
    
    .map-main {
      min-height: 500px;
    }
  }
</style>

