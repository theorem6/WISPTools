<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { browser } from '$app/environment';
  import { workOrderService } from '$lib/services/workOrderService';
  
  const dispatch = createEventDispatcher();
  onMount(() => {
    console.info('[CreateTicketModal] Mounted');
    console.info('[CreateTicketModal] Current tenant on mount:', $currentTenant);
    console.info('[CreateTicketModal] Selected tenant ID from localStorage:', browser ? localStorage.getItem('selectedTenantId') : 'N/A (server-side)');
    return () => console.info('[CreateTicketModal] Destroyed');
  });
  
  // Debug tenant changes
  $: if ($currentTenant) {
    console.info('[CreateTicketModal] Tenant changed:', $currentTenant.id, $currentTenant.name);
    if (browser) {
      localStorage.setItem('selectedTenantId', $currentTenant.id);
      console.info('[CreateTicketModal] Set localStorage tenantId to:', $currentTenant.id);
    }
  }
  
  let title = '';
  let description = '';
  let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  let type: 'troubleshoot' | 'repair' | 'installation' | 'maintenance' | 'upgrade' | 'removal' | 'inspection' | 'other' = 'troubleshoot';
  let ticketCategory: 'customer-facing' | 'infrastructure' = 'customer-facing';
  let customerName = '';
  let customerPhone = '';
  let loading = false;
  let error = '';
  
  async function handleSubmit() {
    console.info('[CreateTicketModal] handleSubmit called');
    console.info('[CreateTicketModal] Current tenant:', $currentTenant);
    console.info('[CreateTicketModal] Form data:', { title, description, priority, type, customerName, customerPhone });
    
    if (!$currentTenant) {
      console.error('[CreateTicketModal] No tenant available');
      error = 'No tenant selected. Please select a tenant and try again.';
      return;
    }
    
    if (!title.trim()) {
      console.warn('[CreateTicketModal] Title validation failed');
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
      
      const workOrderData = {
        tenantId: $currentTenant.id,
        title: title.trim(),
        description: description?.trim() || undefined,
        priority,
        type,
        ticketCategory,
        status: 'open' as const,
        customerReported: ticketCategory === 'customer-facing',
        customerContact: customerName ? {
          name: customerName.trim(),
          phone: customerPhone?.trim() || undefined
        } : undefined,
        affectedCustomers: customerName ? [{
          customerId: 'manual-' + Date.now(),
          customerName: customerName.trim(),
          phoneNumber: customerPhone?.trim() || undefined
        }] : undefined
      };
      
      console.info('[CreateTicketModal] Work order data:', workOrderData);
      
      const newTicket = await workOrderService.createWorkOrder(workOrderData);

      console.info('[CreateTicketModal] Ticket created successfully:', newTicket);
      dispatch('created', newTicket);
      dispatch('close');
    } catch (err: any) {
      console.error('[CreateTicketModal] Failed to create ticket', err);
      console.error('[CreateTicketModal] Error details:', {
        message: err.message,
        stack: err.stack,
        response: err.response,
        data: err.data
      });
      error = err.message || 'Failed to create ticket. Please check the console for details.';
    } finally {
      loading = false;
    }
  }
  
  // Debug: Log button clicks and manually trigger submission
  function handleButtonClick(event: MouseEvent) {
    console.info('[CreateTicketModal] Submit button clicked');
    event.preventDefault();
    event.stopPropagation();
    
    // Manually call handleSubmit to ensure it runs
    handleSubmit();
  }
</script>

<div
  class="modal-backdrop"
  role="presentation"
  on:click={() => dispatch('close')}
>
  <div
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
        
        <div class="form-group">
          <label for="ticketCategory">Ticket Category *</label>
          <select id="ticketCategory" bind:value={ticketCategory} required>
            <option value="customer-facing">Customer-Facing</option>
            <option value="infrastructure">Infrastructure</option>
          </select>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="type">Type</label>
            <select id="type" bind:value={type}>
              <option value="troubleshoot">Troubleshoot</option>
              <option value="repair">Repair</option>
              <option value="installation">Installation</option>
              <option value="maintenance">Maintenance</option>
              <option value="upgrade">Upgrade</option>
              <option value="removal">Removal</option>
              <option value="inspection">Inspection</option>
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
        
        {#if ticketCategory === 'customer-facing'}
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
        {/if}
        
        <div class="form-group">
          <label for="description">Description</label>
          <textarea
            id="description"
            bind:value={description}
            placeholder="Detailed description of the issue"
            rows="4"
          ></textarea>
        </div>
        
      </section>
      
      <footer class="modal-footer">
        <button type="button" class="btn btn-secondary" on:click={() => dispatch('close')}>
          Cancel
        </button>
        <button 
          type="submit" 
          class="btn btn-primary" 
          disabled={loading}
          on:click={handleButtonClick}
        >
          {#if loading}
            <span class="spinner-sm" aria-hidden="true"></span>
            Creating...
          {:else}
            Create Ticket
          {/if}
        </button>
      </footer>
    </form>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    background: rgba(0, 0, 0, 0.6) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 99999 !important;
    backdrop-filter: blur(4px);
    visibility: visible !important;
    opacity: 1 !important;
  }

  .modal-content {
    background: var(--card-bg, #ffffff) !important;
    border-radius: 0.75rem;
    padding: 0;
    max-width: 540px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3) !important;
    display: flex !important;
    flex-direction: column;
    position: relative !important;
    visibility: visible !important;
    opacity: 1 !important;
    border: 1px solid var(--border-color, #e5e7eb);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary, #1f2937);
  }

  .modal-close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary, #6b7280);
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
    line-height: 1;
  }

  .modal-close-btn:hover {
    background: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #1f2937);
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
    display: grid;
    gap: var(--spacing-lg, 1.5rem);
  }

  .modal-eyebrow {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted, #6b7280);
  }

  form {
    display: flex;
    flex-direction: column;
    height: 100%;
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
    padding: var(--spacing-sm, 0.5rem);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: var(--radius-md, 0.375rem);
    background: var(--input-bg, var(--color-background-secondary, #f9fafb));
    color: var(--text-primary, #111827);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    font-size: 0.875rem;
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
      width: 95%;
      max-width: 95%;
      max-height: 95vh;
    }
    
    .modal-header,
    .modal-body {
      padding: 1rem;
    }
  }
</style>

