<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { pciService, type ServiceResult } from '$lib/services/pciService';
  import { pciMapper, type Cell, type PCIConflict } from '$lib/pciMapper';
  import { coverageMapService } from '../../coverage-map/lib/coverageMapService.mongodb';
  import { currentTenant } from '$lib/stores/tenantStore';
  
  export let show = false;
  export let tenantId: string | null = null;
  
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

  // Also watch for tenantId changes from store
  $: if (show && $currentTenant?.id && (!tenantId || tenantId !== $currentTenant.id)) {
    tenantId = $currentTenant.id;
  }

  type ConflictStats = ReturnType<typeof getConflictStats>;
  let conflictStats: ConflictStats = null;
  $: conflictStats = getConflictStats();

  async function loadNetworkData() {
    const effectiveTenantId = (tenantId && tenantId.trim() !== '') ? tenantId : $currentTenant?.id ?? null;
    
    if (!effectiveTenantId || effectiveTenantId.trim() === '') {
      console.warn('[PCIPlanner] No tenant ID provided');
      error = 'No tenant selected. Please select a tenant to use the PCI Planner.';
      isLoading = false;
      return;
    }
    
    isLoading = true;
    error = '';
    
    try {
      console.log(`[PCIPlanner] Loading network data for tenant: ${effectiveTenantId}`);
      
      // Load actual LTE sectors (ENB sectors) instead of sites
      const allSectors = await coverageMapService.getSectors(effectiveTenantId, { includePlanLayer: true });
      console.log(`[PCIPlanner] Loaded ${allSectors.length} total sectors from coverage map service`);
      
      // Filter for LTE sectors only (ENB sectors)
      const lteSectors = allSectors.filter((sector: any) => {
        const tech = sector.technology?.toUpperCase();
        return tech === 'LTE' || tech === 'LTECBRS' || tech === 'LTE+CBRS';
      });
      console.log(`[PCIPlanner] Found ${lteSectors.length} LTE (ENB) sectors`);
      
      // Load sites to get location and eNodeB info for each sector
      const sites = await coverageMapService.getTowerSites(effectiveTenantId);
      const sitesMap = new Map(sites.map((s: any) => [String(s.id || s._id), s]));
      
      // Convert LTE sectors to cells
      cells = lteSectors.map((sector: any) => {
        const sectorSiteId = String(sector.siteId?._id || sector.siteId?.id || sector.siteId || '');
        const site = sitesMap.get(sectorSiteId);
        const location = sector.location || site?.location || { latitude: 0, longitude: 0 };
        
        // Extract sector number from name or use a default
        const sectorName = sector.name || '';
        const sectorMatch = sectorName.match(/[Ss]ector\s*(\d+)/i) || sectorName.match(/[Ss]ec\s*(\d+)/i);
        const sectorNumber = sectorMatch ? Number(sectorMatch[1]) : (sector.eNodeBLocalID || 1);
        
        // Get eNodeB from site metadata or sector
        const siteMetadata = site?.metadata || {};
        const siteStats = site?.stats || {};
        const eNodeB = Number(
          sector.eNodeBLocalID ||
          siteMetadata.eNodeB ||
          siteMetadata.enodeb ||
          siteStats.eNodeB ||
          0
        );
        
        return {
          id: sector.id,
          name: sector.name || `${site?.name || 'Unknown'} Sector ${sectorNumber}`,
          eNodeB: eNodeB,
          sector: sectorNumber,
          pci: Number(sector.pci ?? -1),
          latitude: Number(location.latitude ?? 0),
          longitude: Number(location.longitude ?? 0),
          frequency: Number(sector.frequency ?? sector.centerFreq ?? 0),
          rsPower: Number(sector.transmitPower ?? sector.rsPower ?? 0),
          azimuth: sector.azimuth,
          beamwidth: sector.beamwidth,
          heightAGL: sector.heightAGL ?? site?.height,
          technology: sector.technology || 'LTE',
          earfcn: sector.earfcn,
          centerFreq: sector.frequency ?? sector.centerFreq,
          channelBandwidth: sector.bandwidth,
          dlEarfcn: sector.dlEarfcn,
          ulEarfcn: sector.ulEarfcn
        } as Cell;
      }).filter((cell: Cell) => {
        // Filter out invalid cells (missing location or eNodeB)
        return cell.latitude !== 0 && cell.longitude !== 0 && cell.eNodeB !== 0;
      });
      
      console.log(`[PCIPlanner] Converted ${cells.length} LTE sectors to cells for PCI analysis`);
    } catch (err) {
      console.error('[PCIPlanner] Failed to load network data:', err);
      const message = err instanceof Error ? err.message : String(err);
      error = `Failed to load network data: ${message || 'Unknown error'}`;
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
      const message = err instanceof Error ? err.message : String(err);
      error = message || 'Analysis failed';
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
      const message = err instanceof Error ? err.message : String(err);
      error = message || 'Optimization failed';
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
<div class="modal-overlay" onclick={handleClose}>
  <div class="modal-content pci-planner-modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2>📊 PCI Planner</h2>
      <button class="close-btn" onclick={handleClose}>✕</button>
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
            onclick={() => activeTab = 'analysis'}
          >
            📊 Analysis
          </button>
          <button 
            class="tab-btn" 
            class:active={activeTab === 'conflicts'} 
            onclick={() => activeTab = 'conflicts'}
          >
            ⚠️ Conflicts ({conflicts.length})
          </button>
          <button 
            class="tab-btn" 
            class:active={activeTab === 'optimization'} 
            onclick={() => activeTab = 'optimization'}
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
                onclick={performAnalysis}
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
                onclick={() => showAdvancedOptions = !showAdvancedOptions}
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
                {#if conflictStats}
                  <div class="conflict-stats">
                    <div class="stat-item critical">
                      <span class="stat-number">{conflictStats.critical}</span>
                      <span class="stat-label">Critical</span>
                    </div>
                    <div class="stat-item high">
                      <span class="stat-number">{conflictStats.high}</span>
                      <span class="stat-label">High</span>
                    </div>
                    <div class="stat-item medium">
                      <span class="stat-number">{conflictStats.medium}</span>
                      <span class="stat-label">Medium</span>
                    </div>
                    <div class="stat-item low">
                      <span class="stat-number">{conflictStats.low}</span>
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
                  onclick={optimizePCIs}
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
                <button class="btn-secondary" onclick={exportResults}>
                  📥 Export Results
                </button>
                <button class="btn-primary" onclick={performAnalysis}>
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
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-xl);
    max-width: 90vw;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .modal-header h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.25rem;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem;
    border-radius: 4px;
    transition: var(--transition);
  }

  .close-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .modal-body {
    padding: var(--spacing-lg);
    flex: 1;
    overflow-y: auto;
  }

  .pci-planner-modal {
    width: 95%;
    max-width: 1000px;
    max-height: 90vh;
  }

  .error-banner {
    background: var(--danger);
    color: white;
    padding: var(--spacing-md);
    margin: var(--spacing-md) 0;
    border-radius: var(--border-radius-md);
    text-align: center;
  }

  .success-banner {
    background: var(--success);
    color: white;
    padding: var(--spacing-md);
    margin: var(--spacing-md) 0;
    border-radius: var(--border-radius-md);
    text-align: center;
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
