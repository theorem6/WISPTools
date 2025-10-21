<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { workOrderService } from '$lib/services/workOrderService';
  
  const dispatch = createEventDispatcher();
  
  let title = '';
  let description = '';
  let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  let type: 'troubleshoot' | 'repair' | 'installation' | 'other' = 'troubleshoot';
  let customerName = '';
  let customerPhone = '';
  let loading = false;
  let error = '';
  
  async function handleSubmit() {
    if (!$currentTenant) return;
    
    if (!title.trim()) {
      error = 'Please enter a ticket title';
      return;
    }
    
    loading = true;
    error = '';
    
    try {
      await workOrderService.createWorkOrder({
        tenantId: $currentTenant.id,
        title,
        description,
        priority,
        type,
        status: 'open',
        customerReported: true,
        customerContact: customerName ? {
          name: customerName,
          phone: customerPhone || undefined
        } : undefined,
        affectedCustomers: customerName ? [{
          customerId: 'manual-' + Date.now(),
          customerName,
          phoneNumber: customerPhone || undefined
        }] : undefined
      });
      
      dispatch('close');
    } catch (err: any) {
      error = err.message || 'Failed to create ticket';
    } finally {
      loading = false;
    }
  }
</script>

<div class="modal-backdrop" on:click={() => dispatch('close')}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <h2>Create Support Ticket</h2>
      <button class="close-btn" on:click={() => dispatch('close')}>✕</button>
    </div>
    
    <form on:submit|preventDefault={handleSubmit}>
      {#if error}
        <div class="alert alert-error">
          <span>❌</span>
          <span>{error}</span>
        </div>
      {/if}
      
      <div class="form-group">
        <label for="title">Ticket Title *</label>
        <input
          id="title"
          type="text"
          bind:value={title}
          placeholder="Brief description of the issue"
          required
        />
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="type">Type</label>
          <select id="type" bind:value={type}>
            <option value="troubleshoot">Troubleshoot</option>
            <option value="repair">Repair</option>
            <option value="installation">Installation</option>
            <option value="other">Other</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="priority">Priority</label>
          <select id="priority" bind:value={priority}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>
      
      <div class="form-group">
        <label for="description">Description</label>
        <textarea
          id="description"
          bind:value={description}
          placeholder="Detailed description of the issue"
          rows="4"
        ></textarea>
      </div>
      
      <div class="form-group">
        <label for="customer-name">Customer Name</label>
        <input
          id="customer-name"
          type="text"
          bind:value={customerName}
          placeholder="Customer or contact name"
        />
      </div>
      
      <div class="form-group">
        <label for="customer-phone">Customer Phone</label>
        <input
          id="customer-phone"
          type="tel"
          bind:value={customerPhone}
          placeholder="Phone number"
        />
      </div>
      
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" on:click={() => dispatch('close')}>
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" disabled={loading}>
          {#if loading}
            <span class="spinner-sm"></span>
            Creating...
          {:else}
            Create Ticket
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .modal-backdrop {
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
    padding: 1rem;
  }
  
  .modal-content {
    background: white;
    border-radius: 0.75rem;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    opacity: 0.5;
  }
  
  form {
    padding: 1.5rem;
  }
  
  .form-group {
    margin-bottom: 1.5rem;
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  
  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }
  
  input, select, textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    font-size: 1rem;
  }
  
  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }
  
  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .btn-primary { background: var(--primary); color: white; }
  .btn-secondary { background: #6b7280; color: white; }
  
  .alert {
    padding: 1rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  
  .alert-error {
    background: #fee;
    border: 1px solid #fcc;
    color: #c00;
  }
  
  .spinner-sm {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>

