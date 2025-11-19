<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { authService } from '$lib/services/authService';
  
  export let show = false;
  
  const dispatch = createEventDispatcher();
  
  import ImportSystem from './ImportSystem.svelte';
  
  let activeTab: 'appearance' | 'acs' | 'info' | 'import' = 'appearance';
  let showImportSystem = false;
  let loading = false;
  let saveSuccess = false;
  let saveError = '';
  
  // Appearance settings
  let theme: 'light' | 'dark' | 'system' = 'system';
  
  // ACS credentials
  let acsSettings = {
    username: '',
    password: '',
    url: ''
  };
  
  // Company info
  let companyInfo = {
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    email: ''
  };
  
  onMount(() => {
    loadSettings();
  });
  
  function loadSettings() {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system';
    if (savedTheme) {
      theme = savedTheme;
    }
    
    // Load ACS settings from localStorage (temporary - should be from backend)
    const savedACS = localStorage.getItem('acs_settings');
    if (savedACS) {
      try {
        acsSettings = JSON.parse(savedACS);
      } catch (e) {
        console.error('Failed to parse ACS settings:', e);
      }
    }
    
    // Load company info from localStorage (temporary - should be from backend)
    const savedCompany = localStorage.getItem('company_info');
    if (savedCompany) {
      try {
        companyInfo = JSON.parse(savedCompany);
      } catch (e) {
        console.error('Failed to parse company info:', e);
      }
    }
  }
  
  function applyTheme(newTheme: 'light' | 'dark' | 'system') {
    theme = newTheme;
    localStorage.setItem('theme', newTheme);
    
    if (newTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
    
    saveSuccess = true;
    setTimeout(() => saveSuccess = false, 2000);
  }
  
  async function saveACSSettings() {
    loading = true;
    saveError = '';
    
    try {
      // TODO: Save to backend when API is ready
      localStorage.setItem('acs_settings', JSON.stringify(acsSettings));
      
      saveSuccess = true;
      setTimeout(() => saveSuccess = false, 2000);
    } catch (error: any) {
      console.error('Failed to save ACS settings:', error);
      saveError = error.message || 'Failed to save ACS settings';
    } finally {
      loading = false;
    }
  }
  
  async function saveCompanyInfo() {
    loading = true;
    saveError = '';
    
    try {
      // TODO: Save to backend when API is ready
      localStorage.setItem('company_info', JSON.stringify(companyInfo));
      
      saveSuccess = true;
      setTimeout(() => saveSuccess = false, 2000);
    } catch (error: any) {
      console.error('Failed to save company info:', error);
      saveError = error.message || 'Failed to save company info';
    } finally {
      loading = false;
    }
  }
  
  function handleClose() {
    show = false;
    activeTab = 'appearance';
    saveSuccess = false;
    saveError = '';
    dispatch('close');
  }
</script>

{#if show}
  <div class="settings-overlay" on:click={handleClose}>
    <div class="settings-panel" on:click|stopPropagation>
      <div class="settings-header">
        <h2>⚙️ Settings</h2>
        <button class="close-btn" on:click={handleClose}>✕</button>
      </div>
      
      <div class="settings-tabs">
        <button 
          class="tab" 
          class:active={activeTab === 'appearance'}
          on:click={() => activeTab = 'appearance'}
        >
          🎨 Appearance
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'acs'}
          on:click={() => activeTab = 'acs'}
        >
          🔐 ACS Credentials
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'info'}
          on:click={() => activeTab = 'info'}
        >
          ℹ️ Company Info
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'import'}
          on:click={() => { activeTab = 'import'; showImportSystem = true; }}
        >
          📥 Import Data
        </button>
      </div>
      
      <div class="settings-content">
        {#if activeTab === 'appearance'}
          <div class="tab-content">
            <h3>Theme</h3>
            <p class="description">Choose your preferred color scheme</p>
            
            <div class="theme-options">
              <button 
                class="theme-option" 
                class:active={theme === 'light'}
                on:click={() => applyTheme('light')}
              >
                <span class="icon">☀️</span>
                <span class="label">Light</span>
              </button>
              
              <button 
                class="theme-option" 
                class:active={theme === 'dark'}
                on:click={() => applyTheme('dark')}
              >
                <span class="icon">🌙</span>
                <span class="label">Dark</span>
              </button>
              
              <button 
                class="theme-option" 
                class:active={theme === 'system'}
                on:click={() => applyTheme('system')}
              >
                <span class="icon">💻</span>
                <span class="label">System</span>
              </button>
            </div>
          </div>
        {:else if activeTab === 'acs'}
          <div class="tab-content">
            <h3>ACS Credentials</h3>
            <p class="description">Configure your ACS (GenieACS) connection</p>
            
            <div class="form-group">
              <label>ACS URL</label>
              <input 
                type="url" 
                bind:value={acsSettings.url}
                placeholder="https://acs.example.com"
              />
            </div>
            
            <div class="form-group">
              <label>Username</label>
              <input 
                type="text" 
                bind:value={acsSettings.username}
                placeholder="admin"
              />
            </div>
            
            <div class="form-group">
              <label>Password</label>
              <input 
                type="password" 
                bind:value={acsSettings.password}
                placeholder="••••••••"
              />
            </div>
            
            <button class="btn-save" on:click={saveACSSettings} disabled={loading}>
              {loading ? 'Saving...' : 'Save ACS Settings'}
            </button>
          </div>
        {:else if activeTab === 'info'}
          <div class="tab-content">
            <h3>Company Information</h3>
            <p class="description">Your company details for reports and documentation</p>
            
            <div class="form-group">
              <label>Company Name</label>
              <input 
                type="text" 
                bind:value={companyInfo.name}
                placeholder="ACME Networks Inc."
              />
            </div>
            
            <div class="form-group">
              <label>Street Address</label>
              <input 
                type="text" 
                bind:value={companyInfo.address}
                placeholder="123 Main Street"
              />
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>City</label>
                <input 
                  type="text" 
                  bind:value={companyInfo.city}
                  placeholder="New York"
                />
              </div>
              
              <div class="form-group">
                <label>State</label>
                <input 
                  type="text" 
                  bind:value={companyInfo.state}
                  placeholder="NY"
                  maxlength="2"
                />
              </div>
              
              <div class="form-group">
                <label>ZIP Code</label>
                <input 
                  type="text" 
                  bind:value={companyInfo.zip}
                  placeholder="10001"
                  maxlength="10"
                />
              </div>
            </div>
            
            <div class="form-group">
              <label>Phone</label>
              <input 
                type="tel" 
                bind:value={companyInfo.phone}
                placeholder="(555) 123-4567"
              />
            </div>
            
            <div class="form-group">
              <label>Email</label>
              <input 
                type="email" 
                bind:value={companyInfo.email}
                placeholder="contact@company.com"
              />
            </div>
            
            <button class="btn-save" on:click={saveCompanyInfo} disabled={loading}>
              {loading ? 'Saving...' : 'Save Company Info'}
            </button>
          </div>
        {:else if activeTab === 'import'}
          <div class="tab-content">
            <h3>Data Import</h3>
            <p class="description">Import data from CSV files for all database objects (except ACS items)</p>
            
            <div class="import-info">
              <p>Use the import system to bulk import:</p>
              <ul>
                <li>📦 Inventory Items</li>
                <li>👥 Customers</li>
                <li>🗺️ Plans/Projects</li>
                <li>🏗️ Sites/Towers</li>
                <li>📡 Network Equipment</li>
                <li>📋 Work Orders</li>
                <li>👤 Users</li>
                <li>📚 Hardware Bundles</li>
              </ul>
            </div>
            
            <button class="btn-save" on:click={() => { showImportSystem = true; }}>
              📥 Open Import System
            </button>
          </div>
        {/if}
        
        {#if saveSuccess}
          <div class="success-message">
            ✅ Settings saved successfully!
          </div>
        {/if}
        
        {#if saveError}
          <div class="error-message">
            ❌ {saveError}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Import System Modal -->
{#if showImportSystem}
  <ImportSystem 
    show={showImportSystem}
    on:close={() => { showImportSystem = false; }}
  />
{/if}

<style>
  .settings-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  }
  
  .settings-panel {
    background: var(--card-bg, white);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    background: var(--bg-secondary, #f8f9fa);
  }
  
  .settings-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text-primary, #1a202c);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary, #718096);
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    transition: all 0.2s;
  }
  
  .close-btn:hover {
    background: var(--bg-hover, #e2e8f0);
    color: var(--text-primary, #1a202c);
  }
  
  .settings-tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    background: var(--bg-secondary, #f8f9fa);
  }
  
  .tab {
    flex: 1;
    padding: 1rem;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 0.95rem;
    color: var(--text-secondary, #718096);
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }
  
  .tab:hover {
    background: var(--bg-hover, #e2e8f0);
  }
  
  .tab.active {
    color: var(--primary, #3b82f6);
    border-bottom-color: var(--primary, #3b82f6);
    background: var(--card-bg, white);
  }
  
  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 2rem;
  }
  
  .tab-content h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    color: var(--text-primary, #1a202c);
  }
  
  .description {
    margin: 0 0 1.5rem 0;
    color: var(--text-secondary, #718096);
    font-size: 0.9rem;
  }
  
  .theme-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }
  
  .theme-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1.5rem 1rem;
    border: 2px solid var(--border-color, #e0e0e0);
    border-radius: 8px;
    background: var(--card-bg, white);
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .theme-option:hover {
    border-color: var(--primary, #3b82f6);
    transform: translateY(-2px);
  }
  
  .theme-option.active {
    border-color: var(--primary, #3b82f6);
    background: var(--primary-light, #eff6ff);
  }
  
  .theme-option .icon {
    font-size: 2rem;
  }
  
  .theme-option .label {
    font-size: 0.9rem;
    color: var(--text-primary, #1a202c);
    font-weight: 500;
  }
  
  .form-group {
    margin-bottom: 1.25rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary, #1a202c);
    font-size: 0.9rem;
  }
  
  .form-group input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    font-size: 0.95rem;
    background: var(--input-bg, white);
    color: var(--text-primary, #1a202c);
    transition: border-color 0.2s;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: var(--primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 1rem;
  }
  
  .btn-save {
    width: 100%;
    padding: 0.875rem;
    background: var(--primary, #3b82f6);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 1rem;
  }
  
  .btn-save:hover:not(:disabled) {
    background: var(--primary-dark, #2563eb);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }
  
  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .success-message {
    margin-top: 1rem;
    padding: 1rem;
    background: #d1fae5;
    border: 1px solid #6ee7b7;
    border-radius: 6px;
    color: #065f46;
    font-size: 0.9rem;
  }
  
  .error-message {
    margin-top: 1rem;
    padding: 1rem;
    background: #fee2e2;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    color: #991b1b;
    font-size: 0.9rem;
  }
  
  .import-info {
    margin-bottom: 1.5rem;
    padding: 1.5rem;
    background: var(--bg-secondary, #f8f9fa);
    border-radius: 8px;
    border: 1px solid var(--border-color, #e0e0e0);
  }
  
  .import-info p {
    margin: 0 0 1rem;
    color: var(--text-primary, #1a202c);
    font-weight: 500;
  }
  
  .import-info ul {
    margin: 0;
    padding-left: 1.5rem;
    list-style: none;
  }
  
  .import-info li {
    margin-bottom: 0.5rem;
    color: var(--text-secondary, #718096);
    font-size: 0.9rem;
  }
</style>

