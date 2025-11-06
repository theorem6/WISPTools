<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { customerService, type Customer } from '$lib/services/customerService';
  
  export let show = false;
  export let customer: Customer | null = null;
  
  const dispatch = createEventDispatcher();
  
  let isSaving = false;
  let error = '';
  let success = '';
  
  let formData = {
    firstName: '',
    lastName: '',
    primaryPhone: '',
    alternatePhone: '',
    email: '',
    serviceAddress: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'USA',
      latitude: undefined as number | undefined,
      longitude: undefined as number | undefined
    },
    billingAddress: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'USA',
      sameAsService: true
    },
    serviceStatus: 'pending' as Customer['serviceStatus'],
    servicePlan: {
      planName: '',
      downloadMbps: undefined as number | undefined,
      uploadMbps: undefined as number | undefined,
      monthlyFee: undefined as number | undefined,
      currency: 'USD'
    },
    notes: '',
    tags: [] as string[]
  };
  
  let tagInput = '';
  
  // HSS Subscriber Management
  let showHSSSubscriber = false;
  let hssSubscriber: any = null;
  let isLoadingSubscriber = false;
  let hssGroups: any[] = [];
  let hssBandwidthPlans: any[] = [];
  let hssSubscriberForm = {
    imsi: '',
    msisdn: '',
    ki: '',
    opc: '',
    group_id: '',
    bandwidth_plan_id: '',
    qci: 9
  };
  
  onMount(() => {
    if (customer) {
      loadCustomerData();
    }
  });
  
  $: if (customer && show) {
    loadCustomerData();
    if (customer._id) {
      loadHSSSubscriber();
      loadHSSData();
    }
  }
  
  async function loadHSSData() {
    if (!customer?._id) return;
    
    try {
      const tenantId = localStorage.getItem('selectedTenantId');
      if (!tenantId) return;
      
      // Use centralized API configuration
      const apiPath = API_CONFIG.PATHS.CUSTOMERS.split('/customers')[0];
      const token = await (await import('$lib/services/authService')).authService.getIdToken();
      
      // Load groups and bandwidth plans
      const [groupsRes, plansRes] = await Promise.all([
        fetch(`${apiPath}/hss/groups`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId
          }
        }).catch(() => null),
        fetch(`${apiPath}/hss/bandwidth-plans`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId
          }
        }).catch(() => null)
      ]);
      
      if (groupsRes?.ok) {
        const groupsData = await groupsRes.json();
        hssGroups = Array.isArray(groupsData.groups) ? groupsData.groups : groupsData;
      }
      
      if (plansRes?.ok) {
        const plansData = await plansRes.json();
        hssBandwidthPlans = Array.isArray(plansData.plans) ? plansData.plans : plansData;
      }
    } catch (err) {
      console.error('Error loading HSS data:', err);
    }
  }
  
  async function loadHSSSubscriber() {
    if (!customer?._id) return;
    
    isLoadingSubscriber = true;
    try {
      hssSubscriber = await customerService.getHSSSubscriber(customer._id);
      if (hssSubscriber) {
        hssSubscriberForm = {
          imsi: hssSubscriber.imsi || '',
          msisdn: hssSubscriber.msisdn || formData.primaryPhone.replace(/\D/g, '') || '',
          ki: hssSubscriber.ki || '',
          opc: hssSubscriber.opc || '',
          group_id: hssSubscriber.group_id || '',
          bandwidth_plan_id: hssSubscriber.bandwidth_plan_id || '',
          qci: hssSubscriber.qci || 9
        };
        showHSSSubscriber = true;
      }
    } catch (err: any) {
      // No subscriber exists yet - that's OK
      if (!err.message?.includes('404')) {
        console.error('Error loading HSS subscriber:', err);
      }
      // Pre-fill MSISDN from phone
      hssSubscriberForm.msisdn = formData.primaryPhone.replace(/\D/g, '');
    } finally {
      isLoadingSubscriber = false;
    }
  }
  
  async function createHSSSubscriber() {
    if (!customer?._id || !hssSubscriberForm.imsi.trim()) {
      error = 'IMSI is required';
      return;
    }
    
    isSaving = true;
    error = '';
    
    try {
      hssSubscriber = await customerService.createHSSSubscriber(customer._id, hssSubscriberForm);
      showHSSSubscriber = true;
      success = 'HSS subscriber created successfully';
      setTimeout(() => success = '', 3000);
    } catch (err: any) {
      console.error('Error creating HSS subscriber:', err);
      error = err.message || 'Failed to create HSS subscriber';
    } finally {
      isSaving = false;
    }
  }
  
  function loadCustomerData() {
    if (!customer) return;
    
    formData.firstName = customer.firstName || '';
    formData.lastName = customer.lastName || '';
    formData.primaryPhone = customer.primaryPhone || '';
    formData.alternatePhone = customer.alternatePhone || '';
    formData.email = customer.email || '';
    formData.serviceStatus = customer.serviceStatus || 'pending';
    formData.notes = (customer as any).notes || '';
    formData.tags = (customer as any).tags || [];
    
    if (customer.serviceAddress) {
      formData.serviceAddress = {
        street: customer.serviceAddress.street || '',
        city: customer.serviceAddress.city || '',
        state: customer.serviceAddress.state || '',
        zipCode: customer.serviceAddress.zipCode || '',
        country: customer.serviceAddress.country || 'USA',
        latitude: customer.serviceAddress.latitude,
        longitude: customer.serviceAddress.longitude
      };
    }
    
    if (customer.servicePlan) {
      formData.servicePlan = {
        planName: customer.servicePlan.planName || '',
        downloadMbps: customer.servicePlan.downloadMbps,
        uploadMbps: customer.servicePlan.uploadMbps,
        monthlyFee: undefined,
        currency: 'USD'
      };
    }
  }
  
  function handleBillingAddressChange() {
    if (formData.billingAddress.sameAsService) {
      formData.billingAddress = {
        ...formData.serviceAddress,
        sameAsService: true
      };
    }
  }
  
  function addTag() {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      formData.tags = [...formData.tags, tagInput.trim()];
      tagInput = '';
    }
  }
  
  function removeTag(tag: string) {
    formData.tags = formData.tags.filter(t => t !== tag);
  }
  
  async function handleSave() {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      error = 'First name and last name are required';
      return;
    }
    
    if (!formData.primaryPhone.trim()) {
      error = 'Primary phone is required';
      return;
    }
    
    isSaving = true;
    error = '';
    
    try {
      const firstName = formData.firstName.trim();
      const lastName = formData.lastName.trim();
      const fullName = `${firstName} ${lastName}`.trim();
      
      const customerData: Partial<Customer> = {
        firstName,
        lastName,
        fullName,
        primaryPhone: formData.primaryPhone.trim(),
        alternatePhone: formData.alternatePhone.trim() || undefined,
        email: formData.email.trim() || undefined,
        serviceAddress: {
          street: formData.serviceAddress.street.trim() || undefined,
          city: formData.serviceAddress.city.trim() || undefined,
          state: formData.serviceAddress.state.trim() || undefined,
          zipCode: formData.serviceAddress.zipCode.trim() || undefined,
          country: formData.serviceAddress.country,
          latitude: formData.serviceAddress.latitude,
          longitude: formData.serviceAddress.longitude
        },
        billingAddress: formData.billingAddress.sameAsService ? undefined : {
          street: formData.billingAddress.street.trim() || undefined,
          city: formData.billingAddress.city.trim() || undefined,
          state: formData.billingAddress.state.trim() || undefined,
          zipCode: formData.billingAddress.zipCode.trim() || undefined,
          country: formData.billingAddress.country
        },
        serviceStatus: formData.serviceStatus,
        servicePlan: formData.servicePlan.planName ? {
          planName: formData.servicePlan.planName,
          downloadMbps: formData.servicePlan.downloadMbps,
          uploadMbps: formData.servicePlan.uploadMbps,
          monthlyFee: formData.servicePlan.monthlyFee,
          currency: formData.servicePlan.currency
        } : undefined,
        notes: formData.notes.trim() || undefined,
        tags: formData.tags.length > 0 ? formData.tags : undefined,
        isActive: true
      };
      
      if (customer?._id) {
        await customerService.updateCustomer(customer._id, customerData);
      } else {
        await customerService.createCustomer(customerData);
      }
      
      dispatch('saved');
      handleClose();
    } catch (err: any) {
      console.error('Error saving customer:', err);
      error = err.message || 'Failed to save customer';
    } finally {
      isSaving = false;
    }
  }
  
  function handleClose() {
    show = false;
    error = '';
    // Reset form
    formData = {
      firstName: '',
      lastName: '',
      primaryPhone: '',
      alternatePhone: '',
      email: '',
      serviceAddress: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'USA',
        latitude: undefined,
        longitude: undefined
      },
      billingAddress: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'USA',
        sameAsService: true
      },
      serviceStatus: 'pending',
      servicePlan: {
        planName: '',
        downloadMbps: undefined,
        uploadMbps: undefined,
        monthlyFee: undefined,
        currency: 'USD'
      },
      notes: '',
      tags: []
    };
    tagInput = '';
    dispatch('close');
  }
</script>

{#if show}
<div class="modal-overlay" on:click={handleClose}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <h2>{customer ? '✏️ Edit Customer' : '➕ Add Customer'}</h2>
      <button class="close-btn" on:click={handleClose}>✕</button>
    </div>
    
    {#if error}
      <div class="error-banner">{error}</div>
    {/if}
    
    {#if success}
      <div class="success">{success}</div>
    {/if}
    
    <div class="modal-body">
      <!-- Basic Information -->
      <div class="section">
        <h3>👤 Basic Information</h3>
        
        <div class="form-grid">
          <div class="form-group">
            <label>First Name *</label>
            <input type="text" bind:value={formData.firstName} placeholder="John" required />
          </div>
          
          <div class="form-group">
            <label>Last Name *</label>
            <input type="text" bind:value={formData.lastName} placeholder="Smith" required />
          </div>
        </div>
        
        <div class="form-grid">
          <div class="form-group">
            <label>Primary Phone *</label>
            <input type="tel" bind:value={formData.primaryPhone} placeholder="555-123-4567" required />
          </div>
          
          <div class="form-group">
            <label>Alternate Phone</label>
            <input type="tel" bind:value={formData.alternatePhone} placeholder="555-123-4568" />
          </div>
        </div>
        
        <div class="form-group">
          <label>Email</label>
          <input type="email" bind:value={formData.email} placeholder="john.smith@example.com" />
        </div>
        
        <div class="form-group">
          <label>Service Status</label>
          <select bind:value={formData.serviceStatus}>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      
      <!-- Service Address -->
      <div class="section">
        <h3>📍 Service Address</h3>
        
        <div class="form-group">
          <label>Street Address</label>
          <input type="text" bind:value={formData.serviceAddress.street} placeholder="123 Main St" />
        </div>
        
        <div class="form-grid">
          <div class="form-group">
            <label>City</label>
            <input type="text" bind:value={formData.serviceAddress.city} placeholder="City" />
          </div>
          
          <div class="form-group">
            <label>State</label>
            <input type="text" bind:value={formData.serviceAddress.state} placeholder="State" />
          </div>
          
          <div class="form-group">
            <label>ZIP Code</label>
            <input type="text" bind:value={formData.serviceAddress.zipCode} placeholder="12345" />
          </div>
        </div>
      </div>
      
      <!-- Billing Address -->
      <div class="section">
        <h3>💳 Billing Address</h3>
        
        <div class="form-group">
          <label>
            <input type="checkbox" bind:checked={formData.billingAddress.sameAsService} on:change={handleBillingAddressChange} />
            Same as Service Address
          </label>
        </div>
        
        {#if !formData.billingAddress.sameAsService}
          <div class="form-group">
            <label>Street Address</label>
            <input type="text" bind:value={formData.billingAddress.street} placeholder="123 Main St" />
          </div>
          
          <div class="form-grid">
            <div class="form-group">
              <label>City</label>
              <input type="text" bind:value={formData.billingAddress.city} placeholder="City" />
            </div>
            
            <div class="form-group">
              <label>State</label>
              <input type="text" bind:value={formData.billingAddress.state} placeholder="State" />
            </div>
            
            <div class="form-group">
              <label>ZIP Code</label>
              <input type="text" bind:value={formData.billingAddress.zipCode} placeholder="12345" />
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Service Plan -->
      <div class="section">
        <h3>📡 Service Plan</h3>
        
        <div class="form-grid">
          <div class="form-group">
            <label>Plan Name</label>
            <input type="text" bind:value={formData.servicePlan.planName} placeholder="50/10 Mbps" />
          </div>
          
          <div class="form-group">
            <label>Download (Mbps)</label>
            <input type="number" bind:value={formData.servicePlan.downloadMbps} placeholder="50" />
          </div>
          
          <div class="form-group">
            <label>Upload (Mbps)</label>
            <input type="number" bind:value={formData.servicePlan.uploadMbps} placeholder="10" />
          </div>
        </div>
      </div>
      
      <!-- Tags -->
      <div class="section">
        <h3>🏷️ Tags</h3>
        
        <div class="form-group">
          <div class="tag-input-group">
            <input 
              type="text" 
              bind:value={tagInput} 
              placeholder="Add tag..."
              on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            />
            <button type="button" class="btn-add-tag" on:click={addTag}>Add</button>
          </div>
          
          {#if formData.tags.length > 0}
            <div class="tags-list">
              {#each formData.tags as tag}
                <span class="tag">
                  {tag}
                  <button type="button" class="tag-remove" on:click={() => removeTag(tag)}>✕</button>
                </span>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      
      <!-- Notes -->
      <div class="section">
        <h3>📝 Notes</h3>
        
        <div class="form-group">
          <textarea 
            bind:value={formData.notes} 
            placeholder="Additional notes about this customer..."
            rows="4"
          ></textarea>
        </div>
      </div>
      
      <!-- HSS Subscriber Management -->
      {#if customer?._id}
        <div class="section">
          <div class="section-header">
            <h3>📡 HSS Subscriber</h3>
            <button 
              class="btn-toggle" 
              on:click={() => showHSSSubscriber = !showHSSSubscriber}
            >
              {showHSSSubscriber ? '▼' : '▶'}
            </button>
          </div>
          
          {#if isLoadingSubscriber}
            <div class="loading">Loading subscriber data...</div>
          {:else if showHSSSubscriber}
            {#if hssSubscriber}
              <div class="subscriber-info">
                <div class="info-row">
                  <span class="label">IMSI:</span>
                  <span class="value">{hssSubscriber.imsi}</span>
                </div>
                <div class="info-row">
                  <span class="label">MSISDN:</span>
                  <span class="value">{hssSubscriber.msisdn || '-'}</span>
                </div>
                <div class="info-row">
                  <span class="label">Group:</span>
                  <span class="value">{hssSubscriber.group_id || '-'}</span>
                </div>
                <div class="info-row">
                  <span class="label">Bandwidth Plan:</span>
                  <span class="value">{hssSubscriber.bandwidth_plan_id || '-'}</span>
                </div>
                <div class="info-row">
                  <span class="label">Status:</span>
                  <span class="value {hssSubscriber.enabled ? 'enabled' : 'disabled'}">
                    {hssSubscriber.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            {:else}
              <div class="subscriber-form">
                <div class="form-grid">
                  <div class="form-group">
                    <label>IMSI *</label>
                    <input type="text" bind:value={hssSubscriberForm.imsi} placeholder="123456789012345" required />
                  </div>
                  
                  <div class="form-group">
                    <label>MSISDN</label>
                    <input type="text" bind:value={hssSubscriberForm.msisdn} placeholder={formData.primaryPhone.replace(/\D/g, '')} />
                  </div>
                </div>
                
                <div class="form-grid">
                  <div class="form-group">
                    <label>KI (Authentication Key)</label>
                    <input type="text" bind:value={hssSubscriberForm.ki} placeholder="Optional" />
                  </div>
                  
                  <div class="form-group">
                    <label>OPc (Operator Variant)</label>
                    <input type="text" bind:value={hssSubscriberForm.opc} placeholder="Optional" />
                  </div>
                </div>
                
                <div class="form-grid">
                  <div class="form-group">
                    <label>Group ID</label>
                    <select bind:value={hssSubscriberForm.group_id}>
                      <option value="">Select Group</option>
                      {#each hssGroups as group}
                        <option value={group.group_id || group.id}>{group.name}</option>
                      {/each}
                    </select>
                  </div>
                  
                  <div class="form-group">
                    <label>Bandwidth Plan</label>
                    <select bind:value={hssSubscriberForm.bandwidth_plan_id}>
                      <option value="">Select Plan</option>
                      {#each hssBandwidthPlans as plan}
                        <option value={plan.plan_id || plan.id}>{plan.name} ({plan.download_mbps}/{plan.upload_mbps} Mbps)</option>
                      {/each}
                    </select>
                  </div>
                </div>
                
                <div class="form-group">
                  <label>QCI (Quality of Service)</label>
                  <input type="number" bind:value={hssSubscriberForm.qci} min="1" max="9" />
                </div>
                
                <button class="btn-primary" on:click={createHSSSubscriber} disabled={isSaving}>
                  {isSaving ? 'Creating...' : '📡 Create HSS Subscriber'}
                </button>
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" on:click={handleClose}>Cancel</button>
      <button class="btn-primary" on:click={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : (customer ? '✅ Update Customer' : '✅ Create Customer')}
      </button>
    </div>
  </div>
</div>
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
    max-width: 900px;
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
    color: var(--danger);
    padding: var(--spacing-md);
    margin: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--border-radius);
    border: 1px solid var(--danger);
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
  
  .tag-input-group {
    display: flex;
    gap: 0.5rem;
  }
  
  .tag-input-group input {
    flex: 1;
  }
  
  .btn-add-tag {
    padding: var(--spacing-md);
    background: var(--brand-primary);
    color: white;
    border: none;
    border-radius: var(--border-radius);
    cursor: pointer;
    font-weight: 600;
  }
  
  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-size: 0.85rem;
  }
  
  .tag-remove {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 1rem;
    padding: 0;
    width: 1.2rem;
    height: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .tag-remove:hover {
    color: var(--danger);
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
  
  /* HSS Subscriber Styles */
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }
  
  .btn-toggle {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    color: var(--text-secondary);
    padding: 0.25rem 0.5rem;
  }
  
  .btn-toggle:hover {
    color: var(--text-primary);
  }
  
  .subscriber-info {
    background: var(--bg-secondary);
    padding: var(--spacing-md);
    border-radius: var(--border-radius);
    margin-top: var(--spacing-md);
  }
  
  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
  }
  
  .info-row:last-child {
    border-bottom: none;
  }
  
  .info-row .label {
    font-weight: 600;
    color: var(--text-secondary);
  }
  
  .info-row .value {
    color: var(--text-primary);
  }
  
  .value.enabled {
    color: var(--success);
  }
  
  .value.disabled {
    color: var(--danger);
  }
  
  .subscriber-form {
    margin-top: var(--spacing-md);
  }
  
  .loading {
    text-align: center;
    padding: var(--spacing-md);
    color: var(--text-secondary);
  }
  
  .success {
    background: var(--success-light);
    color: var(--success);
    padding: var(--spacing-md);
    margin: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--border-radius);
    border: 1px solid var(--success);
  }
</style>

