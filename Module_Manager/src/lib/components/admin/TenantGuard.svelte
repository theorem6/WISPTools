<script lang="ts">
  /**
   * TenantGuard Component
   * 
   * Handles authentication and tenant validation in one centralized place.
   * Prevents redundant checks and eliminates redirect loops.
   * 
   * Usage: Wrap protected content in <TenantGuard>
   */
  
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { tenantStore } from '../../stores/tenantStore';
  import { authService } from '../../services/authService';
  import { isPlatformAdmin } from '../../services/adminService';
  
  export let requireTenant = true; // If false, only checks auth
  export let adminOnly = false; // If true, only admins can access
  
  let isChecking = true;
  let isAuthenticated = false;
  let isAdmin = false;
  let tenantState: any = null;
  let error = '';
  
  // Subscribe to tenant store
  const unsubscribe = tenantStore.subscribe(state => {
    tenantState = state;
  });
  
  onMount(async () => {
    if (!browser) return;
    
    console.log('[TenantGuard] Checking authentication and tenant...');
    
    try {
      // Step 1: Check Firebase authentication with retry logic
      let currentUser = authService.getCurrentUser();
      if (!currentUser) {
        // Wait a bit for auth state to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        currentUser = authService.getCurrentUser();
        
        if (!currentUser) {
          console.log('[TenantGuard] Not authenticated, redirecting to login');
          await goto('/login', { replaceState: true });
          return;
        }
      }
      
      isAuthenticated = true;
      console.log('[TenantGuard] User authenticated:', currentUser.email);
      
      // Step 2: Check if user is admin
      const userEmail = currentUser?.email || '';
      isAdmin = isPlatformAdmin(userEmail);
      console.log('[TenantGuard] Is admin:', isAdmin);
      
      // Step 3: Check admin-only access
      if (adminOnly && !isAdmin) {
        console.log('[TenantGuard] Admin access required but user is not admin');
        error = 'This page requires administrator access.';
        isChecking = false;
        return;
      }
      
      // Step 4: Initialize tenant store if not already initialized
      if (!tenantState.isInitialized) {
        console.log('[TenantGuard] Initializing tenant store...');
        await tenantStore.initialize();
      }
      
      // Step 5: Check tenant requirement
      if (requireTenant && !isAdmin) {
        // Regular users need a tenant
        if (!tenantState.currentTenant) {
          // No tenant selected - load user's tenants
          if (currentUser) {
            console.log('[TenantGuard] No tenant selected, loading user tenants...');
            console.log('[TenantGuard] User UID:', currentUser.uid);
            console.log('[TenantGuard] User Email:', currentUser.email);
            
            const tenants = await tenantStore.loadUserTenants(currentUser.uid, currentUser.email || undefined);
            console.log('[TenantGuard] Loaded tenants:', tenants.length, tenants.map(t => ({ id: t.id, name: t.displayName })));
            
            if (tenants.length === 0) {
              // No tenants at all - create a default tenant for the user
              console.log('[TenantGuard] No tenants found - creating default tenant');
              try {
                const { tenantService } = await import('../../services/tenantService');
                const result = await tenantService.createTenant(
                  'default-tenant',
                  'My Organization',
                  currentUser.email || 'user@example.com',
                  currentUser.uid,
                  undefined,
                  true,
                  currentUser.email
                );
                
                if (result.success && result.tenantId) {
                  // Get the created tenant and set it as current
                  const tenant = await tenantService.getTenant(result.tenantId);
                  if (tenant) {
                    tenantStore.setCurrentTenant(tenant);
                    console.log('[TenantGuard] Created and set default tenant');
                  }
                } else {
                  console.log('[TenantGuard] Failed to create default tenant:', result.error);
                  error = 'Unable to set up your organization. Please contact support.';
                  isChecking = false;
                  return;
                }
              } catch (createError) {
                console.error('[TenantGuard] Error creating default tenant:', createError);
                error = 'Unable to set up your organization. Please contact support.';
                isChecking = false;
                return;
              }
            } else if (tenants.length === 1) {
              // Auto-select single tenant
              console.log('[TenantGuard] Auto-selecting single tenant');
              tenantStore.setCurrentTenant(tenants[0]);
            } else {
              // Multiple tenants - redirect to selector
              console.log('[TenantGuard] Multiple tenants, redirecting to selector');
              await goto('/tenant-selector', { replaceState: true });
              return;
            }
          }
        }
        
        // Verify tenant is still valid
        if (tenantState.currentTenant) {
          console.log('[TenantGuard] Tenant validated:', tenantState.currentTenant.displayName);
        }
      } else if (isAdmin) {
        // Admins don't need a tenant
        console.log('[TenantGuard] Admin user - tenant not required');
      }
      
      isChecking = false;
      console.log('[TenantGuard] Guard checks completed successfully');
      
    } catch (err) {
      console.error('[TenantGuard] Error during checks:', err);
      // Don't immediately redirect to login on errors - show error instead
      error = 'Failed to validate access. Please refresh the page.';
      isChecking = false;
    }
  });
  
  // Cleanup subscription
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    unsubscribe();
  });
</script>

{#if isChecking}
  <div class="guard-loading">
    <div class="loading-spinner"></div>
    <p>Verifying access...</p>
  </div>
{:else if error}
  <div class="guard-error">
    <div class="error-icon">⚠️</div>
    <h2>Access Error</h2>
    <p>{error}</p>
    <button on:click={() => goto('/dashboard')}>Go to Dashboard</button>
  </div>
{:else}
  <slot />
{/if}

<style>
  .guard-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 1rem;
  }
  
  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(124, 58, 237, 0.1);
    border-top-color: var(--brand-primary, #7c3aed);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .guard-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 1rem;
    padding: 2rem;
    text-align: center;
  }
  
  .error-icon {
    font-size: 4rem;
  }
  
  .guard-error h2 {
    margin: 0;
  }
  
  .guard-error p {
    color: var(--text-secondary, #666);
    max-width: 400px;
  }
  
  .guard-error button {
    margin-top: 1rem;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s;
  }
  
  .guard-error button:hover {
    transform: translateY(-2px);
  }
</style>

