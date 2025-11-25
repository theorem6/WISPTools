<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { customerAuthService } from '$lib/services/customerAuthService';
  
  onMount(async () => {
    // Check if already authenticated
    const customer = await customerAuthService.getCurrentCustomer();
    if (customer) {
      goto('/modules/customers/portal/dashboard');
    } else {
      goto('/modules/customers/portal/login');
    }
  });
</script>

<div class="redirecting">
  <p>Redirecting...</p>
</div>

<style>
  .redirecting {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
  }
</style>

