<script lang="ts">
  /**
   * Organization Setup Wizard
   * Standalone wizard for verifying/editing organization (tenant) details.
   * Used from onboarding or /wizards catalog.
   */
  import { createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  import { currentTenant } from '$lib/stores/tenantStore';

  export let show = false;

  const dispatch = createEventDispatcher();

  function handleClose() {
    dispatch('close');
  }

  function openSettings() {
    dispatch('action', { type: 'open-settings' });
    goto('/dashboard?panel=settings');
    handleClose();
  }
</script>

{#if show}
  <div class="wizard-overlay" role="dialog" aria-modal="true" aria-labelledby="org-wizard-title">
    <div class="wizard-modal">
      <div class="wizard-header">
        <h2 id="org-wizard-title">🏢 Organization Setup</h2>
        <button class="close-btn" on:click={handleClose} aria-label="Close">✕</button>
      </div>
      <div class="wizard-content">
        <div class="wizard-panel">
          <p>Verify your organization details. You can edit these later in Settings.</p>
          {#if $currentTenant}
            <div class="info-card">
              <div class="info-row">
                <span class="label">Organization Name:</span>
                <span class="value">{$currentTenant.displayName}</span>
              </div>
              <div class="info-row">
                <span class="label">Contact Email:</span>
                <span class="value">{$currentTenant.contactEmail ?? '—'}</span>
              </div>
            </div>
          {:else}
            <p class="hint">No tenant selected. Select a tenant from the dashboard or complete tenant setup first.</p>
          {/if}
          <div class="actions">
            <button type="button" class="btn-primary" on:click={openSettings}>Edit in Settings</button>
            <button type="button" class="btn-secondary" on:click={handleClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .wizard-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: 1rem;
  }
  .wizard-modal {
    background: var(--card-bg, #fff);
    border-radius: 1rem;
    max-width: 480px;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  }
  .wizard-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }
  .wizard-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.25rem;
    color: var(--text-secondary, #666);
  }
  .close-btn:hover {
    color: var(--text-primary, #111);
  }
  .wizard-content {
    padding: 1.25rem;
  }
  .wizard-panel p {
    margin: 0 0 1rem 0;
    color: var(--text-secondary, #555);
  }
  .info-card {
    background: var(--bg-secondary, #f5f5f5);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }
  .info-row:last-child {
    margin-bottom: 0;
  }
  .label {
    font-weight: 500;
    color: var(--text-secondary, #555);
  }
  .value {
    color: var(--text-primary, #111);
  }
  .hint {
    font-size: 0.9rem;
    color: var(--text-secondary, #666);
  }
  .actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
  }
  .btn-primary {
    background: var(--primary-color, #007bff);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-secondary {
    background: var(--bg-secondary, #f0f0f0);
    color: var(--text-primary, #111);
    border: 1px solid var(--border-color, #ddd);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
  }
</style>
