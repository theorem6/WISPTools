<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { authService } from '$lib/services/authService';
  import { authStore, isAuthenticated } from '$lib/stores/authStore';
  
  let mode: 'signin' | 'signup' | 'reset' = 'signin';
  let email = '';
  let password = '';
  let confirmPassword = '';
  let displayName = '';
  let isLoading = false;
  let error = '';
  
  // Redirect if already authenticated (browser-only)
  onMount(() => {
    if ($isAuthenticated && browser) {
      goto('/');
    }
  });
  
  // Reactive redirect (browser-only)
  $: if (browser && $isAuthenticated) {
    goto('/');
  }
  
  function resetForm() {
    email = '';
    password = '';
    confirmPassword = '';
    displayName = '';
    error = '';
    isLoading = false;
  }
  
  function switchMode(newMode: 'signin' | 'signup' | 'reset') {
    mode = newMode;
    error = '';
  }
  
  async function handleSignIn() {
    if (!email || !password) {
      error = 'Please fill in all fields';
      return;
    }
    
    isLoading = true;
    error = '';
    
    const result = await authService.signIn(email, password);
    
    if (result.success) {
      goto('/');
    } else {
      error = result.error || 'Sign in failed';
      isLoading = false;
    }
  }
  
  async function handleSignUp() {
    if (!email || !password) {
      error = 'Please fill in all fields';
      return;
    }
    
    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }
    
    if (password.length < 6) {
      error = 'Password must be at least 6 characters';
      return;
    }
    
    isLoading = true;
    error = '';
    
    const result = await authService.signUp(email, password, displayName);
    
    if (result.success) {
      goto('/');
    } else {
      error = result.error || 'Sign up failed';
      isLoading = false;
    }
  }
  
  async function handleGoogleSignIn() {
    isLoading = true;
    error = '';
    
    const result = await authService.signInWithGoogle();
    
    if (result.success) {
      goto('/');
    } else {
      error = result.error || 'Google sign in failed';
      isLoading = false;
    }
  }
  
  async function handlePasswordReset() {
    if (!email) {
      error = 'Please enter your email address';
      return;
    }
    
    isLoading = true;
    error = '';
    
    const result = await authService.resetPassword(email);
    
    if (result.success) {
      alert('Password reset email sent! Check your inbox.');
      mode = 'signin';
      resetForm();
    } else {
      error = result.error || 'Password reset failed';
    }
    
    isLoading = false;
  }
</script>

<div class="login-page">
  <div class="login-container">
    <!-- Left Side - Branding -->
    <div class="login-brand">
      <div class="brand-content">
        <div class="brand-icon-large">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
        <h1>LTE PCI Mapper</h1>
        <p class="tagline">Professional Network Planning & Conflict Resolution</p>
        
        <div class="features">
          <div class="feature-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            <span>Real-time Conflict Detection</span>
          </div>
          <div class="feature-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6l4 2"></path>
            </svg>
            <span>AI-Powered Optimization</span>
          </div>
          <div class="feature-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>Multi-Network Management</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Right Side - Auth Form -->
    <div class="login-form-container">
      <div class="login-form">
        <h2>
          {#if mode === 'signin'}
            Welcome Back
          {:else if mode === 'signup'}
            Create Account
          {:else}
            Reset Password
          {/if}
        </h2>
        <p class="subtitle">
          {#if mode === 'signin'}
            Sign in to access your networks
          {:else if mode === 'signup'}
            Start planning your LTE deployment
          {:else}
            We'll send you a reset link
          {/if}
        </p>
        
        <!-- Firebase Setup Notice -->
        {#if error && error.includes('Bad Request')}
          <div class="setup-notice">
            <h4>⚙️ Firebase Setup Required</h4>
            <p>To enable authentication, please:</p>
            <ol>
              <li>Go to <a href="https://console.firebase.google.com" target="_blank">Firebase Console</a></li>
              <li>Navigate to Authentication → Sign-in method</li>
              <li>Enable "Email/Password" provider</li>
              <li>Optionally enable "Google" provider</li>
              <li>Refresh this page</li>
            </ol>
            <p class="note"><strong>For testing:</strong> You can create a test account after enabling Email/Password authentication.</p>
          </div>
        {:else if error}
          <div class="error-message">{error}</div>
        {/if}
        
        {#if mode === 'signin'}
          <form on:submit|preventDefault={handleSignIn}>
            <div class="form-group">
              <label for="email">Email Address</label>
              <input 
                type="email" 
                id="email"
                bind:value={email} 
                placeholder="your@email.com"
                required
                disabled={isLoading}
                autocomplete="email"
              />
            </div>
            
            <div class="form-group">
              <label for="password">Password</label>
              <input 
                type="password" 
                id="password"
                bind:value={password} 
                placeholder="Enter your password"
                required
                disabled={isLoading}
                autocomplete="current-password"
              />
            </div>
            
            <button type="submit" class="auth-btn primary" disabled={isLoading}>
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
          
          <div class="divider">or</div>
          
          <button class="auth-btn google" on:click={handleGoogleSignIn} disabled={isLoading}>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
          
          <div class="auth-footer">
            <button class="link-btn" on:click={() => switchMode('reset')}>
              Forgot password?
            </button>
            <span class="separator">•</span>
            <button class="link-btn" on:click={() => switchMode('signup')}>
              Create account
            </button>
          </div>
        {:else if mode === 'signup'}
          <form on:submit|preventDefault={handleSignUp}>
            <div class="form-group">
              <label for="displayName">Display Name (Optional)</label>
              <input 
                type="text" 
                id="displayName"
                bind:value={displayName} 
                placeholder="John Doe"
                disabled={isLoading}
                autocomplete="name"
              />
            </div>
            
            <div class="form-group">
              <label for="email">Email Address</label>
              <input 
                type="email" 
                id="email"
                bind:value={email} 
                placeholder="your@email.com"
                required
                disabled={isLoading}
                autocomplete="email"
              />
            </div>
            
            <div class="form-group">
              <label for="password">Password</label>
              <input 
                type="password" 
                id="password"
                bind:value={password} 
                placeholder="At least 6 characters"
                required
                disabled={isLoading}
                autocomplete="new-password"
              />
            </div>
            
            <div class="form-group">
              <label for="confirmPassword">Confirm Password</label>
              <input 
                type="password" 
                id="confirmPassword"
                bind:value={confirmPassword} 
                placeholder="Re-enter password"
                required
                disabled={isLoading}
                autocomplete="new-password"
              />
            </div>
            
            <button type="submit" class="auth-btn primary" disabled={isLoading}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
          
          <div class="auth-footer">
            <span>Already have an account?</span>
            <button class="link-btn" on:click={() => switchMode('signin')}>
              Sign in
            </button>
          </div>
        {:else}
          <form on:submit|preventDefault={handlePasswordReset}>
            <p class="reset-info">Enter your email and we'll send you a password reset link.</p>
            
            <div class="form-group">
              <label for="email">Email Address</label>
              <input 
                type="email" 
                id="email"
                bind:value={email} 
                placeholder="your@email.com"
                required
                disabled={isLoading}
                autocomplete="email"
              />
            </div>
            
            <button type="submit" class="auth-btn primary" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
          
          <div class="auth-footer">
            <button class="link-btn" on:click={() => switchMode('signin')}>
              ← Back to sign in
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .login-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    max-width: 1100px;
    width: 100%;
    background: var(--card-bg);
    border-radius: 24px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    overflow: hidden;
  }

  .login-brand {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 4rem 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .brand-content {
    text-align: center;
  }

  .brand-icon-large {
    margin-bottom: 2rem;
    display: flex;
    justify-content: center;
  }

  .brand-icon-large svg {
    filter: drop-shadow(0 4px 12px rgba(0,0,0,0.2));
  }

  .login-brand h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2.5rem;
    font-weight: 700;
    color: white;
  }

  .tagline {
    margin: 0 0 3rem 0;
    font-size: 1.125rem;
    color: rgba(255,255,255,0.9);
  }

  .features {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    text-align: left;
  }

  .feature-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    color: white;
  }

  .feature-item svg {
    flex-shrink: 0;
  }

  .feature-item span {
    font-size: 1rem;
    font-weight: 500;
  }

  .login-form-container {
    padding: 4rem 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .login-form {
    width: 100%;
    max-width: 400px;
  }

  .login-form h2 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .subtitle {
    margin: 0 0 2rem 0;
    font-size: 1rem;
    color: var(--text-secondary);
  }

  .error-message {
    padding: 1rem;
    background: var(--danger-light);
    border-left: 4px solid var(--danger-color);
    border-radius: var(--border-radius);
    color: var(--text-primary);
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
  }

  .setup-notice {
    padding: 1.5rem;
    background: var(--info-light);
    border-left: 4px solid var(--info-color);
    border-radius: var(--border-radius);
    margin-bottom: 1.5rem;
  }

  .setup-notice h4 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1.125rem;
  }

  .setup-notice p {
    margin: 0 0 0.75rem 0;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .setup-notice ol {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
    color: var(--text-primary);
  }

  .setup-notice li {
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }

  .setup-notice a {
    color: var(--primary-color);
    text-decoration: underline;
    font-weight: 500;
  }

  .setup-notice .note {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .reset-info {
    color: var(--text-secondary);
    font-size: 0.95rem;
    margin-bottom: 1.5rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-group input {
    width: 100%;
    padding: 0.875rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 1rem;
    transition: all var(--transition);
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: var(--focus-ring);
  }

  .form-group input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .auth-btn {
    width: 100%;
    padding: 1rem;
    border: none;
    border-radius: var(--border-radius);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .auth-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .auth-btn.primary {
    background: var(--primary-color);
    color: white;
  }

  .auth-btn.primary:hover:not(:disabled) {
    background: var(--button-primary-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  .auth-btn.google {
    background: white;
    color: #1f1f1f;
    border: 1px solid var(--border-color);
  }

  .auth-btn.google:hover:not(:disabled) {
    background: var(--hover-bg);
    box-shadow: var(--shadow-sm);
  }

  .divider {
    text-align: center;
    color: var(--text-tertiary);
    font-size: 0.875rem;
    margin: 1.5rem 0;
    position: relative;
  }

  .divider::before,
  .divider::after {
    content: '';
    position: absolute;
    top: 50%;
    width: 42%;
    height: 1px;
    background: var(--border-color);
  }

  .divider::before {
    left: 0;
  }

  .divider::after {
    right: 0;
  }

  .auth-footer {
    margin-top: 2rem;
    text-align: center;
    font-size: 0.9rem;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .separator {
    color: var(--text-tertiary);
  }

  .link-btn {
    background: none;
    border: none;
    color: var(--primary-color);
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    transition: all var(--transition);
  }

  .link-btn:hover {
    color: var(--button-primary-hover);
    text-decoration: underline;
  }

  @media (max-width: 1024px) {
    .login-container {
      grid-template-columns: 1fr;
    }

    .login-brand {
      padding: 3rem 2rem;
    }

    .features {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .login-page {
      padding: 1rem;
    }

    .login-form-container {
      padding: 2rem 1.5rem;
    }

    .login-brand h1 {
      font-size: 2rem;
    }
  }
</style>

