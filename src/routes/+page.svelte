<script lang="ts">
  import { onMount } from 'svelte';
  import { PCIArcGISMapper } from '$lib/arcgisMap';
  import { pciMapper, type Cell } from '$lib/pciMapper';
  import { geminiService } from '$lib/geminiService';
  import ManualImport from '$lib/components/ManualImport.svelte';
  
  let mapContainer: HTMLDivElement;
  let mapInstance: PCIArcGISMapper | null = null;
  
  // State management
  let cells: Cell[] = [];
  let conflicts: any[] = [];
  let analysis: any = null;
  let isLoading = false;
  let currentView: 'map' | 'analysis' | 'recommendations' = 'map';
  let geminiAnalysis: string = '';
  let showAdvancedSettings = false;
  
  // Sample data for demonstration
  const sampleCells: Cell[] = [
    { id: 'CELL001', eNodeB: 1001, sector: 1, pci: 15, latitude: 40.7128, longitude: -74.0060, frequency: 2100, rsPower: -85 },
    { id: 'CELL002', eNodeB: 1002, sector: 2, pci: 18, latitude: 40.7689, longitude: -73.9667, frequency: 2100, rsPower: -87 },
    { id: 'CELL003', eNodeB: 1003, sector: 3, pci: 21, latitude: 40.7589, longitude: -73.9851, frequency: 1800, rsPower: -83 },
    { id: 'CELL004', eNodeB: 1004, sector: 1, pci: 24, latitude: 40.7282, longitude: -73.9942, frequency: 2100, rsPower: -89 },
    { id: 'CELL005', eNodeB: 1005, sector: 2, pci: 27, latitude: 40.7505, longitude: -73.9934, frequency: 1800, rsPower: -86 },
    { id: 'CELL006', eNodeB: 1006, sector: 3, pci: 30, latitude: 40.7614, longitude: -73.9776, frequency: 2100, rsPower: -88 }
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
  }
</style>
