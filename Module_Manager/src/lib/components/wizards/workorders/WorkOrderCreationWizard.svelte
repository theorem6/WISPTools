<script lang="ts">
  /**
   * Work Order Creation Wizard
   * 
   * Guides users through creating work orders/tickets.
   */
  
  import BaseWizard from '../BaseWizard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import CustomerLookupModal from '../../../../routes/modules/help-desk/components/CustomerLookupModal.svelte';
  import type { Customer } from '$lib/services/customerService';
  
  export let show = false;
  
  let currentStep = 0;
  let isLoading = false;
  let error = '';
  let success = '';
  
  // Wizard steps
  const steps = [
    { id: 'welcome', title: 'Welcome', icon: '📋' },
    { id: 'type', title: 'Work Order Type', icon: '🔧' },
    { id: 'affected', title: 'Affected Items', icon: '🎯' },
    { id: 'details', title: 'Details', icon: '📝' },
    { id: 'priority', title: 'Priority & SLA', icon: '⚡' },
    { id: 'assign', title: 'Assign', icon: '👤' },
    { id: 'complete', title: 'Complete', icon: '🎉' }
  ];
  
  // Work order state
  let workOrderType: 'installation' | 'repair' | 'maintenance' | 'upgrade' | 'removal' | 'troubleshoot' | 'inspection' | null = null;
  let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  let title = '';
  let description = '';
  let issueCategory: string | undefined = undefined;
  let affectedSites: Array<{ siteId: string; siteName: string }> = [];
  let affectedEquipment: Array<{ equipmentId: string; equipmentName: string }> = [];
  let affectedCustomers: Array<{ customerId: string; customerName: string }> = [];
  let customerReported = false;
  let selectedCustomer: Customer | null = null;
  let showCustomerLookup = false;
  let customerName = '';
  let customerPhone = '';
  let scheduledDate = '';
  let estimatedDuration = 120; // minutes
  let slaResponseHours = 4;
  let slaResolutionHours = 24;
  let assignedTo: string | null = null;
  let availableTechnicians: Array<{ id: string; name: string; email: string }> = [];
  let attachments: File[] = [];
  
  // Available data
  let availableSites: Array<{ id: string; name: string }> = [];
  let availableEquipment: Array<{ id: string; name: string }> = [];
  
  async function loadSites() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) return;
    
    try {
      const { coverageMapService } = await import('../../../../routes/modules/coverage-map/lib/coverageMapService.mongodb');
      const sites = await coverageMapService.getTowerSites(tenantId);
      availableSites = sites.map((site: any) => ({
        id: site.id || site._id,
        name: site.name
      }));
    } catch (err) {
      console.error('Failed to load sites:', err);
    }
  }
  
  async function loadEquipment() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) return;
    
    try {
      const { inventoryService } = await import('$lib/services/inventoryService');
      const items = await inventoryService.getInventory({ limit: 100 });
      availableEquipment = items.items.map((item: any) => ({
        id: item.id || item._id,
        name: item.name || item.serialNumber || 'Unknown'
      }));
    } catch (err) {
      console.error('Failed to load equipment:', err);
    }
  }
  
  async function loadTechnicians() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) return;
    
    try {
      // Load users with technician role
      const response = await fetch('/api/users', {
        headers: {
          'x-tenant-id': tenantId
        }
      });
      const data = await response.json();
      if (response.ok) {
        availableTechnicians = (data.users || []).map((user: any) => ({
          id: user.id || user._id,
          name: user.name || user.email,
          email: user.email
        }));
      }
    } catch (err) {
      console.error('Failed to load technicians:', err);
    }
  }
  
  function handleClose() {
    show = false;
    resetWizard();
  }
  
  function resetWizard() {
    currentStep = 0;
    workOrderType = null;
    priority = 'medium';
    title = '';
    description = '';
    issueCategory = undefined;
    affectedSites = [];
    affectedEquipment = [];
    affectedCustomers = [];
    customerReported = false;
    selectedCustomer = null;
    customerName = '';
    customerPhone = '';
    scheduledDate = '';
    estimatedDuration = 120;
    slaResponseHours = 4;
    slaResolutionHours = 24;
    assignedTo = null;
    attachments = [];
    error = '';
    success = '';
  }
  
  function handleStepChange(event: CustomEvent<number>) {
    currentStep = event.detail;
    if (currentStep === 2) {
      loadSites();
      loadEquipment();
    } else if (currentStep === 5) {
      loadTechnicians();
    }
  }
  
  function nextStep() {
    if (currentStep === 1 && !workOrderType) {
      error = 'Please select a work order type';
      return;
    }
    if (currentStep === 3 && !title.trim()) {
      error = 'Title is required';
      return;
    }
    if (currentStep === 3 && !description.trim()) {
      error = 'Description is required';
      return;
    }
    if (currentStep === 4 && customerReported && !customerName.trim()) {
      error = 'Customer name is required for customer-reported tickets';
      return;
    }
    if (currentStep < steps.length - 1) {
      currentStep++;
      error = '';
      success = '';
    }
  }
  
  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
      error = '';
      success = '';
    }
  }
  
  function selectWorkOrderType(type: 'installation' | 'repair' | 'maintenance' | 'upgrade' | 'removal' | 'troubleshoot' | 'inspection') {
    workOrderType = type;
    // Auto-set priority based on type
    if (type === 'repair' || type === 'troubleshoot') {
      priority = 'high';
    } else if (type === 'installation') {
      priority = 'medium';
    }
    nextStep();
  }
  
  function toggleSite(siteId: string) {
    const index = affectedSites.findIndex(s => s.siteId === siteId);
    if (index >= 0) {
      affectedSites = affectedSites.filter(s => s.siteId !== siteId);
    } else {
      const site = availableSites.find(s => s.id === siteId);
      if (site) {
        affectedSites = [...affectedSites, { siteId: site.id, siteName: site.name }];
      }
    }
  }
  
  function toggleEquipment(equipmentId: string) {
    const index = affectedEquipment.findIndex(e => e.equipmentId === equipmentId);
    if (index >= 0) {
      affectedEquipment = affectedEquipment.filter(e => e.equipmentId !== equipmentId);
    } else {
      const equipment = availableEquipment.find(e => e.id === equipmentId);
      if (equipment) {
        affectedEquipment = [...affectedEquipment, { equipmentId: equipment.id, equipmentName: equipment.name }];
      }
    }
  }
  
  function handleCustomerSelect(customer: Customer) {
    selectedCustomer = customer;
    customerName = customer.fullName || `${customer.firstName} ${customer.lastName}`;
    customerPhone = customer.primaryPhone || '';
    customerReported = true;
    showCustomerLookup = false;
    
    // Add to affected customers
    const customerId = customer.customerId || customer._id || '';
    if (customerId && !affectedCustomers.some(c => c.customerId === customerId)) {
      affectedCustomers = [...affectedCustomers, {
        customerId: customerId,
        customerName: customerName
      }];
    }
  }
  
  function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files) {
      attachments = [...attachments, ...Array.from(target.files)];
    }
  }
  
  function removeAttachment(index: number) {
    attachments = attachments.filter((_, i) => i !== index);
  }
  
  async function createWorkOrder() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) {
      error = 'No tenant selected';
      return;
    }
    
    if (!workOrderType || !title.trim()) {
      error = 'Work order type and title are required';
      return;
    }
    
    isLoading = true;
    error = '';
    
    try {
      const { workOrderService } = await import('$lib/services/workOrderService');
      
      const workOrderData: any = {
        type: workOrderType,
        priority: priority,
        title: title.trim(),
        description: description.trim(),
        issueCategory: issueCategory,
        tenantId: tenantId,
        status: 'open',
        affectedSites: affectedSites.map(s => ({
          siteId: s.siteId,
          siteName: s.siteName,
          siteType: 'tower'
        })),
        affectedEquipment: affectedEquipment.map(e => ({
          equipmentId: e.equipmentId,
          equipmentName: e.equipmentName
        })),
        affectedCustomers: affectedCustomers,
        sla: {
          responseTimeHours: slaResponseHours,
          resolutionTimeHours: slaResolutionHours
        }
      };
      
      if (customerReported) {
        workOrderData.customerReported = true;
        workOrderData.customerContact = {
          name: customerName,
          phone: customerPhone
        };
        if (selectedCustomer) {
          workOrderData.customerId = selectedCustomer.customerId || selectedCustomer._id;
        }
      }
      
      if (scheduledDate) {
        workOrderData.scheduledDate = new Date(scheduledDate);
      }
      
      if (estimatedDuration) {
        workOrderData.estimatedDuration = estimatedDuration;
      }
      
      if (assignedTo) {
        workOrderData.assignedTo = assignedTo;
        workOrderData.status = 'assigned';
      }
      
      await workOrderService.createWorkOrder(workOrderData);
      
      // Upload attachments if any
      if (attachments.length > 0) {
        // Would upload files to storage and link to work order
        console.log('Uploading attachments:', attachments.length);
      }
      
      success = 'Work order created successfully!';
      setTimeout(() => {
        nextStep();
      }, 1500);
    } catch (err: any) {
      error = err.message || 'Failed to create work order';
    } finally {
      isLoading = false;
    }
  }
  
  function complete() {
    handleClose();
  }
</script>

<BaseWizard
  {show}
  title="📋 Work Order Creation Wizard"
  {steps}
  {currentStep}
  {isLoading}
  {error}
  {success}
  on:close={handleClose}
  on:stepChange={handleStepChange}
>
  <div slot="content">
    {#if currentStep === 0}
      <!-- Welcome Step -->
      <div class="wizard-panel">
        <h3>Welcome to Work Order Creation! 📋</h3>
        <p>This wizard will guide you through creating a work order or ticket.</p>
        
        <div class="info-box">
          <h4>What You'll Do:</h4>
          <ul>
            <li>✅ Select work order type</li>
            <li>✅ Identify affected sites/equipment/customers</li>
            <li>✅ Enter details and description</li>
            <li>✅ Set priority and SLA</li>
            <li>✅ Assign technician (optional)</li>
            <li>✅ Attach files/photos</li>
          </ul>
        </div>
        
        <div class="info-box">
          <h4>Work Order Types:</h4>
          <ul>
            <li><strong>Installation:</strong> New equipment installation</li>
            <li><strong>Repair:</strong> Fix broken equipment</li>
            <li><strong>Maintenance:</strong> Scheduled maintenance</li>
            <li><strong>Upgrade:</strong> Equipment upgrade</li>
            <li><strong>Removal:</strong> Remove equipment</li>
            <li><strong>Troubleshoot:</strong> Diagnose issues</li>
            <li><strong>Inspection:</strong> Site inspection</li>
          </ul>
        </div>
      </div>
      
    {:else if currentStep === 1}
      <!-- Work Order Type -->
      <div class="wizard-panel">
        <h3>Select Work Order Type</h3>
        <p>What type of work order are you creating?</p>
        
        <div class="type-grid">
          <button 
            class="type-card" 
            on:click={() => selectWorkOrderType('installation')}
            disabled={isLoading}
          >
            <div class="type-icon">🔧</div>
            <h4>Installation</h4>
            <p>New equipment installation</p>
          </button>
          
          <button 
            class="type-card" 
            on:click={() => selectWorkOrderType('repair')}
            disabled={isLoading}
          >
            <div class="type-icon">🔨</div>
            <h4>Repair</h4>
            <p>Fix broken equipment</p>
          </button>
          
          <button 
            class="type-card" 
            on:click={() => selectWorkOrderType('maintenance')}
            disabled={isLoading}
          >
            <div class="type-icon">🛠️</div>
            <h4>Maintenance</h4>
            <p>Scheduled maintenance</p>
          </button>
          
          <button 
            class="type-card" 
            on:click={() => selectWorkOrderType('troubleshoot')}
            disabled={isLoading}
          >
            <div class="type-icon">🔍</div>
            <h4>Troubleshoot</h4>
            <p>Diagnose issues</p>
          </button>
          
          <button 
            class="type-card" 
            on:click={() => selectWorkOrderType('upgrade')}
            disabled={isLoading}
          >
            <div class="type-icon">⬆️</div>
            <h4>Upgrade</h4>
            <p>Equipment upgrade</p>
          </button>
          
          <button 
            class="type-card" 
            on:click={() => selectWorkOrderType('removal')}
            disabled={isLoading}
          >
            <div class="type-icon">🗑️</div>
            <h4>Removal</h4>
            <p>Remove equipment</p>
          </button>
          
          <button 
            class="type-card" 
            on:click={() => selectWorkOrderType('inspection')}
            disabled={isLoading}
          >
            <div class="type-icon">👁️</div>
            <h4>Inspection</h4>
            <p>Site inspection</p>
          </button>
        </div>
      </div>
      
    {:else if currentStep === 2}
      <!-- Affected Items -->
      <div class="wizard-panel">
        <h3>Affected Sites & Equipment</h3>
        <p>Select sites and equipment affected by this work order.</p>
        
        <div class="affected-section">
          <h4>Sites</h4>
          {#if availableSites.length === 0}
            <div class="info-box">
              <p>No sites available. Sites will be added as you deploy equipment.</p>
            </div>
          {:else}
            <div class="items-grid">
              {#each availableSites as site}
                <button
                  class="item-card"
                  class:selected={affectedSites.some(s => s.siteId === site.id)}
                  on:click={() => toggleSite(site.id)}
                  disabled={isLoading}
                >
                  <h4>{site.name}</h4>
                </button>
              {/each}
            </div>
          {/if}
        </div>
        
        <div class="affected-section">
          <h4>Equipment</h4>
          {#if availableEquipment.length === 0}
            <div class="info-box">
              <p>No equipment available. Equipment will appear as it's added to inventory.</p>
            </div>
          {:else}
            <div class="items-grid">
              {#each availableEquipment as equipment}
                <button
                  class="item-card"
                  class:selected={affectedEquipment.some(e => e.equipmentId === equipment.id)}
                  on:click={() => toggleEquipment(equipment.id)}
                  disabled={isLoading}
                >
                  <h4>{equipment.name}</h4>
                </button>
              {/each}
            </div>
          {/if}
        </div>
        
        {#if affectedSites.length > 0 || affectedEquipment.length > 0}
          <div class="selected-summary">
            <h4>Selected:</h4>
            {#if affectedSites.length > 0}
              <p><strong>Sites:</strong> {affectedSites.length}</p>
            {/if}
            {#if affectedEquipment.length > 0}
              <p><strong>Equipment:</strong> {affectedEquipment.length}</p>
            {/if}
          </div>
        {/if}
      </div>
      
    {:else if currentStep === 3}
      <!-- Details -->
      <div class="wizard-panel">
        <h3>Work Order Details</h3>
        
        <div class="form-group">
          <label>
            Title <span class="required">*</span>
          </label>
          <input 
            type="text" 
            bind:value={title}
            placeholder="Brief description of the work order"
            disabled={isLoading}
          />
        </div>
        
        <div class="form-group">
          <label>
            Description <span class="required">*</span>
          </label>
          <textarea 
            bind:value={description}
            placeholder="Detailed description of the issue or work needed..."
            rows="6"
            disabled={isLoading}
          ></textarea>
        </div>
        
        <div class="form-group">
          <label>Issue Category</label>
          <select bind:value={issueCategory} disabled={isLoading}>
            <option value="">-- Select Category --</option>
            <option value="cpe-offline">CPE Offline</option>
            <option value="sector-down">Sector Down</option>
            <option value="backhaul-failure">Backhaul Failure</option>
            <option value="power-issue">Power Issue</option>
            <option value="signal-issue">Signal Issue</option>
            <option value="configuration">Configuration</option>
            <option value="other">Other</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>
            <input 
              type="checkbox" 
              bind:checked={customerReported}
              disabled={isLoading}
            />
            Customer Reported Issue
          </label>
        </div>
        
        {#if customerReported}
          <div class="customer-section">
            <button 
              class="btn-small" 
              on:click={() => showCustomerLookup = true}
              disabled={isLoading}
            >
              🔍 Lookup Customer
            </button>
            
            <div class="form-group">
              <label>Customer Name</label>
              <input 
                type="text" 
                bind:value={customerName}
                placeholder="Customer name"
                disabled={isLoading || !!selectedCustomer}
              />
            </div>
            
            <div class="form-group">
              <label>Customer Phone</label>
              <input 
                type="tel" 
                bind:value={customerPhone}
                placeholder="Phone number"
                disabled={isLoading || !!selectedCustomer}
              />
            </div>
            
            {#if selectedCustomer}
              <div class="info-box success">
                <p><strong>Selected:</strong> {customerName} ({customerPhone})</p>
                <button 
                  class="btn-small" 
                  on:click={() => { selectedCustomer = null; customerName = ''; customerPhone = ''; }}
                  disabled={isLoading}
                >
                  Clear
                </button>
              </div>
            {/if}
          </div>
        {/if}
        
        <div class="form-group">
          <label>Attach Files/Photos</label>
          <input 
            type="file" 
            accept="image/*,.pdf,.doc,.docx"
            multiple
            on:change={handleFileUpload}
            disabled={isLoading}
          />
          {#if attachments.length > 0}
            <div class="attachments-list">
              {#each attachments as attachment, index}
                <div class="attachment-item">
                  <span>{attachment.name}</span>
                  <button 
                    class="btn-icon" 
                    on:click={() => removeAttachment(index)}
                    disabled={isLoading}
                  >
                    ×
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      
    {:else if currentStep === 4}
      <!-- Priority & SLA -->
      <div class="wizard-panel">
        <h3>Priority & SLA</h3>
        
        <div class="form-group">
          <label>Priority</label>
          <select bind:value={priority} disabled={isLoading}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Scheduled Date (Optional)</label>
          <input 
            type="datetime-local" 
            bind:value={scheduledDate}
            disabled={isLoading}
          />
        </div>
        
        <div class="form-group">
          <label>Estimated Duration (minutes)</label>
          <input 
            type="number" 
            bind:value={estimatedDuration}
            min="15"
            step="15"
            disabled={isLoading}
          />
        </div>
        
        <div class="sla-section">
          <h4>SLA Settings</h4>
          <div class="form-group">
            <label>Response Time (hours)</label>
            <input 
              type="number" 
              bind:value={slaResponseHours}
              min="1"
              disabled={isLoading}
            />
            <small>Time to acknowledge the work order</small>
          </div>
          
          <div class="form-group">
            <label>Resolution Time (hours)</label>
            <input 
              type="number" 
              bind:value={slaResolutionHours}
              min="1"
              disabled={isLoading}
            />
            <small>Time to resolve the work order</small>
          </div>
        </div>
        
        <div class="info-box">
          <p><strong>Priority Guidelines:</strong></p>
          <ul>
            <li><strong>Critical:</strong> Service outage affecting multiple customers</li>
            <li><strong>High:</strong> Service issue affecting one or more customers</li>
            <li><strong>Medium:</strong> Non-urgent repair or maintenance</li>
            <li><strong>Low:</strong> Routine maintenance or upgrades</li>
          </ul>
        </div>
      </div>
      
    {:else if currentStep === 5}
      <!-- Assign -->
      <div class="wizard-panel">
        <h3>Assign Technician</h3>
        <p>Optionally assign this work order to a technician.</p>
        
        <div class="form-group">
          <label>Assign To (Optional)</label>
          <select bind:value={assignedTo} disabled={isLoading}>
            <option value="">-- Unassigned --</option>
            {#each availableTechnicians as tech}
              <option value={tech.id}>{tech.name} ({tech.email})</option>
            {/each}
          </select>
        </div>
        
        {#if assignedTo}
          <div class="info-box success">
            <p>Work order will be assigned to: {availableTechnicians.find(t => t.id === assignedTo)?.name || 'Unknown'}</p>
          </div>
        {:else}
          <div class="info-box">
            <p>Work order will be created as "Open" and can be assigned later.</p>
          </div>
        {/if}
      </div>
      
    {:else if currentStep === 6}
      <!-- Complete -->
      <div class="wizard-panel">
        <h3>🎉 Work Order Created!</h3>
        <p>Your work order has been created successfully.</p>
        
        <div class="workorder-summary">
          <h4>Work Order Summary</h4>
          <div class="summary-row">
            <span class="label">Type:</span>
            <span class="value">{workOrderType}</span>
          </div>
          <div class="summary-row">
            <span class="label">Priority:</span>
            <span class="value">{priority}</span>
          </div>
          <div class="summary-row">
            <span class="label">Title:</span>
            <span class="value">{title}</span>
          </div>
          <div class="summary-row">
            <span class="label">Affected Sites:</span>
            <span class="value">{affectedSites.length}</span>
          </div>
          <div class="summary-row">
            <span class="label">Affected Equipment:</span>
            <span class="value">{affectedEquipment.length}</span>
          </div>
          {#if assignedTo}
            <div class="summary-row">
              <span class="label">Assigned To:</span>
              <span class="value">{availableTechnicians.find(t => t.id === assignedTo)?.name || 'Unknown'}</span>
            </div>
          {/if}
        </div>
        
        <div class="next-steps">
          <h4>What's Next?</h4>
          <a href="/modules/work-orders" class="next-step-item">
            <span class="icon">📋</span>
            <div>
              <strong>View Work Order</strong>
              <p>Check the Work Orders module to see your ticket</p>
            </div>
          </a>
          {#if assignedTo}
            <div class="next-step-item">
              <span class="icon">📧</span>
              <div>
                <strong>Technician Notified</strong>
                <p>Assigned technician will be notified</p>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
  
  <div slot="footer" let:currentStep let:nextStep let:prevStep let:handleClose let:isLoading>
    {#if currentStep > 0}
      <button class="wizard-btn-secondary" on:click={prevStep} disabled={isLoading}>
        ← Previous
      </button>
    {:else}
      <button class="wizard-btn-secondary" on:click={handleClose} disabled={isLoading}>
        Cancel
      </button>
    {/if}
    
    <div class="footer-actions">
      {#if currentStep === 5}
        <button 
          class="wizard-btn-primary" 
          on:click={createWorkOrder} 
          disabled={isLoading || !title.trim() || !description.trim()}
        >
          {isLoading ? 'Creating...' : '✅ Create Work Order'}
        </button>
      {:else if currentStep < steps.length - 1}
        <button class="wizard-btn-primary" on:click={nextStep} disabled={isLoading}>
          Next →
        </button>
      {:else}
        <button class="wizard-btn-primary" on:click={complete} disabled={isLoading}>
          Finish →
        </button>
      {/if}
    </div>
  </div>
</BaseWizard>

{#if showCustomerLookup}
  <CustomerLookupModal
    show={showCustomerLookup}
    tenantId={$currentTenant?.id || ''}
    on:close={() => showCustomerLookup = false}
    on:select={handleCustomerSelect}
  />
{/if}

<style>
  /* Use global theme variables - no hardcoded colors */
  .wizard-panel h3 {
    margin: 0 0 var(--spacing-md) 0;
    font-size: var(--font-size-2xl);
    color: var(--text-primary);
  }
  
  .wizard-panel p {
    color: var(--text-secondary);
    line-height: var(--line-height-normal);
    margin: var(--spacing-sm) 0;
  }
  
  .info-box {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
    margin: var(--spacing-md) 0;
    color: var(--text-primary);
  }
  
  .info-box.success {
    background: var(--success-light);
    border-color: var(--success-color);
    color: var(--text-primary);
  }
  
  .info-box h4 {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-base);
    color: var(--text-primary);
  }
  
  .info-box ul {
    margin: var(--spacing-sm) 0 0 var(--spacing-lg);
    padding: 0;
    color: var(--text-primary);
  }
  
  .type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--spacing-md);
    margin: var(--spacing-lg) 0;
  }
  
  .type-card {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    cursor: pointer;
    transition: var(--transition);
    text-align: center;
    color: var(--text-primary);
  }
  
  .type-card:hover:not(:disabled) {
    border-color: var(--primary-color);
    transform: translateY(-2px);
    background: var(--hover-bg);
  }
  
  .type-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .type-icon {
    font-size: 2.5rem;
    margin-bottom: var(--spacing-sm);
  }
  
  .type-card h4 {
    margin: var(--spacing-sm) 0;
    font-size: var(--font-size-base);
    color: var(--text-primary);
  }
  
  .type-card p {
    font-size: var(--font-size-sm);
    margin: var(--spacing-sm) 0 0 0;
    color: var(--text-secondary);
  }
  
  .affected-section {
    margin: var(--spacing-lg) 0;
  }
  
  .affected-section h4 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-primary);
  }
  
  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--spacing-md);
    margin: var(--spacing-md) 0;
  }
  
  .item-card {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
    cursor: pointer;
    transition: var(--transition);
    text-align: left;
    color: var(--text-primary);
  }
  
  .item-card:hover:not(:disabled) {
    border-color: var(--primary-color);
    background: var(--hover-bg);
  }
  
  .item-card.selected {
    background: var(--primary-color);
    color: var(--text-inverse);
    border-color: var(--primary-color);
  }
  
  .item-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .item-card h4 {
    margin: 0;
    font-size: var(--font-size-sm);
    color: inherit;
  }
  
  .selected-summary {
    margin-top: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
  }
  
  .selected-summary h4 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--text-primary);
  }
  
  .form-group {
    margin: var(--spacing-md) 0;
  }
  
  .form-group label {
    display: block;
    margin-bottom: var(--spacing-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
  }
  
  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    background: var(--input-bg);
    color: var(--text-primary);
  }
  
  .form-group small {
    display: block;
    margin-top: var(--spacing-xs);
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
  }
  
  .required {
    color: var(--danger-color);
  }
  
  .customer-section {
    margin: var(--spacing-md) 0;
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
  }
  
  .btn-small {
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    border: none;
    font-size: var(--font-size-sm);
    cursor: pointer;
    background: var(--primary-color);
    color: var(--text-inverse);
    margin-bottom: var(--spacing-sm);
    transition: var(--transition);
  }
  
  .btn-small:hover:not(:disabled) {
    background: var(--primary-hover);
  }
  
  .attachments-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-sm);
  }
  
  .attachment-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    color: var(--text-primary);
  }
  
  .btn-icon {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    padding: 0;
    color: var(--text-secondary);
  }
  
  .btn-icon:hover {
    color: var(--danger-color);
  }
  
  .sla-section {
    margin: var(--spacing-lg) 0;
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
  }
  
  .sla-section h4 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-primary);
  }
  
  .workorder-summary {
    margin: var(--spacing-lg) 0;
  }
  
  .workorder-summary h4 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-primary);
  }
  
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-md) 0;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
  }
  
  .summary-row .label {
    font-weight: var(--font-weight-medium);
    color: var(--text-secondary);
  }
  
  .summary-row .value {
    color: var(--text-primary);
  }
  
  .next-steps {
    margin-top: var(--spacing-lg);
  }

  a.next-step-item {
    text-decoration: none;
    color: inherit;
  }

  a.next-step-item:hover {
    background: var(--bg-primary);
  }
  
  .next-step-item {
    display: flex;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    margin: var(--spacing-md) 0;
    border: 1px solid var(--border-color);
    color: var(--text-primary);
  }
  
  .next-step-item .icon {
    font-size: 2rem;
  }
  
  .next-step-item strong {
    display: block;
    margin-bottom: var(--spacing-xs);
    color: var(--text-primary);
  }
  
  .next-step-item p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  
  .footer-actions {
    display: flex;
    gap: var(--spacing-sm);
  }
</style>
