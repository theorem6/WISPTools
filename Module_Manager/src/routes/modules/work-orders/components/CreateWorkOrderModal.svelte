<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { workOrderService, type WorkOrder } from '$lib/services/workOrderService';
  import { coverageMapService } from '../../coverage-map/lib/coverageMapService.mongodb';
  import CustomerLookupModal from '../../help-desk/components/CustomerLookupModal.svelte';
  import type { Customer } from '$lib/services/customerService';
  
  export let show = false;
  export let tenantId: string;
  
  const dispatch = createEventDispatcher();
  
  let isSaving = false;
  let error = '';
  let sites: any[] = [];
  let showCustomerLookup = false;
  let selectedCustomer: Customer | null = null;
  const typeFieldId = 'work-order-type';
  const priorityFieldId = 'work-order-priority';
  const titleFieldId = 'work-order-title';
  const descriptionFieldId = 'work-order-description';
  const issueCategoryFieldId = 'work-order-issue-category';
  const siteFieldId = 'work-order-site';
  const customerNameFieldId = 'work-order-customer-name';
  const customerPhoneFieldId = 'work-order-customer-phone';
  const scheduledDateFieldId = 'work-order-scheduled-date';
  const estimatedDurationFieldId = 'work-order-estimated-duration';
  const slaResponseFieldId = 'work-order-sla-response';
  const slaResolutionFieldId = 'work-order-sla-resolution';
  
  let formData = {
    type: 'troubleshoot' as WorkOrder['type'],
    priority: 'medium' as WorkOrder['priority'],
    title: '',
    description: '',
    issueCategory: undefined as WorkOrder['issueCategory'],
    location: {
      type: 'tower' as any,
      siteId: '',
      siteName: ''
    },
    customerReported: false,
    customerName: '',
    customerPhone: '',
    customerId: '',
    scheduledDate: '',
    estimatedDuration: 120,
    slaResponseHours: 4,
    slaResolutionHours: 24
  };
  
  let sitesLoaded = false;
  
  onMount(async () => {
    if (show && !sitesLoaded) {
      await loadSites();
    }
  });
  
  $: if (show && !sitesLoaded) {
    loadSites();
  }
  
  async function loadSites() {
    if (sitesLoaded) return; // Prevent duplicate loads
    
    try {
      sites = await coverageMapService.getTowerSites(tenantId);
      sitesLoaded = true;
    } catch (err) {
      console.error('Failed to load sites:', err);
      sites = [];
    }
  }
  
  function handleSiteChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const siteId = target.value;
    formData.location.siteId = siteId;
    
    if (siteId) {
      const site = sites.find(s => s.id === siteId);
      if (site) {
        formData.location.siteName = site.name;
      }
    } else {
      formData.location.siteName = '';
    }
  }
  
  async function handleSave() {
    if (!formData.title.trim()) {
      error = 'Title is required';
      return;
    }
    
    isSaving = true;
    error = '';
    
    try {
      const workOrderData: Partial<WorkOrder> = {
        type: formData.type,
        priority: formData.priority,
        title: formData.title,
        description: formData.description || undefined,
        issueCategory: formData.issueCategory || undefined,
        tenantId
      };
      
      // Add location if site selected
      if (formData.location.siteId) {
        workOrderData.location = {
          type: formData.location.type,
          siteId: formData.location.siteId,
          siteName: formData.location.siteName
        };
        
        workOrderData.affectedSites = [{
          siteId: formData.location.siteId,
          siteName: formData.location.siteName,
          siteType: formData.location.type
        }];
      }
      
      // Add customer info if customer-reported
      if (formData.customerReported && selectedCustomer) {
        workOrderData.customerReported = true;
        workOrderData.customerContact = {
          name: formData.customerName,
          phone: formData.customerPhone,
          email: selectedCustomer.email
        };
        
        // Add to affectedCustomers array
        workOrderData.affectedCustomers = [{
          customerId: formData.customerId || selectedCustomer._id || selectedCustomer.customerId,
          customerName: formData.customerName,
          phoneNumber: formData.customerPhone,
          serviceAddress: selectedCustomer.serviceAddress?.street 
            ? `${selectedCustomer.serviceAddress.street}, ${selectedCustomer.serviceAddress.city || ''}`.trim()
            : ''
        }];
      } else if (formData.customerReported && formData.customerName) {
        // Manual entry fallback
        workOrderData.customerReported = true;
        workOrderData.customerContact = {
          name: formData.customerName,
          phone: formData.customerPhone
        };
      }
      
      // Add scheduling info
      if (formData.scheduledDate) {
        workOrderData.scheduledDate = new Date(formData.scheduledDate);
      }
      
      if (formData.estimatedDuration) {
        workOrderData.estimatedDuration = formData.estimatedDuration;
      }
      
      // Add SLA
      workOrderData.sla = {
        responseTimeHours: formData.slaResponseHours,
        resolutionTimeHours: formData.slaResolutionHours
      };
      
      await workOrderService.createWorkOrder(workOrderData);
      
      dispatch('saved');
      handleClose();
    } catch (err: any) {
      error = err.message || 'Failed to create work order';
    } finally {
      isSaving = false;
    }
  }
  
  function handleCustomerSelect(customer: Customer) {
    selectedCustomer = customer;
    formData.customerReported = true;
    formData.customerName = customer.fullName || `${customer.firstName} ${customer.lastName}`;
    formData.customerPhone = customer.primaryPhone;
    formData.customerId = customer.customerId || customer._id || '';
    
    // Pre-fill location if customer has service address
    if (customer.serviceAddress?.latitude && customer.serviceAddress?.longitude) {
      // Could set GPS coordinates here
    }
    
    // Auto-fill title if empty and customer selected
    if (!formData.title && customer.serviceStatus === 'active') {
      formData.title = `Service Issue - ${customer.fullName || customer.firstName} ${customer.lastName}`;
    }
  }
  
  function clearCustomer() {
    selectedCustomer = null;
    formData.customerName = '';
    formData.customerPhone = '';
    formData.customerId = '';
  }
  
  function handleClose() {
    show = false;
    error = '';
    sitesLoaded = false; // Reset for next time modal opens
    selectedCustomer = null;
    // Reset form
    formData = {
      type: 'troubleshoot',
      priority: 'medium',
      title: '',
      description: '',
      issueCategory: undefined,
      location: { type: 'tower', siteId: '', siteName: '' },
      customerReported: false,
      customerName: '',
      customerPhone: '',
      customerId: '',
      scheduledDate: '',
      estimatedDuration: 120,
      slaResponseHours: 4,
      slaResolutionHours: 24
    };
  }

function handleOverlayKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    handleClose();
  }
}

function handleOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    handleClose();
  }
}
</script>

{#if show}
<div
  class="modal-overlay"
  role="dialog"
  aria-modal="true"
  tabindex="0"
  aria-label="Create work order dialog"
  on:click={handleOverlayClick}
  on:keydown={handleOverlayKeydown}
>
  <div class="modal-content" role="document">
    <div class="modal-header">
      <h2>➕ Create Work Order</h2>
      <button class="close-btn" on:click={handleClose}>✕</button>
    </div>
    
    {#if error}
      <div class="error-banner">{error}</div>
    {/if}
    
    <div class="modal-body">
      <!-- Basic Info -->
      <div class="section">
        <h3>📋 Basic Information</h3>
        
        <div class="form-grid">
          <div class="form-group">
            <label for={typeFieldId}>Type *</label>
            <select id={typeFieldId} bind:value={formData.type}>
              <option value="installation">Installation</option>
              <option value="repair">Repair</option>
              <option value="maintenance">Maintenance</option>
              <option value="upgrade">Upgrade</option>
              <option value="removal">Removal</option>
              <option value="troubleshoot">Troubleshoot</option>
              <option value="inspection">Inspection</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for={priorityFieldId}>Priority *</label>
            <select id={priorityFieldId} bind:value={formData.priority}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        
        <div class="form-group">
          <label for={titleFieldId}>Title *</label>
          <input
            id={titleFieldId}
            type="text"
            bind:value={formData.title}
            placeholder="Brief description of the issue or task"
            required
          />
        </div>
        
        <div class="form-group">
          <label for={descriptionFieldId}>Description</label>
          <textarea 
            id={descriptionFieldId}
            bind:value={formData.description} 
            placeholder="Detailed description of the work to be performed..."
            rows="4"
          ></textarea>
        </div>
        
        {#if formData.type === 'troubleshoot' || formData.type === 'repair'}
          <div class="form-group">
            <label for={issueCategoryFieldId}>Issue Category</label>
            <select id={issueCategoryFieldId} bind:value={formData.issueCategory}>
              <option value="">Select category...</option>
              <option value="cpe-offline">CPE Offline</option>
              <option value="sector-down">Sector Down</option>
              <option value="backhaul-failure">Backhaul Failure</option>
              <option value="network-outage">Network Outage</option>
              <option value="poor-performance">Poor Performance</option>
              <option value="equipment-failure">Equipment Failure</option>
              <option value="power-issue">Power Issue</option>
              <option value="configuration-error">Configuration Error</option>
              <option value="other">Other</option>
            </select>
          </div>
        {/if}
      </div>
      
      <!-- Location -->
      <div class="section">
        <h3>📍 Location</h3>
        
        <div class="form-group">
          <label for={siteFieldId}>Site</label>
          <select id={siteFieldId} value={formData.location.siteId} on:change={handleSiteChange}>
            <option value="">Select site...</option>
            {#each sites as site}
              <option value={site.id}>{site.name} ({site.type})</option>
            {/each}
          </select>
        </div>
      </div>
      
      <!-- Customer Info -->
      <div class="section">
        <h3>👤 Customer Information</h3>
        
        <div class="form-group">
          <label>
            <input type="checkbox" bind:checked={formData.customerReported} />
            Customer Reported Issue
          </label>
        </div>
        
        {#if formData.customerReported}
          {#if selectedCustomer}
            <div class="selected-customer">
              <div class="customer-card">
                <div class="customer-info">
                  <strong>{selectedCustomer.fullName || `${selectedCustomer.firstName} ${selectedCustomer.lastName}`}</strong>
                  <span class="customer-id">{selectedCustomer.customerId}</span>
                  {#if selectedCustomer.primaryPhone}
                    <div class="customer-phone">📞 {selectedCustomer.primaryPhone}</div>
                  {/if}
                  {#if selectedCustomer.email}
                    <div class="customer-email">📧 {selectedCustomer.email}</div>
                  {/if}
                </div>
                <button type="button" class="btn-remove" on:click={clearCustomer}>✕</button>
              </div>
            </div>
          {:else}
            <div class="customer-lookup-section">
              <button 
                type="button" 
                class="btn-lookup" 
                on:click={() => showCustomerLookup = true}
              >
                🔍 Lookup Customer from Database
              </button>
              <p class="or-divider">OR</p>
              <div class="form-grid">
                <div class="form-group">
                  <label for={customerNameFieldId}>Customer Name</label>
                  <input
                    id={customerNameFieldId}
                    type="text"
                    bind:value={formData.customerName}
                    placeholder="John Smith"
                  />
                </div>
                
                <div class="form-group">
                  <label for={customerPhoneFieldId}>Phone</label>
                  <input
                    id={customerPhoneFieldId}
                    type="tel"
                    bind:value={formData.customerPhone}
                    placeholder="555-1234"
                  />
                </div>
              </div>
            </div>
          {/if}
        {/if}
      </div>
      
      <!-- Scheduling -->
      <div class="section">
        <h3>📅 Scheduling</h3>
        
        <div class="form-grid">
          <div class="form-group">
            <label for={scheduledDateFieldId}>Scheduled Date</label>
            <input
              id={scheduledDateFieldId}
              type="datetime-local"
              bind:value={formData.scheduledDate}
            />
          </div>
          
          <div class="form-group">
            <label for={estimatedDurationFieldId}>Estimated Duration (minutes)</label>
            <input
              id={estimatedDurationFieldId}
              type="number"
              bind:value={formData.estimatedDuration}
              placeholder="120"
            />
          </div>
        </div>
      </div>
      
      <!-- SLA -->
      <div class="section">
        <h3>⏱️ SLA (Service Level Agreement)</h3>
        
        <div class="form-grid">
          <div class="form-group">
            <label for={slaResponseFieldId}>Response Time (hours)</label>
            <input
              id={slaResponseFieldId}
              type="number"
              bind:value={formData.slaResponseHours}
              placeholder="4"
            />
          </div>
          
          <div class="form-group">
            <label for={slaResolutionFieldId}>Resolution Time (hours)</label>
            <input
              id={slaResolutionFieldId}
              type="number"
              bind:value={formData.slaResolutionHours}
              placeholder="24"
            />
          </div>
        </div>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" on:click={handleClose}>Cancel</button>
      <button class="btn-primary" on:click={handleSave} disabled={isSaving}>
        {isSaving ? 'Creating...' : '✅ Create Work Order'}
      </button>
    </div>
  </div>
</div>

{#if showCustomerLookup}
  <CustomerLookupModal 
    on:close={() => showCustomerLookup = false}
    on:selected={(e) => handleCustomerSelect(e.detail)}
    onSelect={handleCustomerSelect}
  />
{/if}
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal-content {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    width: 90%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-xl);
    border: 1px solid var(--border-color);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h2 {
    margin: 0;
    color: var(--text-primary);
    font-weight: 600;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    transition: var(--transition);
  }
  
  .close-btn:hover {
    color: var(--text-primary);
  }
  
  .error-banner {
    background: var(--danger-light);
    border: 1px solid var(--danger);
    color: var(--danger);
    padding: var(--spacing-md);
    margin: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--border-radius);
  }
  
  .modal-body {
    padding: var(--spacing-lg);
    overflow-y: auto;
    flex: 1;
  }
  
  .section {
    margin-bottom: var(--spacing-xl);
  }
  
  .section h3 {
    margin: 0 0 var(--spacing-md) 0;
    font-size: 1.1rem;
    color: var(--brand-primary);
    font-weight: 600;
  }
  
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md);
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  
  .form-group label {
    font-weight: 500;
    font-size: 0.9rem;
    color: var(--text-primary);
  }
  
  .form-group input,
  .form-group select,
  .form-group textarea {
    padding: var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--input-bg);
    color: var(--text-primary);
    font-size: 0.9rem;
    transition: var(--transition);
  }
  
  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--brand-primary);
    background: var(--card-bg);
  }
  
  .form-group textarea {
    resize: vertical;
    font-family: inherit;
  }
  
  .form-group select {
    text-transform: capitalize;
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    border-top: 1px solid var(--border-color);
  }
  
  .btn-primary,
  .btn-secondary {
    padding: var(--spacing-md) var(--spacing-lg);
    border: none;
    border-radius: var(--border-radius);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
  }
  
  .btn-primary {
    background: var(--gradient-primary);
    color: var(--text-inverse);
    box-shadow: var(--shadow-md);
  }
  
  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--bg-tertiary);
    transform: translateY(-1px);
  }
  
  .customer-lookup-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .btn-lookup {
    padding: var(--spacing-md);
    background: var(--gradient-primary);
    color: var(--text-inverse);
    border: none;
    border-radius: var(--border-radius);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  
  .btn-lookup:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }
  
  .or-divider {
    text-align: center;
    color: var(--text-secondary);
    margin: 0;
    font-size: 0.9rem;
  }
  
  .selected-customer {
    margin-top: 0.5rem;
  }
  
  .customer-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--success-light, #d4edda);
    border: 1px solid var(--success, #28a745);
    border-radius: var(--border-radius);
  }
  
  .customer-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .customer-info strong {
    color: var(--text-primary);
    font-size: 1rem;
  }
  
  .customer-id {
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-family: monospace;
  }
  
  .customer-phone,
  .customer-email {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  
  .btn-remove {
    background: var(--danger, #dc3545);
    color: white;
    border: none;
    border-radius: 50%;
    width: 2rem;
    height: 2rem;
    cursor: pointer;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: var(--transition);
  }
  
  .btn-remove:hover {
    background: var(--danger-dark, #c82333);
    transform: scale(1.1);
  }
</style>

