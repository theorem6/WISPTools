<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let status = 'Processing Google Sign-In...';
  let error = '';
  
  onMount(async () => {
    if (!browser) return;
    
    try {
      // Parse the OAuth response from URL hash
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      
      const accessToken = params.get('access_token');
      const expiresIn = params.get('expires_in');
      const state = params.get('state'); // This contains the tenant ID
      const errorParam = params.get('error');
      
      if (errorParam) {
        throw new Error(params.get('error_description') || errorParam);
      }
      
      if (!accessToken) {
        throw new Error('No access token received from Google');
      }
      
      // Calculate expiration time
      const expiresAt = Date.now() + (parseInt(expiresIn || '3600') * 1000);
      
      // Get user email by calling Google's userinfo API
      let email = 'unknown@gmail.com';
      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json();
          email = userInfo.email || 'unknown@gmail.com';
        }
      } catch (err) {
        console.error('[Google OAuth] Failed to get user email:', err);
      }
      
      console.log('[Google OAuth Callback] Success!', { email, expiresAt });
      
      // Save token to localStorage (redirect flow)
      const tenantId = state || sessionStorage.getItem('oauth_tenant_id') || 'default';
      
      const token: any = {
        accessToken,
        expiresAt,
        email
      };
      
      localStorage.setItem(`google_oauth_${tenantId}`, JSON.stringify(token));
      
      status = '✅ Sign-in successful! Redirecting back...';
      
      // Get return URL
      const returnUrl = sessionStorage.getItem('oauth_return_url') || '/modules/cbrs-management';
      sessionStorage.removeItem('oauth_return_url');
      sessionStorage.removeItem('oauth_tenant_id');
      
      // Redirect back to the page with a flag to show success
      sessionStorage.setItem('google_oauth_completed', 'true');
      
      // Redirect after showing success message
      setTimeout(() => {
        window.location.href = returnUrl;
      }, 1000);
      
    } catch (err: any) {
      console.error('[Google OAuth Callback] Error:', err);
      error = err.message || 'OAuth callback failed';
      status = '❌ Sign-in failed';
      
      // Redirect back after error
      setTimeout(() => {
        const returnUrl = sessionStorage.getItem('oauth_return_url') || '/modules/cbrs-management';
        sessionStorage.removeItem('oauth_return_url');
        sessionStorage.removeItem('oauth_tenant_id');
        window.location.href = returnUrl;
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
      <p class="help-text">You can close this window and try again.</p>
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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 2rem;
  }
  
  .callback-card {
    background: white;
    border-radius: 1rem;
    padding: 3rem;
    text-align: center;
    max-width: 400px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }
  
  .callback-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }
  
  h2 {
    margin: 0 0 1rem 0;
    color: #1a202c;
  }
  
  .error-message {
    color: #ef4444;
    margin: 1rem 0;
  }
  
  .help-text {
    color: #6b7280;
    font-size: 0.875rem;
  }
  
  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(124, 58, 237, 0.1);
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 1rem auto;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>

