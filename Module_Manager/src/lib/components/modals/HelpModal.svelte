<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  export let title = 'Help';
  export let content = '';
  
  const dispatch = createEventDispatcher();
  
  function handleClose() {
    dispatch('close');
  }
</script>

{#if show}
  <div class="help-overlay" onclick={handleClose} onkeydown={(e) => e.key === 'Escape' && handleClose()}>
    <div class="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-modal-title" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <div class="help-header">
        <h2 id="help-modal-title">{title}</h2>
        <button class="close-btn" onclick={handleClose} aria-label="Close">×</button>
      </div>
      
      <div class="help-body">
        {@html content}
      </div>
    </div>
  </div>
{/if}

<style>
  .help-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 1rem;
  }

  .help-modal {
    background: var(--card-bg);
    border-radius: 1rem;
    max-width: 800px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .help-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border-color);
  }

  .help-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    line-height: 1;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  .help-body {
    padding: 2rem;
    overflow-y: auto;
    flex: 1;
  }

  .help-body :global(h3) {
    color: var(--primary-color);
    margin: 1.5rem 0 1rem 0;
    font-size: 1.25rem;
  }

  .help-body :global(h4) {
    color: var(--text-primary);
    margin: 1.25rem 0 0.75rem 0;
    font-size: 1.1rem;
  }

  .help-body :global(p) {
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0.75rem 0;
  }

  .help-body :global(ul), .help-body :global(ol) {
    color: var(--text-secondary);
    line-height: 1.8;
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }

  .help-body :global(li) {
    margin: 0.5rem 0;
  }

  .help-body :global(code) {
    background: var(--code-bg);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
    color: var(--primary-color);
  }

  .help-body :global(pre) {
    background: var(--code-bg);
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin: 1rem 0;
  }

  .help-body :global(pre code) {
    background: none;
    padding: 0;
  }

  .help-body :global(a) {
    color: var(--primary-color);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s;
  }

  .help-body :global(a:hover) {
    border-bottom-color: var(--primary-color);
  }

  .help-body :global(.warning) {
    background: rgba(239, 68, 68, 0.1);
    border-left: 4px solid #ef4444;
    padding: 1rem;
    border-radius: 0.5rem;
    margin: 1rem 0;
  }

  .help-body :global(.info) {
    background: rgba(59, 130, 246, 0.1);
    border-left: 4px solid #3b82f6;
    padding: 1rem;
    border-radius: 0.5rem;
    margin: 1rem 0;
  }

  .help-body :global(.success) {
    background: rgba(16, 185, 129, 0.1);
    border-left: 4px solid #10b981;
    padding: 1rem;
    border-radius: 0.5rem;
    margin: 1rem 0;
  }

  .help-body :global(.toc) {
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin: 1.5rem 0;
  }

  .help-body :global(.toc h4) {
    margin-top: 0;
    margin-bottom: 1rem;
    color: var(--primary-color);
    font-size: 1.1rem;
  }

  .help-body :global(.toc ul) {
    list-style: none;
    padding-left: 0;
    margin: 0;
  }

  .help-body :global(.toc li) {
    margin: 0.5rem 0;
    padding-left: 1rem;
    position: relative;
  }

  .help-body :global(.toc li::before) {
    content: '▸';
    position: absolute;
    left: 0;
    color: var(--primary-color);
  }

  .help-body :global(.toc a) {
    color: var(--text-primary);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: all 0.2s;
    display: inline-block;
  }

  .help-body :global(.toc a:hover) {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
    transform: translateX(4px);
  }

  .help-body {
    scroll-behavior: smooth;
  }

  .help-body :global(h4[id]) {
    scroll-margin-top: 1rem;
  }

  @media (max-width: 768px) {
    .help-modal {
      max-width: 100%;
      margin: 0;
      border-radius: 0;
      max-height: 100vh;
    }

    .help-header, .help-body {
      padding: 1.25rem;
    }
  }
</style>


  .help-body :global(.toc ul) {
    list-style: none;
    padding-left: 0;
    margin: 0;
  }

  .help-body :global(.toc li) {
    margin: 0.5rem 0;
    padding-left: 1rem;
    position: relative;
  }

  .help-body :global(.toc li::before) {
    content: '▸';
    position: absolute;
    left: 0;
    color: var(--primary-color);
  }

  .help-body :global(.toc a) {
    color: var(--text-primary);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: all 0.2s;
    display: inline-block;
  }

  .help-body :global(.toc a:hover) {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
    transform: translateX(4px);
  }

  .help-body {
    scroll-behavior: smooth;
  }

  .help-body :global(h4[id]) {
    scroll-margin-top: 1rem;
  }

  @media (max-width: 768px) {
    .help-modal {
      max-width: 100%;
      margin: 0;
      border-radius: 0;
      max-height: 100vh;
    }

    .help-header, .help-body {
      padding: 1.25rem;
    }
  }
</style>


  .help-body :global(.toc ul) {
    list-style: none;
    padding-left: 0;
    margin: 0;
  }

  .help-body :global(.toc li) {
    margin: 0.5rem 0;
    padding-left: 1rem;
    position: relative;
  }

  .help-body :global(.toc li::before) {
    content: '▸';
    position: absolute;
    left: 0;
    color: var(--primary-color);
  }

  .help-body :global(.toc a) {
    color: var(--text-primary);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: all 0.2s;
    display: inline-block;
  }

  .help-body :global(.toc a:hover) {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
    transform: translateX(4px);
  }

  .help-body {
    scroll-behavior: smooth;
  }

  .help-body :global(h4[id]) {
    scroll-margin-top: 1rem;
  }

  @media (max-width: 768px) {
    .help-modal {
      max-width: 100%;
      margin: 0;
      border-radius: 0;
      max-height: 100vh;
    }

    .help-header, .help-body {
      padding: 1.25rem;
    }
  }
</style>

