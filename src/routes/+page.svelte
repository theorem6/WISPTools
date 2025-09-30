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
  
  // Modal states
  let showActionsModal = false;
  let showAnalysisModal = false;
  let showConflictsModal = false;
  let showRecommendationsModal = false;
  
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

<!-- Full Screen Map with Floating UI -->
<div class="app">
  <!-- Map Background -->
  <div class="map-fullscreen" bind:this={mapContainer}>
    {#if isLoading}
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
          <span class="chip-value">{cells.length}</span>
        </div>
        <div class="chip chip-warning">
          <span class="chip-label">Conflicts</span>
          <span class="chip-value">{conflicts.length}</span>
        </div>
        <div class="chip chip-danger">
          <span class="chip-label">Critical</span>
          <span class="chip-value">{conflicts.filter(c => c.severity === 'CRITICAL').length}</span>
        </div>
      </div>
    </div>
    <div class="topbar-right">
      <button class="icon-btn" on:click={() => showActionsModal = true} title="Actions">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="1"></circle>
          <circle cx="12" cy="5" r="1"></circle>
          <circle cx="12" cy="19" r="1"></circle>
        </svg>
      </button>
      <button class="icon-btn" on:click={() => showAnalysisModal = true} title="Analysis">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
      </button>
      <button class="icon-btn" on:click={() => showConflictsModal = true} title="Conflicts">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </button>
      <button class="icon-btn" on:click={() => showRecommendationsModal = true} title="Recommendations">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </button>
    </div>
  </nav>

  <!-- Quick Action FAB -->
  <button class="fab" on:click={() => showActionsModal = true}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  </button>

  <!-- Actions Modal -->
  {#if showActionsModal}
    <div class="modal-overlay" on:click={() => showActionsModal = false}>
      <div class="modal" on:click|stopPropagation>
        <div class="modal-header">
          <h2>Actions</h2>
          <button class="close-btn" on:click={() => showActionsModal = false}>×</button>
        </div>
        <div class="modal-body">
          <div class="action-grid">
            <div class="action-section">
              <h3>Data Management</h3>
              <ManualImport on:import={handleManualImport} />
              <button class="action-btn" on:click={() => { loadSampleData(); showActionsModal = false; }}>
                <span class="action-icon">📊</span>
                <span class="action-text">Load Sample Data</span>
              </button>
              <button class="action-btn" on:click={() => { clearMap(); showActionsModal = false; }} disabled={!cells.length}>
                <span class="action-icon">🗑️</span>
                <span class="action-text">Clear Map</span>
              </button>
            </div>
            
            <div class="action-section">
              <h3>Analysis & Optimization</h3>
              <button class="action-btn primary" on:click={() => { performAnalysis(); showActionsModal = false; }} disabled={!cells.length}>
                <span class="action-icon">🔍</span>
                <span class="action-text">Run Analysis</span>
              </button>
              <button class="action-btn success" on:click={() => { optimizePCIAssignments(); showActionsModal = false; }} disabled={isOptimizing || !conflicts.length}>
                <span class="action-icon">{isOptimizing ? '⚙️' : '🎯'}</span>
                <span class="action-text">{isOptimizing ? 'Optimizing...' : 'Optimize PCIs'}</span>
              </button>
            </div>
            
            <div class="action-section full-width">
              <h3>Export Reports</h3>
              <ConflictReportExport {cells} {conflicts} {recommendations} />
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Analysis Modal -->
  {#if showAnalysisModal && analysis}
    <div class="modal-overlay" on:click={() => showAnalysisModal = false}>
      <div class="modal" on:click|stopPropagation>
        <div class="modal-header">
          <h2>Analysis Summary</h2>
          <button class="close-btn" on:click={() => showAnalysisModal = false}>×</button>
        </div>
        <div class="modal-body">
          <div class="stats-grid">
            <div class="stat-box">
              <div class="stat-number">{analysis.totalCells}</div>
              <div class="stat-label">Total Cells</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">{analysis.conflicts.length}</div>
              <div class="stat-label">Conflicts</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">{analysis.conflictRate.toFixed(1)}%</div>
              <div class="stat-label">Conflict Rate</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">{conflicts.filter(c => c.severity === 'CRITICAL').length}</div>
              <div class="stat-label">Critical</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">{conflicts.filter(c => c.severity === 'HIGH').length}</div>
              <div class="stat-label">High</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">{conflicts.filter(c => c.severity === 'MEDIUM').length}</div>
              <div class="stat-label">Medium</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Conflicts Modal -->
  {#if showConflictsModal}
    <div class="modal-overlay" on:click={() => showConflictsModal = false}>
      <div class="modal modal-large" on:click|stopPropagation>
        <div class="modal-header">
          <h2>Conflicts ({conflicts.length})</h2>
          <button class="close-btn" on:click={() => showConflictsModal = false}>×</button>
        </div>
        <div class="modal-body scrollable">
          {#if conflicts.length > 0}
            <div class="conflicts-table">
              {#each conflicts as conflict}
                <div class="conflict-row {conflict.severity.toLowerCase()}">
                  <div class="conflict-cells">
                    <span class="cell-name">{conflict.primaryCell.id}</span>
                    <span class="arrow">→</span>
                    <span class="cell-name">{conflict.conflictingCell.id}</span>
                  </div>
                  <div class="conflict-meta">
                    <span class="badge {conflict.severity.toLowerCase()}">{conflict.severity}</span>
                    <span class="type">{conflict.conflictType}</span>
                    <span class="distance">{conflict.distance.toFixed(0)}m</span>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-state">
              <p>✓ No conflicts detected</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Recommendations Modal -->
  {#if showRecommendationsModal && geminiAnalysis}
    <div class="modal-overlay" on:click={() => showRecommendationsModal = false}>
      <div class="modal modal-large" on:click|stopPropagation>
        <div class="modal-header">
          <h2>AI Recommendations</h2>
          <button class="close-btn" on:click={() => showRecommendationsModal = false}>×</button>
        </div>
        <div class="modal-body scrollable">
          <div class="recommendations">
            {@html geminiAnalysis.replace(/\n/g, '<br>')}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Optimization Result Modal -->
  {#if optimizationResult}
    <div class="modal-overlay" on:click={() => optimizationResult = null}>
      <div class="modal" on:click|stopPropagation>
        <div class="modal-header">
          <h2>Optimization Complete</h2>
          <button class="close-btn" on:click={() => optimizationResult = null}>×</button>
        </div>
        <div class="modal-body">
          <div class="success-banner">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <p>Successfully optimized PCI assignments</p>
          </div>
          <div class="result-stats">
            <div class="result-item">
              <div class="result-value">{optimizationResult.resolvedConflicts}</div>
              <div class="result-label">Conflicts Resolved</div>
            </div>
            <div class="result-item">
              <div class="result-value">{optimizationResult.conflictReduction.toFixed(0)}%</div>
              <div class="result-label">Reduction</div>
            </div>
            <div class="result-item">
              <div class="result-value">{optimizationResult.iterations}</div>
              <div class="result-label">Iterations</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
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

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    animation: fadeIn 0.2s;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal {
    background: var(--card-bg);
    border-radius: 20px;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s;
  }

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .modal-large {
    max-width: 800px;
  }

  .modal-header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--danger-light);
    color: var(--danger-color);
  }

  .modal-body {
    padding: 2rem;
    overflow-y: auto;
  }

  .modal-body.scrollable {
    max-height: calc(90vh - 120px);
  }

  /* Action Grid */
  .action-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
  }

  .action-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .action-section.full-width {
    grid-column: 1 / -1;
  }

  .action-section h3 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    background: var(--card-bg);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .action-btn:hover:not(:disabled) {
    background: var(--hover-bg);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.primary {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
  }

  .action-btn.success {
    background: var(--success-color);
    color: white;
    border-color: var(--success-color);
  }

  .action-icon {
    font-size: 1.5rem;
  }

  .action-text {
    font-size: 0.95rem;
    font-weight: 500;
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  .stat-box {
    text-align: center;
    padding: 1.5rem;
    background: var(--bg-secondary);
    border-radius: 12px;
    border: 1px solid var(--border-color);
  }

  .stat-number {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--primary-color);
    line-height: 1;
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.5rem;
  }

  /* Conflicts Table */
  .conflicts-table {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .conflict-row {
    padding: 1rem 1.25rem;
    background: var(--bg-secondary);
    border-radius: 12px;
    border-left: 4px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .conflict-row.critical {
    border-left-color: var(--danger-color);
    background: var(--danger-light);
  }

  .conflict-row.high {
    border-left-color: var(--warning-color);
  }

  .conflict-cells {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .cell-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .arrow {
    color: var(--text-secondary);
  }

  .conflict-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .badge {
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .badge.critical {
    background: var(--danger-color);
    color: white;
  }

  .badge.high {
    background: var(--warning-color);
    color: white;
  }

  .badge.medium {
    background: var(--info-color);
    color: white;
  }

  .type, .distance {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  /* Recommendations */
  .recommendations {
    line-height: 1.8;
    color: var(--text-primary);
  }

  /* Success Banner */
  .success-banner {
    text-align: center;
    padding: 2rem;
    background: var(--success-light);
    border-radius: 12px;
    margin-bottom: 2rem;
  }

  .success-banner svg {
    stroke: var(--success-color);
    margin-bottom: 1rem;
  }

  .success-banner p {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .result-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  .result-item {
    text-align: center;
    padding: 1.5rem;
    background: var(--bg-secondary);
    border-radius: 12px;
  }

  .result-value {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--success-color);
    line-height: 1;
  }

  .result-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.5rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
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

    .action-grid, .stats-grid, .result-stats {
      grid-template-columns: 1fr;
    }

    .modal {
      max-width: 100%;
      margin: 1rem;
    }
  }

  /* Component Overrides */
  :global(.component-wrapper .import-button),
  :global(.action-section .import-button) {
    width: 100%;
    margin: 0;
  }

  :global(.action-section .export-panel) {
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    box-shadow: none;
  }

  :global(.action-section .export-panel h3) {
    display: none;
  }
</style>