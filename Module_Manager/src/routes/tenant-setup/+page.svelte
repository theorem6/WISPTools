<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { tenantService } from '$lib/services/tenantService';
  import { authService } from '$lib/services/authService';

  let isLoading = false;
  let error = '';
  let success = '';
  let step = 1;

  // Tenant details
  let tenantName = '';
  let displayName = '';
  let contactEmail = '';
  let contactPhone = '';
  let subdomain = '';
  let existingTenants: any[] = [];
  let currentUser: any = null;

  onMount(async () => {
    if (!browser) return;

    // Check if user is authenticated
    currentUser = authService.getCurrentUser();
    if (!currentUser) {
      await goto('/login');
      return;
    }

    contactEmail = currentUser.email || '';

    // Check if a tenant was just selected (to prevent redirect loop)
    const justCreatedTenant = localStorage.getItem('selectedTenantId');
    if (justCreatedTenant) {
      console.log('Tenant already selected, redirecting to dashboard');
      await goto('/dashboard', { replaceState: true });
      return;
    }

    // Check if user already has tenants
    try {
      existingTenants = await tenantService.getUserTenants(currentUser.uid);
      
      if (existingTenants.length > 0) {
        // User already has tenants, redirect to tenant selection
        console.log('User has tenants, redirecting to selector');
        await goto('/tenant-selector', { replaceState: true });
      }
    } catch (err) {
      console.error('Error loading tenants:', err);
    }
  });

  function generateSubdomain() {
    if (tenantName) {
      subdomain = tenantName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }
  }

  async function handleSubmit() {
    error = '';
    success = '';
    isLoading = true;

    // Validation
    if (!tenantName || !displayName || !contactEmail) {
      error = 'Please fill in all required fields';
      isLoading = false;
      return;
    }

    if (!subdomain) {
      generateSubdomain();
    }

    try {
      // Regular users creating their own tenant SHOULD become owner
      const result = await tenantService.createTenant(
        tenantName,
        displayName,
        contactEmail,
        currentUser.uid,
        subdomain,
        true  // Create owner association for regular users
      );

      if (result.success && result.tenantId) {
        success = 'Tenant created successfully!';
        
        // IMPORTANT: Save tenant to localStorage IMMEDIATELY
        // This prevents dashboard from redirecting back here
        localStorage.setItem('selectedTenantId', result.tenantId);
        localStorage.setItem('selectedTenantName', displayName);
        
        step = 2;
        
        // Wait a moment for user to see success, then redirect
        setTimeout(() => {
          goto('/dashboard', { replaceState: true });
        }, 1500);
      } else {
        error = result.error || 'Failed to create tenant';
      }
    } catch (err: any) {
      error = err.message || 'An error occurred';
    }

    isLoading = false;
  }

  $: if (tenantName) {
    generateSubdomain();
  }
</script>

<div class="tenant-setup-page">
  <div class="setup-container">
    <div class="setup-header">
      <h1>🏢 Set Up Your Organization</h1>
      <p>Create a tenant to manage your devices and networks</p>
    </div>

    {#if step === 1}
      <div class="setup-card">
        <div class="progress-bar">
          <div class="progress" style="width: 50%"></div>
        </div>

        <h2>Organization Details</h2>
        <p class="subtitle">Tell us about your organization</p>

        {#if error}
          <div class="error-message">
            <span class="error-icon">⚠️</span>
            {error}
          </div>
        {/if}

        <form on:submit|preventDefault={handleSubmit}>
          <div class="form-group">
            <label for="tenantName">
              Organization Name <span class="required">*</span>
            </label>
            <input
              id="tenantName"
              type="text"
              bind:value={tenantName}
              placeholder="e.g., Acme Wireless"
              disabled={isLoading}
              required
            />
            <p class="help-text">Legal or business name of your organization</p>
          </div>

          <div class="form-group">
            <label for="displayName">
              Display Name <span class="required">*</span>
            </label>
            <input
              id="displayName"
              type="text"
              bind:value={displayName}
              placeholder="e.g., Acme Wireless ISP"
              disabled={isLoading}
              required
            />
            <p class="help-text">Name shown in the application</p>
          </div>

          <div class="form-group">
            <label for="subdomain">
              Subdomain <span class="required">*</span>
            </label>
            <div class="subdomain-input">
              <input
                id="subdomain"
                type="text"
                bind:value={subdomain}
                placeholder="acme-wireless"
                disabled={isLoading}
                required
                pattern="[a-z0-9-]+"
              />
              <span class="subdomain-suffix">.your-domain.com</span>
            </div>
            <p class="help-text">Unique URL for device connections: /cwmp/{subdomain}</p>
          </div>

          <div class="form-group">
            <label for="contactEmail">
              Contact Email <span class="required">*</span>
            </label>
            <input
              id="contactEmail"
              type="email"
              bind:value={contactEmail}
              placeholder="admin@acme-wireless.com"
              disabled={isLoading}
              required
            />
          </div>

          <div class="form-group">
            <label for="contactPhone">
              Contact Phone
            </label>
            <input
              id="contactPhone"
              type="tel"
              bind:value={contactPhone}
              placeholder="+1 (555) 123-4567"
              disabled={isLoading}
            />
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-primary" disabled={isLoading}>
              {#if isLoading}
                <span class="spinner"></span>
                Creating...
              {:else}
                Create Tenant
              {/if}
            </button>
          </div>
        </form>
      </div>
    {:else if step === 2}
      <div class="setup-card success-card">
        <div class="success-icon">✅</div>
        <h2>Tenant Created Successfully!</h2>
        <p>Your organization is ready to go.</p>
        
        <div class="success-details">
          <div class="detail-item">
            <strong>Organization:</strong> {displayName}
          </div>
          <div class="detail-item">
            <strong>CWMP URL:</strong>
            <code>http://your-domain.com/cwmp/{subdomain}</code>
          </div>
          <div class="detail-item">
            <strong>Your Role:</strong> Owner (Full Access)
          </div>
        </div>

        <p class="redirect-message">Redirecting to dashboard...</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .tenant-setup-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .setup-container {
    max-width: 600px;
    width: 100%;
  }

  .setup-header {
    text-align: center;
    color: white;
    margin-bottom: 2rem;
  }

  .setup-header h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .setup-header p {
    opacity: 0.9;
  }

  .setup-card {
    background: var(--card-bg);
    border-radius: 1rem;
    padding: 2.5rem;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background-color: rgba(124, 58, 237, 0.2);
    border-radius: 2px;
    margin-bottom: 2rem;
    overflow: hidden;
  }

  .progress {
    height: 100%;
    background: linear-gradient(90deg, var(--brand-primary), var(--brand-secondary));
    transition: width 0.3s ease;
  }

  h2 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: var(--text-secondary);
    margin-bottom: 2rem;
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

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
  }

  .required {
    color: #ef4444;
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

  .subdomain-input {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .subdomain-input input {
    flex: 1;
  }

  .subdomain-suffix {
    color: var(--text-secondary);
    font-size: 0.875rem;
    white-space: nowrap;
  }

  .help-text {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .form-actions {
    margin-top: 2rem;
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

  .success-card {
    text-align: center;
  }

  .success-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .success-details {
    background-color: rgba(124, 58, 237, 0.1);
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin: 1.5rem 0;
    text-align: left;
  }

  .detail-item {
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border-color);
  }

  .detail-item:last-child {
    border-bottom: none;
  }

  .detail-item strong {
    color: var(--text-primary);
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
  }

  code {
    background-color: var(--bg-secondary);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    color: var(--brand-primary);
  }

  .redirect-message {
    margin-top: 1.5rem;
    color: var(--text-secondary);
    font-style: italic;
  }

  @media (max-width: 768px) {
    .tenant-setup-page {
      padding: 1rem;
    }

    .setup-card {
      padding: 2rem 1.5rem;
    }
  }
</style>

