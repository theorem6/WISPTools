<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  let email = '';
  let password = '';
  let isLoading = false;
  let error = '';
  let mode: 'signin' | 'signup' = 'signin';

  // For now, we'll use localStorage to simulate authentication
  // This will be replaced with Firebase auth from Login_Logic fork
  
  onMount(async () => {
    if (!browser) return;
    
    console.log('Login page: Checking if already authenticated...');
    
    // Check if already logged in
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    console.log('Login page: isAuthenticated =', isAuthenticated);
    
    if (isAuthenticated === 'true') {
      console.log('Login page: Already authenticated, redirecting to dashboard');
      await goto('/dashboard', { replaceState: true });
    } else {
      console.log('Login page: Not authenticated, showing login form');
    }
  });

  async function handleSubmit() {
    isLoading = true;
    error = '';

    // Basic validation
    if (!email || !password) {
      error = 'Please enter email and password';
      isLoading = false;
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      error = 'Password must be at least 6 characters';
      isLoading = false;
      return;
    }

    try {
      // Use real Firebase authentication
      const { authService } = await import('$lib/services/authService');
      
      let result;
      if (mode === 'signup') {
        console.log('Login page: Creating new account with Firebase...');
        result = await authService.signUp(email, password);
      } else {
        console.log('Login page: Signing in with Firebase...');
        result = await authService.signIn(email, password);
      }
      
      if (result.success) {
        console.log('Login page: Firebase auth successful!');
        console.log('Login page: User:', result.user?.email);
        
        // Also set localStorage for backwards compatibility
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userEmail', email);
        
        // Navigate to dashboard
        await goto('/dashboard', { replaceState: true });
      } else {
        error = result.error || 'Authentication failed';
        console.error('Login page: Auth failed:', error);
      }
    } catch (err: any) {
      error = err.message || 'An error occurred during authentication';
      console.error('Login page: Auth error:', err);
    }
    
    isLoading = false;
  }

  function toggleMode() {
    mode = mode === 'signin' ? 'signup' : 'signin';
    error = '';
  }
</script>

<div class="login-page">
  <div class="login-container">
    <!-- Branding Section -->
    <div class="login-brand">
      <div class="brand-icon">📶</div>
      <h1>LTE WISP Management Platform</h1>
      <p class="brand-tagline">Professional Network Planning & Optimization</p>
    </div>

    <!-- Login Form -->
    <div class="login-card">
      <h2>{mode === 'signin' ? 'Welcome Back' : 'Create Account'}</h2>
      <p class="subtitle">
        {mode === 'signin' 
          ? 'Sign in to access your network management tools' 
          : 'Get started with professional network planning'}
      </p>

      {#if error}
        <div class="error-message">
          <span class="error-icon">⚠️</span>
          {error}
        </div>
      {/if}

      <form on:submit|preventDefault={handleSubmit}>
        <div class="form-group">
          <label for="email">Email Address</label>
          <input
            id="email"
            type="email"
            bind:value={email}
            placeholder="you@example.com"
            disabled={isLoading}
            required
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            type="password"
            bind:value={password}
            placeholder="Enter your password"
            disabled={isLoading}
            required
          />
        </div>

        <button type="submit" class="btn-primary" disabled={isLoading}>
          {#if isLoading}
            <span class="spinner"></span>
            {mode === 'signin' ? 'Signing in...' : 'Creating account...'}
          {:else}
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          {/if}
        </button>
      </form>

      <div class="form-footer">
        <button type="button" class="link-btn" on:click={toggleMode}>
          {mode === 'signin' 
            ? "Don't have an account? Sign up" 
            : 'Already have an account? Sign in'}
        </button>
      </div>

      <div class="demo-notice">
        <p><strong>Firebase Authentication:</strong> Use your Firebase account to access your saved networks and data.</p>
        <p>Don't have an account? Click "Sign up" to create one.</p>
      </div>
    </div>

    <!-- Features Section -->
    <div class="features">
      <div class="feature">
        <span class="feature-icon">📊</span>
        <h3>PCI Resolution</h3>
        <p>Automated conflict detection</p>
      </div>
      <div class="feature">
        <span class="feature-icon">📡</span>
        <h3>Coverage Planning</h3>
        <p>RF analysis tools</p>
      </div>
      <div class="feature">
        <span class="feature-icon">🌐</span>
        <h3>Spectrum Management</h3>
        <p>Frequency planning</p>
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
    max-width: 500px;
    width: 100%;
  }

  .login-brand {
    text-align: center;
    color: white;
    margin-bottom: 2rem;
  }

  .brand-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .login-brand h1 {
    font-size: 1.75rem;
    margin-bottom: 0.5rem;
    color: white;
  }

  .brand-tagline {
    opacity: 0.9;
    font-size: 0.95rem;
  }

  .login-card {
    background: var(--card-bg);
    border-radius: 1rem;
    padding: 2.5rem;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .login-card h2 {
    font-size: 1.75rem;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: var(--text-secondary);
    margin-bottom: 2rem;
    font-size: 0.95rem;
  }

  .error-message {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .error-icon {
    font-size: 1.125rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
  }

  .form-group input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    font-size: 0.95rem;
    transition: all 0.2s;
    background-color: var(--bg-primary);
    color: var(--text-primary);
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--brand-primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .form-group input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    width: 100%;
    padding: 0.875rem;
    background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(37, 99, 235, 0.3);
  }

  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .form-footer {
    margin-top: 1.5rem;
    text-align: center;
  }

  .link-btn {
    background: none;
    border: none;
    color: var(--brand-primary);
    cursor: pointer;
    font-size: 0.875rem;
    text-decoration: underline;
    padding: 0;
  }

  .link-btn:hover {
    color: var(--brand-primary-hover);
  }

  .demo-notice {
    margin-top: 2rem;
    padding: 1rem;
    background-color: rgba(124, 58, 237, 0.1);
    border-radius: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .demo-notice p {
    margin-bottom: 0.25rem;
  }

  .demo-notice strong {
    color: var(--brand-secondary);
  }

  .features {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-top: 2rem;
  }

  .feature {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 0.75rem;
    padding: 1.5rem 1rem;
    text-align: center;
    color: white;
  }

  .feature-icon {
    font-size: 2rem;
    display: block;
    margin-bottom: 0.5rem;
  }

  .feature h3 {
    font-size: 0.875rem;
    margin-bottom: 0.25rem;
    color: white;
  }

  .feature p {
    font-size: 0.75rem;
    opacity: 0.9;
  }

  @media (max-width: 768px) {
    .login-page {
      padding: 1rem;
    }

    .login-card {
      padding: 2rem 1.5rem;
    }

    .features {
      grid-template-columns: 1fr;
    }

    .brand-icon {
      font-size: 3rem;
    }

    .login-brand h1 {
      font-size: 1.5rem;
    }
  }
</style>

