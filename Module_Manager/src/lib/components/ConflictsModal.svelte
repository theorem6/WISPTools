<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { PCIConflict } from '../pciMapper';
  
  export let show = false;
  export let conflicts: PCIConflict[] = [];
  
  const dispatch = createEventDispatcher();
  
  // Handle Escape key to close modal
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && show) {
      event.preventDefault();
      event.stopPropagation();
      handleClose();
    }
  }
  
  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
  
  function handleClose() {
    dispatch('close');
  }
</script>

{#if show}
  <div 
    class="modal-overlay" 
    role="presentation"
    on:click={handleClose}
    on:keydown={(e) => e.key === 'Escape' && handleClose()}
  >
    <div 
      class="modal modal-large" 
      role="dialog"
      tabindex="-1"
      aria-labelledby="conflicts-modal-title"
      on:click|stopPropagation
      on:keydown|stopPropagation
    >
      <div class="modal-header">
        <h2 id="conflicts-modal-title">Conflicts ({conflicts.length})</h2>
        <button class="close-btn" on:click={handleClose}>×</button>
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
                  {#if conflict.losChecked}
                    {#if conflict.terrainBlocked}
                      <span class="los-badge blocked" title="Terrain blocks line of sight">🗻 No LOS</span>
                    {:else if conflict.hasLineOfSight}
                      <span class="los-badge clear" title="Clear line of sight">👁️ LOS</span>
                    {/if}
                  {/if}
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

  .modal-large {
    max-width: 800px;
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

  .modal-body.scrollable {
    max-height: calc(90vh - 120px);
  }

  .conflicts-table {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .conflict-row {
    padding: 1rem 1.25rem;
    background: var(--surface-secondary);
    border-radius: 12px;
    border-left: 4px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .conflict-row.critical {
    border-left-color: var(--danger-color);
    background: var(--danger-light);
    color: var(--text-primary);
  }

  .conflict-row.high {
    border-left-color: var(--warning-color);
    background: var(--warning-light);
    color: var(--text-primary);
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

  .los-badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: var(--border-radius);
    white-space: nowrap;
  }

  .los-badge.blocked {
    background: var(--success-light);
    color: var(--success-color);
  }

  .los-badge.clear {
    background: var(--warning-light);
    color: var(--warning-color);
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
    font-size: var(--font-size-base);
  }

  .empty-state p {
    color: var(--text-secondary);
  }
</style>

