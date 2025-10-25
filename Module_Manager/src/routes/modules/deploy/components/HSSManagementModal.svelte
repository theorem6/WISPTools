<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { authService } from '$lib/services/authService';
  import SubscriberList from '../../hss-management/components/SubscriberList.svelte';
  import GroupManagement from '../../hss-management/components/GroupManagement.svelte';
  import BandwidthPlans from '../../hss-management/components/BandwidthPlans.svelte';
  import BulkImport from '../../hss-management/components/BulkImport.svelte';
  import RemoteEPCs from '../../hss-management/components/RemoteEPCs.svelte';
  import HSSStats from '../../hss-management/components/HSSStats.svelte';
  import MMEConnections from '../../hss-management/components/MMEConnections.svelte';
  import EPCDeploymentModal from './EPCDeploymentModal.svelte';

  export let show = false;
  export let tenantId: string;

  const dispatch = createEventDispatcher();

  let activeTab: 'dashboard' | 'subscribers' | 'groups' | 'plans' | 'epcs' | 'import' | 'connections' = 'dashboard';
  let stats: any = null;
  let groups: any[] = [];
  let bandwidthPlans: any[] = [];
  let loading = true;
  let error = '';
  let showEPCDeploymentModal = false;

  // HSS API endpoint
  const HSS_API = import.meta.env.VITE_HSS_API_URL || 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/api/hss';

  // Reactive statement to load data when modal opens
  $: if (show && tenantId) {
    console.log('[HSSManagement] Modal opened with tenant:', tenantId);
    loadInitialData();
  }

  onMount(() => {
    console.log('[HSSManagement] Component mounted');
  });

  onDestroy(() => {
    console.log('[HSSManagement] Component destroyed');
  });

  async function loadInitialData() {
    if (!tenantId || tenantId.trim() === '') {
      console.warn('[HSSManagement] No tenant ID provided');
      error = 'No tenant selected';
      loading = false;
      return;
    }

    loading = true;
    error = '';

    try {
      console.log(`[HSSManagement] Loading HSS data for tenant: ${tenantId}`);
      await Promise.all([
        loadStats(),
        loadGroups(),
        loadBandwidthPlans()
      ]);
      console.log('[HSSManagement] HSS data loaded successfully');
    } catch (err: any) {
      console.error('[HSSManagement] Failed to load initial data:', err);
      error = `Failed to load HSS data: ${err.message || 'Unknown error'}`;
    } finally {
      loading = false;
    }
  }

  async function loadStats() {
    try {
      console.log('[HSSManagement] Loading stats...');
      const response = await fetch(`${HSS_API}/dashboard/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn('[HSSManagement] Stats endpoint not available (404), using empty stats');
          stats = null;
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      stats = await response.json();
      console.log('[HSSManagement] Stats loaded:', stats);
    } catch (err: any) {
      console.error('[HSSManagement] Failed to load stats:', err);
      // Don't throw - allow modal to continue loading other data
      stats = null;
    }
  }

  async function loadGroups() {
    try {
      console.log('[HSSManagement] Loading groups...');
      const response = await fetch(`${HSS_API}/groups`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      groups = await response.json();
      console.log('[HSSManagement] Groups loaded:', groups.length);
    } catch (err: any) {
      console.error('[HSSManagement] Failed to load groups:', err);
      throw err;
    }
  }

  async function loadBandwidthPlans() {
    try {
      console.log('[HSSManagement] Loading bandwidth plans...');
      const response = await fetch(`${HSS_API}/bandwidth-plans`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      bandwidthPlans = await response.json();
      console.log('[HSSManagement] Bandwidth plans loaded:', bandwidthPlans.length);
    } catch (err: any) {
      console.error('[HSSManagement] Failed to load bandwidth plans:', err);
      throw err;
    }
  }

  async function getAuthToken(): Promise<string> {
    const token = await authService.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    return token;
  }

  function handleClose() {
    show = false;
    error = '';
    activeTab = 'dashboard';
    dispatch('close');
  }

  function refreshData() {
    loadInitialData();
  }

  function openEPCDeploymentModal() {
    showEPCDeploymentModal = true;
  }

  function closeEPCDeploymentModal() {
    showEPCDeploymentModal = false;
  }

  function getTabIcon(tab: string): string {
    switch (tab) {
      case 'dashboard': return '📊';
      case 'subscribers': return '👥';
      case 'groups': return '📦';
      case 'plans': return '🚀';
      case 'epcs': return '🏗️';
      case 'import': return '📥';
      case 'connections': return '🌐';
      default: return '📋';
    }
  }

  function getTabTitle(tab: string): string {
    switch (tab) {
      case 'dashboard': return 'Dashboard';
      case 'subscribers': return 'Subscribers';
      case 'groups': return 'Groups';
      case 'plans': return 'Bandwidth Plans';
      case 'epcs': return 'EPC Management';
      case 'import': return 'Bulk Import';
      case 'connections': return 'MME Connections';
      default: return 'Unknown';
    }
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={handleClose}>
    <div class="modal-content hss-management-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>🏠 HSS Management</h2>
        <div class="header-actions">
          <button class="refresh-btn" on:click={refreshData} title="Refresh Data">
            🔄
          </button>
          <button class="close-btn" on:click={handleClose}>✕</button>
        </div>
      </div>

      {#if error}
        <div class="error-banner">{error}</div>
      {/if}

      <div class="modal-body">
        {#if loading}
          <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Loading HSS data...</p>
          </div>
        {:else}
          <!-- Tabs -->
          <div class="tabs">
            <button 
              class="tab-btn" 
              class:active={activeTab === 'dashboard'}
              on:click={() => activeTab = 'dashboard'}
            >
              {getTabIcon('dashboard')} Dashboard
            </button>
            <button 
              class="tab-btn" 
              class:active={activeTab === 'subscribers'}
              on:click={() => activeTab = 'subscribers'}
            >
              {getTabIcon('subscribers')} Subscribers
            </button>
            <button 
              class="tab-btn" 
              class:active={activeTab === 'groups'}
              on:click={() => activeTab = 'groups'}
            >
              {getTabIcon('groups')} Groups
            </button>
            <button 
              class="tab-btn" 
              class:active={activeTab === 'plans'}
              on:click={() => activeTab = 'plans'}
            >
              {getTabIcon('plans')} Plans
            </button>
            <button 
              class="tab-btn" 
              class:active={activeTab === 'epcs'}
              on:click={() => activeTab = 'epcs'}
            >
              {getTabIcon('epcs')} EPCs
            </button>
            <button 
              class="tab-btn" 
              class:active={activeTab === 'import'}
              on:click={() => activeTab = 'import'}
            >
              {getTabIcon('import')} Import
            </button>
            <button 
              class="tab-btn" 
              class:active={activeTab === 'connections'}
              on:click={() => activeTab = 'connections'}
            >
              {getTabIcon('connections')} Connections
            </button>
          </div>

          <!-- Tab Content -->
          <div class="tab-content">
            {#if activeTab === 'dashboard'}
              <div class="dashboard-content">
                <h3>HSS Dashboard</h3>
                <p>Overview of HSS system status and statistics</p>
                
                {#if stats}
                  <HSSStats {tenantId} {HSS_API} />
                {:else}
                  <div class="no-data">
                    <p>No statistics available</p>
                  </div>
                {/if}
              </div>

            {:else if activeTab === 'subscribers'}
              <div class="subscribers-content">
                <h3>Subscriber Management</h3>
                <p>Manage LTE/5G subscribers, IMSI, authentication keys, and QoS settings</p>
                
                <SubscriberList 
                  {tenantId} 
                  {HSS_API} 
                  {groups} 
                  {bandwidthPlans}
                  on:refresh={refreshData}
                />
              </div>

            {:else if activeTab === 'groups'}
              <div class="groups-content">
                <h3>Subscriber Groups</h3>
                <p>Organize subscribers into groups for easier management</p>
                
                <GroupManagement 
                  {tenantId} 
                  {HSS_API}
                  on:refresh={refreshData}
                />
              </div>

            {:else if activeTab === 'plans'}
              <div class="plans-content">
                <h3>Bandwidth Plans</h3>
                <p>Define speed tiers and QoS parameters for subscribers</p>
                
                <BandwidthPlans 
                  {tenantId} 
                  {HSS_API}
                  on:refresh={refreshData}
                />
              </div>

            {:else if activeTab === 'epcs'}
              <div class="epcs-content">
                <div class="epcs-header">
                  <div>
                    <h3>EPC Management</h3>
                    <p>Deploy and manage Evolved Packet Core (EPC) instances</p>
                  </div>
                  <button class="deploy-btn" on:click={openEPCDeploymentModal} title="Deploy EPC">
                    🚀 Deploy EPC
                  </button>
                </div>
                
                <RemoteEPCs 
                  {tenantId} 
                  {HSS_API}
                  on:refresh={refreshData}
                />
              </div>

            {:else if activeTab === 'import'}
              <div class="import-content">
                <h3>Bulk Import</h3>
                <p>Import subscribers from CSV files</p>
                
                <BulkImport 
                  {tenantId} 
                  {HSS_API}
                  on:refresh={refreshData}
                />
              </div>

            {:else if activeTab === 'connections'}
              <div class="connections-content">
                <h3>MME Connections</h3>
                <p>Monitor MME connections and S6a/Diameter interface status</p>
                
                <MMEConnections 
                  {tenantId} 
                  {HSS_API}
                />
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- EPC Deployment Modal -->
      <EPCDeploymentModal
        show={showEPCDeploymentModal}
        tenantId={tenantId}
        on:close={closeEPCDeploymentModal}
      />
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-xl);
    max-width: 95vw;
    max-height: 95vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .modal-header h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.5rem;
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
  }

  .refresh-btn, .close-btn {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.5rem;
    border-radius: var(--border-radius-sm);
    transition: all 0.2s ease;
  }

  .refresh-btn:hover, .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
  }

  .hss-management-modal {
    width: 95%;
    max-width: 1400px;
    max-height: 95vh;
  }

  .error-banner {
    background: var(--danger);
    color: white;
    padding: var(--spacing-md);
    margin: var(--spacing-md) 0;
    border-radius: var(--border-radius-md);
    text-align: center;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl);
    text-align: center;
    color: var(--text-secondary);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color);
    border-top: 4px solid var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var(--spacing-md);
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .tabs {
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
    overflow-x: auto;
  }

  .tab-btn {
    background: none;
    border: none;
    padding: var(--spacing-md) var(--spacing-lg);
    cursor: pointer;
    color: var(--text-secondary);
    border-bottom: 2px solid transparent;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    white-space: nowrap;
    min-width: fit-content;
  }

  .tab-btn:hover {
    color: var(--text-primary);
    background: var(--bg-secondary);
  }

  .tab-btn.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }

  .tab-content {
    min-height: 400px;
  }

  .dashboard-content,
  .subscribers-content,
  .groups-content,
  .plans-content,
  .epcs-content,
  .import-content,
  .connections-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .epcs-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-lg);
  }

  .deploy-btn {
    background: var(--primary);
    color: white;
    border: none;
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--border-radius-md);
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .deploy-btn:hover {
    background: var(--primary-dark);
  }

  .dashboard-content h3,
  .subscribers-content h3,
  .groups-content h3,
  .plans-content h3,
  .epcs-content h3,
  .import-content h3,
  .connections-content h3 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--text-primary);
  }

  .dashboard-content p,
  .subscribers-content p,
  .groups-content p,
  .plans-content p,
  .epcs-content p,
  .import-content p,
  .connections-content p {
    margin: 0;
    color: var(--text-secondary);
  }

  .no-data {
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--text-secondary);
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .hss-management-modal {
      width: 95%;
      max-width: none;
    }

    .tabs {
      flex-direction: column;
      gap: 0;
    }

    .tab-btn {
      border-bottom: 1px solid var(--border-color);
      border-radius: 0;
    }

    .tab-btn.active {
      border-bottom-color: var(--primary);
      background: var(--bg-secondary);
    }
  }
</style>
