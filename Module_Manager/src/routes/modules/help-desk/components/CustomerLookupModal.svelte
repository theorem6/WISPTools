<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  let searchQuery = '';
</script>

<div class="modal-backdrop" on:click={() => dispatch('close')}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <h2>Customer Lookup</h2>
      <button class="close-btn" on:click={() => dispatch('close')}>✕</button>
    </div>
    
    <div class="modal-body">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search by phone, email, or IMSI..."
        class="search-input"
      />
      <p class="info-text">Customer lookup integration coming soon...</p>
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
    max-width: 600px;
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
  .search-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }
  .info-text {
    color: var(--text-secondary);
    text-align: center;
  }
</style>

