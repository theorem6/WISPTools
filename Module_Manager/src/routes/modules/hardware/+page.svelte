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
  
  // Data
  let items: InventoryItem[] = [];
  let isLoading = true;
  let error = '';
  let success = '';
  
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
  
  onMount(async () => {
    await loadData();
  });
  
  async function loadData() {
    isLoading = true;
    error = '';
    
    try {
      // Load stats
      stats = await inventoryService.getStats();
      
      // Load items
      await applyFilters();
    } catch (err: any) {
      console.error('Error loading hardware:', err);
      error = err.message || 'Failed to load hardware';
    } finally {
      isLoading = false;
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
      <button class="btn-primary" on:click={() => goto('/modules/inventory/add')}>
        ➕ Add Hardware
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
      <div class="stat-icon">🔧</div>
      <div>
        <div class="stat-value">{stats.totalItems}</div>
        <div class="stat-label">Total Hardware</div>
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
        <div class="stat-value">{getStatusCount('deployed')}</div>
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
    
    <div class="stat-card">
      <div class="stat-icon">🏗️</div>
      <div>
        <div class="stat-value">{getStatusCount('maintenance')}</div>
        <div class="stat-label">In Maintenance</div>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon">📦</div>
      <div>
        <div class="stat-value">{getStatusCount('reserved')}</div>
        <div class="stat-label">Reserved</div>
      </div>
    </div>
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
  
  <!-- Hardware Table -->
  {#if isLoading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading hardware...</p>
    </div>
  {:else if items.length === 0}
    <div class="empty-state">
      <span class="empty-icon">🔧</span>
      <h3>No hardware found</h3>
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
  {:else}
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
</style>

