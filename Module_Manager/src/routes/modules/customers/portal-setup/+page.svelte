<script lang="ts">
  import { onMount } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { brandingService } from '$lib/services/brandingService';
  import { goto } from '$app/navigation';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';

  type WizardStep = 'welcome' | 'domain' | 'branding' | 'features' | 'complete';

  let currentStep: WizardStep = 'welcome';
  let loading = false;
  let saving = false;
  let error = '';
  let success = '';
  let tenantId = '';
  let tenantName = '';

  // Domain configuration
  let customDomain = '';
  let enableCustomDomain = false;
  let portalSubdomain = '';
  let portalUrl = '';

  // Branding
  let companyName = '';
  let logoUrl = '';
  let primaryColor = '#3b82f6';
  let supportEmail = '';
  let supportPhone = '';

  // Features
  let enableFAQ = true;
  let enableServiceStatus = true;
  let enableLiveChat = false;
  let enableKnowledgeBase = false;

  let initializedTenantId = '';

  onMount(() => {
    const unsubscribe = currentTenant.subscribe(async (tenant) => {
      if (tenant?.id && tenant.id !== initializedTenantId) {
        initializedTenantId = tenant.id;
        tenantId = tenant.id;
        tenantName = tenant.displayName || tenant.name || '';
        companyName = tenantName || companyName;
        supportEmail = tenant.contactEmail || supportEmail;
        await loadExistingConfig();
      }
    });

    return () => unsubscribe();
  });

  async function loadExistingConfig() {
    if (!tenantId) {
      error = 'No tenant selected. Please select a tenant to configure the portal.';
      return;
    }

    loading = true;
    try {
      const branding = await brandingService.getTenantBranding(tenantId);

      // Load existing configuration
      enableCustomDomain = branding.portal?.enableCustomDomain || false;
      customDomain = branding.portal?.customDomain || '';
      // Use tenant ID (first 12 chars) as portal path
      portalSubdomain = branding.portal?.portalSubdomain || tenantId.slice(0, 12);
      portalUrl = branding.portal?.portalUrl || `https://wisptools.io/portal/${portalSubdomain}`;

      // Get company name from tenant branding or use tenant name
      companyName = branding.company?.name || tenantName || companyName;
      logoUrl = branding.logo?.url || '';
      primaryColor = branding.colors?.primary || '#3b82f6';
      supportEmail = branding.company?.supportEmail || supportEmail;
      supportPhone = branding.company?.supportPhone || '';

      enableFAQ = branding.features?.enableFAQ !== false;
      enableServiceStatus = branding.features?.enableServiceStatus !== false;
      enableLiveChat = branding.features?.enableLiveChat || false;
      enableKnowledgeBase = branding.features?.enableKnowledgeBase || false;

      // If already configured, show complete step
      if (branding.portal?.customDomain || branding.logo?.url) {
        currentStep = 'complete';
      } else {
        currentStep = 'welcome';
      }
    } catch (err: any) {
      console.error('Error loading config:', err);
      error = err.message || 'Failed to load existing configuration.';
    } finally {
      loading = false;
    }
  }
  
  function nextStep() {
    const steps: WizardStep[] = ['welcome', 'domain', 'branding', 'features', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      currentStep = steps[currentIndex + 1];
    }
  }
  
  function previousStep() {
    const steps: WizardStep[] = ['welcome', 'domain', 'branding', 'features', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      currentStep = steps[currentIndex - 1];
    }
  }
  
  function goToStep(step: WizardStep) {
    currentStep = step;
  }
  
  async function saveConfiguration() {
    if (!tenantId) {
      error = 'No tenant selected. Please select a tenant before saving.';
      return;
    }
    
    saving = true;
    error = '';
    success = '';
    
    try {
      // Generate portal path if not using custom domain
      if (!enableCustomDomain && !portalSubdomain) {
        // Use first 12 characters of tenant ID as portal path
        portalSubdomain = tenantId.slice(0, 12);
      }
      
      await brandingService.updateTenantBranding(tenantId, {
        logo: {
          url: logoUrl,
          altText: companyName || 'Company Logo'
        },
        colors: {
          primary: primaryColor
        },
        company: {
          name: companyName,
          supportEmail,
          supportPhone
        },
        portal: {
          enableCustomDomain,
          customDomain: enableCustomDomain ? customDomain : '',
          portalSubdomain: enableCustomDomain ? undefined : portalSubdomain,
          welcomeMessage: `Welcome to ${companyName}'s Customer Portal`
        },
        features: {
          enableFAQ,
          enableServiceStatus,
          enableLiveChat,
          enableKnowledgeBase
        }
      });
      
      // Update portal URL after save
      portalUrl = getPortalUrl();
      
      success = 'Customer portal configured successfully!';
      nextStep();
    } catch (err: any) {
      error = err.message || 'Failed to save configuration';
    } finally {
      saving = false;
    }
  }
  
  function getPortalUrl() {
    if (enableCustomDomain && customDomain) {
      return `https://${customDomain}`;
    }
    // Use tenant ID or generate a short code
    const portalPath = portalSubdomain || tenantId?.slice(0, 12) || 'portal';
    return `https://wisptools.io/portal/${portalPath}`;
  }
</script>

<TenantGuard>
  {#if loading}
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Loading portal setup...</p>
    </div>
  {:else}
  <div class="portal-setup-page">
    <div class="setup-header">
      <h1>🌐 Customer Portal Setup Wizard</h1>
      <p class="subtitle">Configure your branded customer portal in just a few steps</p>
    </div>
    
    {#if error}
      <div class="alert alert-error">{error}</div>
    {/if}
    
    {#if success}
      <div class="alert alert-success">{success}</div>
    {/if}
    
    <!-- Progress Steps -->
    <div class="progress-steps">
      <div class="step" class:active={currentStep === 'welcome'} class:completed={['domain', 'branding', 'features', 'complete'].includes(currentStep)}>
        <div class="step-number">1</div>
        <div class="step-label">Welcome</div>
      </div>
      <div class="step-line"></div>
      <div class="step" class:active={currentStep === 'domain'} class:completed={['branding', 'features', 'complete'].includes(currentStep)}>
        <div class="step-number">2</div>
        <div class="step-label">Domain</div>
      </div>
      <div class="step-line"></div>
      <div class="step" class:active={currentStep === 'branding'} class:completed={['features', 'complete'].includes(currentStep)}>
        <div class="step-number">3</div>
        <div class="step-label">Branding</div>
      </div>
      <div class="step-line"></div>
      <div class="step" class:active={currentStep === 'features'} class:completed={currentStep === 'complete'}>
        <div class="step-number">4</div>
        <div class="step-label">Features</div>
      </div>
      <div class="step-line"></div>
      <div class="step" class:active={currentStep === 'complete'}>
        <div class="step-number">✓</div>
        <div class="step-label">Complete</div>
      </div>
    </div>
    
    <!-- Wizard Content -->
    <div class="wizard-content">
      {#if currentStep === 'welcome'}
        <div class="wizard-step">
          <h2>Welcome to Customer Portal Setup</h2>
          <p>This wizard will help you configure your branded customer portal. You'll set up:</p>
          <ul class="setup-list">
            <li>✅ Custom domain or subdomain</li>
            <li>✅ Company branding and colors</li>
            <li>✅ Portal features and capabilities</li>
            <li>✅ Support contact information</li>
          </ul>
          <p class="info-text">You can always change these settings later from the Settings menu.</p>
          <div class="wizard-actions">
            <button class="btn-primary" on:click={nextStep}>
              Get Started →
            </button>
          </div>
        </div>
      {/if}
      
      {#if currentStep === 'domain'}
        <div class="wizard-step">
          <h2>Configure Your Portal Domain</h2>
          <p>Choose how customers will access your portal.</p>
          
          <div class="form-section">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={enableCustomDomain} />
              <span>Use a custom domain (e.g., portal.yourcompany.com)</span>
            </label>
            
            {#if enableCustomDomain}
              <div class="form-group">
                <label>Custom Domain</label>
                <input 
                  type="text" 
                  bind:value={customDomain} 
                  placeholder="portal.yourcompany.com"
                  class="form-input"
                />
                <p class="help-text">
                  Point your domain's CNAME record to: <code>wisptools.io</code>
                </p>
              </div>
            {:else}
              <div class="form-group">
                <label>Portal URL</label>
                <div class="url-preview">
                  <span class="url-prefix">https://wisptools.io/portal/</span>
                  <input 
                    type="text" 
                    bind:value={portalSubdomain} 
                    placeholder="auto-generated"
                    class="form-input url-input"
                    readonly
                  />
                </div>
                <p class="help-text">
                  Your portal will be accessible at: <strong>{getPortalUrl()}</strong>
                  <br />
                  <small>This unique URL can be mapped to your custom domain, or used as-is.</small>
                </p>
              </div>
            {/if}
          </div>
          
          <div class="wizard-actions">
            <button class="btn-secondary" on:click={previousStep}>← Back</button>
            <button class="btn-primary" on:click={nextStep}>Next →</button>
          </div>
        </div>
      {/if}
      
      {#if currentStep === 'branding'}
        <div class="wizard-step">
          <h2>Customize Your Branding</h2>
          <p>Make the portal look like your company.</p>
          
          <div class="form-section">
            <div class="form-group readonly">
              <label>Company Name (managed by tenant)</label>
              <div class="readonly-value">
                {companyName || 'No tenant selected'}
              </div>
              <p class="help-text">Update the tenant profile to change this name.</p>
            </div>
            
            <div class="form-group">
              <label>Logo URL</label>
              <input 
                type="url" 
                bind:value={logoUrl} 
                placeholder="https://yourcompany.com/logo.png"
                class="form-input"
              />
              <p class="help-text">Enter a publicly accessible URL to your company logo</p>
            </div>
            
            <div class="form-group">
              <label>Primary Color</label>
              <div class="color-input-group">
                <input 
                  type="color" 
                  bind:value={primaryColor} 
                  class="color-picker"
                />
                <input 
                  type="text" 
                  bind:value={primaryColor} 
                  placeholder="#3b82f6"
                  class="form-input color-text"
                />
              </div>
            </div>
            
            <div class="form-group">
              <label>Support Email</label>
              <input 
                type="email" 
                bind:value={supportEmail} 
                placeholder="support@yourcompany.com"
                class="form-input"
              />
            </div>
            
            <div class="form-group">
              <label>Support Phone</label>
              <input 
                type="tel" 
                bind:value={supportPhone} 
                placeholder="(555) 123-4567"
                class="form-input"
              />
            </div>
          </div>
          
          <div class="wizard-actions">
            <button class="btn-secondary" on:click={previousStep}>← Back</button>
            <button class="btn-primary" on:click={nextStep}>Next →</button>
          </div>
        </div>
      {/if}
      
      {#if currentStep === 'features'}
        <div class="wizard-step">
          <h2>Enable Portal Features</h2>
          <p>Choose which features to enable for your customers.</p>
          
          <div class="form-section">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={enableFAQ} />
              <span>FAQ / Help Center</span>
            </label>
            
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={enableServiceStatus} />
              <span>Service Status & Outages</span>
            </label>
            
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={enableKnowledgeBase} />
              <span>Knowledge Base / Documentation</span>
            </label>
            
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={enableLiveChat} />
              <span>Live Chat Support</span>
            </label>
          </div>
          
          <div class="wizard-actions">
            <button class="btn-secondary" on:click={previousStep}>← Back</button>
            <button class="btn-primary" on:click={saveConfiguration} disabled={saving}>
              {saving ? 'Saving...' : 'Save & Complete →'}
            </button>
          </div>
        </div>
      {/if}
      
      {#if currentStep === 'complete'}
        <div class="wizard-step">
          <div class="success-icon">✅</div>
          <h2>Setup Complete!</h2>
          <p>Your customer portal has been configured successfully.</p>
          
          <div class="portal-info">
            <div class="info-card">
              <h3>Portal URL</h3>
              <p class="portal-url">{getPortalUrl()}</p>
              <button class="btn-secondary btn-sm" on:click={() => window.open(getPortalUrl(), '_blank')}>
                Open Portal →
              </button>
            </div>
            
            <div class="info-card">
              <h3>Next Steps</h3>
              <ul class="next-steps">
                <li>Share the portal URL with your customers</li>
                <li>Configure DNS if using a custom domain</li>
                <li>Customize branding further in Settings</li>
                <li>Add FAQ content and knowledge base articles</li>
              </ul>
            </div>
          </div>
          
          <div class="wizard-actions">
            <button class="btn-secondary" on:click={() => goto('/modules/customers')}>
              Go to Customers
            </button>
            <button class="btn-primary" on:click={() => goto('/modules')}>
              Back to Modules
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
  {/if}
</TenantGuard>

<style>
  .portal-setup-page {
    padding: 2rem;
    max-width: 900px;
    margin: 0 auto;
  }
  
  .setup-header {
    text-align: center;
    margin-bottom: 3rem;
  }
  
  .setup-header h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2.5rem;
    color: var(--text-primary);
  }
  
  .subtitle {
    color: var(--text-secondary);
    font-size: 1.1rem;
  }
  
  .progress-steps {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 3rem;
    gap: 0.5rem;
  }
  
  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    opacity: 0.4;
    transition: var(--transition);
  }
  
  .step.active {
    opacity: 1;
  }
  
  .step.completed {
    opacity: 1;
  }
  
  .step-number {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: var(--text-secondary);
  }
  
  .step.active .step-number {
    background: var(--gradient-primary);
    color: white;
    border-color: transparent;
  }
  
  .step.completed .step-number {
    background: var(--success);
    color: white;
    border-color: transparent;
  }
  
  .step-label {
    font-size: 0.85rem;
    color: var(--text-secondary);
    text-align: center;
  }
  
  .step.active .step-label {
    color: var(--text-primary);
    font-weight: 600;
  }
  
  .step-line {
    width: 60px;
    height: 2px;
    background: var(--border-color);
    margin: 0 0.5rem;
  }
  
  .wizard-content {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    padding: 3rem;
    min-height: 400px;
  }
  
  .wizard-step h2 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }
  
  .setup-list {
    list-style: none;
    padding: 0;
    margin: 1.5rem 0;
  }
  
  .setup-list li {
    padding: 0.75rem 0;
    color: var(--text-secondary);
  }
  
  .info-text {
    color: var(--text-secondary);
    font-style: italic;
    margin-top: 1.5rem;
  }
  
  .form-section {
    margin: 2rem 0;
  }
  
  .form-group {
    margin-bottom: 1.5rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .form-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 1rem;
  }
  
.form-group.readonly .readonly-value {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-weight: 600;
}

  .form-input:focus {
    outline: none;
    border-color: var(--brand-primary);
  }
  
  .help-text {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  
  .url-preview {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .url-prefix,
  .url-suffix {
    color: var(--text-secondary);
    font-family: monospace;
  }
  
  .url-input {
    flex: 1;
  }
  
  .color-input-group {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  
  .color-picker {
    width: 60px;
    height: 40px;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    cursor: pointer;
  }
  
  .color-text {
    flex: 1;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    margin-bottom: 1rem;
    cursor: pointer;
  }
  
  .checkbox-label input[type="checkbox"] {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }
  
  .wizard-actions {
    display: flex;
    justify-content: space-between;
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border-color);
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 2rem;
    border: none;
    border-radius: var(--border-radius);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
  }
  
  .btn-primary {
    background: var(--gradient-primary);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }
  
  .btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
  }
  
  .success-icon {
    font-size: 4rem;
    text-align: center;
    margin-bottom: 1rem;
  }
  
  .portal-info {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin: 2rem 0;
  }
  
  .info-card {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
  }
  
  .info-card h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }
  
  .portal-url {
    font-family: monospace;
    background: var(--card-bg);
    padding: 0.75rem;
    border-radius: var(--border-radius);
    margin: 1rem 0;
    word-break: break-all;
    color: var(--brand-primary);
    font-weight: 600;
  }
  
  .next-steps {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .next-steps li {
    padding: 0.5rem 0;
    color: var(--text-secondary);
  }
  
  .next-steps li:before {
    content: "→ ";
    color: var(--brand-primary);
    font-weight: bold;
  }
  
  .alert {
    padding: 1rem;
    border-radius: var(--border-radius);
    margin-bottom: 1.5rem;
  }
  
  .alert-error {
    background: var(--danger-light);
    color: var(--danger);
    border: 1px solid var(--danger);
  }
  
  .alert-success {
    background: var(--success-light);
    color: var(--success);
    border: 1px solid var(--success);
  }
  
  .loading-container,
  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 1rem;
  }
  
  .loading-container p {
    color: var(--text-secondary);
  }
  
  .readonly-value {
    padding: 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    color: var(--text-primary);
    font-weight: 500;
  }
  
  .form-group.readonly {
    opacity: 0.8;
  }
</style>

