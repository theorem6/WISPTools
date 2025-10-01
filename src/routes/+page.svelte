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
  
  // Modal components
  import ActionsModal from '$lib/components/ActionsModal.svelte';
  import AnalysisModal from '$lib/components/AnalysisModal.svelte';
  import ConflictsModal from '$lib/components/ConflictsModal.svelte';
  import RecommendationsModal from '$lib/components/RecommendationsModal.svelte';
  import OptimizationResultModal from '$lib/components/OptimizationResultModal.svelte';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  
  let mapContainer: HTMLDivElement;
  let mapInstance: PCIArcGISMapper | null = null;
  
  // Sample data
  const sampleCells: Cell[] = [
    { id: 'CELL001', eNodeB: 1001, sector: 1, pci: 15, latitude: 40.7128, longitude: -74.0060, frequency: 2100, rsPower: -85, towerType: '3-sector', technology: 'LTE', earfcn: 1950, centerFreq: 2100, channelBandwidth: 20, dlEarfcn: 1950, ulEarfcn: 1850 },
    { id: 'CELL002', eNodeB: 1001, sector: 2, pci: 18, latitude: 40.7128, longitude: -74.0060, frequency: 2100, rsPower: -87, azimuth: 120, towerType: '3-sector', technology: 'LTE', earfcn: 1950, centerFreq: 2100, channelBandwidth: 20, dlEarfcn: 1950, ulEarfcn: 1850 },
    { id: 'CELL003', eNodeB: 1001, sector: 3, pci: 21, latitude: 40.7128, longitude: -74.0060, frequency: 2100, rsPower: -83, azimuth: 240, towerType: '3-sector', technology: 'LTE', earfcn: 1950, centerFreq: 2100, channelBandwidth: 20, dlEarfcn: 1950, ulEarfcn: 1850 },
    { id: 'CELL004', eNodeB: 1002, sector: 1, pci: 24, latitude: 40.7689, longitude: -73.9667, frequency: 2100, rsPower: -89, towerType: '3-sector', technology: 'LTE', earfcn: 1950, centerFreq: 2100, channelBandwidth: 20, dlEarfcn: 1950, ulEarfcn: 1850 },
    { id: 'CELL005', eNodeB: 1002, sector: 2, pci: 27, latitude: 40.7689, longitude: -73.9667, frequency: 2100, rsPower: -86, azimuth: 120, towerType: '3-sector', technology: 'LTE', earfcn: 1950, centerFreq: 2100, channelBandwidth: 20, dlEarfcn: 1950, ulEarfcn: 1850 },
    { id: 'CELL006', eNodeB: 1002, sector: 3, pci: 30, latitude: 40.7689, longitude: -73.9667, frequency: 2100, rsPower: -88, azimuth: 240, towerType: '3-sector', technology: 'LTE', earfcn: 1950, centerFreq: 2100, channelBandwidth: 20, dlEarfcn: 1950, ulEarfcn: 1850 },
    { id: 'CELL007', eNodeB: 1003, sector: 1, pci: 33, latitude: 40.7589, longitude: -73.9851, frequency: 3550, rsPower: -85, towerType: '4-sector', technology: 'CBRS', earfcn: 55650, centerFreq: 3550, channelBandwidth: 20, dlEarfcn: 55650, ulEarfcn: 55650 },
    { id: 'CELL008', eNodeB: 1003, sector: 2, pci: 36, latitude: 40.7589, longitude: -73.9851, frequency: 3550, rsPower: -87, azimuth: 90, towerType: '4-sector', technology: 'CBRS', earfcn: 55650, centerFreq: 3550, channelBandwidth: 20, dlEarfcn: 55650, ulEarfcn: 55650 },
    { id: 'CELL009', eNodeB: 1003, sector: 3, pci: 39, latitude: 40.7589, longitude: -73.9851, frequency: 3550, rsPower: -83, azimuth: 180, towerType: '4-sector', technology: 'CBRS', earfcn: 55650, centerFreq: 3550, channelBandwidth: 20, dlEarfcn: 55650, ulEarfcn: 55650 },
    { id: 'CELL010', eNodeB: 1003, sector: 4, pci: 42, latitude: 40.7589, longitude: -73.9851, frequency: 3550, rsPower: -89, azimuth: 270, towerType: '4-sector', technology: 'CBRS', earfcn: 55650, centerFreq: 3550, channelBandwidth: 20, dlEarfcn: 55650, ulEarfcn: 55650 }
  ];
  
  // ========================================================================
  // Lifecycle - Initialize map and load sample data
  // ========================================================================
  
  onMount(() => {
    if (mapContainer) {
      mapInstance = new PCIArcGISMapper(mapContainer);
      mapInstance.enableCellPopup();
      loadSampleData();
    }
  });
  
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
      mapInstance.renderCells(cells);
    }
    
    if (conflicts.length > 0) {
      mapInstance.renderConflicts(conflicts);
    }
  }
  
  // Reactive statement to update map when store changes
  $: if (mapInstance && $cellsStore.items.length > 0) {
    updateMapVisualization();
  }
</script>

<!-- Full Screen Map with Floating UI -->
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

  <!-- Floating Top Bar -->
  <nav class="topbar">
    <div class="topbar-left">
      <h1 class="logo">LTE PCI Mapper</h1>
      <div class="stats-chips">
        <div class="chip">
          <span class="chip-label">Cells</span>
          <span class="chip-value">{$cellCount}</span>
        </div>
        <div class="chip chip-warning">
          <span class="chip-label">Conflicts</span>
          <span class="chip-value">{$conflictCount}</span>
        </div>
        <div class="chip chip-danger">
          <span class="chip-label">Critical</span>
          <span class="chip-value">{$criticalConflictCount}</span>
        </div>
      </div>
    </div>
    <div class="topbar-right">
      <ThemeSwitcher />
      <button class="icon-btn" on:click={() => uiActions.openModal('showActionsModal')} title="Actions">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="1"></circle>
          <circle cx="12" cy="5" r="1"></circle>
          <circle cx="12" cy="19" r="1"></circle>
        </svg>
      </button>
      <button class="icon-btn" on:click={() => uiActions.openModal('showAnalysisModal')} title="Analysis">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
      </button>
      <button class="icon-btn" on:click={() => uiActions.openModal('showConflictsModal')} title="Conflicts">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </button>
      <button class="icon-btn" on:click={() => uiActions.openModal('showRecommendationsModal')} title="Recommendations">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </button>
    </div>
  </nav>

  <!-- Quick Action FAB -->
  <button class="fab" on:click={() => uiActions.openModal('showActionsModal')}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  </button>

  <!-- Modular Components - Isolated and reusable -->
  <ActionsModal 
    show={$uiStore.showActionsModal}
    cells={$cellsStore.items}
    conflicts={$conflictsStore.items}
    recommendations={$analysisStore.recommendations}
    isOptimizing={$optimizationStore.isOptimizing}
    hasData={$hasData}
    hasConflicts={$hasConflicts}
    on:close={() => uiActions.closeModal('showActionsModal')}
    on:import={handleManualImport}
    on:loadSample={loadSampleData}
    on:clearMap={clearMap}
    on:runAnalysis={performAnalysis}
    on:optimize={optimizePCIAssignments}
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
</div>

<style>
  /* App Container */
  .app {
    position: relative;
    width: 100%;
    height: calc(100vh - 100px);
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

  /* Floating Top Bar */
  .topbar {
    position: absolute;
    top: 1rem;
    left: 1rem;
    right: 1rem;
    z-index: 100;
    background: rgba(255,255,255,0.95);
    backdrop-filter: blur(12px);
    border-radius: 16px;
    padding: 1rem 1.5rem;
    box-shadow: 0 8px 32px rgba(0,0,0,0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid var(--border-color);
  }

  [data-theme="dark"] .topbar {
    background: rgba(30,41,59,0.95);
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  .logo {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .stats-chips {
    display: flex;
    gap: 0.75rem;
  }

  .chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border-radius: 24px;
    border: 1px solid var(--border-color);
  }

  .chip-warning {
    background: var(--warning-light);
    border-color: var(--warning-color);
  }

  .chip-danger {
    background: var(--danger-light);
    border-color: var(--danger-color);
  }

  .chip-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .chip-value {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .topbar-right {
    display: flex;
    gap: 0.5rem;
  }

  .icon-btn {
    width: 40px;
    height: 40px;
    border-radius: 12px;
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
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  /* FAB */
  .fab {
    position: absolute;
    bottom: 2rem;
    right: 2rem;
    z-index: 100;
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
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    transition: all 0.3s;
  }

  .fab:hover {
    transform: scale(1.1) translateY(-4px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.3);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .topbar {
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
    }

    .topbar-left {
      flex-direction: column;
      gap: 0.75rem;
      width: 100%;
    }

    .stats-chips {
      width: 100%;
      justify-content: space-between;
    }
  }
</style>