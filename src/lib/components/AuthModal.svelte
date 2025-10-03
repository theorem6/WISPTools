<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { authService } from '../services/authService';
  import { authStore } from '../stores/authStore';
  
  export let show = false;
  
  const dispatch = createEventDispatcher();
  
  let mode: 'signin' | 'signup' | 'reset' = 'signin';
  let email = '';
  let password = '';
  let confirmPassword = '';
  let displayName = '';
  let isLoading = false;
  let error = '';
  
  function handleClose() {
    resetForm();
    dispatch('close');
  }
  
  function resetForm() {
    email = '';
    password = '';
    confirmPassword = '';
    displayName = '';
    error = '';
    isLoading = false;
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
      handleClose();
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
      handleClose();
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
      handleClose();
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
  
  function switchMode(newMode: 'signin' | 'signup' | 'reset') {
    mode = newMode;
    error = '';
  }
</script>

{#if show}
  <div 
    class="auth-overlay" 
    role="presentation"
    on:click={handleClose}
    on:keydown={(e) => e.key === 'Escape' && handleClose()}
  >
    <div 
      class="auth-modal" 
      role="dialog"
      aria-labelledby="auth-modal-title"
      on:click|stopPropagation
      on:keydown|stopPropagation
    >
      <div class="auth-header">
        <h2 id="auth-modal-title">
          {#if mode === 'signin'}
            Sign In to PCI Mapper
          {:else if mode === 'signup'}
            Create Account
          {:else}
            Reset Password
          {/if}
        </h2>
        <button class="close-btn" on:click={handleClose}>×</button>
      </div>
      
      <div class="auth-body">
        {#if error}
          <div class="error-message">{error}</div>
        {/if}
        
        {#if mode === 'signin'}
          <form on:submit|preventDefault={handleSignIn}>
            <div class="form-group">
              <label for="email">Email</label>
              <input 
                type="email" 
                id="email"
                bind:value={email} 
                placeholder="your@email.com"
                required
                disabled={isLoading}
              />
            </div>
            
            <div class="form-group">
              <label for="password">Password</label>
              <input 
                type="password" 
                id="password"
                bind:value={password} 
                placeholder="••••••••"
                required
                disabled={isLoading}
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
            <span>•</span>
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
              />
            </div>
            
            <div class="form-group">
              <label for="email">Email</label>
              <input 
                type="email" 
                id="email"
                bind:value={email} 
                placeholder="your@email.com"
                required
                disabled={isLoading}
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
            <p class="reset-info">Enter your email and we'll send you a reset link.</p>
            
            <div class="form-group">
              <label for="email">Email</label>
              <input 
                type="email" 
                id="email"
                bind:value={email} 
                placeholder="your@email.com"
                required
                disabled={isLoading}
              />
            </div>
            
            <button type="submit" class="auth-btn primary" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
          
          <div class="auth-footer">
            <button class="link-btn" on:click={() => switchMode('signin')}>
              Back to sign in
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .auth-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    animation: fadeIn 0.2s;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .auth-modal {
    background: var(--card-bg);
    border-radius: var(--border-radius-xl);
    width: 100%;
    max-width: 450px;
    box-shadow: var(--shadow-2xl);
    border: 1px solid var(--border-color);
    animation: slideUp 0.3s;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .auth-header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .auth-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: none;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 1.75rem;
    line-height: 1;
    cursor: pointer;
    transition: all var(--transition);
  }

  .close-btn:hover {
    background: var(--danger-light);
    color: var(--danger-color);
  }

  .auth-body {
    padding: 2rem;
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

  .reset-info {
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-group input {
    width: 100%;
    padding: 0.75rem;
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
    padding: 0.875rem;
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
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .auth-btn.google {
    background: white;
    color: #1f1f1f;
    border: 1px solid var(--border-color);
    margin-top: 1rem;
  }

  [data-theme="dark"] .auth-btn.google {
    background: var(--surface-secondary);
    color: var(--text-primary);
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
    width: 40%;
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
    margin-top: 1.5rem;
    text-align: center;
    font-size: 0.9rem;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .link-btn {
    background: none;
    border: none;
    color: var(--primary-color);
    font-weight: 500;
    cursor: pointer;
    padding: 0;
    transition: all var(--transition);
  }

  .link-btn:hover {
    color: var(--button-primary-hover);
    text-decoration: underline;
  }

  @media (max-width: 640px) {
    .auth-modal {
      max-width: 95%;
    }

    .auth-body {
      padding: 1.5rem;
    }
  }
</style>

