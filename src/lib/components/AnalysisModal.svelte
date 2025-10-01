<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PCIConflictAnalysis, PCIConflict } from '../pciMapper';
  
  export let show = false;
  export let analysis: PCIConflictAnalysis | null = null;
  export let conflicts: PCIConflict[] = [];
  
  const dispatch = createEventDispatcher();
  
  function handleClose() {
    dispatch('close');
  }
</script>

{#if show && analysis}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click={handleClose}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Analysis Summary</h2>
        <button class="close-btn" on:click={handleClose}>×</button>
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
    color: var(--text-primary);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  .stat-box {
    text-align: center;
    padding: 1.5rem;
    background: var(--surface-secondary);
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
    font-weight: var(--font-weight-medium);
  }

  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

