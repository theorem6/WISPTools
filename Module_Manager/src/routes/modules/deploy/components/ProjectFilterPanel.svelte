<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { planService, type PlanProject } from '$lib/services/planService';
  
  export let show = false;
  export let approvedPlans: PlanProject[] = [];
  export let visiblePlanIds: Set<string> = new Set();
  
  const dispatch = createEventDispatcher();
  
  let filterExpanded = false;
  
  $: visibleCount = approvedPlans.filter(p => visiblePlanIds.has(p.id)).length;
  
  async function togglePlanVisibility(plan: PlanProject) {
    try {
      const isCurrentlyVisible = visiblePlanIds.has(plan.id);
      
      if (isCurrentlyVisible) {
        // Hide plan
        await planService.updatePlan(plan.id, { showOnMap: false });
        visiblePlanIds.delete(plan.id);
      } else {
        // Show plan
        await planService.updatePlan(plan.id, { showOnMap: true });
        visiblePlanIds.add(plan.id);
      }
      
      // Update local state
      visiblePlanIds = new Set(visiblePlanIds);
      
      // Notify parent of change - reload map to sync
      dispatch('visibility-changed', { planId: plan.id, visible: !isCurrentlyVisible });
    } catch (err: any) {
      console.error('Error toggling plan visibility:', err);
    }
  }
  
  function handleClose() {
    dispatch('close');
  }
</script>

{#if show}
<div class="project-filter-panel">
  <div class="panel-header">
    <h3>📋 Project Filters</h3>
    <button class="toggle-btn" onclick={() => filterExpanded = !filterExpanded} title={filterExpanded ? 'Collapse' : 'Expand'}>
      {filterExpanded ? '−' : '+'}
    </button>
  </div>
  
  {#if filterExpanded}
  <div class="panel-content">
    {#if approvedPlans.length === 0}
      <div class="empty-state">
        <p>No approved projects available</p>
        <p class="hint">Approve plans in the Plan Approval modal to see them here</p>
      </div>
    {:else}
      <div class="projects-list">
        {#each approvedPlans as plan}
          <div class="project-item" class:visible={visiblePlanIds.has(plan.id)}>
            <div class="project-info">
              <div class="project-name">{plan.name}</div>
              <div class="project-meta">
                <span class="badge status-{plan.status}">{plan.status}</span>
                <span class="scope-count">
                  {plan.scope.towers.length + plan.scope.sectors.length + plan.scope.cpeDevices.length + plan.scope.equipment.length} objects
                </span>
              </div>
            </div>
            <label class="toggle-switch">
              <input 
                type="checkbox" 
                checked={visiblePlanIds.has(plan.id)}
                on:change={() => togglePlanVisibility(plan)}
              />
              <span class="slider"></span>
            </label>
          </div>
        {/each}
      </div>
      
      <div class="filter-summary">
        <span class="summary-text">
          {visibleCount} of {approvedPlans.length} projects visible on map
        </span>
      </div>
    {/if}
  </div>
  {/if}
</div>
{/if}

<style>
  .project-filter-panel {
    position: fixed;
    top: 80px;
    right: 20px;
    width: 320px;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-xl);
    z-index: 1000;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border-color);
  }
  
  .panel-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .toggle-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem 0.5rem;
    transition: color 0.2s;
  }
  
  .toggle-btn:hover {
    color: var(--text-primary);
  }
  
  .panel-content {
    padding: var(--spacing-md);
    overflow-y: auto;
    flex: 1;
  }
  
  .empty-state {
    text-align: center;
    padding: var(--spacing-lg);
    color: var(--text-secondary);
  }
  
  .empty-state p {
    margin: 0.5rem 0;
  }
  
  .empty-state .hint {
    font-size: 0.85rem;
    color: var(--text-tertiary);
  }
  
  .projects-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  
  .project-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm);
    border-radius: var(--border-radius-sm);
    background: var(--bg-secondary);
    transition: background 0.2s;
  }
  
  .project-item:hover {
    background: var(--bg-tertiary);
  }
  
  .project-item.visible {
    border-left: 3px solid var(--brand-primary);
  }
  
  .project-info {
    flex: 1;
    min-width: 0;
  }
  
  .project-name {
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .project-meta {
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
    font-size: 0.85rem;
  }
  
  .badge {
    padding: 0.125rem 0.5rem;
    border-radius: var(--border-radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .badge.status-approved {
    background: rgba(59, 130, 246, 0.1);
    color: #2563eb;
  }
  
  .badge.status-ready {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
  }
  
  .scope-count {
    color: var(--text-secondary);
    font-size: 0.75rem;
  }
  
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
  }
  
  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--bg-tertiary);
    transition: 0.3s;
    border-radius: 24px;
  }
  
  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }
  
  input:checked + .slider {
    background-color: var(--brand-primary);
  }
  
  input:checked + .slider:before {
    transform: translateX(20px);
  }
  
  .filter-summary {
    margin-top: var(--spacing-md);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--border-color);
    text-align: center;
  }
  
  .summary-text {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
</style>

