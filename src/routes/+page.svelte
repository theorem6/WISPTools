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

<!-- Modern Card-Based Layout -->
<div class="app-layout">
  <!-- Top Stats Dashboard -->
  <div class="stats-dashboard">
    <div class="stat-card">
      <div class="stat-icon">📡</div>
      <div class="stat-info">
        <div class="stat-value">{cells.length}</div>
        <div class="stat-label">Total Cells</div>
      </div>
    </div>
    <div class="stat-card" class:warning={conflicts.length > 0}>
      <div class="stat-icon">⚠️</div>
      <div class="stat-info">
        <div class="stat-value">{conflicts.length}</div>
        <div class="stat-label">Conflicts</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">📊</div>
      <div class="stat-info">
        <div class="stat-value">{analysis ? `${analysis.conflictRate.toFixed(1)}%` : '0%'}</div>
        <div class="stat-label">Conflict Rate</div>
      </div>
    </div>
    <div class="stat-card" class:critical={conflicts.filter(c => c.severity === 'CRITICAL').length > 0}>
      <div class="stat-icon">🔴</div>
      <div class="stat-info">
        <div class="stat-value">{conflicts.filter(c => c.severity === 'CRITICAL').length}</div>
        <div class="stat-label">Critical</div>
      </div>
    </div>
  </div>

  <!-- Main Grid Layout -->
  <div class="content-grid">
    <!-- Left Panel - Actions & Controls -->
    <div class="left-panel">
      <div class="panel-card">
        <h3>⚡ Actions</h3>
        <div class="action-buttons">
          <ManualImport on:import={handleManualImport} />
          <button class="btn btn-primary" on:click={loadSampleData} disabled={isLoading}>
            📊 Load Sample
          </button>
          <button class="btn btn-success" on:click={optimizePCIAssignments} disabled={isOptimizing || !conflicts.length}>
            {isOptimizing ? '⚙️ Optimizing...' : '🎯 Optimize PCIs'}
          </button>
          <button class="btn btn-secondary" on:click={clearMap} disabled={!cells.length}>
            🗑️ Clear
          </button>
        </div>
      </div>

      <div class="panel-card">
        <h3>📤 Export</h3>
        <ConflictReportExport {cells} {conflicts} {recommendations} />
      </div>

      {#if analysis}
        <div class="panel-card">
          <h3>📊 Summary</h3>
          <div class="summary-list">
            <div class="summary-item">
              <span>Total Cells</span>
              <strong>{analysis.totalCells}</strong>
            </div>
            <div class="summary-item">
              <span>Conflicts</span>
              <strong>{analysis.conflicts.length}</strong>
            </div>
            <div class="summary-item">
              <span>Critical</span>
              <strong class="critical">{conflicts.filter(c => c.severity === 'CRITICAL').length}</strong>
            </div>
            <div class="summary-item">
              <span>High</span>
              <strong class="high">{conflicts.filter(c => c.severity === 'HIGH').length}</strong>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Center - Map -->
    <div class="map-panel">
      <div class="map-container" bind:this={mapContainer}>
        {#if isLoading}
          <div class="loading-overlay">
            <div class="spinner"></div>
            <p>Analyzing conflicts...</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Right Panel - Analysis -->
    <div class="right-panel">
      {#if conflicts.length > 0}
        <div class="panel-card">
          <h3>⚠️ Conflicts</h3>
          <div class="conflicts-list">
            {#each conflicts.slice(0, 10) as conflict}
              <div class="conflict-card" class:critical={conflict.severity === 'CRITICAL'}>
                <div class="conflict-header">
                  <span class="cell-id">{conflict.primaryCell.id}</span>
                  <span class="severity-badge {conflict.severity.toLowerCase()}">{conflict.severity}</span>
                </div>
                <div class="conflict-details">
                  <span>vs {conflict.conflictingCell.id}</span>
                  <span>{conflict.distance.toFixed(0)}m</span>
                </div>
                <div class="conflict-type">{conflict.conflictType}</div>
              </div>
            {/each}
            {#if conflicts.length > 10}
              <div class="more-conflicts">+{conflicts.length - 10} more...</div>
            {/if}
          </div>
        </div>
      {/if}

      {#if geminiAnalysis}
        <div class="panel-card">
          <h3>💡 AI Recommendations</h3>
          <div class="ai-analysis">
            {@html geminiAnalysis.replace(/\n/g, '<br>')}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Optimization Results Modal -->
{#if optimizationResult}
  <div class="modal-overlay">
    <div class="modal-content">
      <div class="modal-header">
        <h2>🎯 Optimization Results</h2>
        <button class="close-btn" on:click={() => optimizationResult = null}>✕</button>
      </div>
      <div class="modal-body">
        <div class="results-grid">
          <div class="result-card">
            <div class="result-value">{optimizationResult.resolvedConflicts}</div>
            <div class="result-label">Resolved</div>
          </div>
          <div class="result-card">
            <div class="result-value">{optimizationResult.conflictReduction.toFixed(0)}%</div>
            <div class="result-label">Reduction</div>
          </div>
          <div class="result-card">
            <div class="result-value">{optimizationResult.iterations}</div>
            <div class="result-label">Iterations</div>
          </div>
        </div>
        <div class="success-message">
          ✅ Optimization applied successfully!
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .app-layout {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    padding: var(--spacing-lg);
    height: calc(100vh - 100px);
    background: var(--bg-primary);
  }

  /* Stats Dashboard */
  .stats-dashboard {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-lg);
  }

  .stat-card {
    background: var(--card-bg);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    box-shadow: var(--shadow-md);
    border: 2px solid var(--border-color);
    transition: var(--transition);
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  .stat-card.warning {
    border-color: var(--warning-color);
  }

  .stat-card.critical {
    border-color: var(--danger-color);
  }

  .stat-icon {
    font-size: 2.5rem;
  }

  .stat-info {
    flex: 1;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: bold;
    color: var(--text-primary);
    line-height: 1;
  }

  .stat-label {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-top: var(--spacing-xs);
  }

  /* Content Grid */
  .content-grid {
    display: grid;
    grid-template-columns: 300px 1fr 300px;
    gap: var(--spacing-lg);
    flex: 1;
    min-height: 0;
  }

  /* Panels */
  .left-panel, .right-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    overflow-y: auto;
  }

  .panel-card {
    background: var(--card-bg);
    border-radius: var(--border-radius);
    padding: var(--spacing-xl);
    box-shadow: var(--shadow-md);
    border: 1px solid var(--border-color);
  }

  .panel-card h3 {
    margin: 0 0 var(--spacing-lg) 0;
    font-size: 1.2rem;
    color: var(--text-primary);
  }

  /* Action Buttons */
  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .btn {
    padding: var(--spacing-md);
    border: none;
    border-radius: var(--border-radius);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
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
  }

  .btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Map */
  .map-panel {
    position: relative;
    border-radius: var(--border-radius);
    overflow: hidden;
    box-shadow: var(--shadow-lg);
  }

  .map-container {
    width: 100%;
    height: 100%;
    background: var(--card-bg);
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Conflicts List */
  .conflicts-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    max-height: 500px;
    overflow-y: auto;
  }

  .conflict-card {
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    border-radius: var(--border-radius-sm);
    border-left: 4px solid var(--warning-color);
  }

  .conflict-card.critical {
    border-left-color: var(--danger-color);
    background: var(--danger-light);
  }

  .conflict-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-xs);
  }

  .cell-id {
    font-weight: 600;
    color: var(--text-primary);
  }

  .severity-badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .severity-badge.critical {
    background: var(--danger-color);
    color: white;
  }

  .severity-badge.high {
    background: var(--warning-color);
    color: white;
  }

  .conflict-details {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .conflict-type {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: var(--spacing-xs);
  }

  /* Summary */
  .summary-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .summary-item {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-sm);
    background: var(--bg-secondary);
    border-radius: var(--border-radius-sm);
  }

  .summary-item strong.critical {
    color: var(--danger-color);
  }

  .summary-item strong.high {
    color: var(--warning-color);
  }

  /* AI Analysis */
  .ai-analysis {
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--text-secondary);
    max-height: 400px;
    overflow-y: auto;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .modal-content {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    width: 90%;
    max-width: 600px;
    box-shadow: var(--shadow-xl);
  }

  .modal-header {
    padding: var(--spacing-xl);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-header h2 {
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
  }

  .modal-body {
    padding: var(--spacing-xl);
  }

  .results-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
  }

  .result-card {
    text-align: center;
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
  }

  .result-value {
    font-size: 2.5rem;
    font-weight: bold;
    color: var(--success-color);
  }

  .result-label {
    color: var(--text-secondary);
    margin-top: var(--spacing-sm);
  }

  .success-message {
    padding: var(--spacing-lg);
    background: var(--success-light);
    border-radius: var(--border-radius);
    text-align: center;
    font-weight: 600;
    color: var(--text-primary);
  }

  /* Responsive */
  @media (max-width: 1200px) {
    .content-grid {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr auto;
    }

    .right-panel {
      max-height: 400px;
    }
  }
</style>