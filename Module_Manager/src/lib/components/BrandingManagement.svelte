<script lang="ts">
  import { onMount } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { brandingService, type TenantBranding } from '$lib/services/brandingService';
  
  let branding: TenantBranding | null = null;
  let loading = false;
  let saving = false;
  let error = '';
  let success = '';
  
  // Form data
  let logoUrl = '';
  let logoAltText = '';
  let primaryColor = '#3b82f6';
  let secondaryColor = '#64748b';
  let accentColor = '#10b981';
  let supportEmail = '';
  let supportPhone = '';
  let supportHours = 'Mon-Fri 8am-5pm';
  let welcomeMessage = '';
  let footerText = '';
  
  onMount(async () => {
    await loadBranding();
  });
  
  async function loadBranding() {
    if (!$currentTenant) return;
    
    loading = true;
    try {
      branding = await brandingService.getTenantBranding($currentTenant.id);
      
      // Populate form
      logoUrl = branding.logo?.url || '';
      logoAltText = branding.logo?.altText || '';
      primaryColor = branding.colors?.primary || '#3b82f6';
      secondaryColor = branding.colors?.secondary || '#64748b';
      accentColor = branding.colors?.accent || '#10b981';
      supportEmail = branding.company?.supportEmail || '';
      supportPhone = branding.company?.supportPhone || '';
      supportHours = branding.company?.supportHours || 'Mon-Fri 8am-5pm';
      welcomeMessage = branding.portal?.welcomeMessage || '';
      footerText = branding.portal?.footerText || '';
    } catch (err: any) {
      error = err.message || 'Failed to load branding';
    } finally {
      loading = false;
    }
  }
  
  async function saveBranding() {
    if (!$currentTenant) return;
    
    saving = true;
    error = '';
    success = '';
    
    try {
      await brandingService.updateTenantBranding($currentTenant.id, {
        logo: {
          url: logoUrl,
          altText: logoAltText
        },
        colors: {
          primary: primaryColor,
          secondary: secondaryColor,
          accent: accentColor
        },
        company: {
          supportEmail,
          supportPhone,
          supportHours
        },
        portal: {
          welcomeMessage,
          footerText
        }
      });
      
      success = 'Branding saved successfully!';
      setTimeout(() => success = '', 3000);
      
      // Reload to get updated branding
      await loadBranding();
    } catch (err: any) {
      error = err.message || 'Failed to save branding';
    } finally {
      saving = false;
    }
  }
</script>

<div class="branding-management">
  {#if loading}
    <div class="loading">Loading branding settings...</div>
  {:else}
    <div class="branding-form">
      <h3>Customer Portal Branding</h3>
      <p class="description">Customize your customer portal appearance and messaging</p>
      
      {#if error}
        <div class="alert alert-error">{error}</div>
      {/if}
      
      {#if success}
        <div class="alert alert-success">{success}</div>
      {/if}
      
      <div class="form-section">
        <h4>Logo</h4>
        <div class="form-group">
          <label>Logo URL</label>
          <input 
            type="url" 
            bind:value={logoUrl}
            placeholder="https://example.com/logo.png"
          />
          <small>Enter the full URL to your logo image</small>
        </div>
        
        <div class="form-group">
          <label>Logo Alt Text</label>
          <input 
            type="text" 
            bind:value={logoAltText}
            placeholder="Company Logo"
          />
        </div>
      </div>
      
      <div class="form-section">
        <h4>Colors</h4>
        <div class="form-group">
          <label>Primary Color</label>
          <div class="color-input-group">
            <input 
              type="color" 
              bind:value={primaryColor}
            />
            <input 
              type="text" 
              bind:value={primaryColor}
              placeholder="#3b82f6"
            />
          </div>
        </div>
        
        <div class="form-group">
          <label>Secondary Color</label>
          <div class="color-input-group">
            <input 
              type="color" 
              bind:value={secondaryColor}
            />
            <input 
              type="text" 
              bind:value={secondaryColor}
              placeholder="#64748b"
            />
          </div>
        </div>
        
        <div class="form-group">
          <label>Accent Color</label>
          <div class="color-input-group">
            <input 
              type="color" 
              bind:value={accentColor}
            />
            <input 
              type="text" 
              bind:value={accentColor}
              placeholder="#10b981"
            />
          </div>
        </div>
      </div>
      
      <div class="form-section">
        <h4>Support Information</h4>
        <div class="form-group">
          <label>Support Email</label>
          <input 
            type="email" 
            bind:value={supportEmail}
            placeholder="support@example.com"
          />
        </div>
        
        <div class="form-group">
          <label>Support Phone</label>
          <input 
            type="tel" 
            bind:value={supportPhone}
            placeholder="(555) 123-4567"
          />
        </div>
        
        <div class="form-group">
          <label>Support Hours</label>
          <input 
            type="text" 
            bind:value={supportHours}
            placeholder="Mon-Fri 8am-5pm"
          />
        </div>
      </div>
      
      <div class="form-section">
        <h4>Portal Messages</h4>
        <div class="form-group">
          <label>Welcome Message</label>
          <input 
            type="text" 
            bind:value={welcomeMessage}
            placeholder="Welcome to our Customer Portal"
          />
        </div>
        
        <div class="form-group">
          <label>Footer Text</label>
          <textarea 
            bind:value={footerText}
            placeholder="Copyright © 2024 Company Name"
            rows="3"
          ></textarea>
        </div>
      </div>
      
      <button class="btn-save" on:click={saveBranding} disabled={saving}>
        {saving ? 'Saving...' : 'Save Branding'}
      </button>
    </div>
  {/if}
</div>

<style>
  .branding-management {
    padding: 1rem 0;
  }
  
  .branding-form h3 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: var(--text-primary, #111827);
  }
  
  .description {
    color: var(--text-secondary, #6b7280);
    margin-bottom: 1.5rem;
    font-size: 0.875rem;
  }
  
  .form-section {
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .form-section:last-of-type {
    border-bottom: none;
  }
  
  .form-section h4 {
    font-size: 1.125rem;
    margin-bottom: 1rem;
    color: var(--text-primary, #111827);
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary, #111827);
  }
  
  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 1rem;
  }
  
  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .form-group small {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
  }
  
  .color-input-group {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  
  .color-input-group input[type="color"] {
    width: 60px;
    height: 40px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    cursor: pointer;
  }
  
  .color-input-group input[type="text"] {
    flex: 1;
  }
  
  .btn-save {
    background: var(--primary, #3b82f6);
    color: white;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .btn-save:hover:not(:disabled) {
    background: var(--primary-dark, #2563eb);
  }
  
  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .alert {
    padding: 0.75rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }
  
  .alert-error {
    background: #fee2e2;
    color: #dc2626;
  }
  
  .alert-success {
    background: #d1fae5;
    color: #065f46;
  }
  
  .loading {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary, #6b7280);
  }
</style>

