<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { authService } from '$lib/services/authService';
  import { tenantStore } from '$lib/stores/tenantStore';
  import '../app.css';
  
  let isInitializing = true;
  let isAuthenticated = false;
  let currentUser: any = null;
  
  onMount(async () => {
    if (!browser) return;
    
    console.log('[Root Layout] Initializing authentication...');
    
    // Wait for Firebase auth to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check Firebase authentication state
    const user = authService.getCurrentUser();
    isAuthenticated = !!user;
    currentUser = user;
    
    console.log('[Root Layout] Auth state:', {
      isAuthenticated,
      userEmail: user?.email || 'none'
    });
    
    // Initialize tenant store only if authenticated
    if (isAuthenticated) {
      console.log('[Root Layout] Initializing tenant store...');
      await tenantStore.initialize();
      console.log('[Root Layout] Tenant store initialized');
    }
    
    isInitializing = false;
  });
  
  // Listen for auth state changes
  authService.onAuthStateChange((user) => {
    if (!browser) return;
    
    isAuthenticated = !!user;
    currentUser = user;
    
    console.log('[Root Layout] Auth state changed:', {
      isAuthenticated,
      userEmail: user?.email || 'none'
    });
    
    // Handle authentication state changes
    if (!isAuthenticated) {
      // User signed out - clear tenant data and redirect to login
      // Only redirect if not already on login page to prevent loops
      if (window.location.pathname !== '/login') {
        tenantStore.clearTenantData();
        goto('/login', { replaceState: true });
      }
    } else {
      // User signed in - initialize tenant store if not already done
      if (!tenantStore.isInitialized) {
        tenantStore.initialize();
      }
      
      // If on login page and authenticated, redirect to dashboard
      if (window.location.pathname === '/login') {
        goto('/dashboard', { replaceState: true });
      }
    }
  });
</script>

{#if isInitializing}
  <div class="auth-loading">
    <div class="spinner"></div>
    <p>Initializing authentication...</p>
  </div>
{:else if !isAuthenticated}
  <!-- Not authenticated - show login page -->
  <slot />
{:else}
  <!-- Authenticated - show protected content -->
  <slot />
{/if}

<style>
  .auth-loading {
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

  .auth-loading p {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
</style>