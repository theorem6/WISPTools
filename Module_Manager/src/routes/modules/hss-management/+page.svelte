<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/firebase';
  import SubscriberList from './components/SubscriberList.svelte';
  import GroupManagement from './components/GroupManagement.svelte';
  import BandwidthPlans from './components/BandwidthPlans.svelte';
  import HSSStats from './components/HSSStats.svelte';
  import MMEConnections from './components/MMEConnections.svelte';
  import BulkImport from './components/BulkImport.svelte';
  
  let activeTab = 'dashboard';
  let tenantId = 'tenant_001'; // Default tenant ID
  let stats: any = null;
  let loading = true;
  let error = '';
  
  // HSS API endpoint
  const HSS_API = import.meta.env.VITE_HSS_API_URL || 'http://localhost:3000';
  
  onMount(async () => {
    try {
      // Get tenant ID from user if available
      const user = auth.currentUser;
      if (user) {
        tenantId = user.uid; // Use user ID as tenant ID for now
      }
      await loadStats();
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  });
  
  async function loadStats() {
    try {
      const user = auth.currentUser;
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
  
  function switchTab(tab: string) {
    activeTab = tab;
  }
</script>

<div class="hss-management">
  <!-- Header -->
  <div class="header">
    <div class="header-content">
      <h1>🔐 HSS & Subscriber Management</h1>
      <p class="subtitle">Home Subscriber Server - Authentication & User Management</p>
    </div>
  </div>
  
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
        on:click={() => switchTab('dashboard')}
      >
        📊 Dashboard
      </button>
      <button 
        class:active={activeTab === 'subscribers'} 
        on:click={() => switchTab('subscribers')}
      >
        👥 Subscribers
      </button>
      <button 
        class:active={activeTab === 'groups'} 
        on:click={() => switchTab('groups')}
      >
        📦 Groups
      </button>
      <button 
        class:active={activeTab === 'plans'} 
        on:click={() => switchTab('plans')}
      >
        🚀 Bandwidth Plans
      </button>
      <button 
        class:active={activeTab === 'mme'} 
        on:click={() => switchTab('mme')}
      >
        🌐 MME Connections
      </button>
      <button 
        class:active={activeTab === 'import'} 
        on:click={() => switchTab('import')}
      >
        📥 Bulk Import
      </button>
    </div>
    
    <!-- Tab Content -->
    <div class="tab-content">
      {#if activeTab === 'dashboard'}
        <HSSStats {stats} on:refresh={loadStats} />
      {:else if activeTab === 'subscribers'}
        <SubscriberList {tenantId} {HSS_API} />
      {:else if activeTab === 'groups'}
        <GroupManagement {tenantId} {HSS_API} />
      {:else if activeTab === 'plans'}
        <BandwidthPlans {tenantId} {HSS_API} />
      {:else if activeTab === 'mme'}
        <MMEConnections {tenantId} {HSS_API} />
      {:else if activeTab === 'import'}
        <BulkImport {tenantId} {HSS_API} on:imported={loadStats} />
      {/if}
    </div>
  {/if}
</div>

<style>
  .hss-management {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .header {
    margin-bottom: 2rem;
  }
  
  .header-content h1 {
    margin: 0;
    font-size: 2rem;
    color: #1a1a1a;
  }
  
  .subtitle {
    margin: 0.5rem 0 0 0;
    color: #666;
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
    border: 4px solid #f3f3f3;
    border-top: 4px solid #2563eb;
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
    border-bottom: 2px solid #e5e7eb;
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
    color: #6b7280;
    transition: all 0.2s;
    white-space: nowrap;
  }
  
  .tabs button:hover {
    color: #2563eb;
    background: #f9fafb;
  }
  
  .tabs button.active {
    color: #2563eb;
    border-bottom-color: #2563eb;
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

