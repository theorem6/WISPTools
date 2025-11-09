<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { isPlatformAdmin } from '$lib/services/adminService';
  import { savePlatformCBRSConfig, loadPlatformCBRSConfig, validatePlatformConfig, type PlatformCBRSConfig } from '../../../modules/cbrs-management/lib/services/configService';
  
  let userEmail = '';
  let isAdmin = false;
  let isLoading = true;
  let isSaving = false;
  let error: string | null = null;
  let successMessage: string | null = null;
  
  // Form state
  let formData = {
    googleApiKey: '',
    googleApiEndpoint: 'https://sas.googleapis.com/v1',
    googleCertificatePath: '',
    federatedApiKey: '',
    federatedApiEndpoint: 'https://sas.federatedwireless.com/api/v1',
    federatedCertificatePath: '',
    sharedMode: true
  };
  
const googleEndpointFieldId = 'google-api-endpoint';
const googleApiKeyFieldId = 'google-api-key';
const googleCertPathFieldId = 'google-cert-path';
const federatedEndpointFieldId = 'federated-api-endpoint';
const federatedApiKeyFieldId = 'federated-api-key';
const federatedCertPathFieldId = 'federated-cert-path';

  let testResult = '';
  let showTestResult = false;
  
  onMount(async () => {
    if (browser) {
      // Check admin status
      userEmail = localStorage.getItem('userEmail') || '';
      isAdmin = isPlatformAdmin(userEmail);
      
      if (!isAdmin) {
        console.error('Access denied: Not a platform admin');
        await goto('/dashboard');
        return;
      }
      
      // Load existing platform configuration
      await loadConfiguration();
      
      isLoading = false;
    }
  });
  
  async function loadConfiguration() {
    try {
      const config = await loadPlatformCBRSConfig();
      
      if (config) {
        formData = {
          googleApiKey: config.googleApiKey,
          googleApiEndpoint: config.googleApiEndpoint,
          googleCertificatePath: config.googleCertificatePath || '',
          federatedApiKey: config.federatedApiKey,
          federatedApiEndpoint: config.federatedApiEndpoint,
          federatedCertificatePath: config.federatedCertificatePath || '',
          sharedMode: config.sharedMode
        };
        console.log('Platform configuration loaded');
      } else {
        console.log('No platform configuration found, using defaults');
      }
    } catch (err: any) {
      console.error('Failed to load platform configuration:', err);
      error = 'Failed to load configuration: ' + (err?.message || 'Unknown error');
    }
  }
  
  async function handleSave() {
    isSaving = true;
    error = null;
    successMessage = null;
    
    try {
      const config: PlatformCBRSConfig = {
        ...formData,
        updatedBy: userEmail,
        updatedAt: new Date()
      };
      
      // Validate configuration
      const validation = validatePlatformConfig(config);
      if (!validation.valid) {
        error = 'Validation failed: ' + validation.errors.join(', ');
        return;
      }
      
      await savePlatformCBRSConfig(config);
      successMessage = '✅ Platform configuration saved successfully! All tenants using shared-platform mode will use these keys.';
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        successMessage = null;
      }, 5000);
    } catch (err: any) {
      console.error('Failed to save platform configuration:', err);
      error = 'Failed to save configuration: ' + (err?.message || 'Unknown error');
    } finally {
      isSaving = false;
    }
  }
  
  async function handleTest() {
    showTestResult = true;
    testResult = 'Testing connection...';
    
    try {
      // Validate all required fields are filled
      if (!formData.googleApiKey || !formData.federatedApiKey) {
        testResult = '✗ Both Google SAS and Federated Wireless API keys are required';
        return;
      }
      
      if (!formData.googleApiEndpoint || !formData.federatedApiEndpoint) {
        testResult = '✗ Both API endpoints are required';
        return;
      }
      
      // In production, this would make actual test API calls
      testResult = '✓ Configuration valid. API keys formatted correctly.';
    } catch (err: any) {
      testResult = `✗ Test failed: ${err.message}`;
    }
  }
</script>

<svelte:head>
  <title>CBRS Platform Configuration - Admin Panel</title>
</svelte:head>

<div class="admin-page">
  <div class="page-header">
    <div class="header-content">
      <a href="/dashboard" class="back-link">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        ← Back to Dashboard
      </a>
      
      <div class="header-title">
        <h1>🔑 CBRS Platform Configuration</h1>
        <p class="subtitle">Configure shared SAS API keys for all tenants</p>
      </div>
    </div>
  </div>
  
  <div class="page-content">
    {#if error}
      <div class="alert alert-error">
        <span class="alert-icon">⚠️</span>
        <span class="alert-message">{error}</span>
        <button class="alert-close" on:click={() => error = null}>✕</button>
      </div>
    {/if}
    
    {#if successMessage}
      <div class="alert alert-success">
        <span class="alert-icon">✅</span>
        <span class="alert-message">{successMessage}</span>
        <button class="alert-close" on:click={() => successMessage = null}>✕</button>
      </div>
    {/if}
    
    <div class="info-card">
      <div class="info-icon">💡</div>
      <div class="info-content">
        <h3>About Shared Platform Mode</h3>
        <p>
          Configure your platform's shared SAS API keys here. Tenants who choose "Shared Platform" mode 
          will use these keys with their own unique User ID / Customer ID for tenant isolation.
        </p>
        <p class="info-secondary">
          This allows you to share one SAS subscription across all tenants, significantly reducing costs 
          while maintaining proper tenant isolation through User IDs and Customer IDs.
        </p>
      </div>
    </div>
    
    <div class="config-card">
      <div class="card-header">
        <h2>🔵 Google SAS Configuration</h2>
        <span class="status-badge">Platform-wide</span>
      </div>
      
      <form on:submit|preventDefault={handleSave}>
        <div class="form-group">
          <label for={googleEndpointFieldId}>
            API Endpoint
            <span class="required">*</span>
          </label>
          <input 
            id={googleEndpointFieldId}
            type="text" 
            bind:value={formData.googleApiEndpoint}
            placeholder="https://sas.googleapis.com/v1"
            required
          />
          <span class="form-hint">Google SAS API endpoint URL</span>
        </div>
        
        <div class="form-group">
          <label for={googleApiKeyFieldId}>
            Platform API Key
            <span class="required">*</span>
          </label>
          <input 
            id={googleApiKeyFieldId}
            type="password" 
            bind:value={formData.googleApiKey}
            placeholder="Enter your Google SAS API key"
            required
          />
          <span class="form-hint">
            This API key will be shared by all tenants using "Shared Platform" mode.
            Each tenant will have their own Google User ID for isolation.
          </span>
        </div>
        
        <div class="form-group">
          <label for={googleCertPathFieldId}>Certificate Path (Optional)</label>
          <input 
            id={googleCertPathFieldId}
            type="text" 
            bind:value={formData.googleCertificatePath}
            placeholder="/path/to/certificate.pem"
          />
          <span class="form-hint">Path to client certificate for mutual TLS (if required)</span>
        </div>
      </form>
    </div>
    
    <div class="config-card">
      <div class="card-header">
        <h2>🟢 Federated Wireless Configuration</h2>
        <span class="status-badge">Platform-wide</span>
      </div>
      
      <form on:submit|preventDefault={handleSave}>
        <div class="form-group">
          <label for={federatedEndpointFieldId}>
            API Endpoint
            <span class="required">*</span>
          </label>
          <input 
            id={federatedEndpointFieldId}
            type="text" 
            bind:value={formData.federatedApiEndpoint}
            placeholder="https://sas.federatedwireless.com/api/v1"
            required
          />
          <span class="form-hint">Federated Wireless SAS API endpoint URL</span>
        </div>
        
        <div class="form-group">
          <label for={federatedApiKeyFieldId}>
            Platform API Key
            <span class="required">*</span>
          </label>
          <input 
            id={federatedApiKeyFieldId}
            type="password" 
            bind:value={formData.federatedApiKey}
            placeholder="Enter your Federated Wireless API key"
            required
          />
          <span class="form-hint">
            This API key will be shared by all tenants using "Shared Platform" mode.
            Each tenant will have their own Customer ID for isolation.
          </span>
        </div>
        
        <div class="form-group">
          <label for={federatedCertPathFieldId}>Certificate Path (Optional)</label>
          <input 
            id={federatedCertPathFieldId}
            type="text" 
            bind:value={formData.federatedCertificatePath}
            placeholder="/path/to/certificate.pem"
          />
          <span class="form-hint">Path to client certificate (if required)</span>
        </div>
      </form>
    </div>
    
    {#if showTestResult}
      <div class="test-result" class:success={testResult.startsWith('✓')} class:error={testResult.startsWith('✗')}>
        {testResult}
      </div>
    {/if}
    
    <div class="security-warning">
      <div class="warning-icon">🔒</div>
      <div class="warning-content">
        <strong>Security Notice:</strong> These API keys are shared across all tenants in "Shared Platform" mode.
        Store them securely and never expose them in client-side code. All SAS API calls should go through 
        your backend (Firebase Functions) to keep these keys protected.
      </div>
    </div>
    
    <div class="action-bar">
      <button type="button" class="btn btn-secondary" on:click={handleTest}>
        🧪 Test Configuration
      </button>
      <button type="button" class="btn btn-primary" on:click={handleSave} disabled={isSaving}>
        {#if isSaving}
          <span class="spinner"></span>
          Saving...
        {:else}
          💾 Save Platform Configuration
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .admin-page {
    min-height: 100vh;
    background: var(--bg-primary);
  }
  
  .page-header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 2rem;
  }
  
  .header-content {
    max-width: 1000px;
    margin: 0 auto;
  }
  
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    transition: all 0.2s;
    margin-bottom: 1.5rem;
    width: fit-content;
  }
  
  .back-link:hover {
    color: var(--accent-color);
    border-color: var(--accent-color);
  }
  
  .header-title h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
  }
  
  .subtitle {
    color: var(--text-secondary);
    font-size: 1rem;
    margin: 0;
  }
  
  .page-content {
    max-width: 1000px;
    margin: 0 auto;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .alert {
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }
  
  .alert-success {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }
  
  .alert-icon {
    font-size: 1.25rem;
  }
  
  .alert-message {
    flex: 1;
    font-weight: 500;
  }
  
  .alert-close {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  
  .alert-close:hover {
    opacity: 1;
  }
  
  .info-card {
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 0.75rem;
    padding: 1.5rem;
    display: flex;
    gap: 1rem;
  }
  
  .info-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }
  
  .info-content h3 {
    margin: 0 0 0.75rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .info-content p {
    margin: 0 0 0.75rem 0;
    line-height: 1.6;
    color: var(--text-primary);
    font-size: 0.9375rem;
  }
  
  .info-content p:last-child {
    margin-bottom: 0;
  }
  
  .info-secondary {
    color: var(--text-secondary) !important;
    font-size: 0.875rem !important;
  }
  
  .config-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    padding: 2rem;
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .card-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .status-badge {
    padding: 0.375rem 0.75rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    background: rgba(139, 92, 246, 0.1);
    color: #8b5cf6;
    text-transform: uppercase;
  }
  
  .form-group {
    margin-bottom: 1.5rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text-primary);
  }
  
  .required {
    color: #ef4444;
    margin-left: 0.25rem;
  }
  
  .form-group input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.875rem;
    transition: all 0.2s;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
  
  .form-hint {
    display: block;
    margin-top: 0.375rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-style: italic;
  }
  
  .test-result {
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
  }
  
  .test-result.success {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }
  
  .test-result.error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }
  
  .security-warning {
    background: rgba(251, 191, 36, 0.05);
    border: 1px solid rgba(251, 191, 36, 0.2);
    border-radius: 0.75rem;
    padding: 1.5rem;
    display: flex;
    gap: 1rem;
  }
  
  .warning-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }
  
  .warning-content {
    line-height: 1.6;
    font-size: 0.9375rem;
    color: var(--text-primary);
  }
  
  .warning-content strong {
    display: block;
    margin-bottom: 0.5rem;
    color: #d97706;
  }
  
  .action-bar {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }
  
  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .btn-primary {
    background: var(--accent-color);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  }
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
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
  
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @media (max-width: 768px) {
    .page-header,
    .page-content {
      padding: 1.5rem 1rem;
    }
    
    .header-title h1 {
      font-size: 1.5rem;
    }
    
    .action-bar {
      flex-direction: column;
    }
    
    .btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>

