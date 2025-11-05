<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { coverageMapService } from '../../coverage-map/lib/coverageMapService.mongodb';
  import { planService, type PlanProject } from '$lib/services/planService';
  import { authService } from '$lib/services/authService';
  
  export let show = false;
  export let tenantId: string = '';
  
  const dispatch = createEventDispatcher();
  
  let deployments: any[] = [];
  let plans: PlanProject[] = [];
  let isLoading = false;
  let error = '';
  let selectedDeployment: any = null;
  let showEditModal = false;
  let isSaving = false;
  
  // Edit form
  let editForm = {
    name: '',
    hardware_type: '',
    status: 'deployed',
    config: {} as any,
    planId: ''
  };
  
  $: if (show && tenantId) {
    loadDeployments();
    loadPlans();
  }
  
  async function loadDeployments() {
    if (!tenantId) return;
    
    isLoading = true;
    error = '';
    try {
      deployments = await coverageMapService.getAllHardwareDeployments(tenantId);
    } catch (err: any) {
      console.error('Error loading deployments:', err);
      error = err.message || 'Failed to load deployments';
    } finally {
      isLoading = false;
    }
  }
  
  async function loadPlans() {
    if (!tenantId) return;
    
    try {
      plans = await planService.getPlans(tenantId);
    } catch (err) {
      console.error('Error loading plans:', err);
    }
  }
  
  function openEdit(deployment: any) {
    selectedDeployment = deployment;
    editForm = {
      name: deployment.name || '',
      hardware_type: deployment.hardware_type || '',
      status: deployment.status || 'deployed',
      config: deployment.config || {},
      planId: deployment.planId || ''
    };
    showEditModal = true;
  }
  
  async function saveEdit() {
    if (!selectedDeployment || !tenantId) return;
    
    isSaving = true;
    error = '';
    try {
      await coverageMapService.updateHardwareDeployment(
        tenantId,
        selectedDeployment._id || selectedDeployment.id,
        editForm
      );
      await loadDeployments();
      showEditModal = false;
      selectedDeployment = null;
    } catch (err: any) {
      console.error('Error updating deployment:', err);
      error = err.message || 'Failed to update deployment';
    } finally {
      isSaving = false;
    }
  }
  
  async function deleteDeployment(deployment: any) {
    if (!confirm(`Are you sure you want to delete deployment "${deployment.name}"?`)) {
      return;
    }
    
    if (!tenantId) return;
    
    try {
      await coverageMapService.removeHardwareDeployment(
        tenantId,
        deployment._id || deployment.id
      );
      await loadDeployments();
    } catch (err: any) {
      console.error('Error deleting deployment:', err);
      error = err.message || 'Failed to delete deployment';
    }
  }
  
  function closeModal() {
    show = false;
    showEditModal = false;
    selectedDeployment = null;
    dispatch('close');
  }
  
  function getPlanName(planId: string) {
    if (!planId) return 'No project';
    const plan = plans.find(p => p.id === planId);
    return plan ? plan.name : 'Unknown project';
  }
</script>

{#if show}
<div class="modal-overlay" on:click={closeModal}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <h2>🔧 Deployed Hardware</h2>
      <button class="close-btn" on:click={closeModal}>✕</button>
    </div>
    
    {#if error}
      <div class="error-banner">{error}</div>
    {/if}
    
    <div class="modal-body">
      {#if isLoading}
        <div class="loading">Loading deployments...</div>
      {:else if deployments.length === 0}
        <div class="empty-state">
          <p>No hardware deployments found</p>
        </div>
      {:else}
        <div class="deployments-list">
          {#each deployments as deployment}
            <div class="deployment-item">
              <div class="deployment-header">
                <div>
                  <h3>{deployment.name || 'Unnamed Deployment'}</h3>
                  <span class="deployment-type">{deployment.hardware_type}</span>
                  <span class="deployment-status {deployment.status}">{deployment.status}</span>
                </div>
                <div class="deployment-actions">
                  <button class="btn-edit" on:click={() => openEdit(deployment)}>✏️ Edit</button>
                  <button class="btn-delete" on:click={() => deleteDeployment(deployment)}>🗑️ Delete</button>
                </div>
              </div>
              
              <div class="deployment-details">
                <div class="detail-row">
                  <span class="label">Site:</span>
                  <span class="value">{deployment.siteId?.name || 'Unknown'}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Project:</span>
                  <span class="value">{getPlanName(deployment.planId)}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Deployed:</span>
                  <span class="value">{new Date(deployment.deployedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" on:click={closeModal}>Close</button>
    </div>
  </div>
</div>

<!-- Edit Modal -->
{#if showEditModal && selectedDeployment}
<div class="modal-overlay" on:click={() => showEditModal = false}>
  <div class="modal-content edit-modal" on:click|stopPropagation>
    <div class="modal-header">
      <h2>✏️ Edit Deployment</h2>
      <button class="close-btn" on:click={() => showEditModal = false}>✕</button>
    </div>
    
    <div class="modal-body">
      <div class="form-group">
        <label>Name</label>
        <input type="text" bind:value={editForm.name} />
      </div>
      
      <div class="form-group">
        <label>Hardware Type</label>
        <input type="text" bind:value={editForm.hardware_type} />
      </div>
      
      <div class="form-group">
        <label>Status</label>
        <select bind:value={editForm.status}>
          <option value="deployed">Deployed</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
          <option value="retired">Retired</option>
        </select>
      </div>
      
      <div class="form-group">
        <label>Project</label>
        <select bind:value={editForm.planId}>
          <option value="">No project</option>
          {#each plans as plan}
            <option value={plan.id}>{plan.name}</option>
          {/each}
        </select>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" on:click={() => showEditModal = false}>Cancel</button>
      <button class="btn-primary" on:click={saveEdit} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    </div>
  </div>
</div>
{/if}
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal-content {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    width: 90%;
    max-width: 800px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-xl);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h2 {
    margin: 0;
    color: var(--text-primary);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
  }
  
  .modal-body {
    padding: var(--spacing-lg);
    overflow-y: auto;
    flex: 1;
  }
  
  .modal-footer {
    padding: var(--spacing-lg);
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }
  
  .deployments-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .deployment-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    padding: 1rem;
  }
  
  .deployment-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
  }
  
  .deployment-header h3 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }
  
  .deployment-type {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background: var(--bg-tertiary);
    border-radius: var(--border-radius-sm);
    font-size: 0.875rem;
    margin-right: 0.5rem;
  }
  
  .deployment-status {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: var(--border-radius-sm);
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .deployment-status.deployed {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
  }
  
  .deployment-details {
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .detail-row {
    display: flex;
    gap: 0.5rem;
  }
  
  .detail-row .label {
    font-weight: 600;
    color: var(--text-secondary);
  }
  
  .detail-row .value {
    color: var(--text-primary);
  }
  
  .deployment-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .btn-edit, .btn-delete {
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    font-size: 0.875rem;
  }
  
  .btn-edit {
    background: var(--brand-primary);
    color: white;
  }
  
  .btn-delete {
    background: var(--error-color);
    color: white;
  }
  
  .btn-primary, .btn-secondary {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: var(--border-radius-md);
    cursor: pointer;
    font-weight: 600;
  }
  
  .btn-primary {
    background: var(--brand-primary);
    color: white;
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
    font-weight: 600;
  }
  
  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  
  .error-banner {
    background: var(--error-color);
    color: white;
    padding: 1rem;
    margin: var(--spacing-lg);
    border-radius: var(--border-radius-md);
  }
  
  .loading, .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
  }
  
  .edit-modal {
    max-width: 500px;
  }
</style>

