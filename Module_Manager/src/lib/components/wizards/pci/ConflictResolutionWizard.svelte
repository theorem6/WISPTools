<script lang="ts">
  /**
   * Conflict Resolution Wizard (PCI)
   * Guides users through identifying and resolving PCI conflicts.
   */
  import { createEventDispatcher } from 'svelte';
  import BaseWizard from '../BaseWizard.svelte';
  import { pciService } from '$lib/services/pciService';
  import { networkService } from '$lib/services/networkService';
  import {
    cellsStore,
    conflictsStore,
    optimizationStore
  } from '$lib/stores/appState';
  import { networkStore } from '$lib/stores/networkStore';
  import type { Cell } from '$lib/pciMapper';
  import type { OptimizationResult } from '$lib/pciOptimizer';

  export let show = false;
  const dispatch = createEventDispatcher<{ close: void; saved: void }>();

  let currentStep = 0;
  let isLoading = false;
  let error = '';
  let success = '';

  const steps = [
    { id: 'welcome', title: 'Welcome', icon: '📊' },
    { id: 'identify', title: 'Identify Conflicts', icon: '🔍' },
    { id: 'review', title: 'Review', icon: '📋' },
    { id: 'strategy', title: 'Strategy', icon: '⚙️' },
    { id: 'preview', title: 'Preview', icon: '👁️' },
    { id: 'apply', title: 'Apply', icon: '✅' },
    { id: 'verify', title: 'Verify', icon: '✔️' },
    { id: 'complete', title: 'Complete', icon: '🎉' }
  ];

  let optimizationResult: OptimizationResult | null = null;
  let verificationConflictCount = -1;

  function handleClose() {
    show = false;
    resetWizard();
    dispatch('close');
  }

  function resetWizard() {
    currentStep = 0;
    optimizationResult = null;
    verificationConflictCount = -1;
    error = '';
    success = '';
  }

  function handleStepChange(event: CustomEvent<number>) {
    currentStep = event.detail;
  }

  function nextStep() {
    if (currentStep < steps.length - 1) {
      currentStep++;
      error = '';
      success = '';
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
      error = '';
      success = '';
    }
  }

  async function runAnalysis() {
    const cells = $cellsStore.items;
    if (!cells.length) {
      error = 'No cells to analyze. Load a network or import cells on the PCI Resolution page first.';
      return;
    }
    isLoading = true;
    error = '';
    success = '';
    try {
      const result = await pciService.performAnalysis(cells);
      if (result.success) {
        success = `Analysis complete. ${$conflictsStore.items.length} conflict(s) found.`;
        nextStep();
      } else {
        error = result.error || 'Analysis failed';
      }
    } catch (err: any) {
      error = err.message || 'Analysis failed';
    } finally {
      isLoading = false;
    }
  }

  async function runOptimization() {
    const cells = $cellsStore.items;
    if (!cells.length) {
      error = 'No cells. Load a network first.';
      return;
    }
    isLoading = true;
    error = '';
    success = '';
    try {
      const result = await pciService.optimizePCIs(cells);
      if (result.success && result.data) {
        optimizationResult = result.data;
        success = `Optimization complete. ${result.data.changes.length} PCI change(s) suggested.`;
        nextStep();
      } else {
        error = result.error || 'Optimization failed';
      }
    } catch (err: any) {
      error = err.message || 'Optimization failed';
    } finally {
      isLoading = false;
    }
  }

  async function applyChanges() {
    if (!optimizationResult?.optimizedCells?.length) {
      error = 'No changes to apply.';
      return;
    }
    const activeNetwork = $networkStore.currentNetwork;
    if (!activeNetwork?.id) {
      error = 'No network selected. Select a network on the PCI Resolution page to save changes.';
      return;
    }
    isLoading = true;
    error = '';
    success = '';
    try {
      cellsStore.update((s) => ({ ...s, items: optimizationResult!.optimizedCells }));
      await networkService.updateNetworkCells(activeNetwork.id, optimizationResult!.optimizedCells);
      networkStore.updateCurrentNetworkCells(optimizationResult!.optimizedCells);
      success = 'Changes applied and saved to network.';
      dispatch('saved');
      nextStep();
    } catch (err: any) {
      error = err.message || 'Failed to save';
    } finally {
      isLoading = false;
    }
  }

  async function verifyResolution() {
    const cells = $cellsStore.items;
    if (!cells.length) {
      error = 'No cells.';
      return;
    }
    isLoading = true;
    error = '';
    success = '';
    try {
      const result = await pciService.performAnalysis(cells);
      if (result.success && result.data) {
        verificationConflictCount = result.data.conflicts.length;
        success = verificationConflictCount === 0
          ? 'No conflicts remaining.'
          : `${verificationConflictCount} conflict(s) still remain. You may run optimization again or resolve manually.`;
        nextStep();
      } else {
        error = result.error || 'Verification failed';
      }
    } catch (err: any) {
      error = err.message || 'Verification failed';
    } finally {
      isLoading = false;
    }
  }

  $: conflictCount = $conflictsStore.items.length;
  $: conflicts = $conflictsStore.items;
  $: activeNetwork = $networkStore.currentNetwork;
</script>

<BaseWizard
  {show}
  title="📊 PCI Conflict Resolution Wizard"
  {steps}
  {currentStep}
  {isLoading}
  {error}
  {success}
  on:close={handleClose}
  on:stepChange={handleStepChange}
>
  <div slot="content">
    {#if currentStep === 0}
      <div class="wizard-panel">
        <h3>PCI Conflict Resolution</h3>
        <p>This wizard will help you identify and resolve Physical Cell ID (PCI) conflicts in your LTE network.</p>
        <div class="info-box">
          <h4>Steps:</h4>
          <ul>
            <li>Run analysis on your current network cells</li>
            <li>Review detected conflicts</li>
            <li>Apply automatic PCI optimization</li>
            <li>Verify resolution</li>
          </ul>
        </div>
        <p class="hint">Make sure you have a network selected and cells loaded on the PCI Resolution page before starting.</p>
      </div>
    {:else if currentStep === 1}
      <div class="wizard-panel">
        <h3>Identify Conflicts</h3>
        <p>Run PCI conflict analysis on the current network cells.</p>
        <button type="button" class="wizard-btn-primary" on:click={runAnalysis} disabled={isLoading}>
          {isLoading ? 'Analyzing...' : 'Run Analysis'}
        </button>
        {#if conflictCount >= 0 && !isLoading}
          <p class="hint">Conflicts found: <strong>{conflictCount}</strong></p>
        {/if}
      </div>
    {:else if currentStep === 2}
      <div class="wizard-panel">
        <h3>Review Conflicts</h3>
        {#if conflicts.length === 0}
          <p class="success-msg">No conflicts detected. Your PCI assignments are good.</p>
          <button type="button" class="wizard-btn-secondary" on:click={handleClose}>Done</button>
        {:else}
          <p>{conflicts.length} conflict(s) detected.</p>
          <div class="conflict-list">
            {#each conflicts.slice(0, 10) as c}
              <div class="conflict-item">
                <span class="severity {c.severity?.toLowerCase()}">{c.severity}</span>
                {c.primaryCell.id} (PCI {c.primaryCell.pci}) ↔ {c.conflictingCell.id} (PCI {c.conflictingCell.pci}) — {c.conflictType}
              </div>
            {/each}
          </div>
          {#if conflicts.length > 10}
            <p class="hint">... and {conflicts.length - 10} more.</p>
          {/if}
        {/if}
      </div>
    {:else if currentStep === 3}
      <div class="wizard-panel">
        <h3>Resolution Strategy</h3>
        <p>Choose automatic optimization to reassign PCIs and resolve conflicts.</p>
        <button type="button" class="wizard-btn-primary" on:click={runOptimization} disabled={isLoading || conflictCount === 0}>
          {isLoading ? 'Optimizing...' : 'Auto-optimize PCIs'}
        </button>
        {#if conflictCount === 0}
          <p class="hint">No conflicts to optimize. You can close the wizard.</p>
        {/if}
      </div>
    {:else if currentStep === 4}
      <div class="wizard-panel">
        <h3>Preview Changes</h3>
        {#if optimizationResult?.changes?.length}
          <p>{optimizationResult.changes.length} PCI change(s) will be applied:</p>
          <ul class="change-list">
            {#each optimizationResult.changes.slice(0, 15) as ch}
              <li><strong>{ch.cellId}</strong>: PCI {ch.oldPCI} → {ch.newPCI}</li>
            {/each}
          </ul>
          {#if optimizationResult.changes.length > 15}
            <p class="hint">... and {optimizationResult.changes.length - 15} more.</p>
          {/if}
        {:else}
          <p>No changes to preview.</p>
        {/if}
      </div>
    {:else if currentStep === 5}
      <div class="wizard-panel">
        <h3>Apply Changes</h3>
        <p>Save the optimized PCI assignments to your network.</p>
        {#if activeNetwork}
          <p class="hint">Network: <strong>{activeNetwork.name || activeNetwork.id}</strong></p>
          <button type="button" class="wizard-btn-primary" on:click={applyChanges} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Apply & Save'}
          </button>
        {:else}
          <p class="hint">No network selected. Select a network on the PCI Resolution page, then return here to apply.</p>
        {/if}
      </div>
    {:else if currentStep === 6}
      <div class="wizard-panel">
        <h3>Verify Resolution</h3>
        <p>Re-run analysis to confirm conflicts are resolved.</p>
        <button type="button" class="wizard-btn-primary" on:click={verifyResolution} disabled={isLoading}>
          {isLoading ? 'Verifying...' : 'Verify'}
        </button>
      </div>
    {:else if currentStep === 7}
      <div class="wizard-panel">
        {#if verificationConflictCount === 0}
          <h3>🎉 All conflicts resolved</h3>
          <p>PCI optimization is complete. No conflicts remain.</p>
        {:else if verificationConflictCount > 0}
          <h3>Resolution complete</h3>
          <p>{verificationConflictCount} conflict(s) still remain. You can run the wizard again or resolve manually on the map.</p>
        {:else}
          <h3>Wizard complete</h3>
          <p>You can close the wizard and continue on the PCI Resolution page.</p>
        {/if}
        <a href="/modules/pci-resolution" class="next-step-item">Back to PCI Resolution →</a>
      </div>
    {/if}
  </div>

  <div slot="footer" let:currentStep let:nextStep let:prevStep let:handleClose let:isLoading>
    {#if currentStep > 0 && currentStep < steps.length - 1 && currentStep !== 2}
      <button class="wizard-btn-secondary" on:click={prevStep} disabled={isLoading}>← Previous</button>
    {:else if currentStep === 0}
      <button class="wizard-btn-secondary" on:click={handleClose} disabled={isLoading}>Cancel</button>
    {/if}
    <div class="footer-actions">
      {#if currentStep === 1 && !isLoading && conflictCount >= 0}
        <button class="wizard-btn-primary" on:click={nextStep}>Next →</button>
      {:else if currentStep === 2 && conflicts.length > 0}
        <button class="wizard-btn-primary" on:click={nextStep}>Next →</button>
      {:else if currentStep === 4}
        <button class="wizard-btn-primary" on:click={nextStep}>Next →</button>
      {:else if currentStep === 7}
        <button class="wizard-btn-primary" on:click={handleClose}>Done</button>
      {/if}
    </div>
  </div>
</BaseWizard>

<style>
  .wizard-panel h3 { margin: 0 0 var(--spacing-md) 0; font-size: var(--font-size-2xl); color: var(--text-primary); }
  .wizard-panel p { margin: var(--spacing-sm) 0; color: var(--text-secondary); }
  .hint { font-size: var(--font-size-sm); color: var(--text-secondary); }
  .info-box { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: var(--spacing-md); margin: var(--spacing-md) 0; }
  .info-box ul { margin: var(--spacing-sm) 0 0 0; padding-left: 1.25rem; }
  .conflict-list { max-height: 200px; overflow-y: auto; margin: var(--spacing-md) 0; }
  .conflict-item { padding: var(--spacing-sm); border-bottom: 1px solid var(--border-color); font-size: var(--font-size-sm); }
  .severity { font-weight: 600; margin-right: 0.5rem; }
  .severity.critical { color: #dc2626; }
  .severity.high { color: #ea580c; }
  .severity.medium { color: #ca8a04; }
  .severity.low { color: #16a34a; }
  .change-list { padding-left: 1.25rem; margin: var(--spacing-sm) 0; }
  .success-msg { color: var(--success-color); }
  .next-step-item { display: inline-block; margin-top: var(--spacing-md); padding: var(--spacing-sm) var(--spacing-md); background: var(--primary-color); color: var(--text-inverse); border-radius: var(--radius-md); text-decoration: none; }
  .footer-actions { display: flex; gap: var(--spacing-sm); }
</style>
