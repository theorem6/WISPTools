<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { auth } from '$lib/firebase';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import GroupManagement from './components/GroupManagement.svelte';
  import BandwidthPlans from './components/BandwidthPlans.svelte';
  import HSSStats from './components/HSSStats.svelte';
  import MMEConnections from './components/MMEConnections.svelte';
  import BulkImport from './components/BulkImport.svelte';
  import RemoteEPCs from './components/RemoteEPCs.svelte';
  import DeployEPC from './components/DeployEPC.svelte';
  import { API_CONFIG } from '$lib/config/api';
  import type { Tenant } from '$lib/models/tenant';
  import HelpModal from '$lib/components/modals/HelpModal.svelte';
  import { hssSubscribersDocs } from '$lib/docs/hss-subscribers-docs';
  import SubscriberCreationWizard from '$lib/components/wizards/hss/SubscriberCreationWizard.svelte';
  import BandwidthPlanWizard from '$lib/components/wizards/hss/BandwidthPlanWizard.svelte';
  import SubscriberGroupWizard from '$lib/components/wizards/hss/SubscriberGroupWizard.svelte';
  
  type HSSManagementTab = 'dashboard' | 'groups' | 'plans' | 'mme' | 'import' | 'remote-epcs';
  
  // Use centralized API configuration
  const HSS_API = API_CONFIG.PATHS.HSS;
  
  let activeTab: HSSManagementTab = 'dashboard';
  let loading = true;
  let error = '';
  let stats: any = null;
  let groups: any[] = [];
  let bandwidthPlans: any[] = [];
  let tenantId = '';
  $: tenantId = $currentTenant?.id ?? '';
  
  // Help
  let showHelpModal = false;
  const helpContent = hssSubscribersDocs;
  // Subscriber Creation Wizard
  let showSubscriberWizard = false;
  // Bandwidth Plan Wizard
  let showBandwidthPlanWizard = false;
  // Subscriber Group Wizard
  let showGroupWizard = false;
  
  // Watch for tenant changes and reload data
  $: if (browser && tenantId) {
    console.log('[HSS Module] Tenant loaded:', tenantId);
    void refreshAll();
  }
  
  async function refreshAll(): Promise<void> {
    loading = true;
    error = '';
    try {
      if (!tenantId) {
        return;
      }
      await Promise.all([
        loadStats(),
        loadGroups(),
        loadBandwidthPlans()
      ]);
    } catch (err: any) {
      error = err?.message || 'Failed to load HSS data';
    } finally {
      loading = false;
    }
  }
  
  async function loadStats() {
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      
      const response = await fetch(`${HSS_API}/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (response.ok) {
        stats = await response.json();
      }
    } catch (err: any) {
      console.error('Error loading stats:', err);
    }
  }
  
  async function loadGroups() {
    try {
      const response = await fetch(`${HSS_API}/groups`, {
        headers: {
          'x-tenant-id': tenantId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        groups = data.groups || data || [];
      }
    } catch (err) {
      console.error('Failed to load groups:', err);
      groups = [];
    }
  }
  
  async function loadBandwidthPlans() {
    try {
      const response = await fetch(`${HSS_API}/bandwidth-plans`, {
        headers: {
          'x-tenant-id': tenantId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        bandwidthPlans = data.plans || data || [];
      }
    } catch (err) {
      console.error('Failed to load bandwidth plans:', err);
      bandwidthPlans = [];
    }
  }
  
  function switchTab(tab: HSSManagementTab) {
    activeTab = tab;
  }
  
  function handleNavigate(event: CustomEvent<{ tab: HSSManagementTab; action?: string }>) {
    const { tab, action } = event.detail;
    activeTab = tab;
    
    // Handle specific actions after tab switch
    if (action) {
      // Use setTimeout to ensure the tab has rendered
      setTimeout(() => {
        // Dispatch action to the appropriate component
        const event = new CustomEvent('quick-action', { detail: { action } });
        window.dispatchEvent(event);
      }, 100);
    }
  }
</script>

<TenantGuard>
<div class="hss-management">
  <!-- Header -->
  <div class="header">
    <div class="header-content">
      <div class="header-main">
        <div class="header-row">
          <button class="back-button" onclick={() => window.location.href = '/dashboard'}>
            ← Back to Dashboard
          </button>
          <ModuleWizardMenu
            wizards={[
              { id: 'subscriber', label: 'Add Subscriber Wizard', icon: '🧙' },
              { id: 'plan', label: 'Add Plan Wizard', icon: '📶' },
              { id: 'group', label: 'Add Group Wizard', icon: '📦' }
            ]}
            on:select={(e) => {
              if (e.detail.id === 'subscriber') showSubscriberWizard = true;
              else if (e.detail.id === 'plan') showBandwidthPlanWizard = true;
              else if (e.detail.id === 'group') showGroupWizard = true;
            }}
          />
        </div>
        <div>
          <h1>🔐 HSS & Subscriber Management</h1>
          <p class="subtitle">Home Subscriber Server - Authentication & User Management</p>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Help Button - Fixed Position -->
  <button class="help-button" onclick={() => showHelpModal = true} aria-label="Open Help" title="Help">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  </button>
  
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading HSS Management...</p>
    </div>
  {:else if error}
    <div class="error-banner">
      <strong>Error:</strong> {error}
    </div>
  {:else}
    <!-- Navigation Tabs -->
    <div class="tabs">
      <button 
        class:active={activeTab === 'dashboard'} 
        onclick={() => switchTab('dashboard')}
      >
        📊 Dashboard
      </button>
      <button 
        class:active={activeTab === 'groups'} 
        onclick={() => switchTab('groups')}
      >
        📦 Groups
      </button>
      <button 
        class:active={activeTab === 'plans'} 
        onclick={() => switchTab('plans')}
      >
        🚀 Bandwidth Plans
      </button>
      <button 
        class:active={activeTab === 'mme'} 
        onclick={() => switchTab('mme')}
      >
        🌐 MME Connections
      </button>
      <button 
        class:active={activeTab === 'import'} 
        onclick={() => switchTab('import')}
      >
        📥 Bulk Import
      </button>
      <button 
        class:active={activeTab === 'remote-epcs'} 
        onclick={() => switchTab('remote-epcs')}
      >
        🌐 Remote EPCs
      </button>
    </div>
    
    <!-- Tab Content -->
    <div class="tab-content">
      {#if activeTab === 'dashboard'}
        <HSSStats {stats} on:refresh={loadStats} on:navigate={handleNavigate} />
      {:else if activeTab === 'groups'}
        <GroupManagement {tenantId} {HSS_API} />
      {:else if activeTab === 'plans'}
        <BandwidthPlans {tenantId} {HSS_API} />
      {:else if activeTab === 'mme'}
        <MMEConnections {tenantId} {HSS_API} />
      {:else if activeTab === 'import'}
        <BulkImport {tenantId} {HSS_API} on:imported={loadStats} />
      {:else if activeTab === 'remote-epcs'}
        <RemoteEPCs {tenantId} {HSS_API} />
      {/if}
    </div>
  {/if}
  
  <!-- Help Modal -->
  <HelpModal 
    show={showHelpModal}
    title="HSS & Subscriber Management Help"
    content={helpContent}
    on:close={() => showHelpModal = false}
  />

  <!-- Subscriber Creation Wizard -->
  <SubscriberCreationWizard
    show={showSubscriberWizard}
    on:close={() => {
      showSubscriberWizard = false;
      refreshAll();
    }}
  />
  <BandwidthPlanWizard
    show={showBandwidthPlanWizard}
    on:close={() => {
      showBandwidthPlanWizard = false;
      refreshAll();
    }}
    on:saved={() => {
      refreshAll();
    }}
  />
  <SubscriberGroupWizard
    show={showGroupWizard}
    on:close={() => {
      showGroupWizard = false;
      refreshAll();
    }}
    on:saved={() => {
      refreshAll();
    }}
  />
</div>
</TenantGuard>

<style>
  .hss-management {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .back-button {
    background: none;
    border: 1px solid var(--border-color);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 1rem;
    transition: all 0.2s;
  }

  .back-button:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--brand-primary);
  }
  
  /* Help Button */
  .help-button {
    position: fixed;
    bottom: 2rem;
    left: 2rem;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
    z-index: 999;
  }
  
  .help-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5), 0 4px 8px rgba(0, 0, 0, 0.15);
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  }
  
  .help-button:active {
    transform: translateY(0);
  }
  
  .help-button svg {
    width: 24px;
    height: 24px;
    stroke: white;
    fill: none;
    stroke-width: 2.5;
  }

  .header-main {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .header-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .wizard-header-btn {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .wizard-header-btn:hover {
    background: var(--hover-bg);
    border-color: var(--brand-primary);
  }
  
  .header {
    margin-bottom: 2rem;
  }
  
  .header-content h1 {
    margin: 0;
    font-size: 2rem;
    color: var(--text-primary);
  }
  
  .subtitle {
    margin: 0.5rem 0 0 0;
    color: var(--text-secondary);
    font-size: 1rem;
  }
  
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    gap: 1rem;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color);
    border-top: 4px solid var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .error-banner {
    background: #fee;
    border: 1px solid #fcc;
    padding: 1rem;
    border-radius: 8px;
    color: #c00;
    margin-bottom: 1rem;
  }
  
  .tabs {
    display: flex;
    gap: 0.5rem;
    border-bottom: 2px solid var(--border-color);
    margin-bottom: 2rem;
    overflow-x: auto;
  }
  
  .tabs button {
    padding: 0.75rem 1.5rem;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    cursor: pointer;
    font-size: 1rem;
    color: var(--text-secondary);
    transition: all 0.2s;
    white-space: nowrap;
  }
  
  .tabs button:hover {
    color: var(--primary);
    background: var(--hover-bg);
  }
  
  .tabs button.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
    font-weight: 600;
  }
  
  .tab-content {
    animation: fadeIn 0.3s;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @media (max-width: 768px) {
    .hss-management {
      padding: 1rem;
    }
    
    .header-content h1 {
      font-size: 1.5rem;
    }
    
    .tabs {
      padding-bottom: 0.5rem;
    }
    
    .tabs button {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
    }
  }
</style>