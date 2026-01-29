<script lang="ts">
  /**
   * ModuleWizardMenu – single "Wizards" button per module that opens a dropdown
   * listing only the wizards supported by that module. Selecting one opens that wizard.
   */
  import { createEventDispatcher } from 'svelte';

  export let wizards: Array<{ id: string; label: string; icon?: string }> = [];
  export let disabled = false;

  let open = false;

  const dispatch = createEventDispatcher<{ select: { id: string } }>();

  function toggle() {
    if (!disabled) open = !open;
  }

  function select(id: string) {
    dispatch('select', { id });
    open = false;
  }

  function handleBlur() {
    // Allow click on item to fire before closing
    setTimeout(() => { open = false; }, 150);
  }
</script>

<svelte:window on:click={(e) => { if (open && e.target instanceof Element && !(e.target as Element).closest('.module-wizard-menu')) open = false; }} />

{#if wizards.length > 0}
  <div class="module-wizard-menu">
    <button
      type="button"
      class="wizard-trigger"
      class:open
      disabled={disabled}
      onclick={toggle}
      onblur={handleBlur}
      title="Wizards for this module"
      aria-haspopup="true"
      aria-expanded={open}
    >
      <span class="wizard-trigger-icon">🧙</span>
      <span class="wizard-trigger-label">Wizards</span>
      <span class="wizard-trigger-chevron">▼</span>
    </button>
    {#if open}
      <div class="wizard-dropdown" role="menu">
        {#each wizards as w}
          <button
            type="button"
            role="menuitem"
            class="wizard-item"
            onclick={() => select(w.id)}
          >
            {#if w.icon}<span class="wizard-item-icon">{w.icon}</span>{/if}
            <span class="wizard-item-label">{w.label}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .module-wizard-menu {
    position: relative;
    display: inline-block;
  }

  .wizard-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-secondary, #1a2332);
    border: 1px solid var(--border-color, #334155);
    border-radius: 8px;
    color: var(--text-primary, #e2e8f0);
    font-size: 0.9rem;
    cursor: pointer;
    white-space: nowrap;
  }

  .wizard-trigger:hover:not(:disabled) {
    background: var(--primary-color, #00d9ff);
    color: var(--text-inverse, #0f1419);
    border-color: var(--primary-color);
  }

  .wizard-trigger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .wizard-trigger.open {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(0, 217, 255, 0.3);
  }

  .wizard-trigger-icon {
    font-size: 1rem;
  }

  .wizard-trigger-chevron {
    font-size: 0.65rem;
    opacity: 0.8;
  }

  .wizard-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    min-width: 200px;
    background: var(--bg-secondary, #1a2332);
    border: 1px solid var(--border-color, #334155);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 1000;
    padding: 4px 0;
  }

  .wizard-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-size: 0.9rem;
    text-align: left;
    cursor: pointer;
  }

  .wizard-item:hover {
    background: rgba(0, 217, 255, 0.15);
    color: var(--primary-color, #00d9ff);
  }

  .wizard-item-icon {
    font-size: 1rem;
  }
</style>
