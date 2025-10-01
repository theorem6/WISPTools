<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ManualImport from './ManualImport.svelte';
  import ConflictReportExport from './ConflictReportExport.svelte';
  import type { Cell, PCIConflict } from '../pciMapper';
  
  export let show = false;
  export let cells: Cell[] = [];
  export let conflicts: PCIConflict[] = [];
  export let recommendations: string[] = [];
  export let isOptimizing = false;
  export let hasData = false;
  export let hasConflicts = false;
  
  const dispatch = createEventDispatcher();
  
  function handleClose() {
    dispatch('close');
  }
  
  function handleImport(event: CustomEvent) {
    dispatch('import', event.detail);
    handleClose();
  }
  
  function handleLoadSample() {
    dispatch('loadSample');
    handleClose();
  }
  
  function handleClearMap() {
    dispatch('clearMap');
    handleClose();
  }
  
  function handleRunAnalysis() {
    dispatch('runAnalysis');
    handleClose();
  }
  
  function handleOptimize() {
    dispatch('optimize');
    handleClose();
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click={handleClose}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Actions</h2>
        <button class="close-btn" on:click={handleClose}>×</button>
      </div>
      <div class="modal-body">
        <div class="action-grid">
          <div class="action-section">
            <h3>Data Management</h3>
            <ManualImport on:import={handleImport} />
            <button class="action-btn" on:click={handleLoadSample}>
              <span class="action-icon">📊</span>
              <span class="action-text">Load Sample Data</span>
            </button>
            <button class="action-btn" on:click={handleClearMap} disabled={!hasData}>
              <span class="action-icon">🗑️</span>
              <span class="action-text">Clear Map</span>
            </button>
          </div>
          
          <div class="action-section">
            <h3>Analysis & Optimization</h3>
            <button class="action-btn primary" on:click={handleRunAnalysis} disabled={!hasData}>
              <span class="action-icon">🔍</span>
              <span class="action-text">Run Analysis</span>
            </button>
            <button class="action-btn success" on:click={handleOptimize} disabled={isOptimizing || !hasConflicts}>
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

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(8px);
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
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s;
    border: 1px solid var(--border-color);
  }

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
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

  @media (max-width: 768px) {
    .action-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Component Overrides */
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

