<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';

  export let show = false;
  export let tenantId: string;

  const dispatch = createEventDispatcher();

  let activeTab: 'subscribers' | 'groups' | 'plans' | 'epcs' = 'subscribers';
  let loading = false;
  let error = '';
  let success = '';
  let importData: any = null;

  // HSS API endpoint
  const HSS_API = import.meta.env.VITE_HSS_API_URL || 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy';

  onMount(async () => {
    if (show && tenantId) {
      await loadHSSData();
    }
  });

  $: if (show && tenantId && tenantId.trim() !== '') {
    loadHSSData();
  }

  async function loadHSSData() {
    if (!tenantId || tenantId.trim() === '') {
      console.warn('[HSSImport] No tenant ID provided');
      error = 'No tenant selected';
      return;
    }

    loading = true;
    error = '';

    try {
      console.log(`[HSSImport] Loading HSS data for tenant: ${tenantId}`);
      
      // Load all HSS data
      const [subscribers, groups, plans, epcs] = await Promise.all([
        loadSubscribers(),
        loadGroups(),
        loadBandwidthPlans(),
        loadEPCs()
      ]);

      importData = {
        subscribers,
        groups,
        plans,
        epcs,
        timestamp: new Date().toISOString()
      };

      console.log('[HSSImport] HSS data loaded successfully');
    } catch (err: any) {
      console.error('[HSSImport] Failed to load HSS data:', err);
      error = `Failed to load HSS data: ${err.message || 'Unknown error'}`;
    } finally {
      loading = false;
    }
  }

  async function loadSubscribers() {
    const response = await fetch(`${HSS_API}/subscribers`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`,
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to load subscribers: ${response.statusText}`);
    }

    return await response.json();
  }

  async function loadGroups() {
    const response = await fetch(`${HSS_API}/groups`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`,
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to load groups: ${response.statusText}`);
    }

    return await response.json();
  }

  async function loadBandwidthPlans() {
    const response = await fetch(`${HSS_API}/bandwidth-plans`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`,
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to load bandwidth plans: ${response.statusText}`);
    }

    return await response.json();
  }

  async function loadEPCs() {
    const response = await fetch(`${HSS_API}/epcs`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`,
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to load EPCs: ${response.statusText}`);
    }

    return await response.json();
  }

  async function getAuthToken(): Promise<string> {
    const { authService } = await import('$lib/services/authService');
    const token = await authService.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    return token;
  }

  function handleClose() {
    show = false;
    error = '';
    success = '';
    importData = null;
    activeTab = 'subscribers';
    dispatch('close');
  }

  function exportToInventory() {
    if (!importData) {
      error = 'No data to export';
      return;
    }

    try {
      // Convert HSS data to inventory format
      const inventoryData = convertHSSToInventory(importData);
      
      // Create downloadable file
      const blob = new Blob([JSON.stringify(inventoryData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hss-inventory-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      success = 'HSS data exported to inventory format successfully';
    } catch (err: any) {
      console.error('[HSSImport] Export failed:', err);
      error = `Export failed: ${err.message || 'Unknown error'}`;
    }
  }

  function convertHSSToInventory(hssData: any) {
    const inventory = {
      timestamp: new Date().toISOString(),
      source: 'HSS Management System',
      tenantId: tenantId,
      data: {
        subscribers: hssData.subscribers.map((sub: any) => ({
          id: sub.imsi,
          name: sub.subscriber_name || sub.imsi,
          category: 'Subscriber Equipment',
          equipmentType: 'LTE/5G Subscriber',
          manufacturer: 'HSS Managed',
          model: 'Subscriber Profile',
          quantity: 1,
          specifications: {
            imsi: sub.imsi,
            msisdn: sub.msisdn,
            ki: sub.ki,
            opc: sub.opc,
            qci: sub.qci,
            apn: sub.apn,
            maxBandwidthUL: sub.max_bandwidth_ul,
            maxBandwidthDL: sub.max_bandwidth_dl,
            enabled: sub.enabled,
            groupId: sub.group_id,
            bandwidthPlanId: sub.bandwidth_plan_id
          },
          location: {
            type: 'Subscriber',
            description: `Subscriber ${sub.imsi}`
          },
          status: sub.enabled ? 'Active' : 'Disabled',
          notes: `HSS Subscriber - Group: ${sub.group_id}, Plan: ${sub.bandwidth_plan_id}`
        })),
        
        groups: hssData.groups.map((group: any) => ({
          id: group.id,
          name: group.name,
          category: 'Subscriber Groups',
          equipmentType: 'Subscriber Group',
          manufacturer: 'HSS Managed',
          model: 'Group Profile',
          quantity: group.subscriber_count || 0,
          specifications: {
            description: group.description,
            subscriberCount: group.subscriber_count || 0,
            createdAt: group.created_at
          },
          location: {
            type: 'Group',
            description: `Group: ${group.name}`
          },
          status: 'Active',
          notes: `HSS Group - ${group.description || 'No description'}`
        })),
        
        bandwidthPlans: hssData.plans.map((plan: any) => ({
          id: plan.id,
          name: plan.name,
          category: 'Bandwidth Plans',
          equipmentType: 'Bandwidth Plan',
          manufacturer: 'HSS Managed',
          model: 'Plan Profile',
          quantity: plan.subscriber_count || 0,
          specifications: {
            uploadSpeed: plan.upload_speed,
            downloadSpeed: plan.download_speed,
            dataLimit: plan.data_limit,
            price: plan.price,
            subscriberCount: plan.subscriber_count || 0,
            createdAt: plan.created_at
          },
          location: {
            type: 'Plan',
            description: `Plan: ${plan.name}`
          },
          status: 'Active',
          notes: `HSS Bandwidth Plan - ${plan.upload_speed}Mbps UL / ${plan.download_speed}Mbps DL`
        })),
        
        epcs: hssData.epcs.map((epc: any) => ({
          id: epc.id,
          name: epc.site_name,
          category: 'EPC Equipment',
          equipmentType: 'Evolved Packet Core',
          manufacturer: 'Open5GS',
          model: 'EPC Instance',
          quantity: 1,
          specifications: {
            location: epc.location,
            networkConfig: epc.network_config,
            contact: epc.contact,
            status: epc.status,
            createdAt: epc.created_at
          },
          location: {
            type: 'EPC Site',
            address: epc.location?.address || '',
            city: epc.location?.city || '',
            state: epc.location?.state || '',
            country: epc.location?.country || '',
            coordinates: epc.location?.coordinates || { latitude: 0, longitude: 0 }
          },
          status: epc.status || 'Unknown',
          notes: `HSS EPC - ${epc.location?.address || 'No address'}`
        }))
      }
    };

    return inventory;
  }

  function getTabIcon(tab: string): string {
    switch (tab) {
      case 'subscribers': return '👥';
      case 'groups': return '📦';
      case 'plans': return '🚀';
      case 'epcs': return '🏗️';
      default: return '📋';
    }
  }

  function getTabTitle(tab: string): string {
    switch (tab) {
      case 'subscribers': return 'Subscribers';
      case 'groups': return 'Groups';
      case 'plans': return 'Bandwidth Plans';
      case 'epcs': return 'EPC Instances';
      default: return 'Unknown';
    }
  }

  function getDataCount(tab: string): number {
    if (!importData) return 0;
    
    switch (tab) {
      case 'subscribers': return importData.subscribers?.length || 0;
      case 'groups': return importData.groups?.length || 0;
      case 'plans': return importData.plans?.length || 0;
      case 'epcs': return importData.epcs?.length || 0;
      default: return 0;
    }
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={handleClose}>
    <div class="modal-content hss-import-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>🏠 HSS Data Import</h2>
        <div class="header-actions">
          <button class="export-btn" on:click={exportToInventory} disabled={!importData} title="Export to Inventory">
            📥 Export
          </button>
          <button class="close-btn" on:click={handleClose}>✕</button>
        </div>
      </div>

      {#if error}
        <div class="error-banner">{error}</div>
      {/if}

      {#if success}
        <div class="success-banner">{success}</div>
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
              class:active={activeTab === 'subscribers'}
              on:click={() => activeTab = 'subscribers'}
            >
              {getTabIcon('subscribers')} Subscribers
              {#if getDataCount('subscribers') > 0}
                <span class="count-badge">{getDataCount('subscribers')}</span>
              {/if}
            </button>
            <button 
              class="tab-btn" 
              class:active={activeTab === 'groups'}
              on:click={() => activeTab = 'groups'}
            >
              {getTabIcon('groups')} Groups
              {#if getDataCount('groups') > 0}
                <span class="count-badge">{getDataCount('groups')}</span>
              {/if}
            </button>
            <button 
              class="tab-btn" 
              class:active={activeTab === 'plans'}
              on:click={() => activeTab = 'plans'}
            >
              {getTabIcon('plans')} Plans
              {#if getDataCount('plans') > 0}
                <span class="count-badge">{getDataCount('plans')}</span>
              {/if}
            </button>
            <button 
              class="tab-btn" 
              class:active={activeTab === 'epcs'}
              on:click={() => activeTab = 'epcs'}
            >
              {getTabIcon('epcs')} EPCs
              {#if getDataCount('epcs') > 0}
                <span class="count-badge">{getDataCount('epcs')}</span>
              {/if}
            </button>
          </div>

          <!-- Tab Content -->
          <div class="tab-content">
            {#if activeTab === 'subscribers'}
              <div class="subscribers-content">
                <h3>Subscribers ({getDataCount('subscribers')})</h3>
                <p>LTE/5G subscriber profiles with IMSI, authentication keys, and QoS settings</p>
                
                {#if importData?.subscribers?.length > 0}
                  <div class="data-list">
                    {#each importData.subscribers as subscriber}
                      <div class="data-item">
                        <div class="item-header">
                          <strong>{subscriber.subscriber_name || subscriber.imsi}</strong>
                          <span class="status-badge" class:enabled={subscriber.enabled}>
                            {subscriber.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <div class="item-details">
                          <div class="detail-row">
                            <span class="label">IMSI:</span>
                            <span class="value">{subscriber.imsi}</span>
                          </div>
                          <div class="detail-row">
                            <span class="label">MSISDN:</span>
                            <span class="value">{subscriber.msisdn || 'N/A'}</span>
                          </div>
                          <div class="detail-row">
                            <span class="label">QCI:</span>
                            <span class="value">{subscriber.qci}</span>
                          </div>
                          <div class="detail-row">
                            <span class="label">APN:</span>
                            <span class="value">{subscriber.apn}</span>
                          </div>
                          <div class="detail-row">
                            <span class="label">Bandwidth:</span>
                            <span class="value">{subscriber.max_bandwidth_ul}Mbps UL / {subscriber.max_bandwidth_dl}Mbps DL</span>
                          </div>
                        </div>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div class="no-data">
                    <p>No subscribers found</p>
                  </div>
                {/if}
              </div>

            {:else if activeTab === 'groups'}
              <div class="groups-content">
                <h3>Subscriber Groups ({getDataCount('groups')})</h3>
                <p>Organizational groups for subscriber management</p>
                
                {#if importData?.groups?.length > 0}
                  <div class="data-list">
                    {#each importData.groups as group}
                      <div class="data-item">
                        <div class="item-header">
                          <strong>{group.name}</strong>
                          <span class="count-badge">{group.subscriber_count || 0} subscribers</span>
                        </div>
                        <div class="item-details">
                          <div class="detail-row">
                            <span class="label">Description:</span>
                            <span class="value">{group.description || 'No description'}</span>
                          </div>
                          <div class="detail-row">
                            <span class="label">Created:</span>
                            <span class="value">{new Date(group.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div class="no-data">
                    <p>No groups found</p>
                  </div>
                {/if}
              </div>

            {:else if activeTab === 'plans'}
              <div class="plans-content">
                <h3>Bandwidth Plans ({getDataCount('plans')})</h3>
                <p>Speed tiers and QoS parameters for subscribers</p>
                
                {#if importData?.plans?.length > 0}
                  <div class="data-list">
                    {#each importData.plans as plan}
                      <div class="data-item">
                        <div class="item-header">
                          <strong>{plan.name}</strong>
                          <span class="count-badge">{plan.subscriber_count || 0} subscribers</span>
                        </div>
                        <div class="item-details">
                          <div class="detail-row">
                            <span class="label">Speed:</span>
                            <span class="value">{plan.upload_speed}Mbps UL / {plan.download_speed}Mbps DL</span>
                          </div>
                          <div class="detail-row">
                            <span class="label">Data Limit:</span>
                            <span class="value">{plan.data_limit || 'Unlimited'}</span>
                          </div>
                          <div class="detail-row">
                            <span class="label">Price:</span>
                            <span class="value">${plan.price || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div class="no-data">
                    <p>No bandwidth plans found</p>
                  </div>
                {/if}
              </div>

            {:else if activeTab === 'epcs'}
              <div class="epcs-content">
                <h3>EPC Instances ({getDataCount('epcs')})</h3>
                <p>Evolved Packet Core deployment instances</p>
                
                {#if importData?.epcs?.length > 0}
                  <div class="data-list">
                    {#each importData.epcs as epc}
                      <div class="data-item">
                        <div class="item-header">
                          <strong>{epc.site_name}</strong>
                          <span class="status-badge" class:active={epc.status === 'active'}>
                            {epc.status || 'Unknown'}
                          </span>
                        </div>
                        <div class="item-details">
                          <div class="detail-row">
                            <span class="label">Location:</span>
                            <span class="value">{epc.location?.address || 'No address'}</span>
                          </div>
                          <div class="detail-row">
                            <span class="label">MCC/MNC:</span>
                            <span class="value">{epc.network_config?.mcc || 'N/A'}/{epc.network_config?.mnc || 'N/A'}</span>
                          </div>
                          <div class="detail-row">
                            <span class="label">TAC:</span>
                            <span class="value">{epc.network_config?.tac || 'N/A'}</span>
                          </div>
                          <div class="detail-row">
                            <span class="label">Contact:</span>
                            <span class="value">{epc.contact?.name || 'N/A'} ({epc.contact?.email || 'No email'})</span>
                          </div>
                        </div>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div class="no-data">
                    <p>No EPC instances found</p>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      </div>
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

  .export-btn, .close-btn {
    background: none;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.5rem;
    border-radius: var(--border-radius-sm);
    transition: all 0.2s ease;
  }

  .export-btn {
    background: var(--primary);
    color: white;
    font-weight: 500;
  }

  .export-btn:hover:not(:disabled) {
    background: var(--primary-dark);
  }

  .export-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
  }

  .hss-import-modal {
    width: 95%;
    max-width: 1200px;
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

  .success-banner {
    background: var(--success);
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

  .count-badge {
    background: var(--primary);
    color: white;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: bold;
  }

  .tab-content {
    min-height: 400px;
  }

  .subscribers-content,
  .groups-content,
  .plans-content,
  .epcs-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .subscribers-content h3,
  .groups-content h3,
  .plans-content h3,
  .epcs-content h3 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--text-primary);
  }

  .subscribers-content p,
  .groups-content p,
  .plans-content p,
  .epcs-content p {
    margin: 0;
    color: var(--text-secondary);
  }

  .data-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .data-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    padding: var(--spacing-lg);
    transition: all 0.2s ease;
  }

  .data-item:hover {
    border-color: var(--primary);
    box-shadow: var(--shadow-sm);
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }

  .item-header strong {
    color: var(--text-primary);
    font-size: 1.1rem;
  }

  .status-badge {
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
    font-size: 0.8rem;
    font-weight: bold;
    text-transform: uppercase;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }

  .status-badge.enabled,
  .status-badge.active {
    background: var(--success);
    color: white;
  }

  .item-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-sm);
  }

  .detail-row {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .detail-row .label {
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .detail-row .value {
    color: var(--text-primary);
    font-family: monospace;
  }

  .no-data {
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--text-secondary);
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .hss-import-modal {
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

    .item-details {
      grid-template-columns: 1fr;
    }
  }
</style>
