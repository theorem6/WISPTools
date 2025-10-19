<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { db } from '$lib/firebase';
  import { doc, getDoc, updateDoc } from 'firebase/firestore';
  
  let tenantId = '';
  let tenantData: any = null;
  let isLoading = true;
  let isSaving = false;
  let error = '';
  let success = '';
  
  // Module configuration
  let enabledModules = {
    pciResolution: true,
    cbrsManagement: true,
    acsManagement: true,
    hssManagement: true,
    coverageMap: true,
    inventory: true,
    distributedEpc: false,
    monitoring: true,
    backendManagement: false
  };
  
  let moduleLimits = {
    maxSites: 10,
    maxSubscribers: 1000,
    maxCPEs: 500,
    maxUsers: 5,
    maxInventoryItems: 1000
  };
  
  let subscriptionTier = 'basic';
  
  let features = {
    advancedReporting: false,
    apiAccess: false,
    whiteLabel: false,
    customIntegrations: false,
    prioritySupport: false
  };
  
  const tiers = [
    { value: 'free', label: 'Free' },
    { value: 'basic', label: 'Basic' },
    { value: 'professional', label: 'Professional' },
    { value: 'enterprise', label: 'Enterprise' },
    { value: 'custom', label: 'Custom' }
  ];
  
  onMount(async () => {
    tenantId = $page.params.tenantId;
    await loadTenantData();
  });
  
  async function loadTenantData() {
    isLoading = true;
    error = '';
    
    try {
      const tenantRef = doc(db, 'tenants', tenantId);
      const tenantSnap = await getDoc(tenantRef);
      
      if (!tenantSnap.exists()) {
        error = 'Tenant not found';
        return;
      }
      
      tenantData = tenantSnap.data();
      
      // Load existing config or use defaults
      if (tenantData.config) {
        enabledModules = { ...enabledModules, ...tenantData.config.enabledModules };
        moduleLimits = { ...moduleLimits, ...tenantData.config.moduleLimits };
        subscriptionTier = tenantData.config.subscriptionTier || 'basic';
        features = { ...features, ...tenantData.config.features };
      }
    } catch (err: any) {
      error = err.message || 'Failed to load tenant data';
    } finally {
      isLoading = false;
    }
  }
  
  async function handleSave() {
    isSaving = true;
    error = '';
    success = '';
    
    try {
      const tenantRef = doc(db, 'tenants', tenantId);
      
      await updateDoc(tenantRef, {
        'config.enabledModules': enabledModules,
        'config.moduleLimits': moduleLimits,
        'config.subscriptionTier': subscriptionTier,
        'config.features': features,
        'config.updatedAt': new Date(),
        'config.updatedBy': 'admin'
      });
      
      success = 'Module configuration saved successfully!';
      setTimeout(() => success = '', 5000);
    } catch (err: any) {
      error = err.message || 'Failed to save configuration';
    } finally {
      isSaving = false;
    }
  }
  
  function applyTierDefaults() {
    // Apply tier-specific defaults
    const tierDefaults: Record<string, any> = {
      free: {
        modules: { pciResolution: true, acsManagement: true, coverageMap: true, inventory: true },
        limits: { maxSites: 3, maxSubscribers: 100, maxCPEs: 50, maxUsers: 1, maxInventoryItems: 100 },
        features: {}
      },
      basic: {
        modules: { pciResolution: true, cbrsManagement: true, acsManagement: true, hssManagement: true, coverageMap: true, inventory: true, monitoring: true },
        limits: { maxSites: 10, maxSubscribers: 1000, maxCPEs: 500, maxUsers: 5, maxInventoryItems: 1000 },
        features: {}
      },
      professional: {
        modules: { pciResolution: true, cbrsManagement: true, acsManagement: true, hssManagement: true, coverageMap: true, inventory: true, distributedEpc: true, monitoring: true },
        limits: { maxSites: 50, maxSubscribers: 10000, maxCPEs: 5000, maxUsers: 20, maxInventoryItems: 10000 },
        features: { advancedReporting: true, apiAccess: true, prioritySupport: true }
      },
      enterprise: {
        modules: { pciResolution: true, cbrsManagement: true, acsManagement: true, hssManagement: true, coverageMap: true, inventory: true, distributedEpc: true, monitoring: true },
        limits: { maxSites: 999999, maxSubscribers: 999999, maxCPEs: 999999, maxUsers: 999999, maxInventoryItems: 999999 },
        features: { advancedReporting: true, apiAccess: true, whiteLabel: true, customIntegrations: true, prioritySupport: true }
      }
    };
    
    const defaults = tierDefaults[subscriptionTier];
    if (defaults) {
      // Reset all to false first
      Object.keys(enabledModules).forEach(key => {
        enabledModules[key as keyof typeof enabledModules] = false;
      });
      // Apply tier defaults
      Object.assign(enabledModules, defaults.modules);
      Object.assign(moduleLimits, defaults.limits);
      Object.keys(features).forEach(key => {
        features[key as keyof typeof features] = false;
      });
      Object.assign(features, defaults.features);
    }
  }
</script>

<div class="admin-page">
  <div class="page-header">
    <button class="back-button" on:click={() => goto('/admin/tenants')}>
      ← Back to Tenants
    </button>
    <h1>Module Configuration</h1>
    {#if tenantData}
      <p class="subtitle">
        {tenantData.displayName || tenantData.name} ({tenantId})
      </p>
    {/if}
  </div>
  
  {#if error}
    <div class="alert alert-error">
      ⚠️ {error}
      <button class="dismiss-btn" on:click={() => error = ''}>✕</button>
    </div>
  {/if}
  
  {#if success}
    <div class="alert alert-success">
      ✅ {success}
      <button class="dismiss-btn" on:click={() => success = ''}>✕</button>
    </div>
  {/if}
  
  {#if isLoading}
    <div class="loading">Loading...</div>
  {:else if tenantData}
    <div class="config-container">
      
      <!-- Subscription Tier -->
      <div class="section">
        <h2>📋 Subscription Tier</h2>
        <div class="tier-selector">
          <select bind:value={subscriptionTier} on:change={applyTierDefaults}>
            {#each tiers as tier}
              <option value={tier.value}>{tier.label}</option>
            {/each}
          </select>
          <button class="btn-secondary" on:click={applyTierDefaults}>
            Apply Tier Defaults
          </button>
        </div>
      </div>
      
      <!-- Enabled Modules -->
      <div class="section">
        <h2>🎛️ Enabled Modules</h2>
        <div class="module-toggles">
          <label class="toggle-item">
            <input type="checkbox" bind:checked={enabledModules.pciResolution} />
            <span class="toggle-label">
              <span class="toggle-icon">📊</span>
              <span>PCI Resolution & Network Optimization</span>
            </span>
          </label>
          
          <label class="toggle-item">
            <input type="checkbox" bind:checked={enabledModules.cbrsManagement} />
            <span class="toggle-label">
              <span class="toggle-icon">📡</span>
              <span>CBRS Management</span>
            </span>
          </label>
          
          <label class="toggle-item">
            <input type="checkbox" bind:checked={enabledModules.acsManagement} />
            <span class="toggle-label">
              <span class="toggle-icon">📡</span>
              <span>ACS CPE Management</span>
            </span>
          </label>
          
          <label class="toggle-item">
            <input type="checkbox" bind:checked={enabledModules.hssManagement} />
            <span class="toggle-label">
              <span class="toggle-icon">🔐</span>
              <span>HSS & Subscriber Management</span>
            </span>
          </label>
          
          <label class="toggle-item">
            <input type="checkbox" bind:checked={enabledModules.coverageMap} />
            <span class="toggle-label">
              <span class="toggle-icon">🗺️</span>
              <span>Coverage Map</span>
            </span>
          </label>
          
          <label class="toggle-item">
            <input type="checkbox" bind:checked={enabledModules.inventory} />
            <span class="toggle-label">
              <span class="toggle-icon">📦</span>
              <span>Inventory Management</span>
            </span>
          </label>
          
          <label class="toggle-item">
            <input type="checkbox" bind:checked={enabledModules.distributedEpc} />
            <span class="toggle-label">
              <span class="toggle-icon">🌐</span>
              <span>Distributed EPC (Advanced)</span>
            </span>
          </label>
          
          <label class="toggle-item">
            <input type="checkbox" bind:checked={enabledModules.monitoring} />
            <span class="toggle-label">
              <span class="toggle-icon">🔍</span>
              <span>Monitoring & Alerts</span>
            </span>
          </label>
        </div>
      </div>
      
      <!-- Usage Limits -->
      <div class="section">
        <h2>📊 Usage Limits</h2>
        <div class="limits-grid">
          <div class="limit-item">
            <label>Max Tower Sites</label>
            <input type="number" bind:value={moduleLimits.maxSites} min="0" />
          </div>
          
          <div class="limit-item">
            <label>Max Subscribers</label>
            <input type="number" bind:value={moduleLimits.maxSubscribers} min="0" />
          </div>
          
          <div class="limit-item">
            <label>Max CPE Devices</label>
            <input type="number" bind:value={moduleLimits.maxCPEs} min="0" />
          </div>
          
          <div class="limit-item">
            <label>Max Users</label>
            <input type="number" bind:value={moduleLimits.maxUsers} min="1" />
          </div>
          
          <div class="limit-item">
            <label>Max Inventory Items</label>
            <input type="number" bind:value={moduleLimits.maxInventoryItems} min="0" />
          </div>
        </div>
        <p class="help-text">Set to 999999 for unlimited</p>
      </div>
      
      <!-- Feature Flags -->
      <div class="section">
        <h2>⭐ Feature Flags</h2>
        <div class="feature-toggles">
          <label class="toggle-item">
            <input type="checkbox" bind:checked={features.advancedReporting} />
            <span class="toggle-label">
              <span>Advanced Reporting</span>
            </span>
          </label>
          
          <label class="toggle-item">
            <input type="checkbox" bind:checked={features.apiAccess} />
            <span class="toggle-label">
              <span>API Access</span>
            </span>
          </label>
          
          <label class="toggle-item">
            <input type="checkbox" bind:checked={features.whiteLabel} />
            <span class="toggle-label">
              <span>White Label</span>
            </span>
          </label>
          
          <label class="toggle-item">
            <input type="checkbox" bind:checked={features.customIntegrations} />
            <span class="toggle-label">
              <span>Custom Integrations</span>
            </span>
          </label>
          
          <label class="toggle-item">
            <input type="checkbox" bind:checked={features.prioritySupport} />
            <span class="toggle-label">
              <span>Priority Support</span>
            </span>
          </label>
        </div>
      </div>
      
      <!-- Save Button -->
      <div class="actions">
        <button class="btn-secondary" on:click={() => goto('/admin/tenants')}>
          Cancel
        </button>
        <button class="btn-primary" on:click={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : '💾 Save Configuration'}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .admin-page {
    min-height: 100vh;
    background: var(--bg-primary);
    padding: 2rem;
  }
  
  .page-header {
    margin-bottom: 2rem;
  }
  
  .back-button {
    background: none;
    border: 1px solid var(--border-color);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    margin-bottom: 1rem;
    color: var(--text-secondary);
  }
  
  .back-button:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }
  
  .subtitle {
    color: var(--text-secondary);
  }
  
  .alert {
    padding: 1rem 1.5rem;
    border-radius: 6px;
    margin-bottom: 1.5rem;
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
  
  .dismiss-btn {
    margin-left: auto;
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: inherit;
  }
  
  .loading {
    text-align: center;
    padding: 4rem;
  }
  
  .config-container {
    max-width: 1200px;
  }
  
  .section {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 2rem;
    margin-bottom: 2rem;
  }
  
  .section h2 {
    margin: 0 0 1.5rem 0;
    font-size: 1.25rem;
  }
  
  .tier-selector {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  
  .tier-selector select {
    flex: 1;
    max-width: 300px;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
  }
  
  .module-toggles,
  .feature-toggles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }
  
  .toggle-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .toggle-item:hover {
    background: var(--bg-hover);
  }
  
  .toggle-item input[type="checkbox"] {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }
  
  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }
  
  .toggle-icon {
    font-size: 1.5rem;
  }
  
  .limits-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
  
  .limit-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .limit-item label {
    font-weight: 500;
    font-size: 0.9rem;
  }
  
  .limit-item input {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  
  .help-text {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.5rem;
  }
  
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 2rem;
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
  }
  
  .btn-primary {
    background: var(--brand-primary);
    color: white;
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
</style>

