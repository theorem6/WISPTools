<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { workOrderService } from '$lib/services/workOrderService';
  
  const dispatch = createEventDispatcher();
  onMount(() => {
    console.info('[CreateTicketModal] Mounted');
    return () => console.info('[CreateTicketModal] Destroyed');
  });
  
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
      console.info('[CreateTicketModal] Submitting ticket', {
        tenant: $currentTenant.id,
        title,
        priority,
        type
      });
      const newTicket = await workOrderService.createWorkOrder({
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

      console.info('[CreateTicketModal] Ticket created', newTicket);
      dispatch('created', newTicket);
      dispatch('close');
    } catch (err: any) {
      console.error('[CreateTicketModal] Failed to create ticket', err);
      error = err.message || 'Failed to create ticket';
    } finally {
      loading = false;
    }
  }
</script>

<div
  class="modal-backdrop"
  role="presentation"
  on:click={() => dispatch('close')}
>
  <article
    class="modal-content"
    data-size="sm"
    role="dialog"
    aria-modal="true"
    aria-labelledby="create-ticket-heading"
    on:click|stopPropagation
  >
    <header class="modal-header">
      <div>
        <p class="modal-eyebrow">Support Ticket</p>
        <h2 id="create-ticket-heading">Create Support Ticket</h2>
      </div>
      <button
        class="modal-close-btn"
        type="button"
        aria-label="Close create ticket form"
        on:click={() => dispatch('close')}
      >
        ✕
      </button>
    </header>
    
    <form on:submit|preventDefault={handleSubmit}>
      <section class="modal-body">
        {#if error}
          <div class="alert alert-error" role="alert">
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
      </section>
      
      <footer class="modal-footer">
        <button type="button" class="btn btn-secondary" on:click={() => dispatch('close')}>
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" disabled={loading}>
          {#if loading}
            <span class="spinner-sm" aria-hidden="true"></span>
            Creating...
          {:else}
            Create Ticket
          {/if}
        </button>
      </footer>
    </form>
  </article>
</div>

<style>
  .modal-eyebrow {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  form {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .modal-body {
    display: grid;
    gap: var(--spacing-lg);
    padding: 0;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }
  
  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md);
  }
  
  label {
    font-weight: 600;
    color: var(--text-primary);
  }
  
  input,
  select,
  textarea {
    width: 100%;
    padding: var(--spacing-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--input-bg);
    color: var(--text-primary);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  
  input:focus,
  select:focus,
  textarea:focus {
    border-color: var(--primary-color);
    outline: 2px solid color-mix(in srgb, var(--primary) 35%, transparent);
    outline-offset: 2px;
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
  }
  
  .btn {
    padding: 0.75rem 1.5rem;
    border-radius: var(--radius-md);
    font-weight: 600;
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  
  .btn-primary {
    background: var(--primary);
    color: var(--text-inverse);
    box-shadow: var(--shadow-sm);
  }

  .btn-primary:not(:disabled):hover {
    background: var(--primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-secondary {
    background: var(--color-background-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover {
    background: var(--hover-bg);
  }
  
  .alert {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
  }
  
  .alert-error {
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
    color: var(--danger);
  }
  
  .spinner-sm {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: currentColor;
    border-radius: 999px;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 640px) {
    .modal-content {
      width: min(100%, 540px);
    }
  }
</style>

