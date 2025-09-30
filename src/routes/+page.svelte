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
  let currentView: 'map' | 'analysis' | 'recommendations' = 'map';
  let geminiAnalysis: string = '';
  let showAdvancedSettings = false;
  let optimizationResult: OptimizationResult | null = null;
  let isOptimizing = false;
  let showOptimizationPanel = false;
  
  // Sample data for demonstration
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
      
      // Load sample data
      loadSampleData();
    }
  });
  
  function loadSampleData() {
    cells = [...sampleCells];
    performAnalysis();
  }
  
  function handleManualImport(event: CustomEvent) {
    const importedCells = event.detail.cells;
    
    // Auto-assign PCIs for cells with PCI = -1
    const cellsWithPCI = importedCells.map((cell: Cell) => {
      if (cell.pci === -1) {
        // Auto-assign conflict-free PCI
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
      // Perform PCI conflict analysis
      analysis = pciMapper.analyzeConflicts(cells);
      conflicts = analysis.conflicts;
      recommendations = analysis.recommendations;
      
      // Render on map
      if (mapInstance) {
        mapInstance.renderCells(cells);
        if (conflicts.length > 0) {
          mapInstance.renderConflicts(conflicts);
        }
      }
      
      // Get Gemini analysis (now local fallback)
      const analysisData = conflicts.map(c =>
        `Conflict: ${c.primaryCell.id} (PCI: ${c.primaryCell.pci}) vs ${c.conflictingCell.id} (PCI: ${c.conflictingCell.pci}), Type: ${c.conflictType}, Severity: ${c.severity}, Distance: ${c.distance.toFixed(2)}m`
      ).join('\n');
      geminiAnalysis = await getGeminiAnalysis(analysisData);
      
    } catch (error) {
      console.error('Error during analysis:', error);
      geminiAnalysis = 'Error during analysis. Please check console for details.';
    } finally {
      isLoading = false;
    }
  }
  
  async function getGeminiAnalysis(analysisData: string): Promise<string> {
    if (!analysisData) {
      return "No conflicts to analyze.";
    }
    try {
      return await geminiService.analyzePCIConflicts(analysisData);
    } catch (error) {
      console.error('Gemini analysis failed:', error);
      return 'AI analysis unavailable. Please check Gemini API configuration.';
    }
  }
  
  async function optimizePCIAssignments() {
    if (cells.length === 0) {
      alert('No cells loaded. Please import cell data first.');
      return;
    }

    if (conflicts.length === 0) {
      alert('No conflicts detected. Network is already optimized.');
      return;
    }

    isOptimizing = true;
    showOptimizationPanel = true;

    try {
      // Run optimization
      optimizationResult = pciOptimizer.optimizePCIAssignments(cells);

      // Apply optimized PCIs
      cells = optimizationResult.optimizedCells;

      // Re-run analysis with optimized PCIs
      await performAnalysis();

      console.log('PCI optimization complete:', optimizationResult);
    } catch (error) {
      console.error('Optimization error:', error);
      alert('Error during optimization. Check console for details.');
    } finally {
      isOptimizing = false;
    }
  }

  function applyOptimization() {
    if (!optimizationResult) return;

    cells = optimizationResult.optimizedCells;
    optimizationResult = null;
    showOptimizationPanel = false;
    performAnalysis();
  }

  function rejectOptimization() {
    if (!optimizationResult) return;

    cells = optimizationResult.originalCells;
    optimizationResult = null;
    showOptimizationPanel = false;
    performAnalysis();
  }

  function clearMap() {
    if (mapInstance) {
      mapInstance.clearMap();
    }
    cells = [];
    conflicts = [];
    analysis = null;
    geminiAnalysis = '';
  }
  
  function exportData() {
    // This function is now handled by the ConflictReportExport component
    // The component will automatically generate and allow download of reports
    alert('Use the "Export Report" buttons in the Conflict Report Export section.');
  }
</script>

<div class="dashboard">
  <div class="control-panel">
    <div class="panel-header">
      <h2>📡 LTE PCI Mapper</h2>
      <div class="view-tabs">
        <button 
          class="tab-button" 
          class:active={currentView === 'map'}
          on:click={() => currentView = 'map'}
        >
          🗺️ Map
        </button>
        <button 
          class="tab-button" 
          class:active={currentView === 'analysis'}
          on:click={() => currentView = 'analysis'}
        >
          📊 Analysis
        </button>
        <button 
          class="tab-button" 
          class:active={currentView === 'recommendations'}
          on:click={() => currentView = 'recommendations'}
        >
          💡 Recommendations
        </button>
      </div>
    </div>
    
    <div class="panel-content">
      <!-- Quick Actions -->
      <div class="action-group">
        <h3>⚡ Quick Actions</h3>
        <ManualImport on:import={handleManualImport} />
        
        <!-- Conflict Report Export -->
        <ConflictReportExport {cells} {conflicts} {recommendations} />
        
        <div class="button-grid">
          <button 
            class="action-button primary" 
            on:click={loadSampleData}
            disabled={isLoading}
          >
            {isLoading ? '⏳ Loading...' : '📊 Load Sample Data'}
          </button>
          <button 
            class="action-button secondary" 
            on:click={performAnalysis}
            disabled={isLoading || !cells.length}
          >
            🔍 Run Analysis
          </button>
          <button 
            class="action-button success optimize-button" 
            on:click={optimizePCIAssignments}
            disabled={isOptimizing || !conflicts.length}
          >
            {#if isOptimizing}
              ⚙️ Optimizing...
            {:else}
              🎯 Auto-Optimize PCIs
            {/if}
          </button>
          <button 
            class="action-button secondary" 
            on:click={clearMap}
            disabled={!cells.length}
          >
            🗑️ Clear Map
          </button>
        </div>
      </div>

      <!-- Analysis Results -->
      {#if currentView === 'analysis'}
        <div class="analysis-results card">
          <h3>📈 Analysis Summary</h3>
          {#if analysis}
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value">{analysis.totalCells}</div>
                <div class="stat-label">Total Cells</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{analysis.conflicts.length}</div>
                <div class="stat-label">Conflicts</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{analysis.conflictRate.toFixed(2)}%</div>
                <div class="stat-label">Conflict Rate</div>
              </div>
            </div>
            
            <h4>🔍 Conflict Details</h4>
            {#if analysis.conflicts.length > 0}
              <div class="conflicts-list">
                {#each analysis.conflicts as conflict}
                  <div class="conflict-item" class:critical={conflict.severity === 'CRITICAL'}>
                    <div class="conflict-header">
                      <span class="cell-id">{conflict.primaryCell.id}</span>
                      <span class="conflict-type">{conflict.conflictType}</span>
                      <span class="severity" class:critical={conflict.severity === 'CRITICAL'}>{conflict.severity}</span>
                    </div>
                    <div class="conflict-details">
                      vs {conflict.conflictingCell.id} at {conflict.distance.toFixed(2)}m
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="no-conflicts">✅ No conflicts detected.</p>
            {/if}
          {:else}
            <p>Run analysis to see results...</p>
          {/if}
        </div>
      {/if}

      <!-- Recommendations -->
      {#if currentView === 'recommendations'}
        <div class="recommendations-section card">
          <h3>💡 Recommendations</h3>
          {#if geminiAnalysis}
            <div class="gemini-analysis">
              {@html geminiAnalysis.replace(/\n/g, '<br>')}
            </div>
          {:else if analysis?.recommendations}
            <div class="basic-recommendations">
              <h4>System Recommendations</h4>
              <ul>
                {#each analysis.recommendations as rec}
                  <li>{rec}</li>
                {/each}
              </ul>
            </div>
          {:else}
            <p class="no-recommendations">Run analysis to get recommendations...</p>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <div class="map-container" bind:this={mapContainer} id="mapView">
    {#if isLoading}
      <div class="loading-overlay">
        <div class="spinner"></div>
        <p>🔍 Analyzing PCI conflicts...</p>
      </div>
    {/if}
  </div>
</div>

<!-- PCI Optimization Results Panel -->
{#if optimizationResult}
  <div class="optimization-panel">
    <div class="optimization-panel-content">
      <div class="optimization-header">
        <h2>🎯 PCI Optimization Results</h2>
        <button class="close-button" on:click={() => optimizationResult = null}>✕</button>
      </div>
      
      <div class="optimization-content">
        <div class="optimization-summary">
          <div class="summary-card">
            <div class="card-value">{optimizationResult.iterations}</div>
            <div class="card-label">Iterations</div>
          </div>
          <div class="summary-card">
            <div class="card-value">{optimizationResult.originalConflicts}</div>
            <div class="card-label">Original Conflicts</div>
          </div>
          <div class="summary-card success">
            <div class="card-value">{optimizationResult.finalConflicts}</div>
            <div class="card-label">Final Conflicts</div>
          </div>
          <div class="summary-card success">
            <div class="card-value">{optimizationResult.resolvedConflicts}</div>
            <div class="card-label">Resolved</div>
          </div>
          <div class="summary-card success">
            <div class="card-value">{optimizationResult.conflictReduction.toFixed(1)}%</div>
            <div class="card-label">Reduction</div>
          </div>
        </div>

        <div class="convergence-chart">
          <h3>📊 Optimization Convergence</h3>
          <div class="chart-container">
            {#each optimizationResult.convergenceHistory as iteration, index}
              <div class="chart-bar">
                <div 
                  class="bar-fill" 
                  style="height: {(iteration.conflictCount / optimizationResult.originalConflicts) * 100}%"
                  title="Iteration {iteration.iteration}: {iteration.conflictCount} conflicts"
                ></div>
                <div class="bar-label">I{iteration.iteration}</div>
              </div>
            {/each}
          </div>
        </div>

        <div class="pci-changes">
          <h3>🔄 PCI Changes ({optimizationResult.changes.length})</h3>
          <div class="changes-list">
            {#each optimizationResult.changes.slice(0, 10) as change}
              <div class="change-item">
                <span class="cell-id">{change.cellId}</span>
                <span class="pci-change">
                  <span class="old-pci">{change.oldPCI}</span>
                  <span class="arrow">→</span>
                  <span class="new-pci">{change.newPCI}</span>
                </span>
                <span class="change-reason">{change.reason}</span>
              </div>
            {/each}
            {#if optimizationResult.changes.length > 10}
              <div class="more-changes">
                +{optimizationResult.changes.length - 10} more changes...
              </div>
            {/if}
          </div>
        </div>

        <div class="optimization-actions">
          <p class="optimization-note">
            ✅ Optimization has been automatically applied. The map shows the optimized PCI assignments.
          </p>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .dashboard {
    display: flex;
    height: calc(100vh - 80px);
    gap: var(--spacing-lg);
    padding: var(--spacing-lg);
    background: var(--bg-primary);
  }
  
  .control-panel {
    width: 420px;
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-xl);
    backdrop-filter: blur(12px);
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-color);
    transition: var(--transition);
    position: relative;
    overflow: hidden;
  }
  
  .panel-header {
    padding: var(--spacing-xl);
    background: var(--gradient-primary);
    color: var(--text-inverse);
    border-bottom: 1px solid var(--border-color);
  }
  
  .panel-header h2 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-inverse);
    font-size: 1.6rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }
  
  .view-tabs {
    display: flex;
    gap: var(--spacing-xs);
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--border-radius-sm);
    padding: var(--spacing-xs);
  }
  
  .tab-button {
    padding: var(--spacing-sm) var(--spacing-md);
    border: none;
    background: transparent;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    transition: var(--transition);
  }
  
  .tab-button:hover {
    background: rgba(255, 255, 255, 0.15);
    color: var(--text-inverse);
  }
  
  .tab-button.active {
    background: rgba(255, 255, 255, 0.2);
    color: var(--text-inverse);
    font-weight: 600;
  }
  
  .panel-content {
    padding: var(--spacing-xl);
    flex: 1;
    overflow-y: auto;
    background: var(--bg-primary);
  }
  
  .action-group {
    margin-bottom: var(--spacing-2xl);
    padding: var(--spacing-xl);
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
  }
  
  .action-group h3 {
    margin: 0 0 var(--spacing-lg) 0;
    color: var(--text-primary);
    font-size: 1.3rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }
  
  .button-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);
    margin-top: var(--spacing-lg);
  }
  
  .action-button {
    padding: var(--spacing-md) var(--spacing-lg);
    border: none;
    border-radius: var(--border-radius);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    box-shadow: var(--shadow-sm);
  }

  .action-button.primary {
    background: var(--primary-color);
    color: var(--text-inverse);
  }

  .action-button.primary:hover:not(:disabled) {
    background: var(--primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .action-button.secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .action-button.secondary:hover:not(:disabled) {
    background: var(--hover-bg);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .action-button.success {
    background: var(--success-color);
    color: var(--text-inverse);
    border: 1px solid var(--success-color);
  }

  .action-button.success:hover:not(:disabled) {
    background: var(--success-color);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .action-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .map-container {
    flex-grow: 1;
    position: relative;
    background: var(--bg-primary);
    border-radius: var(--border-radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-color);
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-inverse);
    font-size: 1.2rem;
    z-index: 50;
  }

  .spinner {
    border: 4px solid var(--border-color);
    border-top: 4px solid var(--primary-color);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin-bottom: var(--spacing-md);
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .card {
    background: var(--card-bg);
    border-radius: var(--border-radius);
    padding: var(--spacing-xl);
    margin-bottom: var(--spacing-xl);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--border-color);
  }

  .card h3 {
    margin-top: 0;
    margin-bottom: var(--spacing-lg);
    color: var(--text-primary);
    font-size: 1.3rem;
    font-weight: 600;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
  }

  .stat-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
    text-align: center;
    transition: var(--transition);
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .stat-value {
    font-size: 2rem;
    font-weight: bold;
    color: var(--primary-color);
    margin-bottom: var(--spacing-sm);
  }

  .stat-label {
    font-size: 0.9rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .conflicts-list {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--bg-secondary);
  }

  .conflict-item {
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border-color);
    transition: var(--transition);
  }

  .conflict-item:last-child {
    border-bottom: none;
  }

  .conflict-item.critical {
    background: var(--danger-light);
    border-left: 4px solid var(--danger-color);
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

  .conflict-type {
    font-size: 0.8rem;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
  }

  .severity {
    font-size: 0.8rem;
    font-weight: 600;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
    background: var(--warning-light);
    color: var(--warning-color);
  }

  .severity.critical {
    background: var(--danger-light);
    color: var(--danger-color);
  }

  .conflict-details {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .no-conflicts {
    text-align: center;
    color: var(--success-color);
    font-weight: 600;
    padding: var(--spacing-xl);
  }

  .gemini-analysis {
    white-space: pre-wrap;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
    font-size: 0.9rem;
    background: var(--bg-secondary);
    padding: var(--spacing-lg);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    line-height: 1.6;
  }

  .no-recommendations {
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin-top: var(--spacing-lg);
  }

  /* Optimization Panel Styles */
  .optimization-panel {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-lg);
  }

  .optimization-panel-content {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-xl);
    width: 100%;
    max-width: 900px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .optimization-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-xl);
    background: var(--gradient-primary);
    color: var(--text-inverse);
    border-bottom: 1px solid var(--border-color);
  }

  .optimization-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .close-button {
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: var(--text-inverse);
    width: 36px;
    height: 36px;
    border-radius: var(--border-radius);
    cursor: pointer;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: var(--transition);
    backdrop-filter: blur(4px);
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.3);
    transform: scale(1.05);
  }

  .optimization-content {
    padding: var(--spacing-xl);
    overflow-y: auto;
    flex: 1;
    background: var(--bg-primary);
  }

  .optimization-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-2xl);
  }

  .summary-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
    text-align: center;
    transition: var(--transition);
    box-shadow: var(--shadow-sm);
  }

  .summary-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .summary-card.success {
    background: var(--success-light);
    border-color: var(--success-color);
  }

  .card-value {
    font-size: 2rem;
    font-weight: bold;
    color: var(--primary-color);
    margin-bottom: var(--spacing-sm);
  }

  .summary-card.success .card-value {
    color: var(--success-color);
  }

  .card-label {
    font-size: 0.9rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .convergence-chart {
    margin-bottom: var(--spacing-2xl);
  }

  .convergence-chart h3 {
    margin: 0 0 var(--spacing-lg) 0;
    color: var(--text-primary);
    font-size: 1.2rem;
    font-weight: 600;
  }

  .chart-container {
    display: flex;
    align-items: flex-end;
    justify-content: space-around;
    height: 160px;
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
  }

  .chart-bar {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0 var(--spacing-xs);
  }

  .bar-fill {
    width: 100%;
    background: linear-gradient(to top, var(--primary-color), var(--success-color));
    border-radius: 4px 4px 0 0;
    transition: height 0.3s ease;
    min-height: 4px;
  }

  .bar-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: var(--spacing-xs);
  }

  .pci-changes {
    margin-bottom: var(--spacing-2xl);
  }

  .pci-changes h3 {
    margin: 0 0 var(--spacing-lg) 0;
    color: var(--text-primary);
    font-size: 1.2rem;
    font-weight: 600;
  }

  .changes-list {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    max-height: 320px;
    overflow-y: auto;
    box-shadow: var(--shadow-sm);
  }

  .change-item {
    display: grid;
    grid-template-columns: 100px 120px 1fr;
    gap: var(--spacing-lg);
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
    align-items: center;
  }

  .change-item:last-child {
    border-bottom: none;
  }

  .change-item .cell-id {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .pci-change {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-family: monospace;
    font-size: 0.9rem;
  }

  .old-pci {
    color: var(--danger-color);
    font-weight: bold;
  }

  .arrow {
    color: var(--text-secondary);
  }

  .new-pci {
    color: var(--success-color);
    font-weight: bold;
  }

  .change-reason {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .more-changes {
    padding: var(--spacing-md) var(--spacing-lg);
    text-align: center;
    color: var(--text-secondary);
    font-style: italic;
    font-size: 0.9rem;
  }

  .optimization-actions {
    text-align: center;
  }

  .optimization-note {
    background: var(--success-light);
    border: 1px solid var(--success-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
    color: var(--text-primary);
    margin: 0;
    font-weight: 500;
    box-shadow: var(--shadow-sm);
  }

  .optimize-button {
    background: var(--gradient-success) !important;
    border: 1px solid var(--success-color);
    box-shadow: var(--shadow-sm);
  }

  .optimize-button:hover:not(:disabled) {
    background: var(--success-color) !important;
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  @media (max-width: 768px) {
    .dashboard {
      flex-direction: column;
      height: auto;
      padding: var(--spacing-md);
    }
    
    .control-panel {
      width: 100%;
      margin-bottom: var(--spacing-lg);
    }
    
    .map-container {
      height: 400px;
    }

    .optimization-panel {
      padding: var(--spacing-md);
    }

    .optimization-panel-content {
      max-height: 95vh;
    }

    .change-item {
      grid-template-columns: 1fr;
      gap: var(--spacing-sm);
    }

    .button-grid {
      grid-template-columns: 1fr;
    }
  }
</style>