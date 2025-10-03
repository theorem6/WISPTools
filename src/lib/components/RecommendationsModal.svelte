<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  export let geminiAnalysis = '';
  
  const dispatch = createEventDispatcher();
  
  function handleClose() {
    dispatch('close');
  }
</script>

{#if show && geminiAnalysis}
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
      aria-labelledby="recommendations-modal-title"
      on:click|stopPropagation
      on:keydown|stopPropagation
    >
      <div class="modal-header">
        <h2 id="recommendations-modal-title">AI Recommendations</h2>
        <button class="close-btn" on:click={handleClose}>×</button>
      </div>
      <div class="modal-body scrollable">
        <div class="recommendations">
          {@html geminiAnalysis.replace(/\n/g, '<br>')}
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
  }

  .modal-body.scrollable {
    max-height: calc(90vh - 120px);
  }

  .recommendations {
    line-height: 1.8;
    color: var(--text-primary);
    font-size: var(--font-size-base);
  }

  /* Ensure all injected HTML elements inherit proper colors */
  .recommendations :global(*) {
    color: inherit;
  }

  .recommendations :global(strong),
  .recommendations :global(b) {
    color: var(--text-primary);
    font-weight: var(--font-weight-bold);
  }

  .recommendations :global(h1),
  .recommendations :global(h2),
  .recommendations :global(h3),
  .recommendations :global(h4) {
    color: var(--text-primary);
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }
</style>

