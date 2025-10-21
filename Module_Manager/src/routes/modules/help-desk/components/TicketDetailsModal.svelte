<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { WorkOrder } from '$lib/services/workOrderService';
  
  export let ticket: WorkOrder;
  const dispatch = createEventDispatcher();
</script>

<div class="modal-backdrop" on:click={() => dispatch('close')}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <h2>Ticket Details</h2>
      <button class="close-btn" on:click={() => dispatch('close')}>✕</button>
    </div>
    
    <div class="modal-body">
      <h3>{ticket.title}</h3>
      <p>Full ticket details coming soon...</p>
      <p>Ticket #{ticket.ticketNumber || ticket._id}</p>
    </div>
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
  }
  .modal-content {
    background: white;
    border-radius: 0.75rem;
    width: 90%;
    max-width: 800px;
    max-height: 90vh;
    overflow-y: auto;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  .modal-header h2 {
    margin: 0;
  }
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
  }
  .modal-body {
    padding: 1.5rem;
  }
</style>

