// Centralized Tenant Store
// Single source of truth for tenant state across the application
// Prevents redundant checks and eliminates redirect loops

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { Tenant } from '../models/tenant';
import { isPlatformAdmin } from '../services/adminService';

export interface TenantState {
  // Current tenant
  currentTenant: Tenant | null;
  
  // All tenants the user has access to
  userTenants: Tenant[];
  
  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  
  // Setup completion
  setupCompleted: boolean;
  
  // Error state
  error: string | null;
}

const initialState: TenantState = {
  currentTenant: null,
  userTenants: [],
  isLoading: false,
  isInitialized: false,
  setupCompleted: false,
  error: null,
};

// Create the main tenant store
function createTenantStore() {
  const { subscribe, set, update } = writable<TenantState>(initialState);

  return {
    subscribe,
    
    /**
     * Initialize the tenant store from localStorage
     * This should only be called once during app initialization
     */
    async initialize(): Promise<void> {
      if (!browser) return;
      
      update(state => ({ ...state, isLoading: true }));
      
      try {
        // Check localStorage for saved tenant
        const selectedTenantId = localStorage.getItem('selectedTenantId');
        const setupCompleted = localStorage.getItem('tenantSetupCompleted') === 'true';
        
        debug.log('[TenantStore] Initializing with:', { selectedTenantId, setupCompleted });
        
        if (selectedTenantId) {
          // Lazy load tenantService to avoid circular dependencies
          const { tenantService } = await import('../services/tenantService');
          const tenant = await tenantService.getTenant(selectedTenantId);
          
          if (tenant) {
            // Tenant found - set as current
            update(state => ({
              ...state,
              currentTenant: tenant,
              setupCompleted: true,
              isLoading: false,
              isInitialized: true,
              error: null
            }));
            
            // Update localStorage
            localStorage.setItem('selectedTenantId', tenant.id);
            localStorage.setItem('selectedTenantName', tenant.displayName);
            localStorage.setItem('tenantSetupCompleted', 'true');
            
            debug.log('[TenantStore] Initialized with tenant:', tenant.displayName);
          } else {
            // Tenant not found - clear localStorage
            console.warn('[TenantStore] Tenant not found, clearing localStorage');
            localStorage.removeItem('selectedTenantId');
            localStorage.removeItem('selectedTenantName');
            localStorage.removeItem('tenantSetupCompleted');
            
            update(state => ({
              ...state,
              currentTenant: null,
              setupCompleted: false,
              isLoading: false,
              isInitialized: true,
              error: null
            }));
          }
        } else {
          // No tenant in localStorage
          update(state => ({
            ...state,
            setupCompleted,
            isLoading: false,
            isInitialized: true,
            error: null
          }));
          
          debug.log('[TenantStore] No tenant in localStorage');
        }
      } catch (error) {
        console.error('[TenantStore] Initialization error:', error);
        update(state => ({
          ...state,
          isLoading: false,
          isInitialized: true,
          error: String(error)
        }));
      }
    },
    
    /**
     * Load all tenants for a user
     * Auto-selects the tenant if user has exactly one (non-admin users)
     * Includes retry logic to wait for auth state to be ready
     */
    async loadUserTenants(userId: string, userEmail?: string): Promise<Tenant[]> {
      if (!browser) return [];
      
      debug.log('[TenantStore] loadUserTenants called with:', { userId, userEmail });
      update(state => ({ ...state, isLoading: true }));
      
      try {
        // Wait for auth to be ready before making API calls
        // This prevents 401 errors from calling API before token is ready
        const { authService } = await import('../services/authService');
        let retries = 0;
        let user = authService.getCurrentUser();
        
        // Wait for user to be available (up to 2 seconds)
        while (!user && retries < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          user = authService.getCurrentUser();
          retries++;
        }
        
        if (!user) {
          console.warn('[TenantStore] User not available after waiting, auth may not be ready');
          update(state => ({
            ...state,
            isLoading: false,
            error: null,
            userTenants: []
          }));
          return [];
        }
        
        // Ensure token is ready by getting it once and verifying it's valid
        let tokenReady = false;
        let tokenRetries = 0;
        const maxTokenRetries = 10;
        
        while (!tokenReady && tokenRetries < maxTokenRetries) {
          try {
            const token = await user.getIdToken(true); // Force refresh to ensure valid token
            if (token && token.length > 100) { // Basic validation - tokens are usually long
              debug.log('[TenantStore] Token ready:', { 
                hasToken: !!token, 
                tokenLength: token?.length,
                userId: user.uid 
              });
              tokenReady = true;
            } else {
              throw new Error('Token invalid or too short');
            }
          } catch (tokenError: any) {
            console.warn('[TenantStore] Token not ready yet, retrying...', {
              attempt: tokenRetries + 1,
              error: tokenError?.message
            });
            // Wait with exponential backoff
            await new Promise(resolve => setTimeout(resolve, 200 * (tokenRetries + 1)));
            tokenRetries++;
          }
        }
        
        if (!tokenReady) {
          console.error('[TenantStore] Failed to get valid token after retries');
          update(state => ({
            ...state,
            isLoading: false,
            error: 'Failed to get authentication token',
            userTenants: []
          }));
          return [];
        }
        
        // Wait a bit more to ensure token is fully propagated
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Check if platform admin - they don't need tenants
        const userIsPlatformAdmin = isPlatformAdmin(userEmail ?? null);
        
        if (userIsPlatformAdmin) {
          debug.log('[TenantStore] Platform admin detected, skipping tenant loading');
          update(state => ({
            ...state,
            userTenants: [],
            isLoading: false,
            error: null
          }));
          return [];
        }
        
        const { tenantService } = await import('../services/tenantService');
        console.log('[TenantStore] Calling tenantService.getUserTenants...');
        const tenants = await tenantService.getUserTenants(userId);
        debug.log('[TenantStore] tenantService.getUserTenants returned:', tenants.length, 'tenants');
        
        // Auto-select tenant for non-admin users to ensure data isolation
        const currentState = get({ subscribe });
        
        debug.log('[TenantStore] Auto-selection check:', { 
          tenantCount: tenants.length, 
          isPlatformAdmin: userIsPlatformAdmin,
          hasCurrentTenant: !!currentState.currentTenant,
          userEmail 
        });
        
        if (tenants.length === 1 && !currentState.currentTenant) {
          // Regular user with one tenant - auto-select it (enforces data isolation)
          const tenant = tenants[0];
          debug.log('[TenantStore] Auto-selecting single tenant:', tenant.displayName);
          
          update(state => ({
            ...state,
            userTenants: tenants,
            currentTenant: tenant,
            setupCompleted: true,
            isLoading: false,
            error: null
          }));
          
          // Save to localStorage
          localStorage.setItem('selectedTenantId', tenant.id);
          localStorage.setItem('selectedTenantName', tenant.displayName);
          localStorage.setItem('tenantSetupCompleted', 'true');
        } else {
          // Platform admin or multi-tenant user - no auto-selection
          update(state => ({
            ...state,
            userTenants: tenants,
            isLoading: false,
            error: null
          }));
        }
        
        debug.log('[TenantStore] Loaded', tenants.length, 'tenants for user');
        return tenants;
      } catch (error: any) {
        console.error('[TenantStore] Error loading user tenants:', error);
        
        // Handle 401 errors gracefully - don't block the app
        if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
          console.warn('[TenantStore] Auth error - user may not be authenticated yet');
          update(state => ({
            ...state,
            isLoading: false,
            error: null, // Don't set error for auth issues - they're expected during login
            userTenants: []
          }));
          return [];
        }
        
        // For other errors, still return empty array but log the error
        update(state => ({
          ...state,
          isLoading: false,
          error: String(error)
        }));
        return [];
      }
    },
    
    /**
     * Set the current tenant
     */
    setCurrentTenant(tenant: Tenant | null): void {
      if (!browser) return;
      
      update(state => ({
        ...state,
        currentTenant: tenant,
        setupCompleted: tenant !== null,
        error: null
      }));
      
      if (tenant) {
        // Save to localStorage
        localStorage.setItem('selectedTenantId', tenant.id);
        localStorage.setItem('selectedTenantName', tenant.displayName);
        localStorage.setItem('tenantSetupCompleted', 'true');
        debug.log('[TenantStore] Current tenant set to:', tenant.displayName);
      } else {
        // Clear localStorage
        localStorage.removeItem('selectedTenantId');
        localStorage.removeItem('selectedTenantName');
        localStorage.removeItem('tenantSetupCompleted');
        debug.log('[TenantStore] Current tenant cleared');
      }
    },
    
    /**
     * Mark setup as completed
     */
    markSetupCompleted(): void {
      if (!browser) return;
      
      update(state => ({ ...state, setupCompleted: true }));
      localStorage.setItem('tenantSetupCompleted', 'true');
      debug.log('[TenantStore] Setup marked as completed');
    },
    
    /**
     * Clear all tenant state (for logout)
     */
    clear(): void {
      if (!browser) return;
      
      set(initialState);
      localStorage.removeItem('selectedTenantId');
      localStorage.removeItem('selectedTenantName');
      localStorage.removeItem('tenantSetupCompleted');
      sessionStorage.clear();
      debug.log('[TenantStore] All tenant state cleared');
    },
    
    /**
     * Alias for clear() method for compatibility
     */
    clearTenantData(): void {
      this.clear();
    },
    
    /**
     * Set error state
     */
    setError(error: string): void {
      update(state => ({ ...state, error }));
    },
    
    /**
     * Clear error state
     */
    clearError(): void {
      update(state => ({ ...state, error: null }));
    },
    
    /**
     * Check if user needs to go through tenant setup
     */
    needsSetup(): boolean {
      const state = get({ subscribe });
      return state.isInitialized && !state.currentTenant && !state.setupCompleted;
    },
    
    /**
     * Check if tenant is loaded and ready
     */
    isReady(): boolean {
      const state = get({ subscribe });
      return state.isInitialized && state.currentTenant !== null;
    }
  };
}

// Export the singleton store
export const tenantStore = createTenantStore();

// Derived stores for convenience
export const currentTenant = derived(tenantStore, $store => $store.currentTenant);
export const userTenants = derived(tenantStore, $store => $store.userTenants);
export const tenantLoading = derived(tenantStore, $store => $store.isLoading);
export const tenantError = derived(tenantStore, $store => $store.error);
export const tenantReady = derived(tenantStore, $store => $store.isInitialized && $store.currentTenant !== null);

