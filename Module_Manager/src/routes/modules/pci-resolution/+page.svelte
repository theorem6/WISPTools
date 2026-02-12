<script lang="ts">
  import { onMount } from 'svelte';
  import { PCIArcGISMapper } from '$lib/arcgisMap';
  import { pciService } from '$lib/services/pciService';
  import type { Cell } from '$lib/pciMapper';
  
  // Store imports
  import {
    cellsStore,
    conflictsStore,
    optimizationStore,
    analysisStore,
    uiStore,
    cellCount,
    conflictCount,
    criticalConflictCount,
    highConflictCount,
    mediumConflictCount,
    lowConflictCount,
    hasData,
    hasConflicts,
    isAnyLoading,
    uiActions,
    resetAllStores
  } from '$lib/stores/appState';
  
  // Components
  import ImportWizard from '$lib/components/forms/ImportWizard.svelte';
  import AnalysisModal from '$lib/components/pci/AnalysisModal.svelte';
  import ConflictsModal from '$lib/components/pci/ConflictsModal.svelte';
  import RecommendationsModal from '$lib/components/pci/RecommendationsModal.svelte';
  import OptimizationResultModal from '$lib/components/pci/OptimizationResultModal.svelte';
  import ConflictReportExport from '$lib/components/data-display/ConflictReportExport.svelte';
  import NetworkManager from '$lib/components/maps/NetworkManager.svelte';
  import CellEditor from '$lib/components/forms/CellEditor.svelte';
  import SiteEditor from '$lib/components/forms/SiteEditor.svelte';
  import ContextMenu from '$lib/components/pci/ContextMenu.svelte';
  import TowerManager from '$lib/components/maps/TowerManager.svelte';
  import TopBrand from '$lib/components/navigation/TopBrand.svelte';
  import PCIStatusWidget from '$lib/components/data-display/PCIStatusWidget.svelte';
  import VerticalMenu from '$lib/components/navigation/VerticalMenu.svelte';
  import SettingsMenu from '$lib/components/navigation/SettingsMenu.svelte';
  import BasemapSwitcher from '$lib/components/maps/BasemapSwitcher.svelte';
  import HelpModal from '$lib/components/modals/HelpModal.svelte';
  import ConflictResolutionWizard from '$lib/components/wizards/pci/ConflictResolutionWizard.svelte';
  import { pciResolutionDocs } from '$lib/docs/pci-resolution-docs';
  import { getWizardsForPath } from '$lib/config/wizardCatalog';
  import type { CellSite } from '$lib/models/cellSite';
  import { convertLegacyToCellSite, convertCellSiteToLegacy } from '$lib/models/cellSite';
  
  // Auth and Network stores
  import { authStore, currentUser, isAuthenticated } from '$lib/stores/authStore';
  import { networkStore, currentNetwork as activeNetwork } from '$lib/stores/networkStore';
  import { networkService } from '$lib/services/networkService';
  
  // Local state for modals
  let showImportWizard = false;
  let showNetworkManager = false;
  let showCellEditor = false;
  let showSiteEditor = false;
  let showContextMenu = false;
  let showTowerManager = false;
  let showExportModal = false;
  let showHelpModal = false;
  let showConflictResolutionWizard = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let selectedCell: Cell | null = null;
  
  // Documentation content
  const helpContent = pciResolutionDocs;
  let selectedSite: CellSite | null = null;
  let isCreatingNewCell = false;
  let isCreatingNewSite = false;
  let newCellLatitude: number | undefined = undefined;
  let newCellLongitude: number | undefined = undefined;
  let contextMenuCellId = '';
  
  let mapContainer: HTMLDivElement;
  let mapInstance: PCIArcGISMapper | null = null;
  let currentBasemap: string = 'topo-vector';
  
  // Removed hardcoded sampleCells - no test data should be hardcoded
  // All cell data should come from MongoDB or user imports
  
  // ========================================================================
  // Initialization
  // ========================================================================
  
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  
  onMount(async () => {
    if (typeof window !== 'undefined') {
      const wizardId = $page.url.searchParams.get('wizard');
      if (wizardId === 'conflict-resolution') { showConflictResolutionWizard = true; goto($page.url.pathname, { replaceState: true }); }
    }
    // Note: Auth is handled by Module_Manager dashboard
    // Users must be authenticated to reach this page
    
    if (mapContainer) {
      console.log('Page: Creating map instance');
      mapInstance = new PCIArcGISMapper(mapContainer);
      
      // Wait for the map to fully initialize
      console.log('Page: Waiting for map initialization...');
      await mapInstance.waitForInit();
      console.log('Page: Map initialized, attaching event handlers');
      
      // Set initial basemap based on theme
      const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
      currentBasemap = isDarkMode ? 'dark-gray-vector' : 'topo-vector';
      
      mapInstance.enableCellPopup();
      
      // Enable cell click to open editor
      mapInstance.onCellClick((cellId) => {
        handleCellClick(cellId);
      });
      
      // Enable right-click to show context menu
      console.log('Page: Attaching right-click handler');
      mapInstance.onMapRightClick((latitude, longitude, screenX, screenY, cellId) => {
        console.log('Page: Right-click callback triggered', latitude, longitude, cellId);
        handleMapRightClick(latitude, longitude, screenX, screenY, cellId);
      });
      
      console.log('Page: All event handlers attached');
    }
  });
  
  // Note: Auth redirects removed - handled by Module_Manager dashboard
  
  // Load user's networks when authenticated
  $: if ($isAuthenticated && $currentUser) {
    loadUserNetworks();
  }
  
  // Sync current network cells with cell store
  $: if ($activeNetwork) {
    syncNetworkCells($activeNetwork);
  }
  
  async function loadUserNetworks() {
    if (!$currentUser) return;
    
    networkStore.setLoading(true);
    const result = await networkService.getUserNetworks($currentUser.uid);
    
    if (result.success && result.data) {
      networkStore.setNetworks(result.data);
      
      // If no current network, select the first one
      if (!$activeNetwork && result.data.length > 0) {
        networkStore.setCurrentNetwork(result.data[0]);
      }
    } else {
      console.error('Failed to load networks:', result.error);
      
      // If index error, show helpful message but don't block the app
      if (result.error?.includes('index')) {
        console.warn('⚠️  Firestore index not created yet. Networks will load after you create the index.');
        console.warn('📋 Click the link in the error above to auto-create the index in Firebase Console.');
        
        // Set empty networks array so app still works
        networkStore.setNetworks([]);
      }
    }
    
    networkStore.setLoading(false);
  }
  
  async function syncNetworkCells(network: any) {
    // Wait for map to be ready before centering
    if (mapInstance && network.location) {
      await centerMapOnNetwork(network);
    }
    
    if (network.cells && network.cells.length > 0) {
      const result = await pciService.loadCells(network.cells);
      if (result.success) {
        // Analyze loaded network
        await performAnalysis();
      }
    } else {
      // Empty network - just center on location
      pciService.clearCells();
    }
  }
  
  async function centerMapOnNetwork(network: any) {
    if (!mapInstance || !network.location) return;
    
    // Wait for map to be fully initialized
    try {
      await mapInstance.waitForInit();
    } catch (error) {
      console.warn('Map not ready for centering:', error);
      return;
    }
    
    const location = network.location;
    const targetZoom = location.zoom || 12;
    
    // Center map on network location
    if (mapInstance.mapView && mapInstance.mapView.ready) {
      try {
        await mapInstance.mapView.goTo({
          center: [location.longitude, location.latitude],
          zoom: targetZoom
        }, {
          animate: true,
          duration: 1000
        });
        console.log('Map centered on network location:', location.latitude, location.longitude);
      } catch (error: any) {
        // Ignore "goto-interrupted" errors - these are expected when new data loads
        if (error?.name === 'view:goto-interrupted') {
          console.log('Map centering interrupted by new data load (expected)');
          return;
        }
        console.warn('Map centering failed:', error);
      }
    }
  }
  
  async function saveCurrentNetwork() {
    if (!$activeNetwork || !$isAuthenticated) return;
    
    const cells = $cellsStore.items;
    await networkService.updateNetworkCells($activeNetwork.id, cells);
    networkStore.updateCurrentNetworkCells(cells);
  }
  
  // ========================================================================
  // Event Handlers - Delegated to service layer
  // ========================================================================
  
  // Removed loadSampleData() - no hardcoded test data
  // Users should import their own data or load from MongoDB
  
  async function handleManualImport(event: CustomEvent) {
    const importedCells = event.detail.cells;
    const result = await pciService.addCells(importedCells);
    if (result.success) {
      // Analyze and render cells on map
      await performAnalysis();
      await saveCurrentNetwork(); // Auto-save to network
    }
  }
  
  async function performAnalysis(showAlert: boolean = false) {
    console.log('[+page] performAnalysis called');
    const cells = $cellsStore.items;
    console.log('[+page] Analyzing', cells.length, 'cells');
    
    if (!cells.length) {
      console.warn('[+page] No cells to analyze');
      if (showAlert) {
        alert('No cells to analyze. Please add towers first.');
      }
      return;
    }
    
    const result = await pciService.performAnalysis(cells);
    console.log('[+page] Analysis result:', result.success, 'conflicts:', result.data?.conflicts?.length);
    
    if (result.success && result.data) {
      updateMapVisualization();
      console.log('[+page] Analysis complete. Conflicts stored:', $conflictsStore.items.length);
      
      // Show user feedback only when manually triggered
      if (showAlert) {
        const conflictCount = $conflictsStore.items.length;
        if (conflictCount === 0) {
          alert(`✅ Analysis complete!\n\nNo PCI conflicts detected.`);
        } else {
          alert(`✅ Analysis complete!\n\n${conflictCount} conflict(s) detected.\n\nView details in the Analysis, Conflicts, or Recommendations buttons.`);
        }
      }
    } else {
      console.error('[+page] Analysis failed:', result.error);
      if (showAlert) {
        alert(`❌ Analysis failed: ${result.error || 'Unknown error'}`);
      }
    }
  }
  
  async function optimizePCIAssignments() {
    const cells = $cellsStore.items;
    if (!cells.length) {
      alert('No cells loaded.');
      return;
    }
    
    const conflicts = $conflictsStore.items;
    if (!conflicts.length) {
      alert('No conflicts detected.');
      return;
    }
    
    const result = await pciService.optimizePCIs(cells);
    if (result.success) {
      updateMapVisualization();
      uiActions.openModal('showOptimizationResultModal');
      await saveCurrentNetwork(); // Auto-save optimized network
    }
  }

  function clearMap() {
      if (mapInstance) {
      mapInstance.clearMap();
    }
    pciService.clearCells();
  }
  
  function handleBasemapChange(event: CustomEvent<string>) {
    const basemapId = event.detail;
    if (mapInstance) {
      mapInstance.changeBasemap(basemapId);
      currentBasemap = basemapId;
    }
  }
  
  // ========================================================================
  // Map Visualization - Isolated map rendering logic
  // ========================================================================
  
  function updateMapVisualization() {
    if (!mapInstance) return;
    
    const cells = $cellsStore.items;
    const conflicts = $conflictsStore.items;
    
    if (cells.length > 0) {
      // Pass conflicts to renderCells for color-coding
      mapInstance.renderCells(cells, conflicts);
    }
    if (conflicts.length > 0) {
      mapInstance.renderConflicts(conflicts);
    }
  }
  
  // Reactive statement to update map when cells or conflicts change
  $: if (mapInstance && $cellsStore.items.length > 0) {
    updateMapVisualization();
  }
  
  // Update map when conflicts change (color updates)
  $: if (mapInstance && $conflictsStore.items) {
    updateMapVisualization();
  }
  
  // ========================================================================
  // Cell Editor - Handle cell editing and creation
  // ========================================================================
  
  function handleCellClick(cellId: string) {
    const cell = $cellsStore.items.find(c => c.id === cellId);
    if (cell) {
      selectedCell = cell;
      isCreatingNewCell = false;
      showCellEditor = true;
    }
  }
  
  function handleMapRightClick(latitude: number, longitude: number, screenX: number, screenY: number, cellId: string | null) {
    // Store click information
    newCellLatitude = latitude;
    newCellLongitude = longitude;
    contextMenuCellId = cellId || '';
    
    // Show context menu at click position
    contextMenuX = screenX;
    contextMenuY = screenY;
    showContextMenu = true;
  }
  
  function handleContextMenuAddSite() {
    showContextMenu = false;
    selectedSite = null;
    isCreatingNewSite = true;
    showSiteEditor = true;
  }
  
  function handleContextMenuImport() {
    showContextMenu = false;
    showImportWizard = true;
  }
  
  function handleContextMenuEditSector() {
    showContextMenu = false;
    const cell = $cellsStore.items.find(c => c.id === contextMenuCellId);
    if (cell) {
      selectedCell = cell;
      isCreatingNewCell = false;
      showCellEditor = true;
    }
  }
  
  async function handleContextMenuDeleteSector() {
    showContextMenu = false;
    
    if (!contextMenuCellId) return;
    
    if (confirm(`Delete sector ${contextMenuCellId}?`)) {
      // Remove from store
      const cells = $cellsStore.items.filter(c => c.id !== contextMenuCellId);
      cellsStore.set({ 
        items: cells,
        isLoading: false,
        error: null
      });
      
      // Re-analyze after deletion
      await performAnalysis();
      
      // Auto-save
      await saveCurrentNetwork();
      
      console.log('Sector deleted:', contextMenuCellId);
    }
  }
  
  async function handleCellSave(event: CustomEvent) {
    const updatedCell = event.detail as Cell;
    
    if (isCreatingNewCell) {
      // Add new cell to store
      const cells = [...$cellsStore.items, updatedCell];
      cellsStore.set({ 
        items: cells,
        isLoading: false,
        error: null
      });
    } else {
      // Update existing cell in store
      const cells = $cellsStore.items.map(c => 
        c.id === updatedCell.id ? updatedCell : c
      );
      cellsStore.set({ 
        items: cells,
        isLoading: false,
        error: null
      });
    }
    
    // Re-analyze after cell save
    await performAnalysis();
    
    // Auto-save to network
    await saveCurrentNetwork();
    
    // Reset state
    showCellEditor = false;
    selectedCell = null;
    isCreatingNewCell = false;
    newCellLatitude = undefined;
    newCellLongitude = undefined;
  }
  
  async function handleSiteSave(event: CustomEvent) {
    const savedSite = event.detail as CellSite;
    
    console.log('[+page] Site saved:', savedSite);
    console.log('[+page] Site has', savedSite.sectors.length, 'sectors');
    
    // Convert site to legacy cell format for analysis
    const legacyCells = convertCellSiteToLegacy([savedSite]);
    console.log('[+page] Converted to', legacyCells.length, 'carriers for analysis');
    if (legacyCells.length > 0) {
      console.log('[+page] Sample cell:', JSON.stringify(legacyCells[0], null, 2));
    }
    
    if (isCreatingNewSite) {
      // Add all sectors from the new site to store
      const cells = [...$cellsStore.items, ...legacyCells];
      cellsStore.set({ 
        items: cells,
        isLoading: false,
        error: null
      });
      console.log(`[+page] Added ${legacyCells.length} carriers from new site. Total cells now: ${cells.length}`);
    } else {
      // Update existing site's sectors
      // Remove old sectors from this site, add new ones
      const siteId = savedSite.id;
      const cells = [
        ...$cellsStore.items.filter(c => !c.id.startsWith(siteId)),
        ...legacyCells
      ];
      cellsStore.set({ 
        items: cells,
        isLoading: false,
        error: null
      });
      console.log(`[+page] Updated site with ${legacyCells.length} carriers. Total cells now: ${cells.length}`);
    }
    
    // Re-analyze after site save
    console.log('[+page] Re-analyzing after site save...');
    await performAnalysis();
    
    // Auto-save to network
    console.log('[+page] Saving to network...');
    await saveCurrentNetwork();
    
    // Reset state
    showSiteEditor = false;
    selectedSite = null;
    isCreatingNewSite = false;
    newCellLatitude = undefined;
    newCellLongitude = undefined;
  }
  
  async function handleTowersChanged() {
    // Re-analyze after tower changes
    await performAnalysis();
    
    // Auto-save to network
    await saveCurrentNetwork();
  }
  
  function handleNetworkDeleted(event: CustomEvent) {
    const deletedNetworkId = event.detail;
    console.log('Network deleted, clearing cells and map:', deletedNetworkId);
    
    // Clear all cells from the store
    pciService.clearCells();
    
    // Clear the map
    if (mapInstance) {
      mapInstance.clearMap();
    }
  }
</script>

<!-- Full Screen Map -->
<!-- Note: Auth check removed - Module_Manager dashboard handles authentication -->
<div class="app">
  <!-- Map Background -->
  <div class="map-fullscreen" bind:this={mapContainer}>
    {#if $isAnyLoading}
      <div class="loading">
        <div class="spinner"></div>
        <p>Analyzing...</p>
      </div>
    {/if}
  </div>

  <!-- New UI Layout: Separate Positioned Elements -->
  
  <!-- Top Left: Brand -->
  <TopBrand />
  
  <!-- Top Right: Basemap Switcher -->
  <BasemapSwitcher currentBasemap={currentBasemap} on:change={handleBasemapChange} />
  
  <!-- Right Side: PCI Status Widget -->
  <PCIStatusWidget />
  
  <!-- Left Sidebar: Vertical Menu -->
  <VerticalMenu 
    hasData={$hasData}
    hasConflicts={$hasConflicts}
    wizardItems={getWizardsForPath('/modules/deploy')}
    on:import={() => showImportWizard = true}
    on:towers={() => showTowerManager = true}
    on:analyze={() => performAnalysis(true)}
    on:optimize={optimizePCIAssignments}
    on:wizard={(e) => {
      if (e.detail?.id === 'pci-import') showImportWizard = true;
      else if (e.detail?.id === 'conflict-resolution') showConflictResolutionWizard = true;
    }}
    on:analysis={() => uiActions.openModal('showAnalysisModal')}
    on:conflicts={() => uiActions.openModal('showConflictsModal')}
    on:recommendations={() => uiActions.openModal('showRecommendationsModal')}
    on:export={() => showExportModal = true}
    on:networks={() => showNetworkManager = true}
  />
  
  <!-- Bottom Right: Settings Gear Menu -->
  <SettingsMenu />
  
  <!-- Help Button -->
  <button class="help-button" onclick={() => showHelpModal = true} aria-label="Open Help" title="Help">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  </button>

  <!-- Modular Components - Isolated and reusable -->
  <NetworkManager 
    show={showNetworkManager}
    on:close={() => showNetworkManager = false}
    on:networkCreated={() => {}}
    on:networkSelected={() => {}}
    on:networkDeleted={handleNetworkDeleted}
  />
  
  <ImportWizard 
    show={showImportWizard}
    on:import={handleManualImport}
    on:close={() => showImportWizard = false}
  />
  
  <AnalysisModal 
    show={$uiStore.showAnalysisModal}
    analysis={$conflictsStore.analysis}
    conflicts={$conflictsStore.items}
    on:close={() => uiActions.closeModal('showAnalysisModal')}
  />
  
  <ConflictsModal 
    show={$uiStore.showConflictsModal}
    conflicts={$conflictsStore.items}
    on:close={() => uiActions.closeModal('showConflictsModal')}
  />
  
  <RecommendationsModal 
    show={$uiStore.showRecommendationsModal}
    geminiAnalysis={$analysisStore.geminiAnalysis}
    on:close={() => uiActions.closeModal('showRecommendationsModal')}
  />
  
  <OptimizationResultModal 
    show={$uiStore.showOptimizationResultModal}
    result={$optimizationStore.result}
    on:close={() => uiActions.closeModal('showOptimizationResultModal')}
  />
  
  <CellEditor 
    cell={selectedCell}
    isOpen={showCellEditor}
    isNewCell={isCreatingNewCell}
    initialLatitude={newCellLatitude}
    initialLongitude={newCellLongitude}
    on:save={handleCellSave}
    on:close={() => { 
      showCellEditor = false; 
      selectedCell = null; 
      isCreatingNewCell = false;
      newCellLatitude = undefined;
      newCellLongitude = undefined;
    }}
  />
  
  <SiteEditor 
    site={selectedSite}
    isOpen={showSiteEditor}
    isNewSite={isCreatingNewSite}
    initialLatitude={newCellLatitude}
    initialLongitude={newCellLongitude}
    on:save={handleSiteSave}
    on:close={() => { 
      showSiteEditor = false; 
      selectedSite = null; 
      isCreatingNewSite = false;
      newCellLatitude = undefined;
      newCellLongitude = undefined;
    }}
  />
  
  <ContextMenu 
    show={showContextMenu}
    x={contextMenuX}
    y={contextMenuY}
    hasSelectedCell={!!contextMenuCellId}
    cellId={contextMenuCellId}
    on:addSite={handleContextMenuAddSite}
    on:import={handleContextMenuImport}
    on:editSector={handleContextMenuEditSector}
    on:deleteSector={handleContextMenuDeleteSector}
    on:close={() => showContextMenu = false}
  />
  
  <TowerManager 
    show={showTowerManager}
    on:towersChanged={handleTowersChanged}
    on:close={() => showTowerManager = false}
  />
  
  <!-- Export Modal -->
  {#if showExportModal}
    <div 
      class="modal-overlay" 
      role="presentation"
        onclick={() => showExportModal = false}
        onkeydown={(e) => e.key === 'Escape' && (showExportModal = false)}
    >
      <div 
        class="modal-container" 
        role="dialog"
        tabindex="-1"
        aria-labelledby="export-modal-title"
          onclick={(e) => e.stopPropagation()}
          onkeydown={(e) => e.stopPropagation()}
      >
        <div class="modal-header">
          <h3 id="export-modal-title">📤 Export & Configuration</h3>
          <button class="modal-close-btn" onclick={() => showExportModal = false}>×</button>
        </div>
        <div class="modal-body">
          <ConflictReportExport 
            cells={$cellsStore.items} 
            conflicts={$conflictsStore.items} 
            recommendations={$analysisStore.recommendations} 
          />
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Help Modal -->
  <HelpModal 
    show={showHelpModal}
    title="PCI Resolution & Network Optimization Help"
    content={helpContent}
    on:close={() => showHelpModal = false}
  />
  
  <ConflictResolutionWizard
    show={showConflictResolutionWizard}
    on:close={() => showConflictResolutionWizard = false}
    on:saved={() => {
      showConflictResolutionWizard = false;
      performAnalysis(false);
    }}
  />
  
        </div>

<style>
  /* App Container */
  .app {
    position: relative;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    background: var(--bg-primary);
  }

  /* Full Screen Map */
  .map-fullscreen {
    position: absolute;
    inset: 0;
    z-index: 0;
  }

  .loading {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    z-index: 10;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Removed old topbar styles - now using separate positioned components */
  
  /* Modal Overlay for Export */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    z-index: 99998;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-container {
    background: var(--card-bg);
    border-radius: 12px;
    max-width: 700px;
    width: 100%;
    max-height: 85vh;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    border: 1px solid var(--border-color);
    animation: slideUp 0.3s ease-out;
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 99999;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(40px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-secondary);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .modal-close-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .modal-close-btn:hover {
    background: var(--danger-light);
    color: var(--danger-color);
  }

  .modal-body {
    overflow-y: auto;
    padding: 0;
  }
  
  /* Help Button */
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
</style>