<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { tenantStore } from '$lib/stores/tenantStore';
  import '../app.css';
  
  // Initialize tenant store on app load
  onMount(async () => {
    if (browser) {
      console.log('[Root Layout] Initializing tenant store...');
      await tenantStore.initialize();
      console.log('[Root Layout] Tenant store initialized');
    }
  });
</script>

<slot />

