<script lang="ts">
  import { onMount } from 'svelte';
  
  onMount(() => {
    console.log('PCI Resolution TEST page: Mounted successfully!');
  });
</script>

<div style="padding: 2rem; text-align: center;">
  <h1>PCI Resolution Module - TEST</h1>
  <p>If you see this, the route is working!</p>
  <p>Now we need to load the actual PCI application.</p>
</div>

<style>
  h1 {
    color: var(--brand-primary);
    margin-bottom: 1rem;
  }
  
  p {
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }
</style>

