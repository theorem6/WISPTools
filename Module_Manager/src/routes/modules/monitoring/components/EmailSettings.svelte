<script lang="ts">
  import { onMount } from 'svelte';
  
  export let tenantId: string;
  export let API_URL: string;
  
  let loading = true;
  let saving = false;
  let testingEmail = false;
  let success = '';
  let error = '';
  
  // Email configuration
  let emailConfig: any = null;
  let tenantInfo: any = null;
  
  // Form data
  let useTenantEmail = true;
  let customSenderEmail = '';
  let customSenderName = '';
  let companyName = '';
  let logoUrl = '';
  let primaryColor = '#2563eb';
  let supportEmail = '';
  let supportPhone = '';
  let testEmailAddress = '';
  
  // Default recipients
  let criticalEmails = '';
  let errorEmails = '';
  let warningEmails = '';
  
  onMount(async () => {
    await loadEmailConfig();
    await loadTenantInfo();
  });
  
  async function loadEmailConfig() {
    try {
      const response = await fetch(`${API_URL}/monitoring/email-config`, {
        headers: { 'x-tenant-id': tenantId }
      });
      
      if (response.ok) {
        emailConfig = await response.json();
        
        if (emailConfig.tenant_config) {
          const config = emailConfig.tenant_config;
          useTenantEmail = config.sender?.use_tenant_email !== false;
          customSenderEmail = config.sender?.email || '';
          customSenderName = config.sender?.name || '';
          companyName = config.branding?.company_name || '';
          logoUrl = config.branding?.logo_url || '';
          primaryColor = config.branding?.primary_color || '#2563eb';
          supportEmail = config.branding?.support_email || '';
          supportPhone = config.branding?.support_phone || '';
          
          criticalEmails = config.default_recipients?.critical?.join(', ') || '';
          errorEmails = config.default_recipients?.error?.join(', ') || '';
          warningEmails = config.default_recipients?.warning?.join(', ') || '';
        }
      }
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  async function loadTenantInfo() {
    try {
      const response = await fetch(`${API_URL}/monitoring/tenant-info`, {
        headers: { 'x-tenant-id': tenantId }
      });
      
      if (response.ok) {
        tenantInfo = await response.json();
      }
    } catch (err) {
      console.error('Error loading tenant info:', err);
    }
  }
  
  async function saveEmailConfig() {
    saving = true;
    error = '';
    success = '';
    
    try {
      const config = {
        sender: {
          use_tenant_email: useTenantEmail,
          email: useTenantEmail ? null : customSenderEmail,
          name: useTenantEmail ? null : customSenderName
        },
        branding: {
          company_name: companyName,
          logo_url: logoUrl,
          primary_color: primaryColor,
          support_email: supportEmail,
          support_phone: supportPhone
        },
        default_recipients: {
          critical: criticalEmails.split(',').map(e => e.trim()).filter(e => e),
          error: errorEmails.split(',').map(e => e.trim()).filter(e => e),
          warning: warningEmails.split(',').map(e => e.trim()).filter(e => e)
        }
      };
      
      const response = await fetch(`${API_URL}/monitoring/email-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify(config)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save email configuration');
      }
      
      success = '✅ Email configuration saved successfully!';
      await loadEmailConfig();
    } catch (err: any) {
      error = err.message;
    } finally {
      saving = false;
    }
  }
  
  async function sendTestEmail() {
    if (!testEmailAddress) {
      error = 'Please enter a test email address';
      return;
    }
    
    testingEmail = true;
    error = '';
    success = '';
    
    try {
      const response = await fetch(`${API_URL}/monitoring/test-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({ email: testEmailAddress })
      });
      
      const result = await response.json();
      
      if (result.success) {
        success = `✅ Test email sent to ${testEmailAddress}! Check your inbox.`;
      } else {
        error = result.error || 'Failed to send test email';
      }
    } catch (err: any) {
      error = err.message;
    } finally {
      testingEmail = false;
    }
  }
</script>

<div class="email-settings">
  <h2>📧 Email Alert Configuration</h2>
  
  {#if loading}
    <div class="loading">Loading email configuration...</div>
  {:else}
    {#if success}
      <div class="success-message">{success}</div>
    {/if}
    
    {#if error}
      <div class="error-message">{error}</div>
    {/if}
    
    <!-- Current Configuration -->
    <div class="config-card">
      <h3>📤 Current Sender</h3>
      {#if emailConfig?.effective_sender}
        <div class="current-sender">
          <div class="sender-item">
            <span class="label">From Email:</span>
            <span class="value">{emailConfig.effective_sender.email}</span>
          </div>
          <div class="sender-item">
            <span class="label">From Name:</span>
            <span class="value">{emailConfig.effective_sender.name}</span>
          </div>
          <div class="sender-item">
            <span class="label">Provider:</span>
            <span class="value">{emailConfig.provider}</span>
          </div>
        </div>
      {/if}
    </div>
    
    <!-- Sender Configuration -->
    <div class="form-section">
      <h3>🔧 Sender Configuration</h3>
      
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={useTenantEmail} />
          <span>Use my tenant email ({tenantInfo?.owner_email || 'loading...'})</span>
        </label>
        <small>Alerts will appear to come from your account email</small>
      </div>
      
      {#if !useTenantEmail}
        <div class="form-group">
          <label for="custom-email">Custom Sender Email</label>
          <input 
            id="custom-email"
            type="email" 
            bind:value={customSenderEmail}
            placeholder="alerts@yourcompany.com"
          />
          <small>Must be verified in SendGrid</small>
        </div>
        
        <div class="form-group">
          <label for="custom-name">Custom Sender Name</label>
          <input 
            id="custom-name"
            type="text" 
            bind:value={customSenderName}
            placeholder="Your Company Alerts"
          />
        </div>
      {/if}
    </div>
    
    <!-- Branding -->
    <div class="form-section">
      <h3>🎨 Email Branding</h3>
      
      <div class="form-group">
        <label for="company-name">Company Name</label>
        <input 
          id="company-name"
          type="text" 
          bind:value={companyName}
          placeholder="Your Company Name"
        />
        <small>Appears in email footer</small>
      </div>
      
      <div class="form-group">
        <label for="logo-url">Logo URL (Optional)</label>
        <input 
          id="logo-url"
          type="url" 
          bind:value={logoUrl}
          placeholder="https://example.com/logo.png"
        />
        <small>Logo image for email header</small>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="primary-color">Primary Color</label>
          <div class="color-input">
            <input 
              id="primary-color"
              type="color" 
              bind:value={primaryColor}
            />
            <input 
              type="text" 
              bind:value={primaryColor}
              placeholder="#2563eb"
            />
          </div>
        </div>
        
        <div class="form-group">
          <label for="support-email">Support Email</label>
          <input 
            id="support-email"
            type="email" 
            bind:value={supportEmail}
            placeholder="support@yourcompany.com"
          />
        </div>
      </div>
      
      <div class="form-group">
        <label for="support-phone">Support Phone (Optional)</label>
        <input 
          id="support-phone"
          type="tel" 
          bind:value={supportPhone}
          placeholder="+1-555-0123"
        />
      </div>
    </div>
    
    <!-- Default Recipients -->
    <div class="form-section">
      <h3>📬 Default Alert Recipients</h3>
      <p class="section-description">
        Comma-separated email addresses for each severity level. 
        These are used when alert rules don't specify recipients.
      </p>
      
      <div class="form-group">
        <label for="critical-emails">Critical Alerts 🔴</label>
        <input 
          id="critical-emails"
          type="text" 
          bind:value={criticalEmails}
          placeholder="ops@example.com, oncall@example.com"
        />
        <small>Service outages, database failures</small>
      </div>
      
      <div class="form-group">
        <label for="error-emails">Error Alerts 🟠</label>
        <input 
          id="error-emails"
          type="text" 
          bind:value={errorEmails}
          placeholder="ops@example.com"
        />
        <small>MME disconnects, heartbeat failures</small>
      </div>
      
      <div class="form-group">
        <label for="warning-emails">Warning Alerts 🟡</label>
        <input 
          id="warning-emails"
          type="text" 
          bind:value={warningEmails}
          placeholder="team@example.com"
        />
        <small>Performance issues, capacity warnings</small>
      </div>
    </div>
    
    <!-- Test Email -->
    <div class="form-section">
      <h3>🧪 Test Email Configuration</h3>
      
      <div class="form-group">
        <label for="test-email">Send Test Email To</label>
        <div class="test-email-row">
          <input 
            id="test-email"
            type="email" 
            bind:value={testEmailAddress}
            placeholder="your-email@example.com"
          />
          <button 
            class="btn-test" 
            on:click={sendTestEmail}
            disabled={testingEmail || !testEmailAddress}
          >
            {testingEmail ? '⏳ Sending...' : '📧 Send Test'}
          </button>
        </div>
        <small>Verify your email configuration is working</small>
      </div>
    </div>
    
    <!-- Save Button -->
    <div class="form-actions">
      <button 
        class="btn-primary" 
        on:click={saveEmailConfig}
        disabled={saving}
      >
        {saving ? '⏳ Saving...' : '💾 Save Configuration'}
      </button>
    </div>
  {/if}
</div>

<style>
  .email-settings {
    max-width: 800px;
  }

  h2 {
    margin: 0 0 2rem 0;
  }

  h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
  }

  .success-message {
    padding: 1rem;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid #10b981;
    border-radius: 6px;
    color: #10b981;
    margin-bottom: 1rem;
  }

  .error-message {
    padding: 1rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    border-radius: 6px;
    color: #ef4444;
    margin-bottom: 1rem;
  }

  .config-card {
    background: var(--card-bg);
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    margin-bottom: 2rem;
  }

  .current-sender {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .sender-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem;
    background: var(--bg-secondary);
    border-radius: 4px;
  }

  .sender-item .label {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .sender-item .value {
    font-weight: 600;
    color: var(--brand-primary);
  }

  .form-section {
    background: var(--card-bg);
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    margin-bottom: 1.5rem;
  }

  .section-description {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin: 0 0 1rem 0;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  input[type="text"],
  input[type="email"],
  input[type="url"],
  input[type="tel"] {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 0.95rem;
    background: var(--input-bg);
    color: var(--text-primary);
  }

  input[type="color"] {
    height: 40px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
  }

  .color-input {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .color-input input[type="color"] {
    width: 60px;
  }

  .color-input input[type="text"] {
    flex: 1;
  }

  small {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: 500;
  }

  .checkbox-label input[type="checkbox"] {
    width: auto;
    cursor: pointer;
  }

  .test-email-row {
    display: flex;
    gap: 0.75rem;
  }

  .test-email-row input {
    flex: 1;
  }

  .btn-test {
    padding: 0.75rem 1.5rem;
    background: var(--brand-primary);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    white-space: nowrap;
    transition: all 0.2s;
  }

  .btn-test:hover:not(:disabled) {
    background: var(--brand-primary-dark);
    transform: translateY(-1px);
  }

  .btn-test:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 2rem;
  }

  .btn-primary {
    padding: 0.75rem 2rem;
    background: var(--brand-primary);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--brand-primary-dark);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
    }
    
    .test-email-row {
      flex-direction: column;
    }
  }
</style>

