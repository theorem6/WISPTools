<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { inventoryService, type InventoryItem, type InventoryFilters } from '$lib/services/inventoryService';
  import { barcodeService } from '$lib/services/barcodeService';
  import AssetTagViewer from './components/AssetTagViewer.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  
  // Data
  let items: InventoryItem[] = [];
  let isLoading = true;
  let error = '';
  let success = '';
  
  // Asset Tag
  let showAssetTag = false;
  let selectedItemForTag: InventoryItem | null = null;
  
  // Filters
  let filters: InventoryFilters = {
    page: 1,
    limit: 50,
    sortBy: 'updatedAt',
    sortOrder: 'desc'
  };
  
  let pagination = {
    page: 1,
    limit: 50,
    total: 0,
    pages: 1
  };
  
  // Search & Filter
  let searchQuery = '';
  let selectedCategory = '';
  let selectedStatus = '';
  let selectedLocation = '';
  
  // Stats
  let stats = {
    totalItems: 0,
    byStatus: [],
    byCategory: [],
    totalValue: 0
  };
  
  // Categories
  const categories = [
    'Radio Equipment',
    'Antennas',
    'Power Systems',
    'Networking Equipment',
    'Transmission Equipment',
    'Environmental Control',
    'Monitoring & Control',
    'Structural & Housing',
    'Test Equipment',
    'CPE Devices',
    'SIM Cards',
    'Cables & Accessories',
    'Tools',
    'Spare Parts',
    'Other'
  ];
  
  const statuses = [
    'available',
    'deployed',
    'reserved',
    'in-transit',
    'maintenance',
    'rma',
    'retired',
    'lost',
    'sold'
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
  
  $: tenantId = $currentTenant?.id || '';
  
  // Check for URL parameters (e.g., from Coverage Map)
  $: if (browser && $page.url.searchParams.has('siteId')) {
    const siteId = $page.url.searchParams.get('siteId');
    const siteName = $page.url.searchParams.get('siteName');
    if (siteId) {
      filters.locationId = siteId;
      filters.locationType = 'tower';
      success = `Showing equipment at: ${siteName || siteId}`;
    }
  }
  
  onMount(async () => {
    if (tenantId) {
      await loadData();
      await loadStats();
    }
    isLoading = false;
  });
  
  $: if (browser && tenantId) {
    loadData();
    loadStats();
  }
  
  async function loadData() {
    isLoading = true;
    error = '';
    
    try {
      const result = await inventoryService.getInventory(filters);
      items = result.items;
      pagination = result.pagination;
    } catch (err: any) {
      error = err.message || 'Failed to load inventory';
      console.error('Error loading inventory:', err);
    } finally {
      isLoading = false;
    }
  }
  
  async function loadStats() {
    try {
      stats = await inventoryService.getStats();
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }
  
  function applyFilters() {
    filters = {
      ...filters,
      search: searchQuery || undefined,
      category: selectedCategory || undefined,
      status: selectedStatus || undefined,
      locationType: selectedLocation || undefined,
      page: 1
    };
    loadData();
  }
  
  function clearFilters() {
    searchQuery = '';
    selectedCategory = '';
    selectedStatus = '';
    selectedLocation = '';
    filters = {
      page: 1,
      limit: 50,
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    };
    loadData();
  }
  
  function handleSort(column: string) {
    if (filters.sortBy === column) {
      filters.sortOrder = filters.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      filters.sortBy = column;
      filters.sortOrder = 'asc';
    }
    loadData();
  }
  
  function goToPage(page: number) {
    filters.page = page;
    loadData();
  }
  
  async function handleExport() {
    try {
      const blob = await inventoryService.exportCSV();
      inventoryService.downloadCSV(blob);
      success = 'Inventory exported successfully';
      setTimeout(() => success = '', 3000);
    } catch (err: any) {
      error = err.message || 'Export failed';
      setTimeout(() => error = '', 5000);
    }
  }
  
  function handlePrintTag(item: InventoryItem) {
    selectedItemForTag = item;
    showAssetTag = true;
  }
  
  async function handleScanBarcode() {
    try {
      const scannedValue = await barcodeService.scanCode();
      const parsedData = barcodeService.parseQRCode(scannedValue);
      
      if (parsedData.assetTag) {
        searchQuery = parsedData.assetTag;
        applyFilters();
      } else if (parsedData.serialNumber) {
        searchQuery = parsedData.serialNumber;
        applyFilters();
      } else {
        searchQuery = scannedValue;
        applyFilters();
      }
      
      success = 'Barcode scanned successfully';
      setTimeout(() => success = '', 3000);
    } catch (err: any) {
      if (err.message !== 'Scan cancelled') {
        error = err.message || 'Scan failed';
        setTimeout(() => error = '', 3000);
      }
    }
  }
  
  function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      available: '#10b981',
      deployed: '#3b82f6',
      reserved: '#f59e0b',
      'in-transit': '#8b5cf6',
      maintenance: '#f59e0b',
      rma: '#ef4444',
      retired: '#6b7280',
      lost: '#ef4444',
      sold: '#6b7280'
    };
    return colors[status] || '#6b7280';
  }
  
  function getConditionEmoji(condition: string): string {
    const emojis: Record<string, string> = {
      new: '✨',
      excellent: '⭐',
      good: '👍',
      fair: '👌',
      poor: '⚠️',
      damaged: '❌',
      refurbished: '🔄'
    };
    return emojis[condition] || '❓';
  }
  
  function formatDate(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  }
  
  function formatCurrency(amount: number | undefined): string {
    if (!amount) return 'N/A';
    return `$${amount.toLocaleString()}`;
  }
</script>

<TenantGuard>
<div class="inventory-page">
  <!-- Header -->
  <div class="page-header">
    <div class="header-left">
      <button class="back-button" on:click={() => goto('/dashboard')}>
        ← Back to Dashboard
      </button>
      <h1>📦 Inventory Management</h1>
      <p class="subtitle">Centralized asset tracking and management</p>
    </div>
    
    <div class="header-actions">
      <button class="btn-secondary" on:click={handleScanBarcode}>
        📷 Scan Barcode
      </button>
      <button class="btn-secondary" on:click={() => goto('/modules/inventory/reports')}>
        📊 View Reports
      </button>
      <button class="btn-secondary" on:click={handleExport}>
        📥 Export CSV
      </button>
      <button class="btn-primary" on:click={() => goto('/modules/inventory/add')}>
        ➕ Add Item
      </button>
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
      <div class="stat-icon">📦</div>
      <div>
        <div class="stat-value">{stats.totalItems}</div>
        <div class="stat-label">Total Items</div>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon">✅</div>
      <div>
        <div class="stat-value">
          {stats.byStatus.find((s: any) => s._id === 'available')?.count || 0}
        </div>
        <div class="stat-label">Available</div>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon">🚀</div>
      <div>
        <div class="stat-value">
          {stats.byStatus.find((s: any) => s._id === 'deployed')?.count || 0}
        </div>
        <div class="stat-label">Deployed</div>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon">💰</div>
      <div>
        <div class="stat-value">{formatCurrency(stats.totalValue)}</div>
        <div class="stat-label">Total Value</div>
      </div>
    </div>
  </div>
  
  <!-- Filters -->
  <div class="filters-section">
    <div class="filters-row">
      <div class="search-box">
        <input
          type="text"
          placeholder="🔍 Search by serial number, model, manufacturer..."
          bind:value={searchQuery}
          on:keydown={(e) => e.key === 'Enter' && applyFilters()}
        />
      </div>
      
      <select bind:value={selectedCategory}>
        <option value="">All Categories</option>
        {#each categories as category}
          <option value={category}>{category}</option>
        {/each}
      </select>
      
      <select bind:value={selectedStatus}>
        <option value="">All Statuses</option>
        {#each statuses as status}
          <option value={status}>{status}</option>
        {/each}
      </select>
      
      <select bind:value={selectedLocation}>
        <option value="">All Locations</option>
        {#each locationTypes as locType}
          <option value={locType}>{locType}</option>
        {/each}
      </select>
      
      <button class="btn-primary" on:click={applyFilters}>Apply</button>
      <button class="btn-secondary" on:click={clearFilters}>Clear</button>
    </div>
  </div>
  
  <!-- Loading State -->
  {#if isLoading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading inventory...</p>
    </div>
  {:else}
    <!-- Inventory Table -->
    <div class="table-container">
      <table class="inventory-table">
        <thead>
          <tr>
            <th on:click={() => handleSort('assetTag')}>Asset Tag</th>
            <th on:click={() => handleSort('category')}>Category</th>
            <th on:click={() => handleSort('equipmentType')}>Type</th>
            <th on:click={() => handleSort('manufacturer')}>Manufacturer</th>
            <th on:click={() => handleSort('model')}>Model</th>
            <th on:click={() => handleSort('serialNumber')}>Serial Number</th>
            <th on:click={() => handleSort('status')}>Status</th>
            <th on:click={() => handleSort('condition')}>Condition</th>
            <th>Location</th>
            <th on:click={() => handleSort('updatedAt')}>Last Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if items.length === 0}
            <tr>
              <td colspan="11" class="empty-state">
                <div>
                  <p>📦 No inventory items found</p>
                  <button class="btn-primary" on:click={() => goto('/modules/inventory/add')}>
                    Add Your First Item
                  </button>
                </div>
              </td>
            </tr>
          {:else}
            {#each items as item}
              <tr>
                <td>{item.assetTag || '-'}</td>
                <td><span class="category-badge">{item.category}</span></td>
                <td>{item.equipmentType}</td>
                <td>{item.manufacturer || '-'}</td>
                <td>{item.model || '-'}</td>
                <td><code>{item.serialNumber}</code></td>
                <td>
                  <span 
                    class="status-badge" 
                    style="background-color: {getStatusColor(item.status)}20; color: {getStatusColor(item.status)}"
                  >
                    {item.status}
                  </span>
                </td>
                <td>
                  <span class="condition-badge">
                    {getConditionEmoji(item.condition)} {item.condition}
                  </span>
                </td>
                <td>
                  <div class="location-cell">
                    <div class="location-type">{item.currentLocation.type}</div>
                    {#if item.currentLocation.siteName}
                      <div class="location-name">{item.currentLocation.siteName}</div>
                    {/if}
                  </div>
                </td>
                <td>{formatDate(item.updatedAt)}</td>
                <td>
                  <div class="action-buttons">
                    <button 
                      class="btn-icon" 
                      title="Print Asset Tag"
                      on:click={() => handlePrintTag(item)}
                    >
                      🏷️
                    </button>
                    <button 
                      class="btn-icon" 
                      title="View Details"
                      on:click={() => goto(`/modules/inventory/${item._id}`)}
                    >
                      👁️
                    </button>
                    <button 
                      class="btn-icon" 
                      title="Edit"
                      on:click={() => goto(`/modules/inventory/${item._id}/edit`)}
                    >
                      ✏️
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
    
    <!-- Pagination -->
    {#if pagination.pages > 1}
      <div class="pagination">
        <button 
          class="btn-secondary"
          disabled={pagination.page === 1}
          on:click={() => goToPage(pagination.page - 1)}
        >
          ← Previous
        </button>
        
        <span class="pagination-info">
          Page {pagination.page} of {pagination.pages} 
          ({pagination.total} items)
        </span>
        
        <button 
          class="btn-secondary"
          disabled={pagination.page === pagination.pages}
          on:click={() => goToPage(pagination.page + 1)}
        >
          Next →
        </button>
      </div>
    {/if}
  {/if}
  
  <!-- Asset Tag Viewer -->
  {#if selectedItemForTag}
    <AssetTagViewer bind:show={showAssetTag} item={selectedItemForTag} />
  {/if}
</div>
</TenantGuard>

<style>
  .inventory-page {
    min-height: 100vh;
    background: var(--bg-primary);
    padding: 2rem;
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .header-left {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .back-button {
    background: none;
    border: 1px solid var(--border-color);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--text-secondary);
    width: fit-content;
  }
  
  .back-button:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  h1 {
    font-size: 2rem;
    margin: 0;
    color: var(--text-primary);
  }
  
  .subtitle {
    color: var(--text-secondary);
    margin: 0;
  }
  
  .header-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }
  
  .btn-primary, .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--brand-primary);
    color: white;
  }
  
  .btn-primary:hover {
    background: var(--brand-primary-hover);
    transform: translateY(-2px);
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }
  
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
  
  .stats-bar {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .stat-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .stat-icon {
    font-size: 2.5rem;
  }
  
  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--brand-primary);
  }
  
  .stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .filters-section {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .filters-row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: center;
  }
  
  .search-box {
    flex: 1;
    min-width: 300px;
  }
  
  .search-box input,
  .filters-row select {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    width: 100%;
  }
  
  .filters-row select {
    min-width: 150px;
  }
  
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4rem;
    gap: 1rem;
  }
  
  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(124, 58, 237, 0.2);
    border-top-color: var(--brand-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .table-container {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow-x: auto;
  }
  
  .inventory-table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .inventory-table thead {
    background: var(--bg-secondary);
    border-bottom: 2px solid var(--border-color);
  }
  
  .inventory-table th {
    padding: 1rem;
    text-align: left;
    font-weight: 600;
    color: var(--text-primary);
    cursor: pointer;
    user-select: none;
  }
  
  .inventory-table th:hover {
    background: var(--bg-hover);
  }
  
  .inventory-table td {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .inventory-table tbody tr:hover {
    background: var(--bg-hover);
  }
  
  .empty-state {
    text-align: center;
    padding: 4rem !important;
  }
  
  .empty-state > div {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  
  .category-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    background: var(--bg-secondary);
    border-radius: 4px;
    font-size: 0.875rem;
  }
  
  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: capitalize;
  }
  
  .condition-badge {
    font-size: 0.875rem;
    text-transform: capitalize;
  }
  
  .location-cell {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .location-type {
    text-transform: capitalize;
    font-weight: 600;
  }
  
  .location-name {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  code {
    background: var(--bg-secondary);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
  }
  
  .action-buttons {
    display: flex;
    gap: 0.5rem;
  }
  
  .btn-icon {
    background: none;
    border: 1px solid var(--border-color);
    padding: 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1.1rem;
  }
  
  .btn-icon:hover {
    background: var(--bg-hover);
  }
  
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem 0;
  }
  
  .pagination-info {
    color: var(--text-secondary);
  }
  
  @media (max-width: 1024px) {
    .inventory-page {
      padding: 1rem;
    }
    
    .page-header {
      flex-direction: column;
    }
    
    .header-actions {
      width: 100%;
      flex-direction: column;
    }
    
    .search-box {
      min-width: 100%;
    }
  }
</style>

