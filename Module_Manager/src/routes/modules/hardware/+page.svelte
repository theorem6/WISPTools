<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import {
    inventoryService,
    type InventoryItem,
    type InventoryFilters,
    type InventoryStats
  } from '$lib/services/inventoryService';
  import { categoryList, getTypesByCategory, equipmentCategories } from '$lib/config/equipmentCategories';
  import { goto } from '$app/navigation';
  import ScanModal from '../inventory/components/ScanModal.svelte';
  import { auth } from '$lib/firebase';
  import { API_CONFIG } from '$lib/config/api';
  import EPCDeploymentModal from '../deploy/components/EPCDeploymentModal.svelte';
  import { formatInTenantTimezone } from '$lib/utils/timezone';
  import { coverageMapService } from '../coverage-map/lib/coverageMapService.mongodb';
  
  const HSS_API = API_CONFIG.PATHS.HSS;
  
  // Data
  let items: InventoryItem[] = [];
  let epcDevices: any[] = []; // EPC/SNMP devices
  let isLoading = true;
  let error = '';
  let success = '';
  
  // UI State
  let showAddMenu = false;
  let showEPCWizard = false;
  
  // Tab for hardware type
  let activeHardwareTab: 'all' | 'inventory' | 'epc' = 'all';
  
  // Scanning
  let showScanModal = false;
  let scanMode: 'check-in' | 'check-out' | 'lookup' = 'lookup';
  
  // Filters
  let filters: InventoryFilters = {
    page: 1,
    limit: 100,
    sortBy: 'updatedAt',
    sortOrder: 'desc'
  };
  
  let pagination = {
    page: 1,
    limit: 100,
    total: 0,
    pages: 1
  };
  
  // Search & Filter
  let searchQuery = '';
  let selectedCategory = '';
  let selectedStatus = '';
  let selectedLocation = '';
  let selectedManufacturer = '';
  
  // Stats
  let stats: InventoryStats = {
    totalItems: 0,
    byStatus: [],
    byCategory: [],
    byLocation: [],
    totalValue: 0
  };
  
  const statuses = [
    { value: 'available', label: 'Available', color: '#10b981' },
    { value: 'deployed', label: 'Deployed', color: '#3b82f6' },
    { value: 'reserved', label: 'Reserved', color: '#f59e0b' },
    { value: 'in-transit', label: 'In Transit', color: '#8b5cf6' },
    { value: 'maintenance', label: 'Maintenance', color: '#f59e0b' },
    { value: 'rma', label: 'RMA', color: '#ef4444' },
    { value: 'retired', label: 'Retired', color: '#6b7280' },
    { value: 'lost', label: 'Lost', color: '#ef4444' },
    { value: 'sold', label: 'Sold', color: '#6b7280' }
  ];
  
  const locationTypes = [
    'warehouse',
    'tower',
    'noc',
    'vehicle',
    'customer',
    'rma',
    'vendor',
    'other'
  ];
  
  // Tenant reactive statements - sync to localStorage and reload on change
  $: tenantId = $currentTenant?.id || '';
  
  // Sync tenantId to localStorage for services that use it
  $: if (tenantId && browser) {
    localStorage.setItem('selectedTenantId', tenantId);
  }
  
  // Watch for tenant changes and reload data
  $: if (browser && tenantId) {
    console.log('[Hardware] Tenant loaded:', tenantId);
    if (tenantId) {
      loadData();
      loadEPCDevices();
    }
  }
  
  onMount(async () => {
    if (tenantId) {
      await loadData();
    }
  });
  
  async function loadData() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) {
      console.warn('[Hardware] No tenant ID available, skipping data load');
      return;
    }
    
    isLoading = true;
    error = '';
    
    try {
      // Load stats
      stats = await inventoryService.getStats();
      
      // Load inventory items
      await applyFilters();
      
      // Load EPC/SNMP devices
      await loadEPCDevices();
    } catch (err: any) {
      console.error('Error loading hardware:', err);
      error = err.message || 'Failed to load hardware';
    } finally {
      isLoading = false;
    }
  }
  
  async function loadEPCDevices() {
    try {
      const tenantId = $currentTenant?.id;
      if (!tenantId) return;
      
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const response = await fetch(`${HSS_API}/epc/remote/list`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        epcDevices = data.epcs || [];
        console.log('[Hardware] Loaded EPC devices:', epcDevices.length);
      }
    } catch (err: any) {
      console.error('Error loading EPC devices:', err);
    }
  }
  
  async function applyFilters() {
    isLoading = true;
    error = '';
    
    try {
      const filterParams: InventoryFilters = {
        ...filters,
        search: searchQuery || undefined,
        category: selectedCategory || undefined,
        status: selectedStatus || undefined,
        locationType: selectedLocation || undefined,
        manufacturer: selectedManufacturer || undefined
      };
      
      const result = await inventoryService.getInventory(filterParams);
      items = result.items;
      pagination = result.pagination;
    } catch (err: any) {
      console.error('Error fetching hardware:', err);
      error = err.message || 'Failed to fetch hardware';
    } finally {
      isLoading = false;
    }
  }
  
  function handleSearch() {
    filters.page = 1;
    applyFilters();
  }
  
  function handleCategoryChange() {
    filters.page = 1;
    applyFilters();
  }
  
  function handlePageChange(page: number) {
    filters.page = page;
    applyFilters();
  }
  
  async function handleDelete(item: InventoryItem) {
    if (!confirm(`Are you sure you want to delete ${item.model || item.serialNumber}?`)) {
      return;
    }
    
    if (!item._id) return;
    
    try {
      await inventoryService.deleteItem(item._id);
      success = 'Hardware item deleted successfully';
      setTimeout(() => success = '', 3000);
      await applyFilters();
      await loadData(); // Refresh stats
    } catch (err: any) {
      error = err.message || 'Failed to delete item';
      setTimeout(() => error = '', 5000);
    }
  }
  
  function getStatusColor(status: string): string {
    const statusObj = statuses.find(s => s.value === status);
    return statusObj?.color || '#6b7280';
  }
  
  function getStatusLabel(status: string): string {
    const statusObj = statuses.find(s => s.value === status);
    return statusObj?.label || status;
  }
  
  function formatDate(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  }
  
  function formatCurrency(amount: number | undefined): string {
    if (!amount) return 'N/A';
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  function getStatusCount(status: string): number {
    const entry = stats.byStatus.find((item) => item._id === status);
    return entry?.count ?? 0;
  }
  
  function getCategoryCount(category: string): number {
    const entry = stats.byCategory.find((item) => item._id === category);
    return entry?.count ?? 0;
  }
  
  // Get unique manufacturers from items
  $: manufacturers = [...new Set(items.map(item => item.manufacturer).filter(Boolean))].sort();
  
  // EPC Device Edit
  let showEPCEditModal = false;
  let selectedEPCDevice: any = null;
  let availableSites: any[] = [];
  let loadingSites = false;
  let epcEditForm = {
    epc_id: '',
    new_epc_id: '',
    site_id: '',
    site_name: '',
    deployment_type: 'both',
    device_code: '',
    hss_config: { mcc: '001', mnc: '01', tac: '1', apnName: 'internet', dnsPrimary: '8.8.8.8', dnsSecondary: '8.8.4.4' },
    snmp_config: { 
      enabled: true, 
      community: 'public', 
      communities: ['public'],
      targets: [],
      version: '2c', 
      pollingInterval: 60, 
      autoDiscovery: true 
    }
  };
  let isSavingEPC = false;
  let snmpCommunitiesText = 'public';
  let snmpSubnetsText = '';
  
  async function loadAvailableSites() {
    if (!$currentTenant?.id || loadingSites) return;
    
    loadingSites = true;
    try {
      availableSites = await coverageMapService.getTowerSites($currentTenant.id);
    } catch (err: any) {
      console.error('Error loading sites:', err);
      availableSites = [];
    } finally {
      loadingSites = false;
    }
  }
  
  async function editEPCDevice(device: any) {
    selectedEPCDevice = device;
    
    // Load available sites if not already loaded
    if (availableSites.length === 0) {
      await loadAvailableSites();
    }
    
    epcEditForm = {
      epc_id: device.epc_id || device.epcId || '',
      new_epc_id: device.epc_id || device.epcId || '',
      site_id: device.site_id ? String(device.site_id) : '', // Convert to string to match option values
      site_name: device.site_name || device.name || '',
      deployment_type: device.deployment_type || 'both',
      device_code: device.device_code || '',
      hss_config: {
        mcc: device.hss_config?.mcc || device.network_config?.mcc || '001',
        mnc: device.hss_config?.mnc || device.network_config?.mnc || '01',
        tac: device.hss_config?.tac || device.network_config?.tac || '1',
        apnName: device.hss_config?.apnName || 'internet',
        dnsPrimary: device.hss_config?.dnsPrimary || '8.8.8.8',
        dnsSecondary: device.hss_config?.dnsSecondary || '8.8.4.4'
      },
      snmp_config: {
        enabled: device.snmp_config?.enabled !== false,
        community: device.snmp_config?.community || 'public',
        communities: device.snmp_config?.communities || (device.snmp_config?.community ? [device.snmp_config.community] : ['public']),
        version: device.snmp_config?.version || '2c',
        pollingInterval: device.snmp_config?.pollingInterval || 60,
        targets: device.snmp_config?.targets || [],
        autoDiscovery: device.snmp_config?.autoDiscovery !== false
      }
    };
    
    // Update textarea values for display
    snmpCommunitiesText = epcEditForm.snmp_config.communities?.join('\n') || epcEditForm.snmp_config.community || 'public';
    snmpSubnetsText = epcEditForm.snmp_config.targets?.join('\n') || '';
    
    showEPCEditModal = true;
  }
  
  function handleSiteSelect(event: Event) {
    const target = event.target as HTMLSelectElement;
    const siteId = target.value;
    epcEditForm.site_id = siteId;
    
    if (siteId) {
      const site = availableSites.find(s => (s.id || s._id) === siteId);
      if (site) {
        epcEditForm.site_name = site.name || site.siteName || '';
      }
    } else {
      epcEditForm.site_name = '';
    }
  }
  
  async function saveEPCDevice() {
    if (!selectedEPCDevice) return;
    
    const epcId = selectedEPCDevice.epc_id || selectedEPCDevice.epcId || epcEditForm.epc_id;
    if (!epcId) {
      error = 'EPC ID is required';
      return;
    }
    
    isSavingEPC = true;
    error = '';
    
    try {
      const tenantId = $currentTenant?.id;
      if (!tenantId) throw new Error('No tenant selected');
      
      const user = auth().currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();
      
      const requestBody = {
        site_id: epcEditForm.site_id || null, // Always send site_id, use null if empty
        site_name: epcEditForm.site_id ? undefined : (epcEditForm.site_name || undefined),
        deployment_type: epcEditForm.deployment_type,
        hss_config: epcEditForm.hss_config,
        snmp_config: epcEditForm.snmp_config,
        device_code: selectedEPCDevice.device_code || epcEditForm.device_code || undefined,
        status: (selectedEPCDevice.device_code || epcEditForm.device_code) ? 'registered' : undefined
      };
      
      console.log('[Hardware] Saving EPC device:', {
        epcId,
        site_id: requestBody.site_id,
        site_name: requestBody.site_name,
        has_hss_config: !!requestBody.hss_config,
        has_snmp_config: !!requestBody.snmp_config
      });
      
      const response = await fetch(`${HSS_API}/epc/${epcId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update device');
      }
      
      success = 'EPC device updated successfully!';
      setTimeout(() => success = '', 3000);
      showEPCEditModal = false;
      selectedEPCDevice = null;
      await loadEPCDevices();
    } catch (err: any) {
      error = err.message || 'Failed to update EPC device';
    } finally {
      isSavingEPC = false;
    }
  }
  
  async function linkDeviceCode() {
    if (!selectedEPCDevice || !epcEditForm.device_code) return;
    
    const epcId = selectedEPCDevice.epc_id || selectedEPCDevice.epcId || epcEditForm.epc_id;
    if (!epcId) {
      error = 'EPC ID is required to link device';
      return;
    }
    
    isSavingEPC = true;
    error = '';
    
    try {
      const tenantId = $currentTenant?.id;
      if (!tenantId) throw new Error('No tenant selected');
      
      const user = auth().currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();
      const response = await fetch(`${HSS_API}/epc/${epcId}/link-device`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ device_code: epcEditForm.device_code })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to link device');
      }
      
      success = 'Device linked successfully!';
      setTimeout(() => success = '', 3000);
      await loadEPCDevices();
    } catch (err: any) {
      error = err.message || 'Failed to link device code';
    } finally {
      isSavingEPC = false;
    }
  }
  
  async function deleteEPCDevice(device: any) {
    const deviceName = device.site_name || device.name || 'this device';
    const deviceId = device.epc_id || device.epcId || device.id;
    
    if (!confirm(`Are you sure you want to delete "${deviceName}"?\n\nThis will permanently remove the EPC configuration. Any linked hardware will need to be re-registered.`)) {
      return;
    }
    
    try {
      const tenantId = $currentTenant?.id;
      if (!tenantId) throw new Error('No tenant selected');
      
      const user = auth().currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();
      // Use POST for delete (workaround for DELETE routing issues)
      const response = await fetch(`/api/epc-management/delete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ epc_id: deviceId })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete device');
      }
      
      success = `EPC device "${deviceName}" deleted successfully!`;
      setTimeout(() => success = '', 3000);
      await loadEPCDevices();
    } catch (err: any) {
      error = err.message || 'Failed to delete EPC device';
      setTimeout(() => error = '', 5000);
    }
  }
</script>

<TenantGuard>
<div class="hardware-page">
  <!-- Header -->
  <div class="page-header">
    <div class="header-left">
      <button class="back-button" on:click={() => goto('/dashboard')}>
        ← Back to Dashboard
      </button>
      <h1>🔧 Hardware Management</h1>
      <p class="subtitle">Comprehensive equipment and hardware management system</p>
    </div>
    
    <div class="header-actions">
      <button class="btn-secondary" on:click={() => { scanMode = 'lookup'; showScanModal = true; }}>
        🔍 Scan Lookup
      </button>
      <button class="btn-secondary" on:click={() => { scanMode = 'check-in'; showScanModal = true; }}>
        📥 Check In
      </button>
      <button class="btn-secondary" on:click={() => { scanMode = 'check-out'; showScanModal = true; }}>
        📤 Check Out
      </button>
      <button class="btn-secondary" on:click={() => goto('/modules/inventory/bundles')}>
        📦 Bundles
      </button>
      <button class="btn-secondary" on:click={() => goto('/modules/inventory/reports')}>
        📊 Reports
      </button>
      
      <!-- Add Hardware Dropdown -->
      <div class="dropdown-container">
        <button class="btn-primary dropdown-toggle" on:click={() => showAddMenu = !showAddMenu}>
          ➕ Add Hardware ▼
        </button>
        {#if showAddMenu}
          <div class="dropdown-menu" on:click={() => showAddMenu = false}>
            <button class="dropdown-item" on:click={() => { showEPCWizard = true; showAddMenu = false; }}>
              📡 EPC/SNMP Server
            </button>
            <button class="dropdown-item" on:click={() => { goto('/modules/inventory/add?type=sector'); showAddMenu = false; }}>
              📶 Sector/Antenna
            </button>
            <button class="dropdown-item" on:click={() => { goto('/modules/inventory/add?type=radio'); showAddMenu = false; }}>
              📻 Radio/eNB
            </button>
            <button class="dropdown-item" on:click={() => { goto('/modules/inventory/add?type=router'); showAddMenu = false; }}>
              🌐 Router/Switch
            </button>
            <button class="dropdown-item" on:click={() => { goto('/modules/inventory/add'); showAddMenu = false; }}>
              🔧 Other Hardware
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
  
  <!-- Alerts -->
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
  
  <!-- Stats Bar -->
  <div class="stats-bar">
    <div class="stat-card">
      <div class="stat-icon">🔧</div>
      <div>
        <div class="stat-value">{stats.totalItems + epcDevices.length}</div>
        <div class="stat-label">Total Hardware</div>
      </div>
    </div>
    
    <div class="stat-card clickable" on:click={() => activeHardwareTab = 'epc'}>
      <div class="stat-icon">📡</div>
      <div>
        <div class="stat-value">{epcDevices.length}</div>
        <div class="stat-label">EPC/SNMP Devices</div>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon">✅</div>
      <div>
        <div class="stat-value">{getStatusCount('available')}</div>
        <div class="stat-label">Available</div>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon">🚀</div>
      <div>
        <div class="stat-value">{getStatusCount('deployed') + epcDevices.filter(d => d.status === 'online').length}</div>
        <div class="stat-label">Deployed/Online</div>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon">💰</div>
      <div>
        <div class="stat-value">{formatCurrency(stats.totalValue)}</div>
        <div class="stat-label">Total Value</div>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon">🏗️</div>
      <div>
        <div class="stat-value">{getStatusCount('maintenance')}</div>
        <div class="stat-label">In Maintenance</div>
      </div>
    </div>
  </div>
  
  <!-- Hardware Type Tabs -->
  <div class="hardware-tabs">
    <button class="tab-btn" class:active={activeHardwareTab === 'all'} on:click={() => activeHardwareTab = 'all'}>
      📋 All Hardware ({items.length + epcDevices.length})
    </button>
    <button class="tab-btn" class:active={activeHardwareTab === 'inventory'} on:click={() => activeHardwareTab = 'inventory'}>
      📦 Inventory ({items.length})
    </button>
    <button class="tab-btn" class:active={activeHardwareTab === 'epc'} on:click={() => activeHardwareTab = 'epc'}>
      📡 EPC/SNMP Devices ({epcDevices.length})
    </button>
  </div>
  
  <!-- Filters -->
  <div class="filters-section">
    <div class="filters-row">
      <div class="search-box">
        <input
          type="text"
          placeholder="🔍 Search by serial number, model, manufacturer, asset tag..."
          bind:value={searchQuery}
          on:keydown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button class="search-btn" on:click={handleSearch}>Search</button>
      </div>
      
      <select bind:value={selectedCategory} on:change={handleCategoryChange}>
        <option value="">All Categories</option>
        {#each categoryList as category}
          <option value={category}>{category}</option>
        {/each}
      </select>
      
      <select bind:value={selectedStatus} on:change={handleCategoryChange}>
        <option value="">All Statuses</option>
        {#each statuses as status}
          <option value={status.value}>{status.label}</option>
        {/each}
      </select>
      
      <select bind:value={selectedLocation} on:change={handleCategoryChange}>
        <option value="">All Locations</option>
        {#each locationTypes as location}
          <option value={location}>{location.charAt(0).toUpperCase() + location.slice(1)}</option>
        {/each}
      </select>
      
      {#if manufacturers.length > 0}
        <select bind:value={selectedManufacturer} on:change={handleCategoryChange}>
          <option value="">All Manufacturers</option>
          {#each manufacturers as manufacturer}
            <option value={manufacturer}>{manufacturer}</option>
          {/each}
        </select>
      {/if}
      
      <button class="btn-clear" on:click={() => {
        searchQuery = '';
        selectedCategory = '';
        selectedStatus = '';
        selectedLocation = '';
        selectedManufacturer = '';
        filters.page = 1;
        applyFilters();
      }}>
        Clear Filters
      </button>
    </div>
    
    <!-- Category Quick Filters -->
    <div class="category-filters">
      {#each categoryList as category}
        {@const count = getCategoryCount(category)}
        {#if count > 0}
          <button
            class="category-chip"
            class:active={selectedCategory === category}
            on:click={() => {
              selectedCategory = selectedCategory === category ? '' : category;
              filters.page = 1;
              applyFilters();
            }}
          >
            {category} ({count})
          </button>
        {/if}
      {/each}
    </div>
  </div>
  
  <!-- Hardware Content -->
  {#if isLoading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading hardware...</p>
    </div>
  {:else if activeHardwareTab === 'epc' || (activeHardwareTab === 'all' && epcDevices.length > 0)}
    <!-- EPC/SNMP Devices Section -->
    {#if activeHardwareTab === 'epc' || activeHardwareTab === 'all'}
      {#if epcDevices.length === 0 && activeHardwareTab === 'epc'}
        <div class="empty-state">
          <span class="empty-icon">📡</span>
          <h3>No EPC/SNMP devices deployed</h3>
          <p>Deploy EPC/SNMP devices from the Deploy module</p>
          <button class="btn-primary" on:click={() => goto('/modules/deploy')}>
            🚀 Go to Deploy
          </button>
        </div>
      {:else if epcDevices.length > 0}
        <div class="epc-section">
          {#if activeHardwareTab === 'all'}
            <h3 class="section-title">📡 EPC/SNMP Devices ({epcDevices.length})</h3>
          {/if}
          <div class="table-container">
            <table class="hardware-table">
              <thead>
                <tr>
                  <th>Site / Device</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Device Code</th>
                  <th>Network Config</th>
                  <th>SNMP</th>
                  <th>Last Seen</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each epcDevices as device (device.epc_id || device.epcId || device.id)}
                  <tr>
                    <td class="hardware-cell">
                      <div class="hardware-info">
                        <div class="hardware-name">{device.site_name || device.name || 'Unnamed'}</div>
                        <div class="hardware-manufacturer">ID: {(device.epc_id || device.epcId || device.id || 'unknown').substring(0, 12)}...</div>
                      </div>
                    </td>
                    <td>
                      <span class="category-badge epc-type">
                        {#if device.deployment_type === 'epc'}📡 EPC
                        {:else if device.deployment_type === 'snmp'}📊 SNMP
                        {:else}📡📊 Both{/if}
                      </span>
                    </td>
                    <td>
                      <span class="status-badge status-{device.status || 'registered'}">
                        {#if device.status === 'online'}🟢 Online
                        {:else if device.status === 'offline'}🔴 Offline
                        {:else if device.status === 'error'}⚠️ Error
                        {:else}⏳ Registered{/if}
                      </span>
                    </td>
                    <td>
                      {#if device.device_code}
                        <code class="device-code">{device.device_code}</code>
                      {:else}
                        <span class="text-muted">Not linked</span>
                      {/if}
                    </td>
                    <td class="config-cell">
                      {#if device.deployment_type !== 'snmp'}
                        MCC: {device.hss_config?.mcc || device.network_config?.mcc || '001'}<br>
                        MNC: {device.hss_config?.mnc || device.network_config?.mnc || '01'}
                      {:else}
                        <span class="text-muted">N/A</span>
                      {/if}
                    </td>
                    <td>
                      {#if device.deployment_type !== 'epc'}
                        {device.snmp_config?.enabled !== false ? '✓' : '✗'}
                        {device.snmp_config?.community || 'public'}
                      {:else}
                        <span class="text-muted">N/A</span>
                      {/if}
                    </td>
                    <td class="date-cell">
                      {#if device.last_seen}
                        {formatInTenantTimezone(device.last_seen)}
                      {:else}
                        <span class="text-muted">Never</span>
                      {/if}
                    </td>
                    <td class="actions-cell">
                      <div class="action-buttons">
                        <button class="btn-icon" on:click={() => editEPCDevice(device)} title="Edit">
                          ✏️
                        </button>
                        <button class="btn-icon btn-danger" on:click={() => deleteEPCDevice(device)} title="Delete">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    {/if}
  {/if}
  
  <!-- Inventory Items Section -->
  {#if !isLoading && (activeHardwareTab === 'inventory' || activeHardwareTab === 'all')}
    {#if items.length === 0 && activeHardwareTab === 'inventory'}
      <div class="empty-state">
        <span class="empty-icon">🔧</span>
        <h3>No inventory items found</h3>
        <p>
          {#if searchQuery || selectedCategory || selectedStatus || selectedLocation}
            Try adjusting your filters or search criteria
          {:else}
            Get started by adding your first hardware item
          {/if}
        </p>
        <button class="btn-primary" on:click={() => goto('/modules/inventory/add')}>
          ➕ Add Hardware
        </button>
      </div>
    {:else if items.length > 0}
      <div class="inventory-section">
        {#if activeHardwareTab === 'all'}
          <h3 class="section-title">📦 Inventory Items ({items.length})</h3>
        {/if}
        <div class="table-container">
          <table class="hardware-table">
            <thead>
              <tr>
                <th>Hardware</th>
                <th>Category</th>
                <th>Status</th>
                <th>Location</th>
                <th>Serial #</th>
                <th>Asset Tag</th>
                <th>Condition</th>
                <th>Value</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each items as item (item._id)}
                <tr>
                  <td class="hardware-cell">
                    <div class="hardware-info">
                      <div class="hardware-name">
                        {item.model || item.equipmentType || 'Unknown'}
                      </div>
                      {#if item.manufacturer}
                        <div class="hardware-manufacturer">{item.manufacturer}</div>
                      {/if}
                    </div>
                  </td>
                  <td>
                    <span class="category-badge">{item.category}</span>
                  </td>
                  <td>
                    <span 
                      class="status-badge" 
                      style="background-color: {getStatusColor(item.status)}20; color: {getStatusColor(item.status)}"
                    >
                      {getStatusLabel(item.status)}
                    </span>
                  </td>
                  <td class="location-cell">
                    {#if item.currentLocation?.siteName}
                      <div>{item.currentLocation.siteName}</div>
                      <div class="location-type">{item.currentLocation.type}</div>
                    {:else if item.currentLocation?.address}
                      <div>{item.currentLocation.address}</div>
                      <div class="location-type">{item.currentLocation.type}</div>
                    {:else}
                      <span class="text-muted">{item.currentLocation?.type || 'N/A'}</span>
                    {/if}
                  </td>
                  <td class="serial-cell">{item.serialNumber || 'N/A'}</td>
                  <td class="asset-cell">{item.assetTag || '-'}</td>
                  <td>
                    <span class="condition-badge condition-{item.condition}">
                      {item.condition || 'N/A'}
                    </span>
                  </td>
                  <td class="value-cell">{formatCurrency(item.purchaseInfo?.purchasePrice)}</td>
                  <td class="date-cell">{formatDate(item.updatedAt)}</td>
                  <td class="actions-cell">
                    <div class="action-buttons">
                      <button class="btn-icon" on:click={() => goto(`/modules/inventory/${item._id}`)} title="View">
                        👁️
                      </button>
                      <button class="btn-icon" on:click={() => goto(`/modules/inventory/${item._id}/edit`)} title="Edit">
                        ✏️
                      </button>
                      <button class="btn-icon btn-danger" on:click={() => handleDelete(item)} title="Delete">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        
        <!-- Pagination -->
        {#if pagination.pages > 1}
          <div class="pagination">
            <button 
              class="page-btn" 
              disabled={pagination.page === 1}
              on:click={() => handlePageChange(pagination.page - 1)}
            >
              ← Previous
            </button>
            <span class="page-info">
              Page {pagination.page} of {pagination.pages} ({pagination.total} total)
            </span>
            <button 
              class="page-btn" 
              disabled={pagination.page >= pagination.pages}
              on:click={() => handlePageChange(pagination.page + 1)}
            >
              Next →
            </button>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<!-- Scan Modal -->
{#if showScanModal}
  <ScanModal 
    show={showScanModal}
    mode={scanMode}
    on:close={() => { 
      showScanModal = false;
      loadData();
    }}
    on:success={() => {
      showScanModal = false;
      loadData();
    }}
  />
{/if}

<!-- EPC Deployment Wizard -->
{#if showEPCWizard}
  <EPCDeploymentModal
    show={showEPCWizard}
    tenantId={$currentTenant?.id || ''}
    on:close={() => { showEPCWizard = false; loadEPCDevices(); }}
  />
{/if}

<!-- EPC Edit Modal -->
{#if showEPCEditModal && selectedEPCDevice}
  <div class="modal-overlay" on:click={() => showEPCEditModal = false}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>✏️ Edit EPC/SNMP Device</h2>
        <button class="close-btn" on:click={() => showEPCEditModal = false}>✕</button>
      </div>
      
      <div class="modal-body">
        <div class="device-info-banner">
          <strong>Current EPC ID:</strong> <code>{selectedEPCDevice.epc_id || selectedEPCDevice.epcId}</code>
        </div>
        
        <!-- EPC ID Section -->
        <div class="config-section">
          <h4>🆔 EPC Identification</h4>
          <div class="form-group">
            <label>EPC ID</label>
            <input type="text" value={epcEditForm.epc_id} readonly disabled placeholder="EPC-XXXX" style="background-color: #f5f5f5; cursor: not-allowed;" />
            <small class="hint">EPC ID is auto-generated and cannot be changed</small>
          </div>
        </div>
        
        <!-- Site Name Section -->
        <div class="config-section">
          <h4>📍 Site Information</h4>
          <div class="form-group">
            <label>Site</label>
            {#if loadingSites}
              <select disabled>
                <option>Loading sites...</option>
              </select>
            {:else}
              <select bind:value={epcEditForm.site_id} on:change={handleSiteSelect}>
                <option value="">-- Select a site --</option>
                {#each availableSites as site}
                  <option value={site.id || site._id}>{site.name || site.siteName || 'Unnamed Site'}</option>
                {/each}
              </select>
            {/if}
            <small class="hint">Select a deployed site from the list</small>
          </div>
          <div class="form-group">
            <label>Site Name</label>
            <input type="text" bind:value={epcEditForm.site_name} placeholder="Site name (auto-filled from selected site)" />
            <small class="hint">Will be auto-generated with suffix if multiple EPCs on same site</small>
          </div>
        </div>
        
        <!-- Device Code Section -->
        <div class="config-section">
          <h4>🔗 Device Linking</h4>
          {#if selectedEPCDevice.device_code}
            <p class="linked-info">✅ Linked: <code class="device-code">{selectedEPCDevice.device_code}</code></p>
          {:else}
            <p class="hint">Enter the code from the device's status page to link it.</p>
            <div class="link-device-row">
              <input type="text" bind:value={epcEditForm.device_code} placeholder="e.g., ABCD1234" maxlength="8" class="device-code-input" />
              <button class="btn-link" on:click={linkDeviceCode} disabled={isSavingEPC || !epcEditForm.device_code}>🔗 Link</button>
            </div>
          {/if}
        </div>
        
        <div class="form-group">
          <label>Deployment Type</label>
          <select bind:value={epcEditForm.deployment_type}>
            <option value="epc">📡 EPC Only</option>
            <option value="snmp">📊 SNMP Only</option>
            <option value="both">📡📊 EPC + SNMP</option>
          </select>
        </div>
        
        {#if epcEditForm.deployment_type === 'epc' || epcEditForm.deployment_type === 'both'}
          <div class="config-section">
            <h4>📡 EPC Configuration</h4>
            <div class="form-row">
              <div class="form-group"><label>MCC</label><input type="text" bind:value={epcEditForm.hss_config.mcc} /></div>
              <div class="form-group"><label>MNC</label><input type="text" bind:value={epcEditForm.hss_config.mnc} /></div>
              <div class="form-group"><label>TAC</label><input type="text" bind:value={epcEditForm.hss_config.tac} /></div>
            </div>
            <div class="form-group"><label>APN Name</label><input type="text" bind:value={epcEditForm.hss_config.apnName} /></div>
            <div class="form-row">
              <div class="form-group"><label>Primary DNS</label><input type="text" bind:value={epcEditForm.hss_config.dnsPrimary} /></div>
              <div class="form-group"><label>Secondary DNS</label><input type="text" bind:value={epcEditForm.hss_config.dnsSecondary} /></div>
            </div>
          </div>
        {/if}
        
        {#if epcEditForm.deployment_type === 'snmp' || epcEditForm.deployment_type === 'both'}
          <div class="config-section">
            <h4>📊 SNMP Configuration</h4>
            <div class="checkbox-row">
              <label><input type="checkbox" bind:checked={epcEditForm.snmp_config.enabled} /> Enabled</label>
              <label><input type="checkbox" bind:checked={epcEditForm.snmp_config.autoDiscovery} /> Auto-Discovery</label>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Version</label>
                <select bind:value={epcEditForm.snmp_config.version}>
                  <option value="1">v1</option>
                  <option value="2c">v2c</option>
                  <option value="3">v3</option>
                </select>
              </div>
              <div class="form-group"><label>Polling Interval (sec)</label><input type="number" bind:value={epcEditForm.snmp_config.pollingInterval} min="10" max="3600" /></div>
            </div>
            
            <div class="form-group">
              <label>Community Strings (one per line)</label>
              <textarea 
                bind:value={snmpCommunitiesText} 
                on:input={(e) => {
                  const communities = e.target.value.split('\n')
                    .map(c => c.trim())
                    .filter(c => c.length > 0);
                  epcEditForm.snmp_config.communities = communities;
                  if (communities.length > 0) {
                    epcEditForm.snmp_config.community = communities[0]; // Keep first as legacy
                  }
                }}
                placeholder="public
private
readonly"
                rows="4"
              ></textarea>
              <small class="hint">Enter each community string on a new line</small>
            </div>
            
            <div class="form-group">
              <label>Subnets to Scan (CIDR format, one per line)</label>
              <textarea 
                bind:value={snmpSubnetsText} 
                on:input={(e) => {
                  const subnets = e.target.value.split('\n')
                    .map(s => s.trim())
                    .filter(s => s.length > 0);
                  epcEditForm.snmp_config.targets = subnets;
                }}
                placeholder="192.168.1.0/24
10.0.0.0/24"
                rows="4"
              ></textarea>
              <small class="hint">Enter each subnet in CIDR format (e.g., 192.168.1.0/24) on a new line</small>
            </div>
          </div>
        {/if}
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={() => showEPCEditModal = false}>Cancel</button>
        <button class="btn-primary" on:click={saveEPCDevice} disabled={isSavingEPC}>
          {isSavingEPC ? 'Saving...' : '💾 Save Changes'}
        </button>
      </div>
    </div>
  </div>
{/if}
</TenantGuard>

<style>
  .hardware-page {
    min-height: 100vh;
    background: var(--bg-primary, #f8f9fa);
    padding: 2rem;
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    gap: 2rem;
    flex-wrap: wrap;
  }
  
  .header-left {
    flex: 1;
    min-width: 300px;
  }
  
  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--card-bg, white);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.5rem;
    color: var(--text-secondary, #718096);
    cursor: pointer;
    font-size: 0.9rem;
    margin-bottom: 1rem;
    transition: all 0.2s;
  }
  
  .back-button:hover {
    background: var(--bg-hover, #f1f5f9);
    color: var(--text-primary, #1a202c);
    border-color: var(--primary, #3b82f6);
  }
  
  .page-header h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    color: var(--text-primary, #1a202c);
  }
  
  .subtitle {
    color: var(--text-secondary, #718096);
    margin: 0;
    font-size: 1rem;
  }
  
  .header-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: center;
  }
  
  .btn-primary, .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.9rem;
    white-space: nowrap;
  }
  
  .btn-primary {
    background: var(--primary, #3b82f6);
    color: white;
  }
  
  .btn-primary:hover {
    background: var(--primary-dark, #2563eb);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }
  
  .btn-secondary {
    background: var(--card-bg, white);
    color: var(--text-primary, #1a202c);
    border: 1px solid var(--border-color, #e0e0e0);
  }
  
  .btn-secondary:hover {
    background: var(--bg-hover, #f1f5f9);
    border-color: var(--primary, #3b82f6);
  }
  
  .alert {
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .alert-error {
    background: #fee2e2;
    border: 1px solid #fca5a5;
    color: #991b1b;
  }
  
  .alert-success {
    background: #d1fae5;
    border: 1px solid #6ee7b7;
    color: #065f46;
  }
  
  .dismiss-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    opacity: 0.6;
  }
  
  .dismiss-btn:hover {
    opacity: 1;
  }
  
  .stats-bar {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .stat-card {
    background: var(--card-bg, white);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.5rem;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .stat-icon {
    font-size: 2rem;
  }
  
  .stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary, #1a202c);
    line-height: 1.2;
  }
  
  .stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary, #718096);
    margin-top: 0.25rem;
  }
  
  .filters-section {
    background: var(--card-bg, white);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .filters-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    align-items: center;
  }
  
  .search-box {
    flex: 1;
    min-width: 300px;
    display: flex;
    gap: 0.5rem;
  }
  
  .search-box input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.5rem;
    font-size: 0.9rem;
    background: var(--input-bg, white);
    color: var(--text-primary, #1a202c);
  }
  
  .search-box input:focus {
    outline: none;
    border-color: var(--primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .search-btn {
    padding: 0.75rem 1.5rem;
    background: var(--primary, #3b82f6);
    color: white;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    font-weight: 500;
  }
  
  .search-btn:hover {
    background: var(--primary-dark, #2563eb);
  }
  
  .filters-row select {
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.5rem;
    background: var(--input-bg, white);
    color: var(--text-primary, #1a202c);
    cursor: pointer;
    font-size: 0.9rem;
  }
  
  .btn-clear {
    padding: 0.75rem 1.5rem;
    background: transparent;
    color: var(--text-secondary, #718096);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
  }
  
  .btn-clear:hover {
    background: var(--bg-hover, #f1f5f9);
    color: var(--text-primary, #1a202c);
  }
  
  .category-filters {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .category-chip {
    padding: 0.5rem 1rem;
    background: var(--bg-secondary, #f1f5f9);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 1.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }
  
  .category-chip:hover {
    background: var(--bg-hover, #e2e8f0);
  }
  
  .category-chip.active {
    background: var(--primary, #3b82f6);
    color: white;
    border-color: var(--primary, #3b82f6);
  }
  
  .loading-state, .empty-state {
    background: var(--card-bg, white);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.5rem;
    padding: 4rem 2rem;
    text-align: center;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color, #e0e0e0);
    border-top-color: var(--primary, #3b82f6);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .empty-icon {
    font-size: 4rem;
    opacity: 0.4;
    margin-bottom: 1rem;
    display: block;
  }
  
  .empty-state h3 {
    font-size: 1.5rem;
    margin: 0 0 0.5rem 0;
    color: var(--text-primary, #1a202c);
  }
  
  .empty-state p {
    color: var(--text-secondary, #718096);
    margin-bottom: 1.5rem;
  }
  
  .table-container {
    background: var(--card-bg, white);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.5rem;
    overflow-x: auto;
    margin-bottom: 2rem;
  }
  
  .hardware-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  
  .hardware-table thead {
    background: var(--bg-secondary, #f1f5f9);
    border-bottom: 2px solid var(--border-color, #e0e0e0);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  
  .hardware-table th {
    padding: 1rem;
    text-align: left;
    font-weight: 600;
    color: var(--text-primary, #1a202c);
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }
  
  .hardware-table td {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    color: var(--text-primary, #1a202c);
  }
  
  .hardware-table tbody tr:hover {
    background: var(--bg-hover, #f9fafb);
  }
  
  .hardware-cell {
    min-width: 200px;
  }
  
  .hardware-name {
    font-weight: 500;
    color: var(--text-primary, #1a202c);
    margin-bottom: 0.25rem;
  }
  
  .hardware-manufacturer {
    font-size: 0.875rem;
    color: var(--text-secondary, #718096);
  }
  
  .category-badge, .status-badge, .condition-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.8125rem;
    font-weight: 500;
    white-space: nowrap;
  }
  
  .status-badge {
    background-color: rgba(0, 0, 0, 0.05);
  }
  
  .condition-badge {
    text-transform: capitalize;
  }
  
  .condition-new { background: #d1fae5; color: #065f46; }
  .condition-excellent { background: #dbeafe; color: #1e40af; }
  .condition-good { background: #fef3c7; color: #92400e; }
  .condition-fair { background: #fed7aa; color: #9a3412; }
  .condition-poor { background: #fee2e2; color: #991b1b; }
  .condition-damaged { background: #fee2e2; color: #991b1b; }
  .condition-refurbished { background: #e0e7ff; color: #3730a3; }
  
  .location-cell {
    font-size: 0.875rem;
  }
  
  .location-type {
    font-size: 0.8125rem;
    color: var(--text-secondary, #718096);
    margin-top: 0.25rem;
  }
  
  .serial-cell, .asset-cell, .date-cell {
    font-family: monospace;
    font-size: 0.875rem;
    color: var(--text-secondary, #718096);
  }
  
  .value-cell {
    font-weight: 500;
  }
  
  .actions-cell {
    white-space: nowrap;
  }
  
  .action-buttons {
    display: flex;
    gap: 0.5rem;
  }
  
  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }
  
  .btn-icon:hover {
    background: var(--bg-hover, #f1f5f9);
    transform: scale(1.1);
  }
  
  .btn-icon.btn-danger:hover {
    background: #fee2e2;
  }
  
  .text-muted {
    color: var(--text-secondary, #718096);
    font-style: italic;
  }
  
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--card-bg, white);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.5rem;
  }
  
  .page-btn {
    padding: 0.5rem 1rem;
    background: var(--card-bg, white);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .page-btn:hover:not(:disabled) {
    background: var(--bg-hover, #f1f5f9);
    border-color: var(--primary, #3b82f6);
  }
  
  .page-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .page-info {
    color: var(--text-secondary, #718096);
    font-size: 0.9rem;
  }
  
  /* Hardware Tabs */
  .hardware-tabs {
    display: flex;
    gap: 0;
    margin-bottom: 1.5rem;
    background: var(--card-bg, white);
    border-radius: 0.5rem;
    overflow: hidden;
    border: 1px solid var(--border-color, #e0e0e0);
  }
  
  .tab-btn {
    flex: 1;
    padding: 1rem;
    background: none;
    border: none;
    cursor: pointer;
    font-weight: 500;
    color: var(--text-secondary, #718096);
    border-right: 1px solid var(--border-color, #e0e0e0);
    transition: all 0.2s;
  }
  
  .tab-btn:last-child {
    border-right: none;
  }
  
  .tab-btn:hover {
    background: var(--bg-hover, #f1f5f9);
  }
  
  .tab-btn.active {
    background: var(--primary, #3b82f6);
    color: white;
  }
  
  .stat-card.clickable {
    cursor: pointer;
    transition: transform 0.2s;
  }
  
  .stat-card.clickable:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .section-title {
    margin: 1.5rem 0 1rem 0;
    font-size: 1.1rem;
    color: var(--text-primary, #1a202c);
  }
  
  .epc-section, .inventory-section {
    margin-bottom: 2rem;
  }
  
  /* EPC Device Styles */
  .device-code {
    background: #ecfdf5;
    color: #047857;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.85rem;
    letter-spacing: 1px;
  }
  
  .epc-type {
    background: #e0e7ff;
    color: #3730a3;
  }
  
  .status-registered { background: #e0e7ff; color: #3730a3; }
  .status-online { background: #d1fae5; color: #065f46; }
  .status-offline { background: #fee2e2; color: #991b1b; }
  .status-error { background: #fef3c7; color: #92400e; }
  
  .config-cell {
    font-size: 0.8rem;
    line-height: 1.4;
  }
  
  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  
  .modal-content {
    background: var(--card-bg, white);
    border-radius: 0.75rem;
    width: 100%;
    max-width: 550px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary, #718096);
  }
  
  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border-color, #e0e0e0);
  }
  
  .device-info-banner {
    background: var(--bg-secondary, #f8f9fa);
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  
  .device-info-banner code {
    background: var(--card-bg, white);
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-size: 0.8rem;
  }
  
  .config-section {
    background: var(--bg-secondary, #f8f9fa);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
  }
  
  .config-section h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.9rem;
  }
  
  .form-group {
    margin-bottom: 0.75rem;
  }
  
  .form-group label {
    display: block;
    font-size: 0.8rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
    color: var(--text-primary, #1a202c);
  }
  
  .form-group input, .form-group select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }
  
  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 0.75rem;
  }
  
  .form-row .form-group {
    margin-bottom: 0;
  }
  
  .checkbox-row {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 0.75rem;
  }
  
  .checkbox-row label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: normal;
    cursor: pointer;
  }
  
  .checkbox-row input[type="checkbox"] {
    width: auto;
  }
  
  .linked-info {
    color: #047857;
    font-weight: 500;
  }
  
  .hint {
    color: var(--text-secondary, #718096);
    font-size: 0.85rem;
    margin-bottom: 0.5rem;
  }
  
  .link-device-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  
  .device-code-input {
    flex: 1;
    max-width: 150px;
    text-transform: uppercase;
    font-family: monospace;
    letter-spacing: 1px;
  }
  
  .btn-link {
    padding: 0.5rem 1rem;
    background: var(--primary, #3b82f6);
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-weight: 500;
  }
  
  .btn-link:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Dropdown Menu */
  .dropdown-container {
    position: relative;
    display: inline-block;
  }
  
  .dropdown-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.5rem;
    background: var(--card-bg, white);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 0.5rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    min-width: 200px;
    z-index: 100;
    overflow: hidden;
  }
  
  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--text-primary, #1a202c);
    transition: background 0.15s;
  }
  
  .dropdown-item:hover {
    background: var(--bg-hover, #f1f5f9);
  }
  
  .dropdown-item:not(:last-child) {
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }
</style>

