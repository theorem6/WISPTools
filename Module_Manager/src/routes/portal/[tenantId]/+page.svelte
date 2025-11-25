<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  
  onMount(() => {
    // Redirect to the actual portal login
    const tenantId = $page.params.tenantId;
    goto(`/modules/customers/portal/login?tenant=${tenantId}`);
  });
</script>

<div>Redirecting to portal...</div>

