<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { customerPortalService } from '$lib/services/customerPortalService';
  import { customerAuthService } from '$lib/services/customerAuthService';
  import type { WorkOrder } from '$lib/services/workOrderService';
  
  let tickets: WorkOrder[] = [];
  let loading = true;
  let error = '';
  let statusFilter: string = 'all';
  
  onMount(async () => {
    try {
      const customer = await customerAuthService.getCurrentCustomer();
      if (!customer) {
        goto('/modules/customers/portal/login');
        return;
      }
      
      tickets = await customerPortalService.getCustomerTickets(customer.tenantId);
    } catch (err: any) {
      error = err.message || 'Failed to load tickets';
    } finally {
      loading = false;
    }
  });
  
  $: filteredTickets = statusFilter === 'all' 
    ? tickets 
    : tickets.filter(t => t.status === statusFilter);
  
  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      'open': '#3b82f6',
      'assigned': '#f59e0b',
      'in-progress': '#8b5cf6',
      'waiting-parts': '#ef4444',
      'resolved': '#10b981',
      'closed': '#6b7280'
    };
    return colors[status] || '#6b7280';
  }
</script>

<div class="tickets-page">
  <div class="page-header">
    <h1>My Tickets</h1>
    <a href="/modules/customers/portal/tickets/new" class="btn-primary">
      Create New Ticket
    </a>
  </div>
  
  <div class="filters">
    <select bind:value={statusFilter} class="filter-select">
      <option value="all">All Status</option>
      <option value="open">Open</option>
      <option value="assigned">Assigned</option>
      <option value="in-progress">In Progress</option>
      <option value="waiting-parts">Waiting Parts</option>
      <option value="resolved">Resolved</option>
      <option value="closed">Closed</option>
    </select>
  </div>
  
  {#if loading}
    <div class="loading">Loading tickets...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if filteredTickets.length === 0}
    <div class="empty-state">
      <p>No tickets found.</p>
      <a href="/modules/customers/portal/tickets/new" class="btn-primary">
        Create Your First Ticket
      </a>
    </div>
  {:else}
    <div class="tickets-list">
      {#each filteredTickets as ticket}
        <div 
          class="ticket-card" 
          on:click={() => goto(`/modules/customers/portal/tickets/${ticket._id}`)}
        >
          <div class="ticket-header">
            <span class="ticket-number">{ticket.ticketNumber || 'N/A'}</span>
            <span 
              class="ticket-status" 
              style="background: {getStatusColor(ticket.status)}"
            >
              {ticket.status}
            </span>
          </div>
          <h3 class="ticket-title">{ticket.title}</h3>
          <p class="ticket-description">{ticket.description || 'No description'}</p>
          <div class="ticket-meta">
            <span>Priority: {ticket.priority}</span>
            <span>Created: {new Date(ticket.createdAt || '').toLocaleDateString()}</span>
            {#if ticket.resolvedAt}
              <span>Resolved: {new Date(ticket.resolvedAt).toLocaleDateString()}</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tickets-page {
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }
  
  .page-header h1 {
    font-size: 2rem;
    color: var(--brand-text, #111827);
  }
  
  .btn-primary {
    background: var(--brand-primary, #3b82f6);
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 500;
    transition: background 0.2s;
  }
  
  .btn-primary:hover {
    background: var(--brand-accent, #10b981);
  }
  
  .filters {
    margin-bottom: 1.5rem;
  }
  
  .filter-select {
    padding: 0.5rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 1rem;
    background: white;
  }
  
  .tickets-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .ticket-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
    cursor: pointer;
    transition: box-shadow 0.2s;
  }
  
  .ticket-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .ticket-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  .ticket-number {
    font-weight: 600;
    color: var(--brand-text, #111827);
  }
  
  .ticket-status {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    color: white;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
  }
  
  .ticket-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--brand-text, #111827);
    margin-bottom: 0.5rem;
  }
  
  .ticket-description {
    color: var(--brand-text-secondary, #6b7280);
    margin-bottom: 0.75rem;
    line-height: 1.5;
  }
  
  .ticket-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    color: var(--brand-text-secondary, #6b7280);
  }
  
  .loading, .error, .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--brand-text-secondary, #6b7280);
  }
  
  .error {
    color: #dc2626;
  }
  
  .empty-state {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
  }
  
  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }
  }
</style>