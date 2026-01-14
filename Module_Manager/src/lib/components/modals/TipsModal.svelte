<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { tipsService } from '$lib/services/tipsService';
  
  interface ModuleTip {
    id: string;
    title: string;
    content: string;
    icon?: string;
  }
  
  export let show = false;
  export let moduleId: string = '';
  export let tips: ModuleTip[] = [];
  
  const dispatch = createEventDispatcher();
  
  let currentTip: ModuleTip | null = null;
  let dontShowAgain = false;
  let hasSelectedTip = false;
  
  // Select a random tip when modal opens
  function selectRandomTip() {
    if (tips.length === 0) {
      currentTip = null;
      hasSelectedTip = false;
      return;
    }
    const randomIndex = Math.floor(Math.random() * tips.length);
    currentTip = tips[randomIndex];
    hasSelectedTip = true;
    console.log('[TipsModal] Selected random tip:', { moduleId, tipId: currentTip.id, totalTips: tips.length });
  }
  
  // Reset and select random tip when modal opens (only once per show cycle)
  $: if (show && !hasSelectedTip && tips.length > 0) {
    console.log('[TipsModal] Modal opened, selecting tip:', { moduleId, tipsCount: tips.length });
    selectRandomTip();
    dontShowAgain = false;
  }
  
  // Reset when modal closes
  $: if (!show) {
    hasSelectedTip = false;
    currentTip = null;
  }
  
  function handleClose() {
    if (dontShowAgain && moduleId) {
      tipsService.dismissTips(moduleId);
    }
    show = false;
    dispatch('close');
  }
</script>

{#if show && currentTip}
  <div class="tips-overlay" onclick={handleClose} onkeydown={(e) => e.key === 'Escape' && handleClose()}>
    <div class="tips-modal" role="dialog" aria-modal="true" aria-labelledby="tips-modal-title" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <div class="tips-header">
        <div class="tips-title-section">
          {#if currentTip.icon}
            <span class="tip-icon">{currentTip.icon}</span>
          {/if}
          <h2 id="tips-modal-title">{currentTip.title}</h2>
        </div>
        <button class="close-btn" onclick={handleClose} aria-label="Close">×</button>
      </div>
      
      <div class="tips-body">
        <div class="tip-content">
          {@html currentTip.content}
        </div>
      </div>
      
      <div class="tips-footer">
        <label class="dont-show-again">
          <input type="checkbox" bind:checked={dontShowAgain} />
          <span>Don't show these tips again</span>
        </label>
        <button class="close-button" onclick={handleClose} type="button">Close</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .tips-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: 1rem;
    animation: fadeIn 0.2s ease-out;
  }

  .tips-modal {
    background: var(--card-bg, #ffffff);
    border-radius: 1rem;
    max-width: 600px;
    width: 100%;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.3s ease-out;
    border: 1px solid var(--border-color, #e0e0e0);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .tips-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }

  .tips-title-section {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
  }

  .tip-icon {
    font-size: 1.5rem;
    line-height: 1;
  }

  .tips-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #1a1a1a);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    line-height: 1;
    cursor: pointer;
    color: var(--text-secondary, #666);
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--hover-bg, #f5f5f5);
    color: var(--text-primary, #1a1a1a);
  }

  .tips-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .tip-content {
    color: var(--text-primary, #1a1a1a);
    line-height: 1.6;
    font-size: 1rem;
  }

  .tip-content :global(h3),
  .tip-content :global(h4) {
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    color: var(--text-primary, #1a1a1a);
  }

  .tip-content :global(h3:first-child),
  .tip-content :global(h4:first-child) {
    margin-top: 0;
  }

  .tip-content :global(ul),
  .tip-content :global(ol) {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }

  .tip-content :global(li) {
    margin: 0.5rem 0;
  }

  .tip-content :global(p) {
    margin: 0.75rem 0;
  }

  .tip-content :global(strong) {
    color: var(--text-primary, #1a1a1a);
    font-weight: 600;
  }

        .tips-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border-color, #e0e0e0);
          background: var(--bg-secondary, #f9f9f9);
        }
        
        .dont-show-again {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
          color: var(--text-secondary, #666);
          user-select: none;
        }
        
        .dont-show-again input[type="checkbox"] {
          cursor: pointer;
        }
        
        .close-button {
          background: var(--primary-color, #007bff);
          color: white;
          border: none;
          padding: 0.5rem 1.5rem;
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .close-button:hover {
          background: var(--primary-hover, #0056b3);
          transform: translateY(-1px);
        }

  @media (max-width: 640px) {
    .tips-modal {
      max-width: 100%;
      margin: 0.5rem;
      max-height: 90vh;
    }

    .tips-header h2 {
      font-size: 1.25rem;
    }

    .tips-footer {
      flex-direction: column;
      gap: 1rem;
    }

    .close-button {
      width: 100%;
    }
  }
</style>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { tipsService } from '$lib/services/tipsService';
  
  interface ModuleTip {
    id: string;
    title: string;
    content: string;
    icon?: string;
  }
  
  export let show = false;
  export let moduleId: string = '';
  export let tips: ModuleTip[] = [];
  
  const dispatch = createEventDispatcher();
  
  let currentTip: ModuleTip | null = null;
  let dontShowAgain = false;
  let hasSelectedTip = false;
  
  // Select a random tip when modal opens
  function selectRandomTip() {
    if (tips.length === 0) {
      currentTip = null;
      hasSelectedTip = false;
      return;
    }
    const randomIndex = Math.floor(Math.random() * tips.length);
    currentTip = tips[randomIndex];
    hasSelectedTip = true;
    console.log('[TipsModal] Selected random tip:', { moduleId, tipId: currentTip.id, totalTips: tips.length });
  }
  
  // Reset and select random tip when modal opens (only once per show cycle)
  $: if (show && !hasSelectedTip && tips.length > 0) {
    console.log('[TipsModal] Modal opened, selecting tip:', { moduleId, tipsCount: tips.length });
    selectRandomTip();
    dontShowAgain = false;
  }
  
  // Reset when modal closes
  $: if (!show) {
    hasSelectedTip = false;
    currentTip = null;
  }
  
  function handleClose() {
    if (dontShowAgain && moduleId) {
      tipsService.dismissTips(moduleId);
    }
    show = false;
    dispatch('close');
  }
</script>

{#if show && currentTip}
  <div class="tips-overlay" onclick={handleClose} onkeydown={(e) => e.key === 'Escape' && handleClose()}>
    <div class="tips-modal" role="dialog" aria-modal="true" aria-labelledby="tips-modal-title" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <div class="tips-header">
        <div class="tips-title-section">
          {#if currentTip.icon}
            <span class="tip-icon">{currentTip.icon}</span>
          {/if}
          <h2 id="tips-modal-title">{currentTip.title}</h2>
        </div>
        <button class="close-btn" onclick={handleClose} aria-label="Close">×</button>
      </div>
      
      <div class="tips-body">
        <div class="tip-content">
          {@html currentTip.content}
        </div>
      </div>
      
      <div class="tips-footer">
        <label class="dont-show-again">
          <input type="checkbox" bind:checked={dontShowAgain} />
          <span>Don't show these tips again</span>
        </label>
        <button class="close-button" onclick={handleClose} type="button">Close</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .tips-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: 1rem;
    animation: fadeIn 0.2s ease-out;
  }

  .tips-modal {
    background: var(--card-bg, #ffffff);
    border-radius: 1rem;
    max-width: 600px;
    width: 100%;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.3s ease-out;
    border: 1px solid var(--border-color, #e0e0e0);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .tips-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }

  .tips-title-section {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
  }

  .tip-icon {
    font-size: 1.5rem;
    line-height: 1;
  }

  .tips-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #1a1a1a);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    line-height: 1;
    cursor: pointer;
    color: var(--text-secondary, #666);
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--hover-bg, #f5f5f5);
    color: var(--text-primary, #1a1a1a);
  }

  .tips-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .tip-content {
    color: var(--text-primary, #1a1a1a);
    line-height: 1.6;
    font-size: 1rem;
  }

  .tip-content :global(h3),
  .tip-content :global(h4) {
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    color: var(--text-primary, #1a1a1a);
  }

  .tip-content :global(h3:first-child),
  .tip-content :global(h4:first-child) {
    margin-top: 0;
  }

  .tip-content :global(ul),
  .tip-content :global(ol) {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }

  .tip-content :global(li) {
    margin: 0.5rem 0;
  }

  .tip-content :global(p) {
    margin: 0.75rem 0;
  }

  .tip-content :global(strong) {
    color: var(--text-primary, #1a1a1a);
    font-weight: 600;
  }

        .tips-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border-color, #e0e0e0);
          background: var(--bg-secondary, #f9f9f9);
        }
        
        .dont-show-again {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
          color: var(--text-secondary, #666);
          user-select: none;
        }
        
        .dont-show-again input[type="checkbox"] {
          cursor: pointer;
        }
        
        .close-button {
          background: var(--primary-color, #007bff);
          color: white;
          border: none;
          padding: 0.5rem 1.5rem;
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .close-button:hover {
          background: var(--primary-hover, #0056b3);
          transform: translateY(-1px);
        }

  @media (max-width: 640px) {
    .tips-modal {
      max-width: 100%;
      margin: 0.5rem;
      max-height: 90vh;
    }

    .tips-header h2 {
      font-size: 1.25rem;
    }

    .tips-footer {
      flex-direction: column;
      gap: 1rem;
    }

    .close-button {
      width: 100%;
    }
  }
</style>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { tipsService } from '$lib/services/tipsService';
  
  interface ModuleTip {
    id: string;
    title: string;
    content: string;
    icon?: string;
  }
  
  export let show = false;
  export let moduleId: string = '';
  export let tips: ModuleTip[] = [];
  
  const dispatch = createEventDispatcher();
  
  let currentTip: ModuleTip | null = null;
  let dontShowAgain = false;
  let hasSelectedTip = false;
  
  // Select a random tip when modal opens
  function selectRandomTip() {
    if (tips.length === 0) {
      currentTip = null;
      hasSelectedTip = false;
      return;
    }
    const randomIndex = Math.floor(Math.random() * tips.length);
    currentTip = tips[randomIndex];
    hasSelectedTip = true;
    console.log('[TipsModal] Selected random tip:', { moduleId, tipId: currentTip.id, totalTips: tips.length });
  }
  
  // Reset and select random tip when modal opens (only once per show cycle)
  $: if (show && !hasSelectedTip && tips.length > 0) {
    console.log('[TipsModal] Modal opened, selecting tip:', { moduleId, tipsCount: tips.length });
    selectRandomTip();
    dontShowAgain = false;
  }
  
  // Reset when modal closes
  $: if (!show) {
    hasSelectedTip = false;
    currentTip = null;
  }
  
  function handleClose() {
    if (dontShowAgain && moduleId) {
      tipsService.dismissTips(moduleId);
    }
    show = false;
    dispatch('close');
  }
</script>

{#if show && currentTip}
  <div class="tips-overlay" onclick={handleClose} onkeydown={(e) => e.key === 'Escape' && handleClose()}>
    <div class="tips-modal" role="dialog" aria-modal="true" aria-labelledby="tips-modal-title" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <div class="tips-header">
        <div class="tips-title-section">
          {#if currentTip.icon}
            <span class="tip-icon">{currentTip.icon}</span>
          {/if}
          <h2 id="tips-modal-title">{currentTip.title}</h2>
        </div>
        <button class="close-btn" onclick={handleClose} aria-label="Close">×</button>
      </div>
      
      <div class="tips-body">
        <div class="tip-content">
          {@html currentTip.content}
        </div>
      </div>
      
      <div class="tips-footer">
        <label class="dont-show-again">
          <input type="checkbox" bind:checked={dontShowAgain} />
          <span>Don't show these tips again</span>
        </label>
        <button class="close-button" onclick={handleClose} type="button">Close</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .tips-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: 1rem;
    animation: fadeIn 0.2s ease-out;
  }

  .tips-modal {
    background: var(--card-bg, #ffffff);
    border-radius: 1rem;
    max-width: 600px;
    width: 100%;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.3s ease-out;
    border: 1px solid var(--border-color, #e0e0e0);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .tips-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }

  .tips-title-section {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
  }

  .tip-icon {
    font-size: 1.5rem;
    line-height: 1;
  }

  .tips-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #1a1a1a);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    line-height: 1;
    cursor: pointer;
    color: var(--text-secondary, #666);
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--hover-bg, #f5f5f5);
    color: var(--text-primary, #1a1a1a);
  }

  .tips-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .tip-content {
    color: var(--text-primary, #1a1a1a);
    line-height: 1.6;
    font-size: 1rem;
  }

  .tip-content :global(h3),
  .tip-content :global(h4) {
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    color: var(--text-primary, #1a1a1a);
  }

  .tip-content :global(h3:first-child),
  .tip-content :global(h4:first-child) {
    margin-top: 0;
  }

  .tip-content :global(ul),
  .tip-content :global(ol) {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }

  .tip-content :global(li) {
    margin: 0.5rem 0;
  }

  .tip-content :global(p) {
    margin: 0.75rem 0;
  }

  .tip-content :global(strong) {
    color: var(--text-primary, #1a1a1a);
    font-weight: 600;
  }

        .tips-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border-color, #e0e0e0);
          background: var(--bg-secondary, #f9f9f9);
        }
        
        .dont-show-again {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
          color: var(--text-secondary, #666);
          user-select: none;
        }
        
        .dont-show-again input[type="checkbox"] {
          cursor: pointer;
        }
        
        .close-button {
          background: var(--primary-color, #007bff);
          color: white;
          border: none;
          padding: 0.5rem 1.5rem;
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .close-button:hover {
          background: var(--primary-hover, #0056b3);
          transform: translateY(-1px);
        }

  @media (max-width: 640px) {
    .tips-modal {
      max-width: 100%;
      margin: 0.5rem;
      max-height: 90vh;
    }

    .tips-header h2 {
      font-size: 1.25rem;
    }

    .tips-footer {
      flex-direction: column;
      gap: 1rem;
    }

    .close-button {
      width: 100%;
    }
  }
</style>







