<script lang="ts">
  import { goto } from '$app/navigation';
  import { customerAuthService } from '$lib/services/customerAuthService';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { brandingService } from '$lib/services/brandingService';
  
  let customerId = '';
  let phone = '';
  let email = '';
  let password = '';
  let confirmPassword = '';
  let loading = false;
  let error = '';
  let success = false;
  let branding: any = null;
  
  async function loadBranding() {
    if ($currentTenant) {
      branding = await brandingService.getTenantBranding($currentTenant.id);
    }
  }
  
  $: if ($currentTenant) {
    loadBranding();
  }
  
  async function handleSignup(e: Event) {
    e.preventDefault();
    loading = true;
    error = '';
    
    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      loading = false;
      return;
    }
    
    if (password.length < 6) {
      error = 'Password must be at least 6 characters';
      loading = false;
      return;
    }
    
    try {
      const result = await customerAuthService.signUp(customerId, phone, email, password);
      
      if (result.success) {
        success = true;
        setTimeout(() => {
          goto('/modules/customers/portal/dashboard');
        }, 2000);
      } else {
        error = result.message || result.error || 'Signup failed';
      }
    } catch (err: any) {
      error = err.message || 'Signup failed';
    } finally {
      loading = false;
    }
  }
</script>

<div class="signup-page">
  <div class="signup-container">
    <div class="signup-header">
      {#if branding?.logo?.url}
        <img src={branding.logo.url} alt={branding.logo.altText || 'Logo'} class="signup-logo" />
      {:else}
        <h1>{branding?.company?.displayName || branding?.company?.name || 'Customer Portal'}</h1>
      {/if}
      <h2>Create Account</h2>
      <p class="signup-subtitle">Link your customer account to access the portal</p>
    </div>
    
    {#if success}
      <div class="success-message">
        <p>Account created successfully! Redirecting...</p>
      </div>
    {:else}
      <form on:submit={handleSignup} class="signup-form">
        {#if error}
          <div class="error-message">{error}</div>
        {/if}
        
        <div class="form-group">
          <label for="customerId">Customer ID</label>
          <input
            id="customerId"
            type="text"
            bind:value={customerId}
            placeholder="Enter your customer ID"
            required
            disabled={loading}
          />
        </div>
        
        <div class="form-group">
          <label for="phone">Phone Number</label>
          <input
            id="phone"
            type="tel"
            bind:value={phone}
            placeholder="Enter your phone number"
            required
            disabled={loading}
          />
        </div>
        
        <div class="form-group">
          <label for="email">Email Address</label>
          <input
            id="email"
            type="email"
            bind:value={email}
            placeholder="Enter your email"
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
            placeholder="Create a password (min 6 characters)"
            required
            minlength="6"
            disabled={loading}
          />
        </div>
        
        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            bind:value={confirmPassword}
            placeholder="Confirm your password"
            required
            disabled={loading}
          />
        </div>
        
        <button type="submit" class="btn-primary" disabled={loading}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
        
        <div class="signup-links">
          <a href="/modules/customers/portal/login" class="link">Already have an account? Sign in</a>
        </div>
      </form>
    {/if}
  </div>
</div>

<style>
  .signup-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--brand-primary, #3b82f6) 0%, var(--brand-accent, #10b981) 100%);
    padding: 2rem;
  }
  
  .signup-container {
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    padding: 3rem;
    max-width: 500px;
    width: 100%;
  }
  
  .signup-header {
    text-align: center;
    margin-bottom: 2rem;
  }
  
  .signup-logo {
    max-height: 60px;
    max-width: 200px;
    margin-bottom: 1rem;
  }
  
  .signup-header h1 {
    font-size: 1.75rem;
    color: var(--brand-text, #111827);
    margin-bottom: 0.5rem;
  }
  
  .signup-header h2 {
    font-size: 1.5rem;
    color: var(--brand-text, #111827);
    margin-bottom: 0.5rem;
  }
  
  .signup-subtitle {
    color: var(--brand-text-secondary, #6b7280);
    font-size: 0.875rem;
  }
  
  .signup-form {
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
  
  .success-message {
    background: #d1fae5;
    color: #065f46;
    padding: 1rem;
    border-radius: 6px;
    text-align: center;
  }
  
  .signup-links {
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
    .signup-container {
      padding: 2rem 1.5rem;
    }
  }
</style>