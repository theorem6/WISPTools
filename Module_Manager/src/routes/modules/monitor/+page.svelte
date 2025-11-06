<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  onMount(() => {
    // Redirect to monitoring module (the actual monitoring implementation)
    if (browser) {
      goto('/modules/monitoring');
    }
  });
</script>

<!-- This page redirects to /modules/monitoring -->
<div style="display: flex; align-items: center; justify-content: center; height: 100vh;">
  <p>Redirecting to Monitoring...</p>
</div>