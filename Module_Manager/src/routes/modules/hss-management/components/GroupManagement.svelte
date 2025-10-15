<script lang="ts">
  import { onMount } from 'svelte';
  export let tenantId: string;
  export let HSS_API: string;
  
  let groups: any[] = [];
  let bandwidthPlans: any[] = [];
  let loading = true;
  let showAddModal = false;
  let editingGroup: any = null;
  
  let formData = {
    group_id: '',
    name: '',
    description: '',
    bandwidth_plan_id: ''
  };

  onMount(() => {
    loadGroups();
    loadBandwidthPlans();
  });

  async function loadGroups() {
    loading = true;
    try {
      const response = await fetch(`${HSS_API}/groups`, {
        headers: { 'x-tenant-id': tenantId }
      });
      if (response.ok) {
        groups = await response.json();
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    }
    loading = false;
  }

  async function loadBandwidthPlans() {
    try {
      const response = await fetch(`${HSS_API}/bandwidth-plans`, {
        headers: { 'x-tenant-id': tenantId }
      });
      if (response.ok) {
        bandwidthPlans = await response.json();
      }
    } catch (error) {
      console.error('Error loading bandwidth plans:', error);
    }
  }

  function openAddModal() {
    formData = {
      group_id: `group_${Date.now()}`,
      name: '',
      description: '',
      bandwidth_plan_id: ''
    };
    editingGroup = null;
    showAddModal = true;
  }

  function openEditModal(group: any) {
    formData = { ...group };
    editingGroup = group;
    showAddModal = true;
  }

  function closeModal() {
    showAddModal = false;
    editingGroup = null;
  }

  async function saveGroup() {
    try {
      const method = editingGroup ? 'PUT' : 'POST';
      const url = editingGroup 
        ? `${HSS_API}/groups/${editingGroup.group_id}`
        : `${HSS_API}/groups`;

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
        loadGroups();
      } else {
        alert('Error saving group');
      }
    } catch (error) {
      console.error('Error saving group:', error);
      alert('Error saving group');
    }
  }

  async function deleteGroup(groupId: string) {
    if (!confirm('Delete this group? Subscribers in this group will be unassigned.')) return;
    
    try {
      const response = await fetch(`${HSS_API}/groups/${groupId}`, {
        method: 'DELETE',
        headers: { 'x-tenant-id': tenantId }
      });

      if (response.ok) {
        loadGroups();
      } else {
        alert('Error deleting group');
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('Error deleting group');
    }
  }

  function getBandwidthPlanName(planId: string) {
    const plan = bandwidthPlans.find(p => p.plan_id === planId);
    return plan ? plan.name : 'None';
  }
</script>

<div class="group-management">
  <div class="header">
    <h2>Subscriber Groups</h2>
    <button class="btn-primary" on:click={openAddModal}>
      + Add Group
    </button>
  </div>

  {#if loading}
    <p>Loading groups...</p>
  {:else if groups.length === 0}
    <div class="empty-state">
      <p>No subscriber groups yet</p>
      <p class="hint">Create groups to organize subscribers and assign bandwidth plans</p>
    </div>
  {:else}
    <div class="groups-grid">
      {#each groups as group}
        <div class="group-card">
          <div class="group-header">
            <h3>{group.name}</h3>
            <span class="group-id">{group.group_id}</span>
          </div>
          {#if group.description}
            <p class="description">{group.description}</p>
          {/if}
          <div class="group-info">
            <div class="info-item">
              <span class="label">Bandwidth Plan</span>
              <span class="value">{getBandwidthPlanName(group.bandwidth_plan_id)}</span>
            </div>
          </div>
          <div class="group-actions">
            <button class="btn-edit" on:click={() => openEditModal(group)}>Edit</button>
            <button class="btn-delete" on:click={() => deleteGroup(group.group_id)}>Delete</button>
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
        <h3>{editingGroup ? 'Edit' : 'Add'} Subscriber Group</h3>
        <button class="close-btn" on:click={closeModal}>×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Group ID</label>
          <input 
            type="text" 
            bind:value={formData.group_id} 
            disabled={!!editingGroup}
            placeholder="group_residential"
          />
        </div>
        <div class="form-group">
          <label>Group Name</label>
          <input 
            type="text" 
            bind:value={formData.name} 
            placeholder="Residential Users"
          />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea 
            bind:value={formData.description}
            placeholder="Group description..."
            rows="3"
          />
        </div>
        <div class="form-group">
          <label>Bandwidth Plan</label>
          <select bind:value={formData.bandwidth_plan_id}>
            <option value="">No plan</option>
            {#each bandwidthPlans as plan}
              <option value={plan.plan_id}>{plan.name} ({plan.download_mbps}/{plan.upload_mbps} Mbps)</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" on:click={closeModal}>Cancel</button>
        <button class="btn-save" on:click={saveGroup}>
          {editingGroup ? 'Update' : 'Create'} Group
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .group-management {
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

  .groups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
  }

  .group-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.5rem;
    background: #f8fafc;
  }

  .group-header {
    margin-bottom: 0.75rem;
  }

  .group-header h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    color: #1a202c;
  }

  .group-id {
    font-size: 0.875rem;
    color: #64748b;
    font-family: monospace;
  }

  .description {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0 0 1rem 0;
    line-height: 1.5;
  }

  .group-info {
    margin-bottom: 1.5rem;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
  }

  .info-item .label {
    font-size: 0.875rem;
    color: #64748b;
  }

  .info-item .value {
    font-weight: 500;
    color: #1a202c;
  }

  .group-actions {
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

  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 1rem;
    font-family: inherit;
  }

  .form-group input:disabled {
    background: #f1f5f9;
    color: #64748b;
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



