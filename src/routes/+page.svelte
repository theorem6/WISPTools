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
    { id: 'CELL001', eNodeB: 1001, sector: 1, pci: 15, latitude: 40.7128, longitude: -74.0060, frequency: 2100, rsPower: -85, towerType: '3-sector', technology: 'LTE' },
    { id: 'CELL002', eNodeB: 1001, sector: 2, pci: 18, latitude: 40.7128, longitude: -74.0060, frequency: 2100, rsPower: -87, azimuth: 120, towerType: '3-sector', technology: 'LTE' },
    { id: 'CELL003', eNodeB: 1001, sector: 3, pci: 21, latitude: 40.7128, longitude: -74.0060, frequency: 2100, rsPower: -83, azimuth: 240, towerType: '3-sector', technology: 'LTE' },
    { id: 'CELL004', eNodeB: 1002, sector: 1, pci: 24, latitude: 40.7689, longitude: -73.9667, frequency: 2100, rsPower: -89, towerType: '3-sector', technology: 'LTE' },
    { id: 'CELL005', eNodeB: 1002, sector: 2, pci: 27, latitude: 40.7689, longitude: -73.9667, frequency: 2100, rsPower: -86, azimuth: 120, towerType: '3-sector', technology: 'LTE' },
    { id: 'CELL006', eNodeB: 1002, sector: 3, pci: 30, latitude: 40.7689, longitude: -73.9667, frequency: 2100, rsPower: -88, azimuth: 240, towerType: '3-sector', technology: 'LTE' },
    { id: 'CELL007', eNodeB: 1003, sector: 1, pci: 33, latitude: 40.7589, longitude: -73.9851, frequency: 3550, rsPower: -85, towerType: '4-sector', technology: 'CBRS' },
    { id: 'CELL008', eNodeB: 1003, sector: 2, pci: 36, latitude: 40.7589, longitude: -73.9851, frequency: 3550, rsPower: -87, azimuth: 90, towerType: '4-sector', technology: 'CBRS' },
    { id: 'CELL009', eNodeB: 1003, sector: 3, pci: 39, latitude: 40.7589, longitude: -73.9851, frequency: 3550, rsPower: -83, azimuth: 180, towerType: '4-sector', technology: 'CBRS' },
    { id: 'CELL010', eNodeB: 1003, sector: 4, pci: 42, latitude: 40.7589, longitude: -73.9851, frequency: 3550, rsPower: -89, azimuth: 270, towerType: '4-sector', technology: 'CBRS' }
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
      
      // Get AI analysis from Gemini
      await getGeminiAnalysis();
      
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      isLoading = false;
    }
  }
  
  async function getGeminiAnalysis() {
    if (!analysis) return;
    
    try {
      const prompt = `Analyze this LTE PCI conflict data and provide professional recommendations:
      
      Total Cells: ${analysis.totalCells}
      Conflict Rate: ${analysis.conflictRate.toFixed(2)}%
      Critical Conflicts: ${conflicts.filter(c => c.severity === 'CRITICAL').length}
      High Priority Conflicts: ${conflicts.filter(c => c.severity === 'HIGH').length}
      
      Conflict Types:
      - Mod3 Conflicts: ${conflicts.filter(c => c.conflictType === 'MOD3').length}
      - Mod6 Conflicts: ${conflicts.filter(c => c.conflictType === 'MOD6').length}
      - Mod12 Conflicts: ${conflicts.filter(c => c.conflictType === 'MOD12').length}
      - Mod30 Conflicts: ${conflicts.filter(c => c.conflictType === 'MOD30').length}
      
      Please provide specific technical recommendations for resolving these PCI conflicts.`;
      
      geminiAnalysis = await geminiService.analyzePCIConflicts(prompt);
    } catch (error) {
      console.error('Gemini analysis failed:', error);
      geminiAnalysis = 'AI analysis unavailable. Please check Gemini API configuration.';
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
    const data = {
      cells,
      conflicts,
      analysis,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pci-analysis-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  function setView(view: 'map' | 'analysis' | 'recommendations') {
    currentView = view;
  }
</script>

<div class="dashboard">
  <!-- Control Panel -->
  <div class="control-panel">
    <div class="panel-header">
      <h2>PCI Conflict Analyzer</h2>
      <div class="view-tabs">
        <button 
          class="tab-button" 
          class:active={currentView === 'map'}
          on:click={() => setView('map')}
        >
          Map View
        </button>
        <button 
          class="tab-button" 
          class:active={currentView === 'analysis'}
          on:click={() => setView('analysis')}
        >
          Analysis
        </button>
        <button 
          class="tab-button" 
          class:active={currentView === 'recommendations'}
          on:click={() => setView('recommendations')}
        >
          AI Insights
        </button>
      </div>
    </div>
    
    <div class="panel-content">
      <!-- Quick Actions -->
      <div class="action-group">
        <h3>Quick Actions</h3>
        <ManualImport on:import={handleManualImport} />
        
        <!-- Conflict Report Export -->
        <ConflictReportExport {cells} {conflicts} {recommendations} />
        <button 
          class="action-button primary" 
          on:click={loadSampleData}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Load Sample Data'}
        </button>
        <button 
          class="action-button secondary" 
          on:click={performAnalysis}
          disabled={isLoading || !cells.length}
        >
          Run Analysis
        </button>
        <button 
          class="action-button primary optimize-button" 
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
          Clear Map
        </button>
        <button 
          class="action-button secondary" 
          on:click={exportData}

          disabled={!analysis}
        >
          Export Data
        </button>
      </div>
      
      <!-- Map View -->
      {#if currentView === 'map'}
        <div class="map-info">
          <h3>Network Overview</h3>
          <div class="stats-grid">
            <div class="stat">
              <div class="stat-value">{cells.length}</div>
              <div class="stat-label">Total Cells</div>
            </div>
            <div class="stat">
              <div class="stat-value">{conflicts.length}</div>
              <div class="stat-label">Conflicts</div>
            </div>
            <div class="stat">
              <div class="stat-value">{analysis?.conflictRate?.toFixed(1) || '0.0'}%</div>
              <div class="stat-label">Conflict Rate</div>
            </div>
          </div>
          
          <div class="legend">
            <h4>Conflict Severity Legend</h4>
            <div class="legend-item">
              <div class="legend-color critical"></div>
              <span>Critical</span>
            </div>
            <div class="legend-item">
              <div class="legend-color high"></div>
              <span>High</span>
            </div>
            <div class="legend-item">
              <div class="legend-color medium"></div>
              <span>Medium</span>
            </div>
            <div class="legend-item">
              <div class="legend-color low"></div>
              <span>Low</span>
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Analysis View -->
      {#if currentView === 'analysis'}
        <div class="analysis-content">
          <h3>Detailed Analysis</h3>
          
          {#if conflicts.length > 0}
            <div class="conflicts-list">
              <h4>Detected Conflicts ({conflicts.length})</h4>
              {#each conflicts.slice(0, 10) as conflict, i}
                <div class="conflict-item" class:critical={conflict.severity === 'CRITICAL'}>
                  <div class="conflict-header">
                    <span class="severity-badge {conflict.severity.toLowerCase()}">{conflict.severity}</span>
                    <span class="conflict-type">{conflict.conflictType}</span>
                  </div>
                  <div class="conflict-details">
                    <span>{conflict.primaryCell.id} ↔ {conflict.conflictingCell.id}</span>
                    <span>{conflict.distance.toFixed(0)}m distance</span>
                  </div>
                </div>
              {/each}
              
              {#if conflicts.length > 10}
                <p class="more-conflicts">... and {conflicts.length - 10} more conflicts</p>
              {/if}
            </div>
          {:else}
            <p class="no-conflicts">No PCI conflicts detected in the network.</p>
          {/if}
        </div>
      {/if}
      
      <!-- Recommendations View -->
      {#if currentView === 'recommendations'}
        <div class="recommendations-content">
          <h3>AI-Powered Recommendations</h3>
          
          {#if geminiAnalysis}
            <div class="gemini-analysis">
              <div class="analysis-text">{geminiAnalysis}</div>
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
  
  <!-- Map Container -->
  <div class="map-container">
    <div class="map-frame">
      <div bind:this={mapContainer} class="arcgis-map"></div>
      
      {#if isLoading}
        <div class="loading-overlay">
          <div class="spinner"></div>
          <p>Analyzing PCI conflicts...</p>
        </div>
      {/if}
    </div>
  </div>

  <!-- PCI Optimization Results Panel -->
  {#if optimizationResult}
    <div class="optimization-panel">
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
          <h3>Optimization Convergence</h3>
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
          <h3>PCI Changes ({optimizationResult.changes.length})</h3>
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
  {/if}
</div>

<style>
  .dashboard {
    display: flex;
    height: calc(100vh - 140px);
    gap: 1rem;
    padding: 1rem;
  }
  
  .control-panel {
    width: 400px;
    background: var(--card-bg);
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    backdrop-filter: blur(10px);
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-color);
    transition: all 0.3s ease;
  }
  
  .panel-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .panel-header h2 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1.5rem;
  }
  
  .view-tabs {
    display: flex;
    gap: 0.5rem;
  }
  
  .tab-button {
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s ease;
  }
  
  .tab-button:hover {
    background: rgba(102, 126, 234, 0.1);
  }
  
  .tab-button.active {
    background: #667eea;
    color: white;
  }
  
  .panel-content {
    padding: 1.5rem;
    flex: 1;
    overflow-y: auto;
  }
  
  .action-group {
    margin-bottom: 2rem;
  }
  
  .action-group h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1.1rem;
  }
  
  .action-button {
    display: block;
    width: 100%;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.2s ease;
  }
  
  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .action-button.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
  
  .action-button.primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }
  
  .action-button.secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .action-button.secondary:hover:not(:disabled) {
    background: var(--hover-bg);
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .stat {
    text-align: center;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }
  
  .stat-value {
    font-size: 1.8rem;
    font-weight: 700;
    color: #667eea;
    margin-bottom: 0.25rem;
  }
  
  .stat-label {
    font-size: 0.8rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .legend {
    margin-top: 1rem;
  }
  
  .legend h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    color: var(--text-primary);
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
    font-size: 0.8rem;
  }
  
  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  
  .legend-color.critical { background: #dc3545; }
  .legend-color.high { background: #fd7e14; }
  .legend-color.medium { background: #ffc107; }
  .legend-color.low { background: #17a2b8; }
  
  .conflict-item {
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    background: var(--bg-secondary);
    border-radius: 6px;
    border-left: 3px solid var(--border-color);
    border: 1px solid var(--border-color);
  }
  
  .conflict-item.critical {
    border-left-color: #dc3545;
    background: var(--bg-secondary);
  }

  [data-theme="dark"] .conflict-item.critical {
    background: rgba(220, 53, 69, 0.1);
  }
  
  .conflict-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }
  
  .severity-badge {
    padding: 0.2rem 0.5rem;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .severity-badge.critical { background: #dc3545; color: white; }
  .severity-badge.high { background: #fd7e14; color: white; }
  .severity-badge.medium { background: #ffc107; color: black; }
  .severity-badge.low { background: #17a2b8; color: white; }
  
  .conflict-details {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  
  .map-container {
    flex: 1;
    background: var(--card-bg);
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    position: relative;
    border: 1px solid var(--border-color);
    transition: all 0.3s ease;
  }
  
  .map-frame {
    width: 100%;
    height: 100%;
    position: relative;
  }
  
  .arcgis-map {
    width: 100%;
    height: 100%;
  }
  
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .gemini-analysis {
    background: var(--bg-secondary);
    padding: 1rem;
    border-radius: 8px;
    border-left: 4px solid #28a745;
    border: 1px solid var(--border-color);
  }
  
  .analysis-text {
    white-space: pre-wrap;
    line-height: 1.6;
    color: var(--text-primary);
  }
  
  .no-conflicts, .no-recommendations {
    text-align: center;
    color: var(--text-secondary);
    font-style: italic;
    padding: 2rem;
  }
  
  .more-conflicts {
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.8rem;
    margin-top: 1rem;
  }
  
  /* Optimization Panel Styles */
  .optimization-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 800px;
    max-height: 80vh;
    background: var(--card-bg);
    border: 2px solid var(--primary-color);
    border-radius: var(--border-radius);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .optimization-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    background: var(--gradient-primary);
    color: white;
  }

  .optimization-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .close-button {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .optimization-content {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .optimization-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .summary-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1rem;
    text-align: center;
  }

  .summary-card.success {
    background: rgba(40, 167, 69, 0.1);
    border-color: var(--success-color);
  }

  .card-value {
    font-size: 2rem;
    font-weight: bold;
    color: var(--primary-color);
    margin-bottom: 0.5rem;
  }

  .summary-card.success .card-value {
    color: var(--success-color);
  }

  .card-label {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .convergence-chart {
    margin-bottom: 2rem;
  }

  .convergence-chart h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  .chart-container {
    display: flex;
    align-items: flex-end;
    justify-content: space-around;
    height: 150px;
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    padding: 1rem;
    border: 1px solid var(--border-color);
  }

  .chart-bar {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0 0.25rem;
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
    margin-top: 0.25rem;
  }

  .pci-changes {
    margin-bottom: 2rem;
  }

  .pci-changes h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  .changes-list {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    max-height: 300px;
    overflow-y: auto;
  }

  .change-item {
    display: grid;
    grid-template-columns: 100px 120px 1fr;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
    align-items: center;
  }

  .change-item:last-child {
    border-bottom: none;
  }

  .cell-id {
    font-weight: bold;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .pci-change {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: monospace;
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
    padding: 0.75rem 1rem;
    text-align: center;
    color: var(--text-secondary);
    font-style: italic;
    font-size: 0.9rem;
  }

  .optimization-actions {
    text-align: center;
  }

  .optimization-note {
    background: rgba(40, 167, 69, 0.1);
    border: 1px solid var(--success-color);
    border-radius: var(--border-radius);
    padding: 1rem;
    color: var(--text-primary);
    margin: 0;
  }

  .optimize-button {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%) !important;
  }

  .optimize-button:hover:not(:disabled) {
    background: linear-gradient(135deg, #20c997 0%, #28a745 100%) !important;
  }

  @media (max-width: 768px) {
    .dashboard {
      flex-direction: column;
      height: auto;
    }
    
    .control-panel {
      width: 100%;
    }
    
    .map-container {
      height: 400px;
    }

    .optimization-panel {
      width: 95%;
      max-height: 90vh;
    }

    .change-item {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
  }
</style>
