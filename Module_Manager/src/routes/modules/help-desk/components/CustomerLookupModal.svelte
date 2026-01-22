<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { customerService, type Customer } from '$lib/services/customerService';
  import { onMount } from 'svelte';
  
  export let onSelect: ((customer: Customer) => void) | null = null;
  
  const dispatch = createEventDispatcher();
  let searchQuery = '';
  let customers: Customer[] = [];
  let loading = false;
  let error = '';
  let selectedCustomerId: string | null = null;
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  
  onMount(() => {
    // Load initial list of customers
    loadCustomers();
  });
  
  async function loadCustomers() {
    if (!searchQuery.trim()) {
      // Load recent customers if no search
      try {
        loading = true;
        error = '';
        customers = await customerService.searchCustomers({ limit: 20 });
      } catch (err: any) {
        error = err.message || 'Failed to load customers';
        customers = [];
      } finally {
        loading = false;
      }
      return;
    }
    
    // Debounce search
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    searchTimeout = setTimeout(async () => {
      try {
        loading = true;
        error = '';
        customers = await customerService.searchCustomers({ 
          search: searchQuery.trim(),
          limit: 50 
        });
      } catch (err: any) {
        error = err.message || 'Failed to search customers';
        customers = [];
      } finally {
        loading = false;
      }
    }, 300);
  }
  
  $: if (searchQuery !== undefined) {
    loadCustomers();
  }
  
  function selectCustomer(customer: Customer) {
    selectedCustomerId = customer._id || customer.customerId || null;
    if (onSelect) {
      onSelect(customer);
    }
    dispatch('selected', customer);
    dispatch('close');
  }
  
  function formatPhone(phone: string): string {
    // Simple phone formatting
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  }
</script>

<div
  class="modal-backdrop"
  role="presentation"
  on:click={() => dispatch('close')}
>
  <div
    class="modal-content"
    data-size="sm"
    role="dialog"
    aria-modal="true"
    aria-labelledby="customer-lookup-heading"
    on:click|stopPropagation
  >
    <header class="modal-header">
      <div>
        <p class="modal-eyebrow">Customers</p>
        <h2 id="customer-lookup-heading">Customer Lookup</h2>
      </div>
      <button
        class="modal-close-btn"
        type="button"
        aria-label="Close customer lookup"
        on:click={() => dispatch('close')}
      >
        ✕
      </button>
    </header>
    
    <section class="modal-body">
      <div class="search-section">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search by name, phone, email, or customer ID..."
          class="search-input"
          on:input={() => loadCustomers()}
        />
      </div>
      
      {#if error}
        <div class="error-message" role="alert">{error}</div>
      {/if}
      
      {#if loading}
        <div class="state-message">Searching customers...</div>
      {:else if customers.length === 0 && searchQuery.trim()}
        <div class="state-message">
          <p>No customers found matching “{searchQuery}”.</p>
        </div>
      {:else if customers.length === 0}
        <div class="state-message">
          <p>No customers found. Create a customer first.</p>
        </div>
      {:else}
        <div class="customer-list" role="listbox" aria-label="Customer results">
          {#each customers as customer (customer._id || customer.customerId)}
            <button
              class="customer-item"
              type="button"
              role="option"
              aria-selected={selectedCustomerId === (customer._id || customer.customerId)}
              on:click={() => selectCustomer(customer)}
            >
              <div class="customer-header">
                <div class="customer-name">
                  <strong>{customer.fullName || `${customer.firstName} ${customer.lastName}`}</strong>
                  {#if customer.customerId}
                    <span class="customer-id">#{customer.customerId}</span>
                  {/if}
                </div>
                {#if customer.serviceStatus}
                  <span class="status-badge status-{customer.serviceStatus}">
                    {customer.serviceStatus}
                  </span>
                {/if}
              </div>
              
              <div class="customer-details">
                {#if customer.primaryPhone}
                  <div class="detail-item">
                    <span class="detail-label" aria-hidden="true">📞</span>
                    {formatPhone(customer.primaryPhone)}
                  </div>
                {/if}
                
                {#if customer.email}
                  <div class="detail-item">
                    <span class="detail-label" aria-hidden="true">📧</span>
                    {customer.email}
                  </div>
                {/if}
                
                {#if customer.serviceAddress?.street}
                  <div class="detail-item">
                    <span class="detail-label" aria-hidden="true">📍</span>
                    {customer.serviceAddress.street}
                    {#if customer.serviceAddress.city}
                      , {customer.serviceAddress.city}
                    {/if}
                  </div>
                {/if}
                
                {#if customer.networkInfo?.imsi}
                  <div class="detail-item">
                    <span class="detail-label" aria-hidden="true">📡</span>
                    IMSI: {customer.networkInfo.imsi}
                  </div>
                {/if}
              </div>
              
              {#if customer.servicePlan?.planName}
                <div class="customer-plan">
                  Plan: {customer.servicePlan.planName}
                  {#if customer.servicePlan.downloadMbps}
                    ({customer.servicePlan.downloadMbps}/{customer.servicePlan.uploadMbps} Mbps)
                  {/if}
                </div>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </section>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .modal-content {
    background: white;
    border-radius: 0.75rem;
    width: 90%;
    max-width: 600px;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  .modal-header h2 {
    margin: 0;
  }
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
  }
  .modal-body {
    padding: 1.5rem;
  }
  .search-section {
    margin-bottom: 1rem;
  }
  
  .search-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    font-size: 1rem;
  }
  
  .error-message {
    background: var(--danger-light, #fee);
    color: var(--danger, #c00);
    padding: 0.75rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .loading, .no-results {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
  }
  
  .customer-list {
    max-height: 60vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .customer-item {
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    background: var(--card-bg, #fff);
  }
  
  .customer-item:hover {
    background: var(--bg-hover, #f5f5f5);
    border-color: var(--brand-primary, #007bff);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .customer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  
  .customer-name {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .customer-name strong {
    font-size: 1.1rem;
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
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 0.5rem;
    font-size: 0.9rem;
  }
  
  .detail-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
  }
  
  .detail-label {
    font-size: 1rem;
  }
  
  .customer-plan {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-color);
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  /* Theme-aware overrides */
  .modal-content {
    background: var(--card-bg);
    border: 1px solid var(--border-light);
    box-shadow: var(--shadow-lg);
  }

  .modal-header h2 {
    color: var(--text-primary);
  }

  .modal-body {
    display: grid;
    gap: var(--spacing-lg);
    background: var(--card-bg);
  }

  .search-input {
    background: var(--input-bg);
    color: var(--text-primary);
    border-radius: var(--radius-md);
  }

  .search-input:focus {
    border-color: var(--primary-color);
    outline: 2px solid color-mix(in srgb, var(--primary) 35%, transparent);
    outline-offset: 2px;
  }

  .customer-item {
    background: var(--color-background-secondary);
    border-color: var(--border-color);
    color: var(--text-primary);
  }

  .customer-item:hover,
  .customer-item:focus-visible {
    border-color: var(--primary-color);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }

  .customer-id,
  .detail-item {
    color: var(--text-secondary);
  }

  .status-badge {
    background: var(--hover-bg);
    color: var(--text-secondary);
  }

  .status-active {
    background: color-mix(in srgb, var(--success) 18%, transparent);
    color: var(--success);
  }

  .status-suspended {
    background: color-mix(in srgb, var(--warning) 22%, transparent);
    color: var(--warning);
  }

  .status-disconnected {
    background: color-mix(in srgb, var(--danger) 24%, transparent);
    color: var(--danger);
  }

  .customer-plan {
    border-top-color: var(--border-light);
  }

  .error-message {
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    border-color: color-mix(in srgb, var(--danger) 32%, transparent);
    color: var(--danger);
  }

  .state-message,
  .loading,
  .no-results {
    border-radius: var(--radius-lg);
    background: var(--color-background-secondary);
    border: 1px dashed var(--border-light);
  }
</style>

