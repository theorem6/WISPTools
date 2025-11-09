<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { WorkOrder } from '$lib/services/workOrderService';
  
  export let ticket: WorkOrder;
  const dispatch = createEventDispatcher();
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
    aria-labelledby="ticket-details-heading"
    on:click|stopPropagation
  >
    <header class="modal-header">
      <div>
        <p class="modal-eyebrow">Support Ticket</p>
        <h2 id="ticket-details-heading">Ticket Details</h2>
      </div>
      <button
        class="modal-close-btn"
        type="button"
        aria-label="Close ticket details"
        on:click={() => dispatch('close')}
      >
        ✕
      </button>
    </header>

    <section class="modal-body">
      <h3 class="ticket-title">{ticket.title || 'Untitled ticket'}</h3>
      <p class="ticket-id">Ticket #{ticket.ticketNumber || ticket._id}</p>
      <p class="ticket-message">Full ticket details coming soon...</p>
    </section>
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

  .ticket-title {
    margin-top: 0;
    margin-bottom: var(--spacing-xs);
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .ticket-id {
    margin: 0 0 var(--spacing-sm);
    font-family: 'Fira Mono', 'Roboto Mono', 'SFMono-Regular', ui-monospace, monospace;
    font-size: 0.95rem;
    color: var(--text-secondary);
  }

  .ticket-message {
    margin: 0;
    color: var(--text-secondary);
  }
</style>

