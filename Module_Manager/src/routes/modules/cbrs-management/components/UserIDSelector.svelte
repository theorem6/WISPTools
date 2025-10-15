<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import type { SASUserID } from '$lib/services/googleSASUserService';
  
  export let show = false;
  export let tenantId: string = '';
  
  const dispatch = createEventDispatcher();
  
  let googleAuthState: any = null;
  let unsubscribe: any = null;
  let userIds: SASUserID[] = [];
  let isLoadingUserIds = false;
  let isSigningIn = false;
  let errorMessage = '';
  
  onMount(async () => {
    // Dynamically import googleAuthStore
    const { googleAuthStore } = await import('$lib/services/googleOAuthService');
    
    // Subscribe to Google auth state
    unsubscribe = googleAuthStore.subscribe((state: any) => {
      googleAuthState = state;
    });
    
    // Initialize for this tenant
    await googleAuthStore.initialize(tenantId);
    
    // If already authenticated, load User IDs
    if (googleAuthState?.isAuthenticated && googleAuthState?.accessToken) {
      await fetchUserIDs();
    }
    
    // Check if we just returned from OAuth redirect
    const oauthCompleted = sessionStorage.getItem('google_oauth_completed');
    if (oauthCompleted === 'true') {
      sessionStorage.removeItem('google_oauth_completed');
      console.log('[UserIDSelector] Returned from Google OAuth - reloading auth state');
      await googleAuthStore.initialize(tenantId);
      
      if (googleAuthState?.isAuthenticated && googleAuthState?.accessToken) {
        await fetchUserIDs();
      }
    }
  });
  
  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });
  
  async function handleGoogleSignIn() {
    try {
      isSigningIn = true;
      errorMessage = '';
      const { googleAuthStore } = await import('$lib/services/googleOAuthService');
      await googleAuthStore.signInWithRedirect(tenantId);
      // This will redirect away - no need to handle response here
    } catch (error: any) {
      console.error('[UserIDSelector] Google sign-in failed:', error);
      errorMessage = `Google sign-in failed: ${error.message}`;
      isSigningIn = false;
    }
  }
  
  async function fetchUserIDs() {
    try {
      isLoadingUserIds = true;
      errorMessage = '';
      console.log('[UserIDSelector] Fetching authorized SAS User IDs...');
      
      const { fetchAuthorizedSASUserIDs } = await import('$lib/services/googleSASUserService');
      
      userIds = await fetchAuthorizedSASUserIDs(
        tenantId,
        googleAuthState.googleEmail,
        googleAuthState.accessToken
      );
      
      console.log('[UserIDSelector] Found', userIds.length, 'User IDs');
    } catch (error: any) {
      console.error('[UserIDSelector] Error fetching User IDs:', error);
      errorMessage = `Failed to fetch User IDs: ${error.message}`;
    } finally {
      isLoadingUserIds = false;
    }
  }
  
  async function handleSignOut() {
    try {
      const { googleAuthStore } = await import('$lib/services/googleOAuthService');
      googleAuthStore.signOut(tenantId);
      userIds = [];
      errorMessage = '';
    } catch (error: any) {
      console.error('[UserIDSelector] Sign out failed:', error);
    }
  }
  
  function selectUserId(userId: SASUserID) {
    dispatch('select', {
      userId: userId.userId,
      googleEmail: googleAuthState?.googleEmail,
      accessToken: googleAuthState?.accessToken
    });
  }
  
  function handleClose() {
    dispatch('close');
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={handleClose}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h3>🆔 Select Network / Customer</h3>
        <button class="modal-close" on:click={handleClose}>✕</button>
      </div>
      
      <div class="modal-body">
        {#if errorMessage}
          <div class="error-banner">
            <span class="error-icon">⚠️</span>
            <div>{errorMessage}</div>
          </div>
        {/if}
        
        {#if !googleAuthState?.isAuthenticated}
          <!-- Google Sign-In Section -->
          <div class="signin-section">
            <div class="signin-header">
              <h4>🔐 Sign in to Google SAS Portal</h4>
              <p>Sign in with your Google account to access your CBRS networks</p>
            </div>
            
            <button 
              type="button"
              class="btn-google-signin"
              on:click={handleGoogleSignIn}
              disabled={isSigningIn}
            >
              {#if isSigningIn}
                <span class="spinner"></span>
                Signing in...
              {:else}
                <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              {/if}
            </button>
            <p class="signin-hint">
              Sign in with your Google account registered for CBRS SAS API access
            </p>
          </div>
        {:else}
          <!-- Signed In - Show User ID Selection -->
          <div class="signed-in-header">
            <div class="signin-info">
              <span class="info-icon">✅</span>
              <div>
                <strong>Signed in as:</strong> {googleAuthState.googleEmail}
              </div>
            </div>
            <button class="btn-signout-small" on:click={handleSignOut}>
              Sign out
            </button>
          </div>
          
          {#if isLoadingUserIds}
            <div class="loading-section">
              <span class="spinner-large"></span>
              <p>Loading your networks...</p>
            </div>
          {:else if userIds.length === 0}
            <div class="no-userids">
              <p>No CBRS networks found for your Google account.</p>
              <p class="hint">Contact your SAS administrator to grant access.</p>
            </div>
          {:else}
            <p class="instruction">
              Select the network/customer you want to manage:
            </p>
            
            <div class="userids-list">
              {#each userIds as userId}
                <button class="userid-card" on:click={() => selectUserId(userId)}>
                  <div class="userid-header">
                    <span class="userid-icon">📡</span>
                    <div class="userid-info">
                      <h4>{userId.displayName || userId.userId}</h4>
                      {#if userId.displayName && userId.userId !== userId.displayName}
                        <p class="userid-number">ID: {userId.userId}</p>
                      {/if}
                    </div>
                    {#if userId.isPrimary}
                      <span class="primary-badge">Primary</span>
                    {/if}
                  </div>
                  
                  {#if userId.organizationName}
                    <div class="userid-meta">
                      <span class="meta-label">Organization:</span>
                      <span class="meta-value">{userId.organizationName}</span>
                    </div>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    animation: fadeIn 0.2s ease-out;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .modal-content {
    background: var(--bg-primary);
    border-radius: 0.75rem;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.3s ease-out;
  }
  
  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
    border-radius: 0.75rem 0.75rem 0 0;
  }
  
  .modal-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  
  .modal-close {
    background: none;
    border: none;
    font-size: 1.75rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
    line-height: 1;
  }
  
  .modal-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  .modal-body {
    padding: 2rem;
  }
  
  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    color: #ef4444;
    font-size: 0.875rem;
  }
  
  .error-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }
  
  .signin-section {
    text-align: center;
    padding: 2rem 1rem;
  }
  
  .signin-header h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .signin-header p {
    margin: 0 0 2rem 0;
    font-size: 0.9375rem;
    color: var(--text-secondary);
  }
  
  .btn-google-signin {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 2rem;
    background: white;
    color: #1f2937;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .btn-google-signin:hover:not(:disabled) {
    background: #f9fafb;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
  
  .btn-google-signin:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .google-icon {
    flex-shrink: 0;
  }
  
  .signin-hint {
    margin-top: 1rem;
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }
  
  .signed-in-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }
  
  .signin-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: rgba(34, 197, 94, 0.05);
    border: 1px solid rgba(34, 197, 94, 0.2);
    border-radius: 0.5rem;
    flex: 1;
  }
  
  .info-icon {
    font-size: 1.25rem;
  }
  
  .btn-signout-small {
    padding: 0.5rem 1rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }
  
  .btn-signout-small:hover {
    background: var(--bg-hover);
    border-color: #ef4444;
    color: #ef4444;
  }
  
  .loading-section {
    text-align: center;
    padding: 3rem 1rem;
  }
  
  .loading-section p {
    margin-top: 1rem;
    color: var(--text-secondary);
  }
  
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    display: inline-block;
  }
  
  .spinner-large {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color);
    border-top: 4px solid var(--accent-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    display: inline-block;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .instruction {
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
    font-size: 0.9375rem;
  }
  
  .userids-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .userid-card {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 0.75rem;
    padding: 1.25rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }
  
  .userid-card:hover {
    border-color: var(--accent-color);
    background: rgba(139, 92, 246, 0.05);
    transform: translateX(4px);
  }
  
  .userid-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }
  
  .userid-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }
  
  .userid-info {
    flex: 1;
  }
  
  .userid-info h4 {
    margin: 0 0 0.25rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .display-name {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .userid-number {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-family: monospace;
  }
  
  .primary-badge {
    padding: 0.25rem 0.75rem;
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .userid-meta {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 0;
    border-top: 1px solid var(--border-color);
    font-size: 0.875rem;
  }
  
  .userid-meta:first-of-type {
    margin-top: 0.75rem;
  }
  
  .meta-label {
    color: var(--text-secondary);
    font-weight: 500;
  }
  
  .meta-value {
    color: var(--text-primary);
  }
  
  .meta-value.status-active {
    color: #22c55e;
  }
  
  .no-userids {
    text-align: center;
    padding: 2rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
  }
  
  .hint {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.5rem;
  }
  
  .manual-entry {
    text-align: center;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }
  
  .manual-entry p {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
  }
  
  .btn-primary, .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--accent-color);
    color: white;
  }
  
  .btn-primary:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
  }
  
  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--bg-hover);
    border-color: var(--accent-color);
  }
</style>

