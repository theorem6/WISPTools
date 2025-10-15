<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let tenantId: string;
  export let HSS_API: string;
  export let groups: any[] = [];
  
  const dispatch = createEventDispatcher();
  
  function close() {
    dispatch('close');
  }
</script>

<div class="modal-overlay" on:click={close}>
  <div class="modal" on:click|stopPropagation>
    <h2>Add Subscriber</h2>
    <p>Add subscriber form coming soon...</p>
    <button on:click={close}>Close</button>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    max-width: 600px;
  }
</style>

