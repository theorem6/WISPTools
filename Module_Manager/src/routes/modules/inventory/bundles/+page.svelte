<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { bundleService, type HardwareBundle, type BundleFilters } from '$lib/services/bundleService';
  import { equipmentCategories, categoryList, getEquipmentTypesByCategory } from '$lib/config/equipmentCategories';
  import CreateBundleModal from './components/CreateBundleModal.svelte';
  import BundleDetailsModal from './components/BundleDetailsModal.svelte';
  
  // Data
  let bundles: HardwareBundle[] = [];
  let isLoading = true;
  let error = '';
  let success = '';
  
  // Filters
  let filters: BundleFilters = {
    status: 'active',
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
  let selectedBundleType = '';
  let selectedStatus = 'active';
  
  // Modals
  let showCreateModal = false;
  let showDetailsModal = false;
  let selectedBundle: HardwareBundle | null = null;
  
  $: tenantId = $currentTenant?.id || '';
  
  const bundleTypes = [
    { value: '', label: 'All Types' },
    { value: 'standard', label: 'Standard' },
    { value: 'custom', label: 'Custom' },
    { value: 'site-deployment', label: 'Site Deployment' },
    { value: 'cpe-installation', label: 'CPE Installation' },
    { value: 'maintenance-kit', label: 'Maintenance Kit' },
    { value: 'emergency-kit', label: 'Emergency Kit' }
  ];
  
  const statuses = [
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
    { value: 'draft', label: 'Draft' }
  ];
  
  onMount(async () => {
    if (tenantId) {
      await loadBundles();
    }
    isLoading = false;
  });
  
  $: if (tenantId) {
    loadBundles();
  }
  
  async function loadBundles() {
    isLoading = true;
    error = '';
    
    try {
      const queryFilters: BundleFilters = {
        ...filters,
        status: selectedStatus || 'active',
        bundleType: selectedBundleType || undefined,
        search: searchQuery || undefined
      };
      
      const result = await bundleService.getBundles(queryFilters);
      bundles = result.bundles;
      pagination = result.pagination;
    } catch (err: any) {
      error = err.message || 'Failed to load bundles';
      console.error('Error loading bundles:', err);
    } finally {
      isLoading = false;
    }
  }
  
  function applyFilters() {
    filters.page = 1;
    loadBundles();
  }
  
  function handleSearch() {
    filters.page = 1;
    loadBundles();
  }
  
  function handlePageChange(page: number) {
    filters.page = page;
    loadBundles();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  function openCreateModal() {
    showCreateModal = true;
  }
  
  function closeCreateModal() {
    showCreateModal = false;
    loadBundles();
  }
  
  function openDetailsModal(bundle: HardwareBundle) {
    selectedBundle = bundle;
    showDetailsModal = true;
  }
  
  function closeDetailsModal() {
    showDetailsModal = false;
    selectedBundle = null;
    loadBundles();
  }
  
  async function handleDelete(bundle: HardwareBundle) {
    if (!confirm(`Are you sure you want to delete bundle "${bundle.name}"?`)) {
      return;
    }
    
    try {
      await bundleService.deleteBundle(bundle._id!);
      success = 'Bundle deleted successfully';
      loadBundles();
      setTimeout(() => success = '', 3000);
    } catch (err: any) {
      error = err.message || 'Failed to delete bundle';
      setTimeout(() => error = '', 5000);
    }
  }
  
  async function handleArchive(bundle: HardwareBundle) {
    try {
      await bundleService.updateBundle(bundle._id!, { status: 'archived' });
      success = 'Bundle archived successfully';
      loadBundles();
      setTimeout(() => success = '', 3000);
    } catch (err: any) {
      error = err.message || 'Failed to archive bundle';
      setTimeout(() => error = '', 5000);
    }
  }
  
  function formatCurrency(amount: number | undefined): string {
    if (!amount) return 'N/A';
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  function formatDate(date: string | Date | undefined): string {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
  }
  
  function getBundleTypeLabel(type: string): string {
    const found = bundleTypes.find(t => t.value === type);
    return found?.label || type;
  }
  
  function getBundleTypeEmoji(type: string): string {
    const emojis: Record<string, string> = {
      'standard': '📦',
      'custom': '🔧',
      'site-deployment': '🏗️',
      'cpe-installation': '📡',
      'maintenance-kit': '🔧',
      'emergency-kit': '🚨'
    };
    return emojis[type] || '📦';
  }
</script>

<div class="bundles-page">
  <!-- Header -->
  <div class="page-header">
    <div class="header-left">
      <button class="back-button" on:click={() => goto('/modules/inventory')}>
        ← Back to Inventory
      </button>
      <h1>📦 Hardware Bundles</h1>
      <p class="subtitle">Create and manage hardware bundles for easy planning and deployment</p>
    </div>
    
    <div class="header-actions">
      <button class="btn-primary" on:click={openCreateModal}>
        ➕ Create Bundle
      </button>
    </div>
  </div>
  
  <!-- Alerts -->
  {#if error}
    <div class="alert alert-error">
      <span>❌</span>
      <span>{error}</span>
      <button on:click={() => error = ''}>✕</button>
    </div>
  {/if}
  
  {#if success}
    <div class="alert alert-success">
      <span>✓</span>
      <span>{success}</span>
      <button on:click={() => success = ''}>✕</button>
    </div>
  {/if}
  
  <!-- Filters -->
  <div class="filters">
    <div class="search-box">
      <span class="search-icon">🔍</span>
      <input
        type="text"
        placeholder="Search bundles..."
        bind:value={searchQuery}
        on:input={handleSearch}
      />
    </div>
    
    <select bind:value={selectedBundleType} on:change={applyFilters}>
      {#each bundleTypes as type}
        <option value={type.value}>{type.label}</option>
      {/each}
    </select>
    
    <select bind:value={selectedStatus} on:change={applyFilters}>
      {#each statuses as status}
        <option value={status.value}>{status.label}</option>
      {/each}
    </select>
    
    <div class="results-count">
      {bundles.length} of {pagination.total} bundles
    </div>
  </div>
  
  <!-- Bundles List -->
  {#if isLoading}
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Loading bundles...</p>
    </div>
  {:else if bundles.length === 0}
    <div class="empty-state">
      <span class="empty-icon">📦</span>
      <h3>No bundles found</h3>
      <p>Create your first hardware bundle to get started</p>
      <button class="btn-primary" on:click={openCreateModal}>
        ➕ Create Bundle
      </button>
    </div>
  {:else}
    <div class="bundles-grid">
      {#each bundles as bundle (bundle._id)}
        <div class="bundle-card">
          <div class="bundle-header">
            <div class="bundle-icon">{getBundleTypeEmoji(bundle.bundleType)}</div>
            <div class="bundle-title">
              <h3>{bundle.name}</h3>
              <span class="bundle-type">{getBundleTypeLabel(bundle.bundleType)}</span>
            </div>
            <div class="bundle-status">
              <span class="badge badge-{bundle.status}">{bundle.status}</span>
            </div>
          </div>
          
          {#if bundle.description}
            <p class="bundle-description">{bundle.description}</p>
          {/if}
          
          <div class="bundle-stats">
            <div class="stat">
              <span class="stat-label">Items:</span>
              <span class="stat-value">{bundle.items?.length || 0}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Total Cost:</span>
              <span class="stat-value">{formatCurrency(bundle.estimatedTotalCost)}</span>
            </div>
            {#if bundle.usageCount}
              <div class="stat">
                <span class="stat-label">Used:</span>
                <span class="stat-value">{bundle.usageCount} times</span>
              </div>
            {/if}
          </div>
          
          {#if bundle.tags && bundle.tags.length > 0}
            <div class="bundle-tags">
              {#each bundle.tags as tag}
                <span class="tag">{tag}</span>
              {/each}
            </div>
          {/if}
          
          <div class="bundle-actions">
            <button class="btn-secondary" on:click={() => openDetailsModal(bundle)}>
              👁️ View Details
            </button>
            <button class="btn-secondary" on:click={() => goto(`/modules/inventory/bundles/${bundle._id}/edit`)}>
              ✏️ Edit
            </button>
            {#if bundle.status === 'active'}
              <button class="btn-warning" on:click={() => handleArchive(bundle)}>
                📦 Archive
              </button>
            {/if}
            <button class="btn-danger" on:click={() => handleDelete(bundle)}>
              🗑️ Delete
            </button>
          </div>
          
          <div class="bundle-footer">
            <span class="footer-text">Updated: {formatDate(bundle.updatedAt)}</span>
            {#if bundle.lastUsedAt}
              <span class="footer-text">Last used: {formatDate(bundle.lastUsedAt)}</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
    
    <!-- Pagination -->
    {#if pagination.pages > 1}
      <div class="pagination">
        <button 
          class="btn-page" 
          disabled={pagination.page === 1}
          on:click={() => handlePageChange(pagination.page - 1)}
        >
          ← Previous
        </button>
        <span class="pagination-info">
          Page {pagination.page} of {pagination.pages}
        </span>
        <button 
          class="btn-page" 
          disabled={pagination.page === pagination.pages}
          on:click={() => handlePageChange(pagination.page + 1)}
        >
          Next →
        </button>
      </div>
    {/if}
  {/if}
</div>

<!-- Modals -->
{#if showCreateModal}
  <CreateBundleModal on:close={closeCreateModal} />
{/if}

{#if showDetailsModal && selectedBundle}
  <BundleDetailsModal bundle={selectedBundle} on:close={closeDetailsModal} />
{/if}

<style>
  .bundles-page {
    padding: 2rem;
    max-width: 1600px;
    margin: 0 auto;
    background: var(--bg-primary);
    min-height: 100vh;
    color: var(--text-primary);
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    gap: 2rem;
  }
  
  .header-left {
    flex: 1;
  }
  
  .back-button {
    padding: 0.5rem 1rem;
    margin-bottom: 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;
  }
  
  .back-button:hover {
    background: var(--bg-tertiary);
    border-color: var(--primary);
  }
  
  .page-header h1 {
    margin: 0 0 0.5rem;
    font-size: 2rem;
    color: var(--text-primary);
  }
  
  .subtitle {
    color: var(--text-secondary);
    margin: 0;
  }
  
  .header-actions {
    display: flex;
    gap: 1rem;
  }
  
  .btn-primary {
    padding: 0.75rem 1.5rem;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  .alert {
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    color: #ef4444;
  }
  
  .alert-success {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid #10b981;
    color: #10b981;
  }
  
  .alert button {
    margin-left: auto;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    opacity: 0.5;
  }
  
  .alert button:hover {
    opacity: 1;
  }
  
  .filters {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    align-items: center;
    flex-wrap: wrap;
  }
  
  .search-box {
    position: relative;
    flex: 1;
    min-width: 300px;
  }
  
  .search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0.5;
  }
  
  .search-box input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 3rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    font-size: 1rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  
  .filters select {
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    cursor: pointer;
  }
  
  .results-count {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-left: auto;
    white-space: nowrap;
  }
  
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    color: var(--text-secondary);
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    background: var(--card-bg, var(--bg-secondary));
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    min-height: 300px;
  }
  
  .empty-icon {
    font-size: 4rem;
    opacity: 0.4;
    margin-bottom: 1rem;
  }
  
  .empty-state h3 {
    margin: 0 0 0.5rem;
    color: var(--text-primary);
  }
  
  .bundles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .bundle-card {
    background: var(--card-bg, var(--bg-primary));
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    padding: 1.5rem;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .bundle-card:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }
  
  .bundle-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .bundle-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }
  
  .bundle-title {
    flex: 1;
  }
  
  .bundle-title h3 {
    margin: 0 0 0.25rem;
    font-size: 1.25rem;
    color: var(--text-primary);
  }
  
  .bundle-type {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .bundle-status {
    flex-shrink: 0;
  }
  
  .badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    font-weight: 500;
  }
  
  .badge-active {
    background: #10b981;
    color: white;
  }
  
  .badge-archived {
    background: #6b7280;
    color: white;
  }
  
  .badge-draft {
    background: #f59e0b;
    color: white;
  }
  
  .bundle-description {
    color: var(--text-secondary);
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.5;
  }
  
  .bundle-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
  }
  
  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .stat-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .stat-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .bundle-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .tag {
    padding: 0.25rem 0.75rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 1rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  
  .bundle-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .btn-secondary,
  .btn-warning,
  .btn-danger {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    flex: 1;
    min-width: 100px;
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }
  
  .btn-warning {
    background: #f59e0b;
    color: white;
  }
  
  .btn-warning:hover {
    opacity: 0.9;
  }
  
  .btn-danger {
    background: #ef4444;
    color: white;
  }
  
  .btn-danger:hover {
    opacity: 0.9;
  }
  
  .bundle-footer {
    display: flex;
    justify-content: space-between;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  
  .footer-text {
    font-size: 0.75rem;
  }
  
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    padding: 2rem 0;
  }
  
  .btn-page {
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-page:hover:not(:disabled) {
    background: var(--bg-tertiary);
    border-color: var(--primary);
  }
  
  .btn-page:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .pagination-info {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  
  @media (max-width: 768px) {
    .bundles-grid {
      grid-template-columns: 1fr;
    }
    
    .page-header {
      flex-direction: column;
    }
    
    .header-actions {
      width: 100%;
    }
    
    .bundle-actions {
      flex-direction: column;
    }
    
    .bundle-actions button {
      width: 100%;
    }
  }
</style>

