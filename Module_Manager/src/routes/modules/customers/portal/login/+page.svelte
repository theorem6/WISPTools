<script lang="ts">
  import { goto } from '$app/navigation';
  import { customerAuthService } from '$lib/services/customerAuthService';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { brandingService } from '$lib/services/brandingService';
  
  let identifier = '';
  let password = '';
  let loading = false;
  let error = '';
  let branding: any = null;
  
  async function loadBranding() {
    if ($currentTenant) {
      branding = await brandingService.getTenantBranding($currentTenant.id);
    }
  }
  
  $: if ($currentTenant) {
    loadBranding();
  }
  
  async function handleLogin(e: Event) {
    e.preventDefault();
    loading = true;
    error = '';
    
    try {
      const result = await customerAuthService.login(identifier, password);
      
      if (result.success) {
        goto('/modules/customers/portal/dashboard');
      } else {
        error = result.message || result.error || 'Login failed';
      }
    } catch (err: any) {
      error = err.message || 'Login failed';
    } finally {
      loading = false;
    }
  }
</script>

<div class="login-page">
  <div class="login-container">
    <div class="login-header">
      {#if branding?.logo?.url}
        <img src={branding.logo.url} alt={branding.logo.altText || 'Logo'} class="login-logo" />
      {:else}
        <h1>{branding?.company?.displayName || branding?.company?.name || 'Customer Portal'}</h1>
      {/if}
      <h2>Sign In</h2>
      <p class="login-subtitle">Access your account to view tickets and service information</p>
    </div>
    
    <form on:submit={handleLogin} class="login-form">
      {#if error}
        <div class="error-message">{error}</div>
      {/if}
      
      <div class="form-group">
        <label for="identifier">Customer ID, Email, or Phone</label>
        <input
          id="identifier"
          type="text"
          bind:value={identifier}
          placeholder="Enter your customer ID, email, or phone"
          required
          disabled={loading}
        />
      </div>
      
      <div class="form-group">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          placeholder="Enter your password"
          required
          disabled={loading}
        />
      </div>
      
      <button type="submit" class="btn-primary" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
      
      <div class="login-links">
        <a href="/modules/customers/portal/signup" class="link">Don't have an account? Sign up</a>
        <a href="#" class="link" on:click|preventDefault={() => alert('Password reset coming soon')}>
          Forgot password?
        </a>
      </div>
    </form>
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--brand-primary, #3b82f6) 0%, var(--brand-accent, #10b981) 100%);
    padding: 2rem;
  }
  
  .login-container {
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    padding: 3rem;
    max-width: 450px;
    width: 100%;
  }
  
  .login-header {
    text-align: center;
    margin-bottom: 2rem;
  }
  
  .login-logo {
    max-height: 60px;
    max-width: 200px;
    margin-bottom: 1rem;
  }
  
  .login-header h1 {
    font-size: 1.75rem;
    color: var(--brand-text, #111827);
    margin-bottom: 0.5rem;
  }
  
  .login-header h2 {
    font-size: 1.5rem;
    color: var(--brand-text, #111827);
    margin-bottom: 0.5rem;
  }
  
  .login-subtitle {
    color: var(--brand-text-secondary, #6b7280);
    font-size: 0.875rem;
  }
  
  .login-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .form-group label {
    font-weight: 500;
    color: var(--brand-text, #111827);
    font-size: 0.875rem;
  }
  
  .form-group input {
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 1rem;
    transition: border-color 0.2s;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: var(--brand-primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .form-group input:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
  }
  
  .btn-primary {
    background: var(--brand-primary, #3b82f6);
    color: white;
    padding: 0.75rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--brand-accent, #10b981);
  }
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .error-message {
    background: #fee2e2;
    color: #dc2626;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
  }
  
  .login-links {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }
  
  .link {
    color: var(--brand-primary, #3b82f6);
    text-decoration: none;
    font-size: 0.875rem;
    transition: opacity 0.2s;
  }
  
  .link:hover {
    opacity: 0.8;
    text-decoration: underline;
  }
  
  @media (max-width: 768px) {
    .login-container {
      padding: 2rem 1.5rem;
    }
  }
</style>

