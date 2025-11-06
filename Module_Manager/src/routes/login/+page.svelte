<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { get } from 'svelte/store';
  import { authService } from '$lib/services/authService';
  import { tenantService } from '$lib/services/tenantService';
  import { tenantStore } from '$lib/stores/tenantStore';
  import type { User } from 'firebase/auth';

  let email = '';
  let password = '';
  let isLoading = false;
  let error = '';
  let mode: 'signin' | 'signup' = 'signin';

  onMount(async () => {
    if (!browser) return;
    
    console.log('[Login Page] Checking authentication...');
    
    // Wait for auth service to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check for error in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam === 'no-tenant') {
      error = 'You do not have access to any organizations. Please contact your administrator to be added to a tenant.';
      // Clear the error parameter from URL
      window.history.replaceState({}, '', '/login');
    }
    
    // Check if already authenticated with Firebase
    const user = authService.getCurrentUser();
    const isAuthenticated = !!user;
    
    console.log('[Login Page] Auth check:', {
      isAuthenticated,
      userEmail: user?.email || 'none'
    });
    
    if (isAuthenticated) {
      console.log('[Login Page] Already authenticated, redirecting to dashboard');
      await goto('/dashboard', { replaceState: true });
    } else {
      console.log('[Login Page] Not authenticated, showing login form');
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
      console.log('[Login Page] Form submitted:', { email, mode });
      console.log('[Login Page] Calling authService.signIn...');
      
      let result;
      
      if (mode === 'signin') {
        console.log('[Login Page] Attempting sign in...');
        result = await authService.signIn(email, password);
        console.log('[Login Page] Sign in result:', result);
      } else {
        console.log('[Login Page] Attempting sign up...');
        result = await authService.signUp(email, password);
        console.log('[Login Page] Sign up result:', result);
      }

      if (result.success) {
        console.log('[Login Page] Authentication successful, waiting for auth state...');
        
        // Wait for Firebase auth state to fully update before redirecting
        // This prevents redirect loops where dashboard checks auth before state is ready
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify auth state is ready
        let user = authService.getCurrentUser();
        let retries = 0;
        while (!user && retries < 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          user = authService.getCurrentUser();
          retries++;
        }
        
        if (!user) {
          console.error('[Login Page] Auth state not ready after login, retrying...');
          error = 'Authentication state not ready. Please try again.';
          isLoading = false;
          return;
        }
        
        console.log('[Login Page] Auth state ready');
        
        // Store user info in localStorage for compatibility
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userEmail', email);
        
        // Robust tenant connection for ALL logins (signin and signup)
        await ensureTenantConnection(user, email, mode === 'signup');
        
        console.log('[Login Page] Redirecting to dashboard');
        
        // Redirect to dashboard
        await goto('/dashboard', { replaceState: true });
      } else {
        error = result.error || 'Authentication failed';
        console.error('[Login Page] Authentication failed:', error);
      }
    } catch (err: any) {
      error = err.message || 'An unexpected error occurred';
      console.error('[Login Page] Authentication error:', err);
      console.error('[Login Page] Error stack:', err.stack);
    } finally {
      isLoading = false;
    }
  }

  /**
   * Robust tenant connection after login
   * Ensures tenant is loaded, set, and available for all services
   */
  async function ensureTenantConnection(user: User, email: string, isNewUser: boolean = false): Promise<void> {
    try {
      console.log('[Login Page] Ensuring tenant connection...', { userId: user.uid, email, isNewUser });
      
      // Initialize tenant store first
      await tenantStore.initialize();
      console.log('[Login Page] Tenant store initialized');
      
      // Load user's tenants
      const tenants = await tenantStore.loadUserTenants(user.uid, email);
      console.log('[Login Page] Loaded tenants:', tenants.length);
      
      // Check if we have a saved tenant in localStorage
      const savedTenantId = localStorage.getItem('selectedTenantId');
      let currentTenant = null;
      
      if (savedTenantId) {
        // Try to find the saved tenant in the loaded list
        currentTenant = tenants.find(t => t.id === savedTenantId);
        if (currentTenant) {
          console.log('[Login Page] Found saved tenant:', currentTenant.displayName);
          tenantStore.setCurrentTenant(currentTenant);
        } else {
          console.warn('[Login Page] Saved tenant not found in user tenants, clearing saved tenant');
          localStorage.removeItem('selectedTenantId');
          localStorage.removeItem('selectedTenantName');
        }
      }
      
      // If no current tenant set yet, try auto-selection
      if (!currentTenant && tenants.length > 0) {
        // Auto-select single tenant for non-admin users
        const isPlatformAdmin = email === 'david@david.com';
        if (tenants.length === 1 && !isPlatformAdmin) {
          console.log('[Login Page] Auto-selecting single tenant:', tenants[0].displayName);
          currentTenant = tenants[0];
          tenantStore.setCurrentTenant(currentTenant);
        } else if (tenants.length > 0) {
          // Multiple tenants or admin - use first tenant as default if none selected
          console.log('[Login Page] Multiple tenants available, using first as default');
          currentTenant = tenants[0];
          tenantStore.setCurrentTenant(currentTenant);
        }
      }
      
      // For new users, create tenant if none exists
      if (isNewUser && tenants.length === 0) {
        console.log('[Login Page] New user with no tenants, creating automatic tenant...');
        try {
          await createAutomaticTenant(user, email);
          // Reload tenants after creation
          const updatedTenants = await tenantStore.loadUserTenants(user.uid, email);
          if (updatedTenants.length > 0) {
            currentTenant = updatedTenants[0];
            tenantStore.setCurrentTenant(currentTenant);
            console.log('[Login Page] Automatic tenant created and set:', currentTenant.displayName);
          }
        } catch (tenantError: any) {
          console.error('[Login Page] Error creating automatic tenant:', tenantError);
          // Don't block login - user can create tenant manually later
        }
      }
      
      // Ensure tenantId is in localStorage for services
      const finalTenant = get(tenantStore).currentTenant;
      if (finalTenant) {
        localStorage.setItem('selectedTenantId', finalTenant.id);
        localStorage.setItem('selectedTenantName', finalTenant.displayName);
        console.log('[Login Page] Tenant connection complete:', finalTenant.displayName);
      } else {
        console.warn('[Login Page] No tenant available after connection attempt');
        // Clear any stale tenant data
        localStorage.removeItem('selectedTenantId');
        localStorage.removeItem('selectedTenantName');
      }
    } catch (error: any) {
      console.error('[Login Page] Error ensuring tenant connection:', error);
      // Don't block login - tenant can be set later
      // Clear any stale tenant data
      localStorage.removeItem('selectedTenantId');
      localStorage.removeItem('selectedTenantName');
    }
  }

  /**
   * Create an automatic tenant for a new user
   * Uses email domain or generates a name from email
   */
  async function createAutomaticTenant(user: User, email: string): Promise<void> {
    try {
      // Extract organization name from email domain or use email prefix
      const emailParts = email.split('@');
      const domain = emailParts[1] || '';
      const domainParts = domain.split('.');
      const orgName = domainParts[0] || emailParts[0] || 'My Organization';
      
      // Capitalize first letter
      const displayName = orgName.charAt(0).toUpperCase() + orgName.slice(1);
      
      // Generate subdomain (lowercase, alphanumeric + hyphens)
      const subdomain = orgName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').trim();
      
      console.log('[Login Page] Creating tenant:', {
        name: orgName,
        displayName,
        subdomain,
        contactEmail: email,
        userId: user.uid
      });
      
      // Create tenant with user as owner
      const result = await tenantService.createTenant(
        orgName,
        displayName,
        email,
        user.uid,
        subdomain,
        true,  // Create owner association
        email  // Owner email
      );
      
      if (result.success && result.tenantId) {
        console.log('[Login Page] Tenant created:', result.tenantId);
        
        // Load the newly created tenant and set it as current
        const tenant = await tenantService.getTenant(result.tenantId);
        if (tenant) {
          tenantStore.setCurrentTenant(tenant);
          console.log('[Login Page] Tenant set as current:', tenant.displayName);
        }
      } else {
        throw new Error(result.error || 'Failed to create tenant');
      }
    } catch (error: any) {
      console.error('[Login Page] Automatic tenant creation failed:', error);
      throw error;
    }
  }

  async function handleGoogleSignIn() {
    isLoading = true;
    error = '';

    try {
      console.log('[Login Page] Attempting Google sign in...');
      const result = await authService.signInWithGoogle();

      if (result.success) {
        console.log('[Login Page] Google authentication successful, waiting for auth state...');
        
        // Wait for Firebase auth state to fully update before redirecting
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify auth state is ready
        let user = authService.getCurrentUser();
        let retries = 0;
        while (!user && retries < 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          user = authService.getCurrentUser();
          retries++;
        }
        
        if (!user) {
          console.error('[Login Page] Auth state not ready after Google login');
          error = 'Authentication state not ready. Please try again.';
          isLoading = false;
          return;
        }
        
        console.log('[Login Page] Google auth state ready');
        
        // Store user info in localStorage for compatibility
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userEmail', user.email || '');
        
        // Robust tenant connection for Google sign-in
        await ensureTenantConnection(user, user.email || '', true);
        
        console.log('[Login Page] Redirecting to dashboard');
        
        // Redirect to dashboard
        await goto('/dashboard', { replaceState: true });
      } else {
        error = result.error || 'Google authentication failed';
        console.error('[Login Page] Google authentication failed:', error);
      }
    } catch (err: any) {
      error = err.message || 'Google authentication error';
      console.error('[Login Page] Google authentication error:', err);
    } finally {
      isLoading = false;
    }
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
      <img src="/wisptools-logo.svg" alt="WISPTools.io" class="brand-logo" />
      <h1>WISPTools.io</h1>
      <p class="brand-tagline">WISP Management Platform</p>
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
    background: linear-gradient(135deg, #0f1419 0%, #1a2332 50%, #1e3a4f 100%);
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
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .brand-logo {
    width: 120px;
    height: 120px;
    filter: drop-shadow(0 0 30px rgba(0, 217, 255, 0.6));
    animation: pulse-glow 3s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% {
      filter: drop-shadow(0 0 30px rgba(0, 217, 255, 0.6));
    }
    50% {
      filter: drop-shadow(0 0 50px rgba(0, 242, 254, 0.8));
    }
  }

  .login-brand h1 {
    font-size: 2rem;
    margin: 0;
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: 2px;
    font-weight: 700;
  }

  .brand-tagline {
    color: #00d9ff;
    font-size: 1rem;
    font-weight: 500;
    letter-spacing: 0.5px;
  }

  .login-card {
    background: linear-gradient(135deg, #1e3a4f 0%, #1a2332 100%);
    border: 2px solid rgba(0, 217, 255, 0.3);
    border-radius: 1rem;
    padding: 2.5rem;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 217, 255, 0.2);
  }

  .login-card h2 {
    font-size: 1.75rem;
    margin-bottom: 0.5rem;
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    color: #a0d9e8;
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
    color: #00d9ff;
  }

  .form-group input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid rgba(0, 217, 255, 0.3);
    border-radius: 0.5rem;
    font-size: 0.95rem;
    transition: all 0.2s;
    background-color: rgba(15, 20, 25, 0.5);
    color: #ffffff;
  }

  .form-group input:focus {
    outline: none;
    border-color: #00f2fe;
    box-shadow: 0 0 0 3px rgba(0, 242, 254, 0.2);
  }

  .form-group input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    width: 100%;
    padding: 0.875rem;
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
    color: #0f1419;
    border: 2px solid #00d9ff;
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
    box-shadow: 0 10px 30px rgba(0, 217, 255, 0.5);
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
    color: #00d9ff;
    cursor: pointer;
    font-size: 0.875rem;
    text-decoration: underline;
    padding: 0;
  }

  .link-btn:hover {
    color: #00f2fe;
  }

  .demo-notice {
    margin-top: 2rem;
    padding: 1rem;
    background-color: rgba(0, 217, 255, 0.1);
    border: 1px solid rgba(0, 217, 255, 0.2);
    border-radius: 0.5rem;
    font-size: 0.75rem;
    color: #a0d9e8;
  }

  .demo-notice p {
    margin-bottom: 0.25rem;
  }

  .demo-notice strong {
    color: #00f2fe;
  }

  .features {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-top: 2rem;
  }

  .feature {
    background: linear-gradient(135deg, rgba(0, 217, 255, 0.1) 0%, rgba(0, 242, 254, 0.05) 100%);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 217, 255, 0.2);
    border-radius: 0.75rem;
    padding: 1.5rem 1rem;
    text-align: center;
    color: white;
    transition: all 0.3s ease;
  }

  .feature:hover {
    border-color: #00d9ff;
    box-shadow: 0 4px 20px rgba(0, 217, 255, 0.3);
    transform: translateY(-2px);
  }

  .feature-icon {
    font-size: 2rem;
    display: block;
    margin-bottom: 0.5rem;
  }

  .feature h3 {
    font-size: 0.875rem;
    margin-bottom: 0.25rem;
    color: #00f2fe;
    font-weight: 600;
  }

  .feature p {
    font-size: 0.75rem;
    color: #a0d9e8;
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

    .brand-logo {
      width: 100px;
      height: 100px;
    }

    .login-brand h1 {
      font-size: 1.5rem;
    }
  }
</style>

