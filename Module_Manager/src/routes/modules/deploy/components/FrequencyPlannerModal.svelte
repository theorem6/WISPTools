<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { frequencyService, type ServiceResult } from '$lib/services/frequencyService';
  import { frequencyPlanner, type TowerSector, type FrequencyPlan, type FrequencyConflict, type FrequencyOptimization } from '$lib/frequencyPlanner';
  import { coverageMapService } from '../../coverage-map/lib/coverageMapService.mongodb';
  import { currentTenant } from '$lib/stores/tenantStore';

  export let show = false;
  export let tenantId: string;

  const dispatch = createEventDispatcher();

  let activeTab: 'analysis' | 'conflicts' | 'optimization' = 'analysis';
  let sectors: TowerSector[] = [];
  let conflicts: FrequencyConflict[] = [];
  let plan: FrequencyPlan | null = null;
  let optimizations: FrequencyOptimization[] = [];
  let isLoading = false;
  let isAnalyzing = false;
  let isOptimizing = false;
  let error = '';
  let success = '';

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
      console.warn('[FrequencyPlanner] No tenant ID provided');
      error = 'No tenant selected';
      isLoading = false;
      return;
    }

    isLoading = true;
    error = '';

    try {
      console.log(`[FrequencyPlanner] Loading network data for tenant: ${tenantId}`);
      const sites = await coverageMapService.getTowerSites(tenantId);
      console.log(`[FrequencyPlanner] Loaded ${sites.length} sites from coverage map service`);

      sectors = sites.map(site => ({
        id: site.id,
        name: site.name,
        latitude: site.latitude,
        longitude: site.longitude,
        azimuth: site.azimuth || 0,
        antennaHeight: site.height || 0,
        vendor: site.vendor || 'Unknown',
        frequency: {
          frequency: site.frequency || 3550, // Default to CBRS
          bandwidth: site.bandwidth || 20,
          vendor: site.vendor || 'Unknown',
          power: site.power || 30
        },
        radCenterHeight: (site.height || 0) + 2, // Assume 2m above antenna
        towerId: site.towerId || site.id,
        sectorId: site.sectorId || site.id
      }));

      console.log(`[FrequencyPlanner] Converted to ${sectors.length} sectors for frequency analysis`);
    } catch (err: any) {
      console.error('[FrequencyPlanner] Failed to load network data:', err);
      error = `Failed to load network data: ${err.message || 'Unknown error'}`;
    } finally {
      isLoading = false;
    }
  }

  async function performAnalysis() {
    if (!tenantId || tenantId.trim() === '') {
      error = 'No tenant selected';
      return;
    }

    isAnalyzing = true;
    error = '';

    try {
      console.log('[FrequencyPlanner] Starting frequency analysis...');
      const result = await frequencyService.performAnalysis(tenantId);
      
      if (result.success && result.data) {
        plan = result.data;
        conflicts = result.data.conflicts;
        success = `Analysis complete! Found ${conflicts.length} conflicts. Plan score: ${result.data.planScore}/100`;
        console.log('[FrequencyPlanner] Analysis completed successfully');
      } else {
        error = result.error || 'Analysis failed';
        console.error('[FrequencyPlanner] Analysis failed:', result.error);
      }
    } catch (err: any) {
      console.error('[FrequencyPlanner] Analysis error:', err);
      error = `Analysis failed: ${err.message || 'Unknown error'}`;
    } finally {
      isAnalyzing = false;
    }
  }

  async function generateOptimizations() {
    if (!tenantId || tenantId.trim() === '') {
      error = 'No tenant selected';
      return;
    }

    isOptimizing = true;
    error = '';

    try {
      console.log('[FrequencyPlanner] Generating optimization suggestions...');
      const result = await frequencyService.getOptimizations(tenantId);
      
      if (result.success && result.data) {
        optimizations = result.data;
        success = `Generated ${optimizations.length} optimization suggestions`;
        console.log('[FrequencyPlanner] Optimizations generated successfully');
      } else {
        error = result.error || 'Optimization failed';
        console.error('[FrequencyPlanner] Optimization failed:', result.error);
      }
    } catch (err: any) {
      console.error('[FrequencyPlanner] Optimization error:', err);
      error = `Optimization failed: ${err.message || 'Unknown error'}`;
    } finally {
      isOptimizing = false;
    }
  }

  function exportResults() {
    if (!plan) {
      error = 'No plan data to export';
      return;
    }

    try {
      const exportData = frequencyService.exportPlanData(plan);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `frequency-plan-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      success = 'Frequency plan exported successfully';
    } catch (err: any) {
      console.error('[FrequencyPlanner] Export failed:', err);
      error = `Export failed: ${err.message || 'Unknown error'}`;
    }
  }

  function handleClose() {
    show = false;
    error = '';
    success = '';
    conflicts = [];
    plan = null;
    optimizations = [];
    activeTab = 'analysis';
    dispatch('close');
  }

  function getConflictStats() {
    if (!conflicts.length) return null;
    
    const high = conflicts.filter(c => c.severity === 'HIGH').length;
    const medium = conflicts.filter(c => c.severity === 'MEDIUM').length;
    const low = conflicts.filter(c => c.severity === 'LOW').length;
    
    return { high, medium, low, total: conflicts.length };
  }

  function getSeverityColor(severity: 'HIGH' | 'MEDIUM' | 'LOW'): string {
    switch (severity) {
      case 'HIGH': return 'var(--danger)';
      case 'MEDIUM': return 'var(--warning)';
      case 'LOW': return 'var(--success)';
      default: return 'var(--text-secondary)';
    }
  }

  function getConflictTypeIcon(type: string): string {
    switch (type) {
      case 'LOS_INTERFERENCE': return '📡';
      case 'VENDOR_SPACING': return '🏗️';
      case 'BACK_TO_BACK_REUSE': return '🔄';
      default: return '⚠️';
    }
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={handleClose}>
    <div class="modal-content frequency-planner-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>📡 Frequency Planner</h2>
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
              ⚠️ Conflicts
              {#if conflicts.length > 0}
                <span class="conflict-count">{conflicts.length}</span>
              {/if}
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
            <div class="analysis-content">
              <div class="analysis-header">
                <h3>Frequency Analysis</h3>
                <p>Analyze frequency conflicts and interference patterns</p>
              </div>

              <div class="analysis-stats">
                <div class="stat-card">
                  <div class="stat-value">{sectors.length}</div>
                  <div class="stat-label">Total Sectors</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{plan?.planScore || 0}</div>
                  <div class="stat-label">Plan Score</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{plan?.conflicts.length || 0}</div>
                  <div class="stat-label">Conflicts</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{plan?.optimizations.length || 0}</div>
                  <div class="stat-label">Suggestions</div>
                </div>
              </div>

              <div class="analysis-actions">
                <button 
                  class="btn-primary" 
                  on:click={performAnalysis}
                  disabled={isAnalyzing || !sectors.length}
                >
                  {#if isAnalyzing}
                    <div class="loading-spinner small"></div>
                    Analyzing...
                  {:else}
                    🔍 Analyze Conflicts
                  {/if}
                </button>

                <button 
                  class="btn-secondary" 
                  on:click={generateOptimizations}
                  disabled={isOptimizing || !conflicts.length}
                >
                  {#if isOptimizing}
                    <div class="loading-spinner small"></div>
                    Optimizing...
                  {:else}
                    🔧 Generate Suggestions
                  {/if}
                </button>

                {#if plan}
                  <button class="btn-secondary" on:click={exportResults}>
                    📥 Export Plan
                  </button>
                {/if}
              </div>

              {#if plan}
                <div class="plan-summary">
                  <h4>Plan Summary</h4>
                  <div class="summary-grid">
                    <div class="summary-item">
                      <strong>Total Interference:</strong> {plan.totalInterference.toFixed(1)} dB
                    </div>
                    <div class="summary-item">
                      <strong>Plan Score:</strong> {plan.planScore}/100
                    </div>
                    <div class="summary-item">
                      <strong>Status:</strong> 
                      <span class:score-high={plan.planScore >= 80} 
                            class:score-medium={plan.planScore >= 60 && plan.planScore < 80}
                            class:score-low={plan.planScore < 60}>
                        {plan.planScore >= 80 ? 'Excellent' : plan.planScore >= 60 ? 'Good' : 'Needs Improvement'}
                      </span>
                    </div>
                  </div>
                </div>
              {/if}
            </div>

          <!-- Conflicts Tab -->
          {:else if activeTab === 'conflicts'}
            <div class="conflicts-content">
              <div class="conflicts-header">
                <h3>Frequency Conflicts</h3>
                <p>Detected interference and spacing issues</p>
              </div>

              {#if conflicts.length === 0}
                <div class="no-conflicts">
                  <div class="no-conflicts-icon">✅</div>
                  <h4>No Conflicts Found</h4>
                  <p>Your frequency plan looks good! No interference issues detected.</p>
                </div>
              {:else}
                {#if getConflictStats()}
                  {@const stats = getConflictStats()}
                  <div class="conflict-summary">
                    <div class="conflict-stat high">
                      <span class="count">{stats.high}</span>
                      <span class="label">High Severity</span>
                    </div>
                    <div class="conflict-stat medium">
                      <span class="count">{stats.medium}</span>
                      <span class="label">Medium Severity</span>
                    </div>
                    <div class="conflict-stat low">
                      <span class="count">{stats.low}</span>
                      <span class="label">Low Severity</span>
                    </div>
                  </div>
                {/if}

                <div class="conflicts-list">
                  {#each conflicts as conflict}
                    <div class="conflict-item" class:high-severity={conflict.severity === 'HIGH'}>
                      <div class="conflict-header">
                        <div class="conflict-type">
                          <span class="type-icon">{getConflictTypeIcon(conflict.type)}</span>
                          <span class="type-name">{conflict.type.replace('_', ' ')}</span>
                        </div>
                        <div class="conflict-severity" style="color: {getSeverityColor(conflict.severity)}">
                          {conflict.severity}
                        </div>
                      </div>
                      
                      <div class="conflict-details">
                        <div class="conflict-description">
                          {conflict.description}
                        </div>
                        <div class="conflict-suggestion">
                          <strong>Suggestion:</strong> {conflict.suggestedAction}
                        </div>
                        <div class="conflict-metrics">
                          <span>Distance: {conflict.distance.toFixed(1)}m</span>
                          <span>Interference: {conflict.interferenceLevel.toFixed(1)} dB</span>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

          <!-- Optimization Tab -->
          {:else if activeTab === 'optimization'}
            <div class="optimization-content">
              <div class="optimization-header">
                <h3>Optimization Suggestions</h3>
                <p>Recommended frequency changes to reduce interference</p>
              </div>

              {#if optimizations.length === 0}
                <div class="no-optimizations">
                  <div class="no-optimizations-icon">🎯</div>
                  <h4>No Optimizations Available</h4>
                  <p>Run analysis first to generate optimization suggestions.</p>
                </div>
              {:else}
                <div class="optimizations-list">
                  {#each optimizations as optimization}
                    <div class="optimization-item" class:high-priority={optimization.priority === 'HIGH'}>
                      <div class="optimization-header">
                        <div class="optimization-sector">
                          <strong>{optimization.sectorId}</strong>
                        </div>
                        <div class="optimization-priority" class:high={optimization.priority === 'HIGH'}>
                          {optimization.priority}
                        </div>
                      </div>
                      
                      <div class="optimization-details">
                        <div class="frequency-change">
                          <div class="current-freq">
                            <span class="label">Current:</span>
                            <span class="freq">{optimization.currentFrequency.frequency} MHz</span>
                            <span class="bw">({optimization.currentFrequency.bandwidth} MHz)</span>
                          </div>
                          <div class="arrow">→</div>
                          <div class="suggested-freq">
                            <span class="label">Suggested:</span>
                            <span class="freq">{optimization.suggestedFrequency.frequency} MHz</span>
                            <span class="bw">({optimization.suggestedFrequency.bandwidth} MHz)</span>
                          </div>
                        </div>
                        
                        <div class="optimization-reason">
                          <strong>Reason:</strong> {optimization.reason}
                        </div>
                        
                        <div class="optimization-improvement">
                          <strong>Expected Improvement:</strong> {optimization.expectedImprovement.toFixed(1)} dB reduction
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        {/if} <!-- Closing tag for {#if isLoading} -->
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
    font-size: 1.5rem;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.5rem;
    border-radius: var(--border-radius-sm);
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
  }

  .frequency-planner-modal {
    width: 95%;
    max-width: 1200px;
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

  .loading-spinner.small {
    width: 20px;
    height: 20px;
    border-width: 2px;
    margin-bottom: 0;
    margin-right: var(--spacing-sm);
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .tabs {
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
  }

  .tab-btn {
    background: none;
    border: none;
    padding: var(--spacing-md) var(--spacing-lg);
    cursor: pointer;
    color: var(--text-secondary);
    border-bottom: 2px solid transparent;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .tab-btn:hover {
    color: var(--text-primary);
    background: var(--bg-secondary);
  }

  .tab-btn.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }

  .conflict-count {
    background: var(--danger);
    color: white;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: bold;
  }

  /* Analysis Tab Styles */
  .analysis-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .analysis-header h3 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--text-primary);
  }

  .analysis-header p {
    margin: 0;
    color: var(--text-secondary);
  }

  .analysis-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--spacing-md);
  }

  .stat-card {
    background: var(--bg-secondary);
    padding: var(--spacing-lg);
    border-radius: var(--border-radius-md);
    text-align: center;
    border: 1px solid var(--border-color);
  }

  .stat-value {
    font-size: 2rem;
    font-weight: bold;
    color: var(--primary);
    margin-bottom: var(--spacing-sm);
  }

  .stat-label {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .analysis-actions {
    display: flex;
    gap: var(--spacing-md);
    flex-wrap: wrap;
  }

  .btn-primary, .btn-secondary {
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--border-radius-md);
    border: none;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .btn-primary {
    background: var(--primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--primary-dark);
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-tertiary);
  }

  .btn-primary:disabled, .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .plan-summary {
    background: var(--bg-secondary);
    padding: var(--spacing-lg);
    border-radius: var(--border-radius-md);
    border: 1px solid var(--border-color);
  }

  .plan-summary h4 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-primary);
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md);
  }

  .summary-item {
    color: var(--text-secondary);
  }

  .score-high { color: var(--success); }
  .score-medium { color: var(--warning); }
  .score-low { color: var(--danger); }

  /* Conflicts Tab Styles */
  .conflicts-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .conflicts-header h3 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--text-primary);
  }

  .conflicts-header p {
    margin: 0;
    color: var(--text-secondary);
  }

  .no-conflicts {
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--text-secondary);
  }

  .no-conflicts-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-md);
  }

  .conflict-summary {
    display: flex;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }

  .conflict-stat {
    flex: 1;
    padding: var(--spacing-md);
    border-radius: var(--border-radius-md);
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .conflict-stat.high {
    background: rgba(var(--danger-rgb), 0.1);
    border: 1px solid var(--danger);
  }

  .conflict-stat.medium {
    background: rgba(var(--warning-rgb), 0.1);
    border: 1px solid var(--warning);
  }

  .conflict-stat.low {
    background: rgba(var(--success-rgb), 0.1);
    border: 1px solid var(--success);
  }

  .conflict-stat .count {
    font-size: 1.5rem;
    font-weight: bold;
  }

  .conflict-stat .label {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .conflicts-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .conflict-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    padding: var(--spacing-lg);
    transition: all 0.2s ease;
  }

  .conflict-item.high-severity {
    border-left: 4px solid var(--danger);
  }

  .conflict-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }

  .conflict-type {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .type-icon {
    font-size: 1.2rem;
  }

  .type-name {
    font-weight: 500;
    color: var(--text-primary);
  }

  .conflict-severity {
    font-weight: bold;
    text-transform: uppercase;
    font-size: 0.8rem;
  }

  .conflict-details {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .conflict-description {
    color: var(--text-primary);
  }

  .conflict-suggestion {
    color: var(--text-secondary);
    font-style: italic;
  }

  .conflict-metrics {
    display: flex;
    gap: var(--spacing-lg);
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  /* Optimization Tab Styles */
  .optimization-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .optimization-header h3 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--text-primary);
  }

  .optimization-header p {
    margin: 0;
    color: var(--text-secondary);
  }

  .no-optimizations {
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--text-secondary);
  }

  .no-optimizations-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-md);
  }

  .optimizations-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .optimization-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    padding: var(--spacing-lg);
    transition: all 0.2s ease;
  }

  .optimization-item.high-priority {
    border-left: 4px solid var(--danger);
  }

  .optimization-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }

  .optimization-sector {
    color: var(--text-primary);
  }

  .optimization-priority {
    font-weight: bold;
    text-transform: uppercase;
    font-size: 0.8rem;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  .optimization-priority.high {
    background: var(--danger);
    color: white;
  }

  .optimization-details {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .frequency-change {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--bg-tertiary);
    border-radius: var(--border-radius-sm);
  }

  .current-freq, .suggested-freq {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .current-freq .label, .suggested-freq .label {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .current-freq .freq, .suggested-freq .freq {
    font-weight: bold;
    color: var(--text-primary);
  }

  .current-freq .bw, .suggested-freq .bw {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .arrow {
    font-size: 1.5rem;
    color: var(--primary);
  }

  .optimization-reason, .optimization-improvement {
    color: var(--text-secondary);
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .frequency-planner-modal {
      width: 95%;
      max-width: none;
    }

    .analysis-stats {
      grid-template-columns: repeat(2, 1fr);
    }

    .analysis-actions {
      flex-direction: column;
    }

    .conflict-summary {
      flex-direction: column;
    }

    .frequency-change {
      flex-direction: column;
      text-align: center;
    }

    .arrow {
      transform: rotate(90deg);
    }
  }
</style>
