<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let tenantId: string;
  export let HSS_API: string;
  
  const dispatch = createEventDispatcher();
</script>

<div class="bulk-import">
  <h2>Bulk Import Subscribers</h2>
  <p>Bulk import functionality coming soon...</p>
</div>

<style>
  .bulk-import {
    padding: 2rem;
    background: white;
    border-radius: 8px;
  }
</style>

