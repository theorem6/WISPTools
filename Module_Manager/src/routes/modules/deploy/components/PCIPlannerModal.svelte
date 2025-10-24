<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { pciService, type ServiceResult } from '$lib/services/pciService';
  import { pciMapper, type Cell, type PCIConflict } from '$lib/pciMapper';
  import { coverageMapService } from '../../coverage-map/lib/coverageMapService.mongodb';
  import { currentTenant } from '$lib/stores/tenantStore';
  
  export let show = false;
  export let tenantId: string;
  
  const dispatch = createEventDispatcher();
  
  let isLoading = false;
  let isAnalyzing = false;
  let isOptimizing = false;
  let error = '';
  let success = '';
  
  // Data
  let cells: Cell[] = [];
  let conflicts: PCIConflict[] = [];
  let analysisResult: any = null;
  let optimizationResult: any = null;
  
  // UI State
  let activeTab = 'analysis';
  let showAdvancedOptions = false;
  
  // Advanced options
  let enableLOS = true;
  let maxIterations = 20;
  let optimizationAlgorithm = 'simple'; // 'simple', 'advanced'
  
  onMount(async () => {
    if (show && tenantId) {
      await loadNetworkData();
    }
  });
  
  $: if (show && tenantId && tenantId.trim() !== '') {
    loadNetworkData();
  }
  
  async function loadNetworkData() {
    if (!tenantId || tenantId.trim() === '') {
      console.warn('[PCIPlanner] No tenant ID provided');
      error = 'No tenant selected';
      isLoading = false;
      return;
    }
    
    isLoading = true;
    error = '';
    
    try {
      console.log(`[PCIPlanner] Loading network data for tenant: ${tenantId}`);
      // Load tower sites and convert to cells
      const sites = await coverageMapService.getTowerSites(tenantId);
      console.log(`[PCIPlanner] Loaded ${sites.length} sites from coverage map service`);
      
      cells = sites.map(site => ({
        id: site.id,
        name: site.name,
        latitude: site.latitude,
        longitude: site.longitude,
        pci: site.pci || -1, // -1 means auto-assign
        earfcn: site.earfcn || 0,
        power: site.power || 0,
        azimuth: site.azimuth || 0,
        height: site.height || 0,
        type: 'tower'
      }));
      
      console.log(`[PCIPlanner] Converted to ${cells.length} cells for PCI analysis`);
    } catch (err) {
      console.error('[PCIPlanner] Failed to load network data:', err);
      error = `Failed to load network data: ${err.message || 'Unknown error'}`;
    } finally {
      isLoading = false;
    }
  }
  
  async function performAnalysis() {
    if (cells.length === 0) {
      error = 'No cells to analyze';
      return;
    }
    
    isAnalyzing = true;
    error = '';
    
    try {
      const result = await pciService.performAnalysis(cells);
      
      if (result.success && result.data) {
        conflicts = result.data.conflicts;
        analysisResult = result.data.analysis;
        success = `Analysis complete: ${conflicts.length} conflicts found`;
        activeTab = 'conflicts';
      } else {
        error = result.error || 'Analysis failed';
      }
    } catch (err) {
      console.error('Analysis error:', err);
      error = 'Analysis failed';
    } finally {
      isAnalyzing = false;
    }
  }
  
  async function optimizePCIs() {
    if (cells.length === 0) {
      error = 'No cells to optimize';
      return;
    }
    
    isOptimizing = true;
    error = '';
    
    try {
      const result = await pciService.optimizePCIs(cells);
      
      if (result.success && result.data) {
        optimizationResult = result.data;
        cells = result.data.optimizedCells;
        success = `Optimization complete: ${result.data.changes.length} changes made`;
        activeTab = 'optimization';
        
        // Re-run analysis with optimized cells
        await performAnalysis();
      } else {
        error = result.error || 'Optimization failed';
      }
    } catch (err) {
      console.error('Optimization error:', err);
      error = 'Optimization failed';
    } finally {
      isOptimizing = false;
    }
  }
  
  function getConflictStats() {
    if (!conflicts.length) return null;
    
    return {
      total: conflicts.length,
      critical: conflicts.filter(c => c.severity === 'CRITICAL').length,
      high: conflicts.filter(c => c.severity === 'HIGH').length,
      medium: conflicts.filter(c => c.severity === 'MEDIUM').length,
      low: conflicts.filter(c => c.severity === 'LOW').length
    };
  }
  
  function handleClose() {
    show = false;
    error = '';
    success = '';
    conflicts = [];
    analysisResult = null;
    optimizationResult = null;
    activeTab = 'analysis';
    dispatch('close');
  }
  
  function exportResults() {
    const data = {
      cells,
      conflicts,
      analysis: analysisResult,
      optimization: optimizationResult,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pci-analysis-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

{#if show}
<div class="modal-overlay" on:click={handleClose}>
  <div class="modal-content pci-planner-modal" on:click|stopPropagation>
    <div class="modal-header">
      <h2>📊 PCI Planner</h2>
      <button class="close-btn" on:click={handleClose}>✕</button>
    </div>
    
    {#if error}
      <div class="error-banner">{error}</div>
    {/if}
    
    {#if success}
      <div class="success-banner">{success}</div>
    {/if}
    
    <div class="modal-body">
      {#if isLoading}
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Loading network data...</p>
        </div>
      {:else}
        <!-- Tabs -->
        <div class="tabs">
          <button 
            class="tab-btn" 
            class:active={activeTab === 'analysis'} 
            on:click={() => activeTab = 'analysis'}
          >
            📊 Analysis
          </button>
          <button 
            class="tab-btn" 
            class:active={activeTab === 'conflicts'} 
            on:click={() => activeTab = 'conflicts'}
          >
            ⚠️ Conflicts ({conflicts.length})
          </button>
          <button 
            class="tab-btn" 
            class:active={activeTab === 'optimization'} 
            on:click={() => activeTab = 'optimization'}
          >
            🔧 Optimization
          </button>
        </div>
      
      <!-- Analysis Tab -->
      {#if activeTab === 'analysis'}
        <div class="tab-content">
          <div class="analysis-section">
            <h3>📡 Network Overview</h3>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value">{cells.length}</div>
                <div class="stat-label">Total Cells</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{cells.filter(c => c.pci === -1).length}</div>
                <div class="stat-label">Auto-Assign PCI</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{conflicts.length}</div>
                <div class="stat-label">Current Conflicts</div>
              </div>
            </div>
            
            <div class="action-buttons">
              <button 
                class="btn-primary" 
                on:click={performAnalysis}
                disabled={isAnalyzing || cells.length === 0}
              >
                {#if isAnalyzing}
                  🔄 Analyzing...
                {:else}
                  🔍 Analyze Conflicts
                {/if}
              </button>
              
              <button 
                class="btn-secondary" 
                on:click={() => showAdvancedOptions = !showAdvancedOptions}
              >
                ⚙️ Advanced Options
              </button>
            </div>
            
            {#if showAdvancedOptions}
              <div class="advanced-options">
                <h4>Advanced Configuration</h4>
                <div class="form-grid">
                  <div class="form-group">
                    <label>
                      <input type="checkbox" bind:checked={enableLOS} />
                      Enable Line-of-Sight Analysis
                    </label>
                  </div>
                  <div class="form-group">
                    <label>Max Iterations</label>
                    <input type="number" bind:value={maxIterations} min="5" max="100" />
                  </div>
                  <div class="form-group">
                    <label>Algorithm</label>
                    <select bind:value={optimizationAlgorithm}>
                      <option value="simple">Simple (Fast)</option>
                      <option value="advanced">Advanced (Thorough)</option>
                    </select>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
      
      <!-- Conflicts Tab -->
      {#if activeTab === 'conflicts'}
        <div class="tab-content">
          {#if conflicts.length === 0}
            <div class="empty-state">
              <div class="empty-icon">✅</div>
              <h3>No Conflicts Found</h3>
              <p>Your network has no PCI conflicts!</p>
            </div>
            {:else}
              <div class="conflicts-section">
                {#if getConflictStats()}
                  {@const stats = getConflictStats()}
                  <div class="conflict-stats">
                    <div class="stat-item critical">
                      <span class="stat-number">{stats.critical}</span>
                      <span class="stat-label">Critical</span>
                    </div>
                    <div class="stat-item high">
                      <span class="stat-number">{stats.high}</span>
                      <span class="stat-label">High</span>
                    </div>
                    <div class="stat-item medium">
                      <span class="stat-number">{stats.medium}</span>
                      <span class="stat-label">Medium</span>
                    </div>
                    <div class="stat-item low">
                      <span class="stat-number">{stats.low}</span>
                      <span class="stat-label">Low</span>
                    </div>
                  </div>
                {/if}
              
              <div class="conflicts-list">
                {#each conflicts as conflict}
                  <div class="conflict-item" class:critical={conflict.severity === 'CRITICAL'} class:high={conflict.severity === 'HIGH'}>
                    <div class="conflict-header">
                      <span class="severity-badge {conflict.severity.toLowerCase()}">{conflict.severity}</span>
                      <span class="conflict-type">{conflict.conflictType}</span>
                    </div>
                    <div class="conflict-details">
                      <div class="cell-info">
                        <strong>{conflict.primaryCell.name}</strong> (PCI: {conflict.primaryCell.pci})
                      </div>
                      <div class="vs">vs</div>
                      <div class="cell-info">
                        <strong>{conflict.conflictingCell.name}</strong> (PCI: {conflict.conflictingCell.pci})
                      </div>
                    </div>
                    <div class="conflict-meta">
                      Distance: {conflict.distance.toFixed(2)}m
                    </div>
                  </div>
                {/each}
              </div>
              
              <div class="action-buttons">
                <button 
                  class="btn-primary" 
                  on:click={optimizePCIs}
                  disabled={isOptimizing}
                >
                  {#if isOptimizing}
                    🔄 Optimizing...
                  {:else}
                    🔧 Optimize PCIs
                  {/if}
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Optimization Tab -->
      {#if activeTab === 'optimization'}
        <div class="tab-content">
          {#if optimizationResult}
            <div class="optimization-section">
              <h3>🎯 Optimization Results</h3>
              
              <div class="optimization-stats">
                <div class="stat-card">
                  <div class="stat-value">{optimizationResult.changes.length}</div>
                  <div class="stat-label">PCI Changes</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{optimizationResult.iterations}</div>
                  <div class="stat-label">Iterations</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{optimizationResult.convergenceHistory.length}</div>
                  <div class="stat-label">Convergence Steps</div>
                </div>
              </div>
              
              {#if optimizationResult.changes.length > 0}
                <div class="changes-list">
                  <h4>📝 PCI Changes Made</h4>
                  {#each optimizationResult.changes as change}
                    <div class="change-item">
                      <div class="change-cell">
                        <strong>{change.cellName}</strong>
                      </div>
                      <div class="change-values">
                        <span class="old-pci">{change.oldPCI}</span>
                        <span class="arrow">→</span>
                        <span class="new-pci">{change.newPCI}</span>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
              
              <div class="action-buttons">
                <button class="btn-secondary" on:click={exportResults}>
                  📥 Export Results
                </button>
                <button class="btn-primary" on:click={performAnalysis}>
                  🔍 Re-analyze
                </button>
              </div>
            </div>
          {:else}
            <div class="empty-state">
              <div class="empty-icon">🔧</div>
              <h3>No Optimization Results</h3>
              <p>Run optimization to see results here.</p>
            </div>
          {/if}
        </div>
      {/if}
      {/if}
    </div>
  </div>
</div>
{/if}

<style>
  .pci-planner-modal {
    width: 95%;
    max-width: 1000px;
    max-height: 90vh;
  }
  
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: var(--spacing-lg);
  }
  
  .tab-btn {
    background: none;
    border: none;
    padding: var(--spacing-md) var(--spacing-lg);
    cursor: pointer;
    color: var(--text-secondary);
    border-bottom: 2px solid transparent;
    transition: var(--transition);
  }
  
  .tab-btn:hover {
    color: var(--text-primary);
    background: var(--hover-bg);
  }
  
  .tab-btn.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }
  
  .tab-content {
    min-height: 400px;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }
  
  .stat-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
    text-align: center;
  }
  
  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--primary);
    margin-bottom: var(--spacing-xs);
  }
  
  .stat-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
  
  .action-buttons {
    display: flex;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }
  
  .advanced-options {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
    margin-top: var(--spacing-md);
  }
  
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md);
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }
  
  .form-group label {
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .conflict-stats {
    display: flex;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }
  
  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-md);
    border-radius: var(--border-radius);
    min-width: 80px;
  }
  
  .stat-item.critical {
    background: var(--danger-light);
    color: var(--danger);
  }
  
  .stat-item.high {
    background: var(--warning-light);
    color: var(--warning);
  }
  
  .stat-item.medium {
    background: var(--info-light);
    color: var(--info);
  }
  
  .stat-item.low {
    background: var(--success-light);
    color: var(--success);
  }
  
  .stat-number {
    font-size: 1.5rem;
    font-weight: 700;
  }
  
  .stat-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .conflicts-list {
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: var(--spacing-lg);
  }
  
  .conflict-item {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-sm);
  }
  
  .conflict-item.critical {
    border-left: 4px solid var(--danger);
  }
  
  .conflict-item.high {
    border-left: 4px solid var(--warning);
  }
  
  .conflict-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-xs);
  }
  
  .severity-badge {
    padding: 0.25rem 0.5rem;
    border-radius: var(--border-radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .severity-badge.critical {
    background: var(--danger-light);
    color: var(--danger);
  }
  
  .severity-badge.high {
    background: var(--warning-light);
    color: var(--warning);
  }
  
  .severity-badge.medium {
    background: var(--info-light);
    color: var(--info);
  }
  
  .severity-badge.low {
    background: var(--success-light);
    color: var(--success);
  }
  
  .conflict-type {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
  
  .conflict-details {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-xs);
  }
  
  .cell-info {
    flex: 1;
  }
  
  .vs {
    color: var(--text-muted);
    font-weight: 500;
  }
  
  .conflict-meta {
    color: var(--text-muted);
    font-size: 0.875rem;
  }
  
  .optimization-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }
  
  .changes-list {
    margin-bottom: var(--spacing-lg);
  }
  
  .change-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md);
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-sm);
  }
  
  .change-cell {
    flex: 1;
  }
  
  .change-values {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }
  
  .old-pci {
    color: var(--text-muted);
    text-decoration: line-through;
  }
  
  .arrow {
    color: var(--primary);
    font-weight: 500;
  }
  
  .new-pci {
    color: var(--success);
    font-weight: 600;
  }
  
  .empty-state {
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--text-secondary);
  }
  
  .empty-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-md);
  }
  
  .error-banner {
    background: var(--danger-light);
    border: 1px solid var(--danger);
    color: var(--danger);
    padding: var(--spacing-md);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-md);
  }
  
  .success-banner {
    background: var(--success-light);
    border: 1px solid var(--success);
    color: var(--success);
    padding: var(--spacing-md);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-md);
  }
  
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl);
    text-align: center;
    color: var(--text-secondary);
  }
  
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color);
    border-top: 4px solid var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var(--spacing-md);
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>
