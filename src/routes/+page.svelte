<script lang="ts">
  import { onMount } from 'svelte';
  import { PCIArcGISMapper } from '$lib/arcgisMap';
  import { pciMapper, type Cell } from '$lib/pciMapper';
  import { geminiService } from '$lib/geminiService';
  import { pciOptimizer, type OptimizationResult } from '$lib/pciOptimizer';
  import ManualImport from '$lib/components/ManualImport.svelte';
  import ConflictReportExport from '$lib/components/ConflictReportExport.svelte';
  
  let mapContainer: HTMLDivElement;
  let mapInstance: PCIArcGISMapper | null = null;
  
  // State management
  let cells: Cell[] = [];
  let conflicts: any[] = [];
  let analysis: any = null;
  let recommendations: string[] = [];
  let isLoading = false;
  let geminiAnalysis: string = '';
  let optimizationResult: OptimizationResult | null = null;
  let isOptimizing = false;
  let showSidebar = true;
  
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
  
  onMount(() => {
    if (mapContainer) {
      mapInstance = new PCIArcGISMapper(mapContainer);
      mapInstance.enableCellPopup();
      loadSampleData();
    }
  });
  
  function loadSampleData() {
    cells = [...sampleCells];
    performAnalysis();
  }
  
  function handleManualImport(event: CustomEvent) {
    const importedCells = event.detail.cells;
    const cellsWithPCI = importedCells.map((cell: Cell) => {
      if (cell.pci === -1) {
        const suggestedPCIs = pciMapper.suggestPCI([...cells, ...importedCells.filter((c: Cell) => c.pci !== -1)]);
        return { ...cell, pci: suggestedPCIs[0] || Math.floor(Math.random() * 504) };
      }
      return cell;
    });
    cells = [...cells, ...cellsWithPCI];
    performAnalysis();
  }
  
  async function performAnalysis() {
    if (!cells.length) return;
    isLoading = true;
    try {
      analysis = pciMapper.analyzeConflicts(cells);
      conflicts = analysis.conflicts;
      recommendations = analysis.recommendations;
      
      if (mapInstance) {
        mapInstance.renderCells(cells);
        if (conflicts.length > 0) {
          mapInstance.renderConflicts(conflicts);
        }
      }
      
      const analysisData = conflicts.map(c =>
        `Conflict: ${c.primaryCell.id} (PCI: ${c.primaryCell.pci}) vs ${c.conflictingCell.id} (PCI: ${c.conflictingCell.pci}), Type: ${c.conflictType}, Severity: ${c.severity}, Distance: ${c.distance.toFixed(2)}m`
      ).join('\n');
      geminiAnalysis = await getGeminiAnalysis(analysisData);
    } catch (error) {
      console.error('Error during analysis:', error);
    } finally {
      isLoading = false;
    }
  }
  
  async function getGeminiAnalysis(analysisData: string): Promise<string> {
    if (!analysisData) return "No conflicts to analyze.";
    try {
      return await geminiService.analyzePCIConflicts(analysisData);
    } catch (error) {
      return 'AI analysis unavailable.';
    }
  }
  
  async function optimizePCIAssignments() {
    if (!cells.length) return alert('No cells loaded.');
    if (!conflicts.length) return alert('No conflicts detected.');
    
    isOptimizing = true;
    try {
      optimizationResult = pciOptimizer.optimizePCIAssignments(cells);
      cells = optimizationResult.optimizedCells;
      await performAnalysis();
    } catch (error) {
      console.error('Optimization error:', error);
    } finally {
      isOptimizing = false;
    }
  }

  function clearMap() {
    if (mapInstance) mapInstance.clearMap();
    cells = [];
    conflicts = [];
    analysis = null;
  }
</script>

<div class="app-container">
  <!-- Top Toolbar -->
  <div class="toolbar">
    <button class="toggle-btn" on:click={() => showSidebar = !showSidebar}>
      {showSidebar ? '◀' : '▶'} Menu
    </button>
    <div class="stats-inline">
      <div class="stat-badge">
        <span class="badge-label">Cells</span>
        <span class="badge-value">{cells.length}</span>
      </div>
      <div class="stat-badge warning">
        <span class="badge-label">Conflicts</span>
        <span class="badge-value">{conflicts.length}</span>
      </div>
      <div class="stat-badge">
        <span class="badge-label">Rate</span>
        <span class="badge-value">{analysis ? `${analysis.conflictRate.toFixed(1)}%` : '0%'}</span>
      </div>
      <div class="stat-badge danger">
        <span class="badge-label">Critical</span>
        <span class="badge-value">{conflicts.filter(c => c.severity === 'CRITICAL').length}</span>
      </div>
    </div>
  </div>

  <div class="main-layout">
    <!-- Collapsible Sidebar -->
    {#if showSidebar}
      <aside class="sidebar">
        <!-- Actions -->
        <section class="section">
          <h3>Actions</h3>
          <div class="button-group">
            <ManualImport on:import={handleManualImport} />
            <button class="btn btn-primary" on:click={loadSampleData} disabled={isLoading}>
              Load Sample
            </button>
            <button class="btn btn-success" on:click={optimizePCIAssignments} disabled={isOptimizing || !conflicts.length}>
              {isOptimizing ? 'Optimizing...' : 'Optimize PCIs'}
            </button>
            <button class="btn btn-secondary" on:click={clearMap} disabled={!cells.length}>
              Clear Map
            </button>
          </div>
        </section>

        <!-- Export -->
        <section class="section">
          <h3>Export</h3>
          <ConflictReportExport {cells} {conflicts} {recommendations} />
        </section>

        <!-- Conflicts -->
        {#if conflicts.length > 0}
          <section class="section">
            <h3>Conflicts ({conflicts.length})</h3>
            <div class="conflict-list">
              {#each conflicts.slice(0, 5) as conflict}
                <div class="conflict-item" class:critical={conflict.severity === 'CRITICAL'}>
                  <div class="conflict-row">
                    <span class="conflict-cells">{conflict.primaryCell.id} ↔ {conflict.conflictingCell.id}</span>
                    <span class="conflict-badge {conflict.severity.toLowerCase()}">{conflict.severity}</span>
                  </div>
                  <div class="conflict-info">
                    <span>{conflict.conflictType}</span>
                    <span>{conflict.distance.toFixed(0)}m</span>
                  </div>
                </div>
              {/each}
              {#if conflicts.length > 5}
                <div class="more-link">+{conflicts.length - 5} more conflicts...</div>
              {/if}
            </div>
          </section>
        {/if}
      </aside>
    {/if}

    <!-- Map Area -->
    <main class="map-area">
      <div class="map-wrapper" bind:this={mapContainer}>
        {#if isLoading}
          <div class="loading-overlay">
            <div class="spinner"></div>
            <p>Analyzing conflicts...</p>
          </div>
        {/if}
      </div>
    </main>
  </div>
</div>

<!-- Optimization Modal -->
{#if optimizationResult}
  <div class="modal-backdrop" on:click={() => optimizationResult = null} role="dialog" aria-modal="true">
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Optimization Complete</h2>
        <button class="close-btn" on:click={() => optimizationResult = null}>✕</button>
      </div>
      <div class="modal-content">
        <div class="result-grid">
          <div class="result-item">
            <div class="result-number">{optimizationResult.resolvedConflicts}</div>
            <div class="result-text">Conflicts Resolved</div>
          </div>
          <div class="result-item">
            <div class="result-number">{optimizationResult.conflictReduction.toFixed(0)}%</div>
            <div class="result-text">Reduction</div>
          </div>
          <div class="result-item">
            <div class="result-number">{optimizationResult.iterations}</div>
            <div class="result-text">Iterations</div>
          </div>
        </div>
        <div class="success-box">
          ✓ Optimization has been applied to the map
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .app-container {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 100px);
    background: var(--bg-primary);
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 0.75rem 1rem;
    background: var(--card-bg);
    border-bottom: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
  }

  .toggle-btn {
    padding: 0.5rem 1rem;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .stats-inline {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .stat-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.8rem;
    background: var(--bg-secondary);
    border-radius: 6px;
    border: 1px solid var(--border-color);
  }

  .stat-badge.warning {
    background: var(--warning-light);
    border-color: var(--warning-color);
  }

  .stat-badge.danger {
    background: var(--danger-light);
    border-color: var(--danger-color);
  }

  .badge-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .badge-value {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  /* Main Layout */
  .main-layout {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  /* Sidebar */
  .sidebar {
    width: 320px;
    background: var(--card-bg);
    border-right: 1px solid var(--border-color);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .section {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 1rem;
  }

  .section h3 {
    margin: 0 0 0.75rem 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .button-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .btn {
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }

  .btn-primary {
    background: var(--primary-color);
    color: white;
  }

  .btn-success {
    background: var(--success-color);
    color: white;
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Conflict List */
  .conflict-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .conflict-item {
    padding: 0.75rem;
    background: var(--card-bg);
    border-radius: 6px;
    border-left: 3px solid var(--warning-color);
  }

  .conflict-item.critical {
    border-left-color: var(--danger-color);
    background: var(--danger-light);
  }

  .conflict-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.4rem;
  }

  .conflict-cells {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .conflict-badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .conflict-badge.critical {
    background: var(--danger-color);
    color: white;
  }

  .conflict-badge.high {
    background: var(--warning-color);
    color: white;
  }

  .conflict-badge.medium {
    background: var(--info-color);
    color: white;
  }

  .conflict-badge.low {
    background: var(--success-color);
    color: white;
  }

  .conflict-info {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .more-link {
    padding: 0.5rem;
    text-align: center;
    font-size: 0.85rem;
    color: var(--primary-color);
    font-weight: 500;
  }

  /* Map Area */
  .map-area {
    flex: 1;
    position: relative;
    min-width: 0;
  }

  .map-wrapper {
    width: 100%;
    height: 100%;
    background: var(--bg-secondary);
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.75);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.1rem;
    z-index: 10;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: var(--card-bg);
    border-radius: 12px;
    width: 90%;
    max-width: 500px;
    box-shadow: var(--shadow-xl);
  }

  .modal-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-content {
    padding: 1.5rem;
  }

  .result-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .result-item {
    text-align: center;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 8px;
  }

  .result-number {
    font-size: 2rem;
    font-weight: 700;
    color: var(--success-color);
    line-height: 1;
  }

  .result-text {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-top: 0.5rem;
  }

  .success-box {
    padding: 1rem;
    background: var(--success-light);
    border-radius: 8px;
    text-align: center;
    font-weight: 600;
    color: var(--text-primary);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      height: 100vh;
      z-index: 100;
      box-shadow: var(--shadow-xl);
    }

    .stats-inline {
      overflow-x: auto;
    }
  }
</style>