<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { handleGoogleCallback } from '$lib/services/googleAuthService';
  import { authService } from '$lib/services/authService';

  let status = 'Processing Google Sign-In...';
  let error = '';
  let isLoading = true;

  onMount(async () => {
    if (!browser) return;

    try {
      status = 'Completing sign-in...';

      // Handle the OAuth callback (ID token is in URL hash)
      const result = await handleGoogleCallback();

      if (result.success && result.user) {
        status = '✅ Sign-in successful!';
        
        // Get return URL
        const returnUrl = sessionStorage.getItem('google_auth_return_url') || '/dashboard';
        sessionStorage.removeItem('google_auth_return_url');

        // Wait a moment for auth state to update
        await new Promise(resolve => setTimeout(resolve, 500));

        // Redirect to appropriate page
        const context = sessionStorage.getItem('google_auth_context') || 'login';
        
        if (context === 'signup') {
          // For signup, check if user already has a tenant
          const { tenantService } = await import('$lib/services/tenantService');
          const userHasTenant = await tenantService.checkUserHasTenant(result.user.uid);
          
          if (userHasTenant.success && userHasTenant.hasTenant) {
            // User already has a tenant, go to dashboard
            goto('/dashboard');
          } else {
            // Continue with signup flow
            goto('/signup?googleSuccess=true');
          }
        } else {
          // For login, go to dashboard or return URL
          goto(returnUrl);
        }
      } else {
        throw new Error(result.error || 'Failed to complete sign-in');
      }
    } catch (err: any) {
      console.error('[Google Auth Callback] Error:', err);
      error = err.message || 'OAuth callback failed';
      status = '❌ Sign-in failed';
      isLoading = false;

      // Redirect back to login after error
      setTimeout(() => {
        const returnUrl = sessionStorage.getItem('google_auth_return_url') || '/login';
        sessionStorage.removeItem('google_auth_return_url');
        sessionStorage.removeItem('google_auth_state');
        sessionStorage.removeItem('google_auth_context');
        goto(`${returnUrl}?error=${encodeURIComponent(error)}`);
      }, 3000);
    }
  });
</script>

<div class="callback-page">
  <div class="callback-card">
    <div class="callback-icon">
      {#if error}
        ❌
      {:else}
        🔄
      {/if}
    </div>
    
    <h2>{status}</h2>
    
    {#if error}
      <p class="error-message">{error}</p>
      <p class="help-text">Redirecting to login page...</p>
    {:else}
      <div class="loading-spinner"></div>
    {/if}
  </div>
</div>

<style>
  .callback-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    padding: 2rem;
  }
  
  .callback-card {
    background: rgba(30, 41, 59, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 217, 255, 0.2);
    border-radius: 1rem;
    padding: 3rem;
    text-align: center;
    max-width: 400px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }
  
  .callback-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }
  
  h2 {
    margin: 0 0 1rem 0;
    color: #ffffff;
  }
  
  .error-message {
    color: #fca5a5;
    margin: 1rem 0;
  }
  
  .help-text {
    color: #a0d9e8;
    font-size: 0.875rem;
  }
  
  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(0, 217, 255, 0.1);
    border-top-color: #00d9ff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 1rem auto;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>

