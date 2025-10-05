<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  onMount(async () => {
    if (!browser) return;
    
    console.log('Root page: Checking authentication...');
    
    // Small delay to ensure services have initialized
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if user is authenticated
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    console.log('Root page: isAuthenticated =', isAuthenticated);
    
    if (isAuthenticated === 'true') {
      // User is logged in, go to dashboard
      console.log('Root page: Navigating to dashboard');
      await goto('/dashboard', { replaceState: true });
    } else {
      // User is not logged in, go to login
      console.log('Root page: Navigating to login');
      await goto('/login', { replaceState: true });
    }
  });
</script>

<div class="loading-page">
  <div class="spinner"></div>
  <p>Loading...</p>
</div>

<style>
  .loading-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-primary);
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--border-color);
    border-top-color: var(--brand-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-page p {
    color: var(--text-secondary);
  }
</style>
