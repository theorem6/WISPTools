<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { OptimizationResult } from '../pciOptimizer';
  
  export let show = false;
  export let result: OptimizationResult | null = null;
  
  const dispatch = createEventDispatcher();
  
  // Handle Escape key to close modal
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && show) {
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

{#if show && result}
  <div 
    class="modal-overlay" 
    role="presentation"
    on:click={handleClose}
    on:keydown={(e) => e.key === 'Escape' && handleClose()}
  >
    <div 
      class="modal" 
      role="dialog"
      tabindex="-1"
      aria-labelledby="optimization-modal-title"
      on:click|stopPropagation
      on:keydown|stopPropagation
    >
      <div class="modal-header">
        <h2 id="optimization-modal-title">Optimization Complete</h2>
        <button class="close-btn" on:click={handleClose}>×</button>
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
            <div class="result-value">{result.resolvedConflicts}</div>
            <div class="result-label">Conflicts Resolved</div>
          </div>
          <div class="result-item">
            <div class="result-value">{result.conflictReduction.toFixed(0)}%</div>
            <div class="result-label">Reduction</div>
          </div>
          <div class="result-item">
            <div class="result-value">{result.iterations}</div>
            <div class="result-label">Iterations</div>
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
    background: var(--surface-secondary);
    border-radius: 12px;
    border: 1px solid var(--border-color);
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
    font-weight: var(--font-weight-medium);
  }

  @media (max-width: 768px) {
    .result-stats {
      grid-template-columns: 1fr;
    }
  }
</style>

