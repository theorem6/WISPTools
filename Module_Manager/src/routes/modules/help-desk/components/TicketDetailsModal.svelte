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
  <div
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
    z-index: 10000;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: var(--card-bg, white);
    border-radius: 0.75rem;
    padding: 0;
    max-width: 640px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
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
  }

  .modal-eyebrow {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted, #6b7280);
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

