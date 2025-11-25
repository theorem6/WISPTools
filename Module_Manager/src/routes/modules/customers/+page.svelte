<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { customerService, type Customer } from '$lib/services/customerService';
  import AddEditCustomerModal from './components/AddEditCustomerModal.svelte';
  import { goto } from '$app/navigation';
  
  // Data
  let customers: Customer[] = [];
  let isLoading = true;
  let error = '';
  let success = '';
  
  // Modals
  let showAddModal = false;
  let showEditModal = false;
  let selectedCustomer: Customer | null = null;
  
  // Search & Filters
  let searchQuery = '';
  let selectedStatus = '';
  let showInactive = false;
  
  // Stats
  let stats = {
    total: 0,
    active: 0,
    pending: 0,
    suspended: 0,
    cancelled: 0
  };
  
  $: tenantId = $currentTenant?.id || '';
  
  onMount(() => {
    if (tenantId) {
      loadCustomers();
    }
  });
  
  $: if (tenantId) {
    loadCustomers();
  }
  
  async function loadCustomers() {
    if (!tenantId) return;
    
    try {
      isLoading = true;
      error = '';
      
      const filters: any = {
        limit: 1000
      };
      
      if (searchQuery.trim()) {
        filters.search = searchQuery.trim();
      }
      
      if (selectedStatus) {
        filters.status = selectedStatus;
      }
      
      customers = await customerService.searchCustomers(filters);
      
      // Filter out inactive if needed
      if (!showInactive) {
        customers = customers.filter(c => c.isActive !== false);
      }
      
      // Calculate stats
      calculateStats();
      
    } catch (err: any) {
      error = err.message || 'Failed to load customers';
      customers = [];
    } finally {
      isLoading = false;
    }
  }
  
  function calculateStats() {
    stats.total = customers.length;
    stats.active = customers.filter(c => c.serviceStatus === 'active').length;
    stats.pending = customers.filter(c => c.serviceStatus === 'pending').length;
    stats.suspended = customers.filter(c => c.serviceStatus === 'suspended').length;
    stats.cancelled = customers.filter(c => c.serviceStatus === 'cancelled').length;
  }
  
  function handleAdd() {
    selectedCustomer = null;
    showAddModal = true;
  }
  
  function handleEdit(customer: Customer) {
    selectedCustomer = customer;
    showEditModal = true;
  }
  
  function handleDelete(customer: Customer) {
    if (!confirm(`Are you sure you want to delete customer ${customer.fullName || customer.customerId}?`)) {
      return;
    }
    
    deleteCustomer(customer);
  }
  
  async function deleteCustomer(customer: Customer) {
    try {
      if (!customer._id) {
        error = 'Customer ID not found';
        return;
      }
      
      await customerService.deleteCustomer(customer._id);
      success = `Customer ${customer.fullName || customer.customerId} deleted successfully`;
      
      setTimeout(() => {
        success = '';
      }, 3000);
      
      await loadCustomers();
    } catch (err: any) {
      error = err.message || 'Failed to delete customer';
      setTimeout(() => {
        error = '';
      }, 5000);
    }
  }
  
  function handleModalClose() {
    showAddModal = false;
    showEditModal = false;
    selectedCustomer = null;
  }
  
  function handleCustomerSaved() {
    handleModalClose();
    loadCustomers();
    success = selectedCustomer ? 'Customer updated successfully' : 'Customer created successfully';
    setTimeout(() => {
      success = '';
    }, 3000);
  }
  
  function formatPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  }
  
  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'active': return 'status-active';
      case 'pending': return 'status-pending';
      case 'suspended': return 'status-suspended';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-pending';
    }
  }
</script>

<TenantGuard>
  <div class="customers-page">
    <div class="page-header">
      <div class="header-content">
        <div class="header-top">
          <button class="back-btn" on:click={() => goto('/modules')} title="Back to Module Manager">
            ←
          </button>
          <h1>👥 Customer Management</h1>
        </div>
        <p class="subtitle">Manage your tenant's customers and subscribers</p>
      </div>
      <button class="btn-primary" on:click={handleAdd}>
        ➕ Add Customer
      </button>
    </div>
    
    {#if error}
      <div class="alert alert-error">{error}</div>
    {/if}
    
    {#if success}
      <div class="alert alert-success">{success}</div>
    {/if}
    
    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{stats.total}</div>
        <div class="stat-label">Total Customers</div>
      </div>
      <div class="stat-card stat-active">
        <div class="stat-value">{stats.active}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card stat-pending">
        <div class="stat-value">{stats.pending}</div>
        <div class="stat-label">Pending</div>
      </div>
      <div class="stat-card stat-suspended">
        <div class="stat-value">{stats.suspended}</div>
        <div class="stat-label">Suspended</div>
      </div>
    </div>
    
    <!-- Search and Filters -->
    <div class="filters-section">
      <div class="search-bar">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search by name, phone, email, or customer ID..."
          class="search-input"
          on:input={() => loadCustomers()}
        />
      </div>
      
      <div class="filter-controls">
        <select bind:value={selectedStatus} on:change={() => loadCustomers()}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
          <option value="trial">Trial</option>
        </select>
        
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={showInactive} on:change={() => loadCustomers()} />
          Show Inactive
        </label>
      </div>
    </div>
    
    <!-- Customer List -->
    <div class="customers-list">
      {#if isLoading}
        <div class="loading">Loading customers...</div>
      {:else if customers.length === 0}
        <div class="empty-state">
          <p>No customers found.</p>
          <button class="btn-primary" on:click={handleAdd}>Add Your First Customer</button>
        </div>
      {:else}
        <div class="customer-grid">
          {#each customers as customer (customer._id || customer.customerId)}
            <div class="customer-card">
              <div class="customer-header">
                <div class="customer-name-section">
                  <h3>{customer.fullName || `${customer.firstName} ${customer.lastName}`}</h3>
                  <span class="customer-id">{customer.customerId}</span>
                </div>
                <span class="status-badge {getStatusBadgeClass(customer.serviceStatus)}">
                  {customer.serviceStatus}
                </span>
              </div>
              
              <div class="customer-details">
                {#if customer.primaryPhone}
                  <div class="detail-row">
                    <span class="detail-icon">📞</span>
                    <span>{formatPhone(customer.primaryPhone)}</span>
                  </div>
                {/if}
                
                {#if customer.email}
                  <div class="detail-row">
                    <span class="detail-icon">📧</span>
                    <span>{customer.email}</span>
                  </div>
                {/if}
                
                {#if customer.serviceAddress?.street}
                  <div class="detail-row">
                    <span class="detail-icon">📍</span>
                    <span>
                      {customer.serviceAddress.street}
                      {#if customer.serviceAddress.city}
                        , {customer.serviceAddress.city}
                      {/if}
                      {#if customer.serviceAddress.state}
                        , {customer.serviceAddress.state}
                      {/if}
                    </span>
                  </div>
                {/if}
                
                {#if customer.servicePlan?.planName}
                  <div class="detail-row">
                    <span class="detail-icon">📡</span>
                    <span>
                      {customer.servicePlan.planName}
                      {#if customer.servicePlan.downloadMbps}
                        ({customer.servicePlan.downloadMbps}/{customer.servicePlan.uploadMbps} Mbps)
                      {/if}
                    </span>
                  </div>
                {/if}
                
                {#if customer.networkInfo?.imsi}
                  <div class="detail-row">
                    <span class="detail-icon">🔢</span>
                    <span>IMSI: {customer.networkInfo.imsi}</span>
                  </div>
                {/if}
              </div>
              
              <div class="customer-actions">
                <button class="btn-secondary btn-sm" on:click={() => handleEdit(customer)}>
                  ✏️ Edit
                </button>
                <button class="btn-danger btn-sm" on:click={() => handleDelete(customer)}>
                  🗑️ Delete
                </button>
                <button class="btn-secondary btn-sm" on:click={() => goto(`/modules/customers/${customer._id || customer.customerId}`)}>
                  👁️ View
                </button>
                <a 
                  href="/modules/customers/portal/login" 
                  target="_blank" 
                  class="btn-secondary btn-sm"
                  title="Open Customer Portal"
                >
                  🌐 Portal
                </a>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  
  {#if showAddModal}
    <AddEditCustomerModal
      show={showAddModal}
      customer={null}
      on:saved={handleCustomerSaved}
      on:close={handleModalClose}
    />
  {/if}
  
  {#if showEditModal && selectedCustomer}
    <AddEditCustomerModal
      show={showEditModal}
      customer={selectedCustomer}
      on:saved={handleCustomerSaved}
      on:close={handleModalClose}
    />
  {/if}
</TenantGuard>

<style>
  .customers-page {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid var(--border-color);
  }
  
  .header-content {
    flex: 1;
  }
  
  .header-top {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .back-btn {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 0.5rem 0.75rem;
    font-size: 1.2rem;
    cursor: pointer;
    color: var(--text-primary);
    transition: var(--transition);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
  }
  
  .back-btn:hover {
    background: var(--bg-tertiary);
    border-color: var(--brand-primary);
    transform: translateX(-2px);
  }
  
  .header-content h1 {
    margin: 0;
    font-size: 2rem;
    color: var(--text-primary);
  }
  
  .subtitle {
    margin: 0.5rem 0 0 0;
    color: var(--text-secondary);
    font-size: 0.95rem;
  }
  
  .btn-primary {
    padding: 0.75rem 1.5rem;
    background: var(--gradient-primary);
    color: white;
    border: none;
    border-radius: var(--border-radius);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
  }
  
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }
  
  .alert {
    padding: 1rem;
    border-radius: var(--border-radius);
    margin-bottom: 1rem;
  }
  
  .alert-error {
    background: var(--danger-light, #fee);
    color: var(--danger, #c00);
    border: 1px solid var(--danger);
  }
  
  .alert-success {
    background: var(--success-light, #d4edda);
    color: var(--success, #155724);
    border: 1px solid var(--success);
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .stat-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1.5rem;
    text-align: center;
  }
  
  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }
  
  .stat-label {
    color: var(--text-secondary);
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .stat-active {
    border-color: var(--success);
    background: var(--success-light, #d4edda20);
  }
  
  .stat-pending {
    border-color: var(--warning);
    background: var(--warning-light, #fff3cd20);
  }
  
  .stat-suspended {
    border-color: var(--danger);
    background: var(--danger-light, #f8d7da20);
  }
  
  .filters-section {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1rem;
    margin-bottom: 2rem;
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    align-items: center;
  }
  
  .search-bar {
    flex: 1;
    min-width: 300px;
  }
  
  .search-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-size: 1rem;
  }
  
  .filter-controls {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  
  .filter-controls select {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--card-bg);
    color: var(--text-primary);
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-primary);
    cursor: pointer;
  }
  
  .loading {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
  }
  
  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-secondary);
  }
  
  .customer-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }
  
  .customer-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1.5rem;
    transition: var(--transition);
  }
  
  .customer-card:hover {
    border-color: var(--brand-primary);
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }
  
  .customer-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .customer-name-section h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1.2rem;
    color: var(--text-primary);
  }
  
  .customer-id {
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-family: monospace;
  }
  
  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .status-active {
    background: var(--success-light, #d4edda);
    color: var(--success, #155724);
  }
  
  .status-pending {
    background: var(--warning-light, #fff3cd);
    color: var(--warning, #856404);
  }
  
  .status-suspended {
    background: var(--danger-light, #f8d7da);
    color: var(--danger, #721c24);
  }
  
  .status-cancelled {
    background: #e9ecef;
    color: #495057;
  }
  
  .customer-details {
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .detail-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  
  .detail-icon {
    font-size: 1rem;
  }
  
  .customer-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .btn-secondary,
  .btn-danger {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: var(--border-radius);
    font-size: 0.85rem;
    cursor: pointer;
    transition: var(--transition);
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }
  
  .btn-danger {
    background: var(--danger);
    color: white;
  }
  
  .btn-danger:hover {
    background: var(--danger-dark, #c82333);
  }
  
  .btn-sm {
    padding: 0.4rem 0.75rem;
    font-size: 0.8rem;
  }
</style>

