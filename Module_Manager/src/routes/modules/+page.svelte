<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  // Redirect to dashboard - this page is deprecated
  onMount(() => {
    goto('/dashboard');
  });
</script>

<svelte:head>
  <title>Modules - LTE WISP Management Platform</title>
  <meta name="description" content="Available modules for network management and optimization" />
</svelte:head>

<div class="redirect-message">
  Redirecting to dashboard...
</div>

<style>
  .redirect-message {
    padding: 4rem 2rem;
    text-align: center;
    color: var(--text-secondary);
  }
</style>

