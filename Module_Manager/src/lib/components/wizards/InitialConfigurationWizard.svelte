<script lang="ts">
  /**
   * Initial Configuration Wizard
   * Standalone wizard for configuring modules (CBRS, ACS, Monitoring).
   * Used from onboarding or /wizards catalog.
   */
  import { createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';

  export let show = false;

  const dispatch = createEventDispatcher();

  function handleClose() {
    dispatch('close');
  }

  function openCoverageMap() {
    goto('/modules/coverage-map');
    handleClose();
  }

  function setupCbrs() {
    dispatch('action', { type: 'setup-cbrs' });
    goto('/modules/cbrs-management');
    handleClose();
  }

  function setupAcs() {
    dispatch('action', { type: 'setup-acs' });
    goto('/modules/acs-cpe-management/settings');
    handleClose();
  }

  function setupMonitoring() {
    dispatch('action', { type: 'setup-monitoring' });
    goto('/modules/monitoring');
    handleClose();
  }
</script>

{#if show}
  <div class="wizard-overlay" role="dialog" aria-modal="true" aria-labelledby="config-wizard-title">
    <div class="wizard-modal">
      <div class="wizard-header">
        <h2 id="config-wizard-title">⚙️ Initial Configuration</h2>
        <button class="close-btn" on:click={handleClose} aria-label="Close">✕</button>
      </div>
      <div class="wizard-content">
        <div class="wizard-panel">
          <p>Add your first tower and configure the modules you'll use. You can do these later from the Dashboard.</p>

          <div class="section">
            <h3>Add First Tower</h3>
            <p class="section-desc">Add a tower site for coverage planning.</p>
            <button type="button" class="btn-primary" on:click={openCoverageMap}>Open Coverage Map</button>
          </div>

          <div class="section">
            <h3>Configure Modules</h3>
            <div class="modules-grid">
              <div class="module-card">
                <span class="icon">📡</span>
                <h4>CBRS Management</h4>
                <p>Configure SAS API keys</p>
                <button type="button" class="btn-secondary" on:click={setupCbrs}>Setup CBRS</button>
              </div>
              <div class="module-card">
                <span class="icon">⚙️</span>
                <h4>ACS/TR-069</h4>
                <p>Connect GenieACS for CPE</p>
                <button type="button" class="btn-secondary" on:click={setupAcs}>Setup ACS</button>
              </div>
              <div class="module-card">
                <span class="icon">📊</span>
                <h4>Monitoring</h4>
                <p>Configure SNMP and monitoring</p>
                <button type="button" class="btn-secondary" on:click={setupMonitoring}>Setup Monitoring</button>
              </div>
            </div>
          </div>

          <div class="actions">
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
    max-width: 560px;
    width: 100%;
    max-height: 90vh;
    overflow: auto;
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
  .wizard-panel > p {
    margin: 0 0 1rem 0;
    color: var(--text-secondary, #555);
  }
  .section {
    margin-bottom: 1.5rem;
  }
  .section h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1rem;
  }
  .section-desc {
    margin: 0 0 0.75rem 0;
    font-size: 0.9rem;
    color: var(--text-secondary, #666);
  }
  .modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1rem;
    margin-top: 0.75rem;
  }
  .module-card {
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
  }
  .module-card .icon {
    font-size: 1.5rem;
    display: block;
    margin-bottom: 0.5rem;
  }
  .module-card h4 {
    margin: 0 0 0.25rem 0;
    font-size: 0.95rem;
  }
  .module-card p {
    margin: 0 0 0.75rem 0;
    font-size: 0.8rem;
    color: var(--text-secondary, #666);
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
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
  }
  .actions {
    margin-top: 1rem;
  }
</style>
