<script lang="ts">
  /**
   * BaseWizard Component
   * 
   * Reusable base component for creating multi-step wizards across modules.
   * Provides common structure, navigation, and styling.
   */
  
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  export let title = 'Wizard';
  export let steps: Array<{ id: string; title: string; icon: string }> = [];
  export let currentStep = 0;
  export let isLoading = false;
  export let error = '';
  export let success = '';
  export let allowStepNavigation = true; // Allow clicking steps to navigate
  
  const dispatch = createEventDispatcher<{
    close: void;
    next: number;
    previous: number;
    stepChange: number;
    complete: void;
  }>();
  
  function handleClose() {
    dispatch('close');
  }
  
  function nextStep() {
    if (currentStep < steps.length - 1) {
      const newStep = currentStep + 1;
      dispatch('next', newStep);
      dispatch('stepChange', newStep);
    }
  }
  
  function prevStep() {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      dispatch('previous', newStep);
      dispatch('stepChange', newStep);
    }
  }
  
  function goToStep(index: number) {
    if (allowStepNavigation && index >= 0 && index < steps.length && index <= currentStep) {
      dispatch('stepChange', index);
    }
  }
  
  function handleComplete() {
    dispatch('complete');
  }
  
  // Handle Escape key
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && show) {
      handleClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
  <div 
    class="wizard-overlay" 
    role="dialog" 
    aria-modal="true" 
    aria-labelledby="wizard-title"
    on:click={handleClose}
  >
    <div 
      class="wizard-modal"
      on:click|stopPropagation
    >
      <!-- Header -->
      <div class="wizard-header">
        <h2 id="wizard-title">{title}</h2>
        <button class="close-btn" on:click={handleClose} aria-label="Close">✕</button>
      </div>
      
      <!-- Progress Steps -->
      {#if steps.length > 0}
        <nav class="wizard-steps" aria-label="Wizard steps">
          {#each steps as step, index}
            <button
              type="button"
              class="wizard-step"
              class:active={index === currentStep}
              class:complete={index < currentStep}
              disabled={!allowStepNavigation || index > currentStep}
              on:click={() => goToStep(index)}
            >
              <span class="step-icon">{step.icon}</span>
              <span class="step-title">{step.title}</span>
            </button>
          {/each}
        </nav>
      {/if}
      
      <!-- Content Area -->
      <div class="wizard-content">
        {#if error}
          <div class="alert alert-error">{error}</div>
        {/if}
        
        {#if success}
          <div class="alert alert-success">{success}</div>
        {/if}
        
        <!-- Slot for step content -->
        <slot name="content" {currentStep} />
      </div>
      
      <!-- Footer -->
      <div class="wizard-footer">
        <slot name="footer" {currentStep} {nextStep} {prevStep} {handleClose} {handleComplete} {isLoading} />
      </div>
    </div>
  </div>
{/if}

<style>
  /* Conform to global theme (app.css, theme.css, modal.css) */
  .wizard-overlay {
    position: fixed;
    inset: 0;
    background: var(--modal-backdrop-color, rgba(15, 23, 42, 0.55));
    backdrop-filter: blur(var(--modal-backdrop-blur, 6px));
    -webkit-backdrop-filter: blur(var(--modal-backdrop-blur, 6px));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: var(--spacing-lg, 1rem);
  }
  
  .wizard-modal {
    background: var(--card-bg);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--modal-radius, var(--radius-lg, 1rem));
    max-width: 700px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--modal-surface-shadow, var(--shadow-lg));
    animation: slideUp 0.3s ease-out;
  }
  
  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  .wizard-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
    background: color-mix(in srgb, var(--card-bg) 94%, var(--bg-secondary) 6%);
  }
  
  .wizard-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .close-btn {
    background: transparent;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    transition: var(--transition);
  }
  
  .close-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }
  
  .wizard-steps {
    display: flex;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
    overflow-x: auto;
  }
  
  .wizard-step {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: var(--transition);
    white-space: nowrap;
    font-size: var(--font-size-sm, 0.875rem);
  }
  
  .wizard-step:hover:not(:disabled) {
    background: var(--hover-bg);
  }
  
  .wizard-step.active {
    background: var(--primary-color);
    color: var(--text-inverse);
    border-color: var(--primary-color);
  }
  
  .wizard-step.complete {
    background: var(--success-light);
    border-color: var(--success-color);
    color: var(--success-color);
  }
  
  .wizard-step:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .step-icon { font-size: 1.25rem; }
  
  .wizard-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-xl);
    background: var(--card-bg);
    color: var(--text-primary);
  }
  
  .wizard-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-lg);
    border-top: 1px solid var(--border-color);
    gap: var(--spacing-md);
    background: color-mix(in srgb, var(--card-bg) 94%, var(--bg-secondary) 6%);
  }
  
  .alert {
    padding: var(--spacing-md);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-md);
  }
  
  .alert-error {
    background: var(--danger-light);
    color: var(--danger-color);
    border: 1px solid var(--danger-color);
  }
  
  .alert-success {
    background: var(--success-light);
    color: var(--success-color);
    border: 1px solid var(--success-color);
  }
  
  /* Form controls inside wizard content – use theme vars */
  .wizard-content :global(label) {
    color: var(--text-primary);
    display: block;
    margin-bottom: var(--spacing-xs);
    font-weight: 500;
  }
  
  .wizard-content :global(input),
  .wizard-content :global(select),
  .wizard-content :global(textarea) {
    background: var(--input-bg);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--font-size-sm);
    width: 100%;
  }
  
  .wizard-content :global(input::placeholder),
  .wizard-content :global(textarea::placeholder) {
    color: var(--text-muted);
  }
  
  .wizard-content :global(input:focus),
  .wizard-content :global(select:focus),
  .wizard-content :global(textarea:focus) {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 30%, transparent);
  }
  
  .wizard-content :global(select option) {
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  
  /* Common wizard buttons */
  :global(.wizard-btn-primary) {
    padding: 0.75rem 1.5rem;
    border-radius: var(--radius-md);
    border: none;
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
    background: var(--primary-color);
    color: var(--text-inverse);
  }
  
  :global(.wizard-btn-primary:hover:not(:disabled)) {
    background: var(--primary-hover);
    transform: translateY(-1px);
  }
  
  :global(.wizard-btn-primary:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  :global(.wizard-btn-secondary) {
    padding: 0.75rem 1.5rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  
  :global(.wizard-btn-secondary:hover:not(:disabled)) {
    background: var(--hover-bg);
  }
  
  :global(.wizard-btn-secondary:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
