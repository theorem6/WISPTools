<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { authService } from '$lib/services/authService';

  onMount(async () => {
    if (!browser) return;
    
    console.log('[Root Page] Checking authentication...');
    
    // Wait for auth service to initialize
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Check Firebase authentication state
    const user = authService.getCurrentUser();
    const isAuthenticated = !!user;
    
    console.log('[Root Page] Auth check result:', {
      isAuthenticated,
      userEmail: user?.email || 'none'
    });
    
    if (isAuthenticated) {
      // User is authenticated, go to dashboard
      console.log('[Root Page] User authenticated, redirecting to dashboard');
      await goto('/dashboard', { replaceState: true });
    } else {
      // User is not authenticated, go to login
      console.log('[Root Page] User not authenticated, redirecting to login');
      await goto('/login', { replaceState: true });
    }
  });
</script>

<div class="loading-page">
  <div class="spinner"></div>
  <p>Checking authentication...</p>
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
    font-size: 0.875rem;
  }
</style>