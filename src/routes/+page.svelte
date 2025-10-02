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
    hasData,
    hasConflicts,
    isAnyLoading,
    uiActions
  } from '$lib/stores/appState';
  
  // Components
  import ActionsDropdown from '$lib/components/ActionsDropdown.svelte';
  import ImportWizard from '$lib/components/ImportWizard.svelte';
  import AnalysisModal from '$lib/components/AnalysisModal.svelte';
  import ConflictsModal from '$lib/components/ConflictsModal.svelte';
  import RecommendationsModal from '$lib/components/RecommendationsModal.svelte';
  import OptimizationResultModal from '$lib/components/OptimizationResultModal.svelte';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import UserProfile from '$lib/components/UserProfile.svelte';
  import NetworkManager from '$lib/components/NetworkManager.svelte';
  import NetworkSelector from '$lib/components/NetworkSelector.svelte';
  import CellEditor from '$lib/components/CellEditor.svelte';
  import SiteEditor from '$lib/components/SiteEditor.svelte';
  import ContextMenu from '$lib/components/ContextMenu.svelte';
  import TowerManager from '$lib/components/TowerManager.svelte';
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
  let contextMenuX = 0;
  let contextMenuY = 0;
  let selectedCell: Cell | null = null;
  let selectedSite: CellSite | null = null;
  let isCreatingNewCell = false;
  let isCreatingNewSite = false;
  let newCellLatitude: number | undefined = undefined;
  let newCellLongitude: number | undefined = undefined;
  let contextMenuCellId = '';
  
  let mapContainer: HTMLDivElement;
  let mapInstance: PCIArcGISMapper | null = null;
  
  // Realistic Sample Data with Intentional Conflicts
  // These PCIs are deliberately chosen to create conflicts that CAN be resolved
  const sampleCells: Cell[] = [
    // Tower 1 - Manhattan Midtown (3-sector)
    { id: 'CELL001', eNodeB: 1001, sector: 1, pci: 15, latitude: 40.7580, longitude: -73.9855, frequency: 2100, rsPower: -75, azimuth: 0, technology: 'LTE', earfcn: 1950, centerFreq: 2100, channelBandwidth: 20, dlEarfcn: 1950, ulEarfcn: 1850 },
    { id: 'CELL002', eNodeB: 1001, sector: 2, pci: 16, latitude: 40.7580, longitude: -73.9855, frequency: 2100, rsPower: -77, azimuth: 120, technology: 'LTE', earfcn: 1950, centerFreq: 2100, channelBandwidth: 20, dlEarfcn: 1950, ulEarfcn: 1850 },
    { id: 'CELL003', eNodeB: 1001, sector: 3, pci: 17, latitude: 40.7580, longitude: -73.9855, frequency: 2100, rsPower: -76, azimuth: 240, technology: 'LTE', earfcn: 1950, centerFreq: 2100, channelBandwidth: 20, dlEarfcn: 1950, ulEarfcn: 1850 },
    
    // Tower 2 - Near Tower 1 with INTENTIONAL MOD3 conflicts (500m away)
    { id: 'CELL004', eNodeB: 1002, sector: 1, pci: 18, latitude: 40.7625, longitude: -73.9810, frequency: 2100, rsPower: -78, azimuth: 0, technology: 'LTE', earfcn: 1950, centerFreq: 2100, channelBandwidth: 20, dlEarfcn: 1950, ulEarfcn: 1850 },
    { id: 'CELL005', eNodeB: 1002, sector: 2, pci: 19, latitude: 40.7625, longitude: -73.9810, frequency: 2100, rsPower: -80, azimuth: 120, technology: 'LTE', earfcn: 1950, centerFreq: 2100, channelBandwidth: 20, dlEarfcn: 1950, ulEarfcn: 1850 },
    { id: 'CELL006', eNodeB: 1002, sector: 3, pci: 20, latitude: 40.7625, longitude: -73.9810, frequency: 2100, rsPower: -79, azimuth: 240, technology: 'LTE', earfcn: 1950, centerFreq: 2100, channelBandwidth: 20, dlEarfcn: 1950, ulEarfcn: 1850 },
    
    // Tower 3 - Chelsea with MOD6 conflicts (700m from Tower 1)
    { id: 'CELL007', eNodeB: 1003, sector: 1, pci: 21, latitude: 40.7489, longitude: -73.9980, frequency: 2100, rsPower: -82, azimuth: 0, technology: 'LTE', earfcn: 1950, centerFreq: 2100, channelBandwidth: 20, dlEarfcn: 1950, ulEarfcn: 1850 },
    { id: 'CELL008', eNodeB: 1003, sector: 2, pci: 15, latitude: 40.7489, longitude: -73.9980, frequency: 2100, rsPower: -81, azimuth: 120, technology: 'LTE', earfcn: 1950, centerFreq: 2100, channelBandwidth: 20, dlEarfcn: 1950, ulEarfcn: 1850 },
    { id: 'CELL009', eNodeB: 1003, sector: 3, pci: 27, latitude: 40.7489, longitude: -73.9980, frequency: 2100, rsPower: -83, azimuth: 240, technology: 'LTE', earfcn: 1950, centerFreq: 2100, channelBandwidth: 20, dlEarfcn: 1950, ulEarfcn: 1850 },
    
    // Tower 4 - Greenwich Village with more conflicts (800m south)
    { id: 'CELL010', eNodeB: 1004, sector: 1, pci: 18, latitude: 40.7350, longitude: -74.0027, frequency: 2100, rsPower: -85, azimuth: 0, technology: 'LTE', earfcn: 1950, centerFreq: 2100, channelBandwidth: 20, dlEarfcn: 1950, ulEarfcn: 1850 },
    { id: 'CELL011', eNodeB: 1004, sector: 2, pci: 24, latitude: 40.7350, longitude: -74.0027, frequency: 2100, rsPower: -84, azimuth: 120, technology: 'LTE', earfcn: 1950, centerFreq: 2100, channelBandwidth: 20, dlEarfcn: 1950, ulEarfcn: 1850 },
    { id: 'CELL012', eNodeB: 1004, sector: 3, pci: 21, latitude: 40.7350, longitude: -74.0027, frequency: 2100, rsPower: -86, azimuth: 240, technology: 'LTE', earfcn: 1950, centerFreq: 2100, channelBandwidth: 20, dlEarfcn: 1950, ulEarfcn: 1850 },
    
    // Tower 5 - CBRS 4-sector in Midtown East (different frequency, fewer conflicts)
    { id: 'CELL013', eNodeB: 1005, sector: 1, pci: 100, latitude: 40.7527, longitude: -73.9772, frequency: 3550, rsPower: -70, azimuth: 0, technology: 'CBRS', earfcn: 55650, centerFreq: 3550, channelBandwidth: 20, dlEarfcn: 55650, ulEarfcn: 55650 },
    { id: 'CELL014', eNodeB: 1005, sector: 2, pci: 103, latitude: 40.7527, longitude: -73.9772, frequency: 3550, rsPower: -72, azimuth: 90, technology: 'CBRS', earfcn: 55650, centerFreq: 3550, channelBandwidth: 20, dlEarfcn: 55650, ulEarfcn: 55650 },
    { id: 'CELL015', eNodeB: 1005, sector: 3, pci: 106, latitude: 40.7527, longitude: -73.9772, frequency: 3550, rsPower: -71, azimuth: 180, technology: 'CBRS', earfcn: 55650, centerFreq: 3550, channelBandwidth: 20, dlEarfcn: 55650, ulEarfcn: 55650 },
    { id: 'CELL016', eNodeB: 1005, sector: 4, pci: 109, latitude: 40.7527, longitude: -73.9772, frequency: 3550, rsPower: -73, azimuth: 270, technology: 'CBRS', earfcn: 55650, centerFreq: 3550, channelBandwidth: 20, dlEarfcn: 55650, ulEarfcn: 55650 }
  ];
  
  // ========================================================================
  // Auth Guard - Redirect to login if not authenticated
  // ========================================================================
  
  import { goto } from '$app/navigation';
  
  onMount(async () => {
    // Check authentication and redirect if needed
    if (!$authStore.isLoading && !$isAuthenticated) {
      goto('/login');
      return;
    }
    
    if (mapContainer) {
      console.log('Page: Creating map instance');
      mapInstance = new PCIArcGISMapper(mapContainer);
      
      // Wait for the map to fully initialize
      console.log('Page: Waiting for map initialization...');
      await mapInstance.waitForInit();
      console.log('Page: Map initialized, attaching event handlers');
      
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
  
  // Redirect if user logs out
  $: if (!$authStore.isLoading && !$isAuthenticated) {
    goto('/login');
  }
  
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
  
  async function loadSampleData() {
    const result = await pciService.loadCells(sampleCells);
    if (result.success && result.data) {
      await performAnalysis();
    }
  }
  
  async function handleManualImport(event: CustomEvent) {
    const importedCells = event.detail.cells;
    const result = await pciService.addCells(importedCells);
    if (result.success) {
      await performAnalysis();
      await saveCurrentNetwork(); // Auto-save to network
    }
  }
  
  async function performAnalysis() {
    const cells = $cellsStore.items;
    if (!cells.length) return;
    
    const result = await pciService.performAnalysis(cells);
    if (result.success && result.data) {
      updateMapVisualization();
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
      cellsStore.set({ items: cells });
      
      // Re-analyze
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
      cellsStore.set({ items: cells });
    } else {
      // Update existing cell in store
      const cells = $cellsStore.items.map(c => 
        c.id === updatedCell.id ? updatedCell : c
      );
      cellsStore.set({ items: cells });
    }
    
    // Re-analyze conflicts with updated cell
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
    
    console.log('Site saved:', savedSite);
    
    // Convert site to legacy cell format for analysis
    const legacyCells = convertCellSiteToLegacy([savedSite]);
    
    if (isCreatingNewSite) {
      // Add all sectors from the new site to store
      const cells = [...$cellsStore.items, ...legacyCells];
      cellsStore.set({ items: cells });
      console.log(`Added ${legacyCells.length} sectors from new site`);
    } else {
      // Update existing site's sectors
      // Remove old sectors from this site, add new ones
      const siteId = savedSite.id;
      const cells = [
        ...$cellsStore.items.filter(c => !c.id.startsWith(siteId)),
        ...legacyCells
      ];
      cellsStore.set({ items: cells });
      console.log(`Updated site with ${legacyCells.length} sectors`);
    }
    
    // Re-analyze conflicts
    await performAnalysis();
    
    // Auto-save to network
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
</script>

{#if $isAuthenticated}
<!-- Full Screen Map -->
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

  <!-- Compact Floating Top Bar -->
  <nav class="topbar">
    <div class="topbar-brand">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="brand-icon">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
      <span class="brand-text">LTE PCI Mapper</span>
      <span class="map-hint" title="Right-click on map to add new cell">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        Right-click map to add cell
      </span>
      
      {#if $isAuthenticated}
        <div class="network-selector-container">
          <NetworkSelector on:manage={() => showNetworkManager = true} />
        </div>
      {/if}
        </div>

    <div class="topbar-stats">
      <div class="stat-item">
        <span class="stat-value">{$cellCount}</span>
        <span class="stat-label">Cells</span>
        </div>
      <div class="stat-divider"></div>
      <div class="stat-item warning">
        <span class="stat-value">{$conflictCount}</span>
        <span class="stat-label">Conflicts</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item danger">
        <span class="stat-value">{$criticalConflictCount}</span>
        <span class="stat-label">Critical</span>
    </div>
    </div>

    <div class="topbar-actions">
      <ActionsDropdown 
        cells={$cellsStore.items}
        conflicts={$conflictsStore.items}
        recommendations={$analysisStore.recommendations}
        isOptimizing={$optimizationStore.isOptimizing}
        hasData={$hasData}
        hasConflicts={$hasConflicts}
        on:openImport={() => showImportWizard = true}
        on:import={handleManualImport}
        on:loadSample={loadSampleData}
        on:clearMap={clearMap}
        on:runAnalysis={performAnalysis}
        on:optimize={optimizePCIAssignments}
      />
      <UserProfile 
        on:networks={() => showNetworkManager = true}
      />
      <ThemeSwitcher />
      <button class="icon-btn" on:click={() => showTowerManager = true} title="Tower Management">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
      </button>
      <button class="icon-btn" on:click={() => uiActions.openModal('showAnalysisModal')} title="Analysis">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
      </button>
      <button class="icon-btn" on:click={() => uiActions.openModal('showConflictsModal')} title="Conflicts">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </button>
      <button class="icon-btn" on:click={() => uiActions.openModal('showRecommendationsModal')} title="Recommendations">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </button>
    </div>
  </nav>

  <!-- Modular Components - Isolated and reusable -->
  <NetworkManager 
    show={showNetworkManager}
    on:close={() => showNetworkManager = false}
    on:networkCreated={() => {}}
    on:networkSelected={() => {}}
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
        </div>
          {:else}
  <!-- Loading state while checking auth -->
  <div class="auth-loading">
    <div class="spinner"></div>
    <p>Loading...</p>
    </div>
  {/if}

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

  .auth-loading {
    position: fixed;
    inset: 0;
    background: var(--bg-primary);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-primary);
  }

  .auth-loading .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--border-color);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  .auth-loading p {
    color: var(--text-secondary);
    font-size: 1rem;
  }

  /* Compact Floating Top Bar */
  .topbar {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    max-width: 1400px;
    z-index: 100;
    background: var(--card-bg);
    backdrop-filter: blur(16px);
    border-radius: 12px;
    padding: 0.5rem 1rem;
    box-shadow: var(--shadow-lg);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid var(--border-color);
    height: 48px;
    transition: all var(--transition);
  }

  .topbar:hover {
    box-shadow: var(--shadow-xl);
  }

  /* Brand Section */
  .topbar-brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .brand-icon {
    color: var(--primary-color);
    flex-shrink: 0;
  }

  .brand-text {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-primary) !important;
    white-space: nowrap;
  }

  .map-hint {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-left: 1rem;
    padding: 0.25rem 0.625rem;
    background: var(--primary-light);
    border-radius: var(--border-radius);
    font-size: 0.75rem;
    color: var(--primary-color);
    font-weight: 500;
    cursor: help;
    transition: all var(--transition);
  }

  .map-hint:hover {
    background: var(--primary-color);
    color: white;
  }

  .map-hint svg {
    flex-shrink: 0;
  }

  .network-selector-container {
    display: flex;
    align-items: center;
    padding-left: 0.75rem;
    margin-left: 0.75rem;
    border-left: 1px solid var(--border-color);
  }

  /* Stats Section */
  .topbar-stats {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    justify-content: center;
    padding: 0 1rem;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
  }

  .stat-value {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary) !important;
    line-height: 1;
  }

  .stat-label {
    font-size: 0.65rem;
    color: var(--text-secondary) !important;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1;
    margin-top: 2px;
  }

  .stat-item.warning .stat-value {
    color: var(--warning-color) !important;
  }

  .stat-item.danger .stat-value {
    color: var(--danger-color) !important;
  }

  .stat-divider {
    width: 1px;
    height: 24px;
    background: var(--border-color);
  }

  /* Actions Section */
  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .icon-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid var(--border-color);
    background: var(--card-bg);
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .icon-btn:hover {
    background: var(--hover-bg);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .topbar-stats {
      gap: 0.5rem;
      padding: 0 0.5rem;
  }

  .stat-label {
      display: none;
    }

    .stat-value {
      font-size: 0.95rem;
    }
  }

  @media (max-width: 768px) {
    .topbar {
      height: auto;
      padding: 0.5rem;
      gap: 0.5rem;
    }

    .brand-text {
      display: none;
    }

    .map-hint {
      display: none;
    }

    .network-selector-container {
      margin-left: 0.5rem;
      padding-left: 0.5rem;
    }

    .topbar-stats {
      gap: 0.5rem;
      padding: 0;
    }

    .stat-divider {
      height: 20px;
    }

    .topbar-actions {
      gap: 0.25rem;
    }

    .icon-btn {
      width: 32px;
      height: 32px;
    }
  }

  @media (max-width: 480px) {
    .topbar {
      flex-wrap: wrap;
      justify-content: center;
    }

    .topbar-brand {
      order: 1;
    }

    .topbar-stats {
      order: 3;
      width: 100%;
      justify-content: space-around;
      padding: 0.25rem 0;
      border-top: 1px solid var(--border-color);
      margin-top: 0.25rem;
    }

    .topbar-actions {
      order: 2;
    }
  }
</style>