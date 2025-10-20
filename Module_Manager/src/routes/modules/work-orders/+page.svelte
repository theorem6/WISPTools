<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/TenantGuard.svelte';
  import { workOrderService, type WorkOrder, type WorkOrderFilters } from '$lib/services/workOrderService';
  import CreateWorkOrderModal from './components/CreateWorkOrderModal.svelte';
  import WorkOrderCard from './components/WorkOrderCard.svelte';
  
  let workOrders: WorkOrder[] = [];
  let isLoading = true;
  let error = '';
  let success = '';
  
  let showCreateModal = false;
  
  let filters: WorkOrderFilters = {
    status: '',
    priority: '',
    type: ''
  };
  
  let stats = {
    totalOpen: 0,
    byStatus: [],
    byPriority: [],
    avgResolutionTime: 0
  };
  
  $: tenantId = $currentTenant?.id || '';
  $: tenantName = $currentTenant?.displayName || 'Organization';
  
  // Filter arrays
  const statuses = ['open', 'assigned', 'in-progress', 'waiting-parts', 'resolved', 'closed'];
  const priorities = ['low', 'medium', 'high', 'critical'];
  const types = ['installation', 'repair', 'maintenance', 'upgrade', 'removal', 'troubleshoot', 'inspection'];
  
  onMount(async () => {
    if (tenantId) {
      await loadData();
    }
  });
  
  $: if (browser && tenantId) {
    loadData();
  }
  
  async function loadData() {
    isLoading = true;
    error = '';
    
    try {
      const [orders, statistics] = await Promise.all([
        workOrderService.getWorkOrders(filters),
        workOrderService.getStats()
      ]);
      
      workOrders = orders;
      stats = statistics as any;
    } catch (err: any) {
      error = err.message || 'Failed to load work orders';
      console.error('Work order loading error:', err);
    } finally {
      isLoading = false;
    }
  }
  
  function applyFilters() {
    loadData();
  }
  
  function clearFilters() {
    filters = { status: '', priority: '', type: '' };
    loadData();
  }
  
  async function handleWorkOrderSaved() {
    showCreateModal = false;
    success = 'Work order created successfully';
    setTimeout(() => success = '', 3000);
    await loadData();
  }
  
  function getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      critical: '#ef4444',
      high: '#f59e0b',
      medium: '#3b82f6',
      low: '#6b7280'
    };
    return colors[priority] || '#6b7280';
  }
  
  function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      open: '#6b7280',
      assigned: '#3b82f6',
      'in-progress': '#f59e0b',
      'waiting-parts': '#8b5cf6',
      resolved: '#10b981',
      closed: '#374151',
      cancelled: '#9ca3af'
    };
    return colors[status] || '#6b7280';
  }
</script>

<TenantGuard>
<div class="work-orders-page">
  <div class="page-header">
    <div class="header-left">
      <button class="back-button" on:click={() => goto('/dashboard')}>
        ← Back to Dashboard
      </button>
      <h1>📋 Work Orders & Tickets</h1>
      <p class="subtitle">Field operations and trouble ticket management</p>
    </div>
    
    <div class="header-actions">
      <button class="btn-secondary" on:click={() => loadData()}>
        🔄 Refresh
      </button>
      <button class="btn-primary" on:click={() => showCreateModal = true}>
        ➕ Create Work Order
      </button>
    </div>
  </div>
  
  <!-- Alerts -->
  {#if error}
    <div class="alert alert-error">
      <span>⚠️</span>
      <span>{error}</span>
      <button class="dismiss-btn" on:click={() => error = ''}>✕</button>
    </div>
  {/if}
  
  {#if success}
    <div class="alert alert-success">
      <span>✅</span>
      <span>{success}</span>
      <button class="dismiss-btn" on:click={() => success = ''}>✕</button>
    </div>
  {/if}
  
  <!-- Stats Bar -->
  <div class="stats-bar">
    <div class="stat-card">
      <div class="stat-icon">📋</div>
      <div class="stat-content">
        <div class="stat-value">{workOrders.length}</div>
        <div class="stat-label">Total Tickets</div>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon">🔓</div>
      <div class="stat-content">
        <div class="stat-value">{stats.totalOpen}</div>
        <div class="stat-label">Open</div>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon">⚡</div>
      <div class="stat-content">
        <div class="stat-value">
          {workOrders.filter(wo => wo.priority === 'critical' || wo.priority === 'high').length}
        </div>
        <div class="stat-label">High Priority</div>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon">⏱️</div>
      <div class="stat-content">
        <div class="stat-value">
          {stats.avgResolutionTime ? Math.round(stats.avgResolutionTime) : 0}h
        </div>
        <div class="stat-label">Avg Resolution</div>
      </div>
    </div>
  </div>
  
  <!-- Filters -->
  <div class="filters-section">
    <div class="filters-row">
      <select bind:value={filters.status} on:change={applyFilters}>
        <option value="">All Statuses</option>
        {#each statuses as status}
          <option value={status}>{status}</option>
        {/each}
      </select>
      
      <select bind:value={filters.priority} on:change={applyFilters}>
        <option value="">All Priorities</option>
        {#each priorities as priority}
          <option value={priority}>{priority}</option>
        {/each}
      </select>
      
      <select bind:value={filters.type} on:change={applyFilters}>
        <option value="">All Types</option>
        {#each types as type}
          <option value={type}>{type}</option>
        {/each}
      </select>
      
      <button class="btn-secondary" on:click={clearFilters}>
        Clear Filters
      </button>
    </div>
  </div>
  
  <!-- Work Orders List -->
  {#if isLoading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading work orders...</p>
    </div>
  {:else}
    <div class="work-orders-grid">
      {#each workOrders as workOrder}
        <WorkOrderCard 
          {workOrder} 
          on:click={() => goto(`/modules/work-orders/${workOrder._id}`)}
          on:refresh={loadData}
        />
      {/each}
      
      {#if workOrders.length === 0}
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>No work orders found</h3>
          <p>Create your first work order or adjust filters</p>
          <button class="btn-primary" on:click={() => showCreateModal = true}>
            ➕ Create Work Order
          </button>
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Create Modal -->
  <CreateWorkOrderModal 
    bind:show={showCreateModal}
    {tenantId}
    on:saved={handleWorkOrderSaved}
  />
</div>
</TenantGuard>

<style>
  .work-orders-page {
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
    color: var(--text-secondary);
    width: fit-content;
    transition: all 0.2s;
  }
  
  .back-button:hover {
    background: var(--bg-hover);
    color: var(--brand-primary);
    border-color: var(--brand-primary);
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
  }
  
  .filters-row select {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    min-width: 150px;
    text-transform: capitalize;
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
  
  .work-orders-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1.5rem;
  }
  
  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 4rem;
    background: var(--card-bg);
    border: 2px dashed var(--border-color);
    border-radius: 12px;
  }
  
  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }
  
  .empty-state h3 {
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
  }
  
  .empty-state p {
    color: var(--text-secondary);
    margin: 0 0 1.5rem 0;
  }
  
  @media (max-width: 768px) {
    .work-orders-page {
      padding: 1rem;
    }
    
    .page-header {
      flex-direction: column;
    }
    
    .work-orders-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

