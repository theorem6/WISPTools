<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  export let tenantId: string;
  export let HSS_API: string;
  
  let plans: any[] = [];
  let loading = true;
  let showAddModal = false;
  let editingPlan: any = null;
  
  let formData = {
    plan_id: '',
    name: '',
    download_mbps: 100,
    upload_mbps: 50
  };
  
  // Listen for quick actions
  function handleQuickAction(event: CustomEvent<{ action: string }>) {
    if (event.detail?.action === 'create') {
      openAddModal();
    }
  }

  onMount(() => {
    loadPlans();
    
    // Listen for quick action events
    window.addEventListener('quick-action' as any, handleQuickAction as any);
  });
  
  onDestroy(() => {
    window.removeEventListener('quick-action' as any, handleQuickAction as any);
  });

  async function loadPlans() {
    loading = true;
    try {
      const response = await fetch(`${HSS_API}/bandwidth-plans`, {
        headers: { 'x-tenant-id': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        // Backend returns { count, plans } format
        plans = data.plans || data || [];
      }
    } catch (error) {
      console.error('Error loading bandwidth plans:', error);
    }
    loading = false;
  }

  function openAddModal() {
    formData = {
      plan_id: `plan_${Date.now()}`,
      name: '',
      download_mbps: 100,
      upload_mbps: 50
    };
    editingPlan = null;
    showAddModal = true;
  }

  function openEditModal(plan: any) {
    formData = { ...plan };
    editingPlan = plan;
    showAddModal = true;
  }

  function closeModal() {
    showAddModal = false;
    editingPlan = null;
  }

  async function savePlan() {
    try {
      const method = editingPlan ? 'PUT' : 'POST';
      const url = editingPlan 
        ? `${HSS_API}/bandwidth-plans/${editingPlan.plan_id}`
        : `${HSS_API}/bandwidth-plans`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        closeModal();
        loadPlans();
      } else {
        alert('Error saving bandwidth plan');
      }
    } catch (error) {
      console.error('Error saving plan:', error);
      alert('Error saving bandwidth plan');
    }
  }

  async function deletePlan(planId: string) {
    if (!confirm('Delete this bandwidth plan? This will affect any groups using it.')) return;
    
    try {
      const response = await fetch(`${HSS_API}/bandwidth-plans/${planId}`, {
        method: 'DELETE',
        headers: { 
          'x-tenant-id': tenantId,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        alert('Bandwidth plan deleted successfully');
        loadPlans();
      } else {
        const errorData = await response.json();
        const errorMsg = errorData.error || 'Error deleting bandwidth plan';
        alert(errorMsg);
        console.error('Delete error:', errorData);
      }
    } catch (error: unknown) {
      console.error('Error deleting plan:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert('Error deleting bandwidth plan: ' + message);
    }
  }
</script>

<div class="bandwidth-plans">
  <div class="header">
    <h2>Bandwidth Plans</h2>
    <button class="btn-primary" on:click={openAddModal}>
      + Add Bandwidth Plan
    </button>
  </div>

  {#if loading}
    <p>Loading bandwidth plans...</p>
  {:else if plans.length === 0}
    <div class="empty-state">
      <p>No bandwidth plans yet</p>
      <p class="hint">Create bandwidth plans to assign to subscriber groups</p>
    </div>
  {:else}
    <div class="plans-grid">
      {#each plans as plan}
        <div class="plan-card">
          <div class="plan-header">
            <h3>{plan.name}</h3>
            <span class="plan-id">{plan.plan_id}</span>
          </div>
          <div class="plan-speeds">
            <div class="speed">
              <span class="label">DOWNLOAD</span>
              <span class="value">{plan.download_mbps || 0} Mbps</span>
            </div>
            <div class="speed">
              <span class="label">UPLOAD</span>
              <span class="value">{plan.upload_mbps || 0} Mbps</span>
            </div>
          </div>
          <div class="plan-actions">
            <button class="btn-edit" on:click={() => openEditModal(plan)}>Edit</button>
            <button class="btn-delete" on:click={() => deletePlan(plan.plan_id)}>Delete</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showAddModal}
  <div class="modal-overlay" on:click={closeModal}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>{editingPlan ? 'Edit' : 'Add'} Bandwidth Plan</h3>
        <button class="close-btn" on:click={closeModal}>×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Plan ID</label>
          <input 
            type="text" 
            bind:value={formData.plan_id} 
            disabled={!!editingPlan}
            placeholder="plan_gold"
          />
        </div>
        <div class="form-group">
          <label>Plan Name</label>
          <input 
            type="text" 
            bind:value={formData.name} 
            placeholder="Gold Plan"
          />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Download Speed (Mbps)</label>
            <input 
              type="number" 
              bind:value={formData.download_mbps}
              min="1"
              placeholder="100"
            />
          </div>
          <div class="form-group">
            <label>Upload Speed (Mbps)</label>
            <input 
              type="number" 
              bind:value={formData.upload_mbps}
              min="1"
              placeholder="50"
            />
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" on:click={closeModal}>Cancel</button>
        <button class="btn-save" on:click={savePlan}>
          {editingPlan ? 'Update' : 'Create'} Plan
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .bandwidth-plans {
    padding: 2rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #1a202c;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #64748b;
  }

  .hint {
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }

  .plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .plan-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.5rem;
    background: #f8fafc;
  }

  .plan-header {
    margin-bottom: 1rem;
  }

  .plan-header h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    color: #1a202c;
  }

  .plan-id {
    font-size: 0.875rem;
    color: #64748b;
    font-family: monospace;
  }

  .plan-speeds {
    display: flex;
    gap: 2rem;
    margin-bottom: 1.5rem;
  }

  .speed {
    display: flex;
    flex-direction: column;
  }

  .speed .label {
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
    margin-bottom: 0.25rem;
  }

  .speed .value {
    font-size: 1.5rem;
    font-weight: 600;
    color: #3b82f6;
  }

  .plan-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-edit, .btn-delete {
    flex: 1;
    padding: 0.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .btn-edit {
    background: #10b981;
    color: white;
  }

  .btn-edit:hover {
    background: #059669;
  }

  .btn-delete {
    background: #ef4444;
    color: white;
  }

  .btn-delete:hover {
    background: #dc2626;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.25rem;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: #64748b;
    line-height: 1;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #334155;
  }

  .form-group input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 1rem;
  }

  .form-group input:disabled {
    background: #f1f5f9;
    color: #64748b;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #e2e8f0;
  }

  .btn-cancel, .btn-save {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }

  .btn-cancel {
    background: #e2e8f0;
    color: #334155;
  }

  .btn-cancel:hover {
    background: #cbd5e1;
  }

  .btn-save {
    background: #3b82f6;
    color: white;
  }

  .btn-save:hover {
    background: #2563eb;
  }
</style>



