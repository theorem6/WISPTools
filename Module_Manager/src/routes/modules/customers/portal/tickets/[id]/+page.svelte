<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { customerPortalService } from '$lib/services/customerPortalService';
  import { customerAuthService } from '$lib/services/customerAuthService';
  import type { WorkOrder } from '$lib/services/workOrderService';
  
  let ticket: WorkOrder | null = null;
  let currentCustomer: { tenantId?: string } | null = null;
  let loading = true;
  let error = '';
  let comment = '';
  let submittingComment = false;
  
  $: ticketId = $page.params.id;
  
  onMount(async () => {
    try {
      const id = ticketId;
      if (!id) {
        error = 'Invalid ticket';
        loading = false;
        return;
      }
      const customer = await customerAuthService.getCurrentCustomer();
      if (!customer) {
        goto('/modules/customers/portal/login');
        return;
      }
      currentCustomer = customer;
      ticket = await customerPortalService.getCustomerTicket(id, customer.tenantId);
    } catch (err: any) {
      error = err.message || 'Failed to load ticket';
    } finally {
      loading = false;
    }
  });
  
  async function handleAddComment(e: Event) {
    e.preventDefault();
    if (!comment.trim() || !ticket) return;
    
    submittingComment = true;
    try {
      const id = ticketId ?? ticket?._id;
      const tenantId = currentCustomer?.tenantId;
      if (!id) return;
      await customerPortalService.addTicketComment(ticket._id!, comment, tenantId);
      comment = '';
      ticket = await customerPortalService.getCustomerTicket(id, tenantId);
    } catch (err: any) {
      error = err.message || 'Failed to add comment';
    } finally {
      submittingComment = false;
    }
  }
  
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

{#if loading}
  <div class="loading">Loading ticket...</div>
{:else if error}
  <div class="error">{error}</div>
{:else if !ticket}
  <div class="error">Ticket not found</div>
{:else}
  <div class="ticket-details-page">
    <div class="page-header">
      <a href="/modules/customers/portal/tickets" class="back-link">← Back to Tickets</a>
      <h1>Ticket Details</h1>
    </div>
    
    <div class="ticket-details">
      <div class="ticket-header">
        <div>
          <span class="ticket-number">{ticket.ticketNumber || 'N/A'}</span>
          <span 
            class="ticket-status" 
            style="background: {getStatusColor(ticket.status)}"
          >
            {ticket.status}
          </span>
        </div>
        <div class="ticket-meta">
          <span>Priority: {ticket.priority}</span>
          <span>Created: {new Date(ticket.createdAt || '').toLocaleDateString()}</span>
        </div>
      </div>
      
      <div class="ticket-content">
        <h2>{ticket.title}</h2>
        <p class="ticket-description">{ticket.description || 'No description'}</p>
      </div>
      
      {#if ticket.workPerformed && ticket.workPerformed.length > 0}
        <div class="ticket-history">
          <h3>Ticket History</h3>
          <div class="history-list">
            {#each ticket.workPerformed as work}
              <div class="history-item">
                <div class="history-header">
                  <span class="history-action">{work.action || 'Update'}</span>
                  <span class="history-date">
                    {new Date(work.timestamp || '').toLocaleString()}
                  </span>
                </div>
                {#if work.performedByName}
                  <div class="history-performer">
                    By: {work.performedByName}
                  </div>
                {/if}
                {#if work.notes}
                  <div class="history-notes">{work.notes}</div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
      
      <div class="add-comment">
        <h3>Add Comment</h3>
        <form on:submit={handleAddComment}>
          <textarea
            bind:value={comment}
            placeholder="Add a comment or update..."
            rows="4"
            disabled={submittingComment}
          ></textarea>
          <button type="submit" class="btn-primary" disabled={submittingComment || !comment.trim()}>
            {submittingComment ? 'Submitting...' : 'Add Comment'}
          </button>
        </form>
      </div>
    </div>
  </div>
{/if}

<style>
  .ticket-details-page {
    max-width: 900px;
    margin: 0 auto;
  }
  
  .page-header {
    margin-bottom: 2rem;
  }
  
  .back-link {
    color: var(--brand-primary, #3b82f6);
    text-decoration: none;
    margin-bottom: 0.5rem;
    display: inline-block;
  }
  
  .back-link:hover {
    text-decoration: underline;
  }
  
  .page-header h1 {
    font-size: 2rem;
    color: var(--brand-text, #111827);
  }
  
  .ticket-details {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 2rem;
  }
  
  .ticket-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .ticket-number {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--brand-text, #111827);
    margin-right: 1rem;
  }
  
  .ticket-status {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    color: white;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
  }
  
  .ticket-meta {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--brand-text-secondary, #6b7280);
    text-align: right;
  }
  
  .ticket-content h2 {
    font-size: 1.5rem;
    color: var(--brand-text, #111827);
    margin-bottom: 1rem;
  }
  
  .ticket-description {
    color: var(--brand-text-secondary, #6b7280);
    line-height: 1.6;
    white-space: pre-wrap;
  }
  
  .ticket-history {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid #e5e7eb;
  }
  
  .ticket-history h3 {
    font-size: 1.25rem;
    color: var(--brand-text, #111827);
    margin-bottom: 1rem;
  }
  
  .history-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .history-item {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 1rem;
  }
  
  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  
  .history-action {
    font-weight: 600;
    color: var(--brand-text, #111827);
  }
  
  .history-date {
    font-size: 0.875rem;
    color: var(--brand-text-secondary, #6b7280);
  }
  
  .history-performer {
    font-size: 0.875rem;
    color: var(--brand-text-secondary, #6b7280);
    margin-bottom: 0.5rem;
  }
  
  .history-notes {
    color: var(--brand-text, #111827);
    line-height: 1.5;
    white-space: pre-wrap;
  }
  
  .add-comment {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid #e5e7eb;
  }
  
  .add-comment h3 {
    font-size: 1.25rem;
    color: var(--brand-text, #111827);
    margin-bottom: 1rem;
  }
  
  .add-comment form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .add-comment textarea {
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 1rem;
    font-family: inherit;
    resize: vertical;
  }
  
  .add-comment textarea:focus {
    outline: none;
    border-color: var(--brand-primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .add-comment textarea:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
  }
  
  .btn-primary {
    background: var(--brand-primary, #3b82f6);
    color: white;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
    align-self: flex-start;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--brand-accent, #10b981);
  }
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .loading, .error {
    text-align: center;
    padding: 3rem;
    color: var(--brand-text-secondary, #6b7280);
  }
  
  .error {
    color: #dc2626;
  }
  
  @media (max-width: 768px) {
    .ticket-header {
      flex-direction: column;
      gap: 1rem;
    }
    
    .ticket-meta {
      text-align: left;
    }
  }
</style>

