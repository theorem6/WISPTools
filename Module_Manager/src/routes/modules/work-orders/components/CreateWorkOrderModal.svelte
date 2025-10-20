<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { workOrderService, type WorkOrder } from '$lib/services/workOrderService';
  import { coverageMapService } from '../../coverage-map/lib/coverageMapService.mongodb';
  
  export let show = false;
  export let tenantId: string;
  
  const dispatch = createEventDispatcher();
  
  let isSaving = false;
  let error = '';
  let sites: any[] = [];
  
  let formData = {
    type: 'troubleshoot' as WorkOrder['type'],
    priority: 'medium' as WorkOrder['priority'],
    title: '',
    description: '',
    issueCategory: '' as WorkOrder['issueCategory'],
    location: {
      type: 'tower' as any,
      siteId: '',
      siteName: ''
    },
    customerReported: false,
    customerName: '',
    customerPhone: '',
    scheduledDate: '',
    estimatedDuration: 120,
    slaResponseHours: 4,
    slaResolutionHours: 24
  };
  
  onMount(async () => {
    if (show) {
      await loadSites();
    }
  });
  
  $: if (show) {
    loadSites();
  }
  
  async function loadSites() {
    try {
      sites = await coverageMapService.getTowerSites(tenantId);
    } catch (err) {
      console.error('Failed to load sites:', err);
    }
  }
  
  $: if (formData.location.siteId) {
    const site = sites.find(s => s.id === formData.location.siteId);
    if (site) {
      formData.location.siteName = site.name;
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
      if (formData.customerReported && formData.customerName) {
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
  
  function handleClose() {
    show = false;
    error = '';
    // Reset form
    formData = {
      type: 'troubleshoot',
      priority: 'medium',
      title: '',
      description: '',
      issueCategory: '',
      location: { type: 'tower', siteId: '', siteName: '' },
      customerReported: false,
      customerName: '',
      customerPhone: '',
      scheduledDate: '',
      estimatedDuration: 120,
      slaResponseHours: 4,
      slaResolutionHours: 24
    };
  }
</script>

{#if show}
<div class="modal-overlay" on:click={handleClose}>
  <div class="modal-content" on:click|stopPropagation>
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
            <label>Type *</label>
            <select bind:value={formData.type}>
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
            <label>Priority *</label>
            <select bind:value={formData.priority}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        
        <div class="form-group">
          <label>Title *</label>
          <input type="text" bind:value={formData.title} placeholder="Brief description of the issue or task" required />
        </div>
        
        <div class="form-group">
          <label>Description</label>
          <textarea 
            bind:value={formData.description} 
            placeholder="Detailed description of the work to be performed..."
            rows="4"
          ></textarea>
        </div>
        
        {#if formData.type === 'troubleshoot' || formData.type === 'repair'}
          <div class="form-group">
            <label>Issue Category</label>
            <select bind:value={formData.issueCategory}>
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
          <label>Site</label>
          <select bind:value={formData.location.siteId}>
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
          <div class="form-grid">
            <div class="form-group">
              <label>Customer Name</label>
              <input type="text" bind:value={formData.customerName} placeholder="John Smith" />
            </div>
            
            <div class="form-group">
              <label>Phone</label>
              <input type="tel" bind:value={formData.customerPhone} placeholder="555-1234" />
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Scheduling -->
      <div class="section">
        <h3>📅 Scheduling</h3>
        
        <div class="form-grid">
          <div class="form-group">
            <label>Scheduled Date</label>
            <input type="datetime-local" bind:value={formData.scheduledDate} />
          </div>
          
          <div class="form-group">
            <label>Estimated Duration (minutes)</label>
            <input type="number" bind:value={formData.estimatedDuration} placeholder="120" />
          </div>
        </div>
      </div>
      
      <!-- SLA -->
      <div class="section">
        <h3>⏱️ SLA (Service Level Agreement)</h3>
        
        <div class="form-grid">
          <div class="form-group">
            <label>Response Time (hours)</label>
            <input type="number" bind:value={formData.slaResponseHours} placeholder="4" />
          </div>
          
          <div class="form-group">
            <label>Resolution Time (hours)</label>
            <input type="number" bind:value={formData.slaResolutionHours} placeholder="24" />
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
    border-radius: 12px;
    width: 90%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h2 {
    margin: 0;
    color: var(--text-primary);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
  }
  
  .close-btn:hover {
    color: var(--text-primary);
  }
  
  .error-banner {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 1rem;
    margin: 1rem 1.5rem;
    border-radius: 6px;
  }
  
  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }
  
  .section {
    margin-bottom: 2rem;
  }
  
  .section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: var(--brand-primary);
  }
  
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .form-group label {
    font-weight: 500;
    font-size: 0.9rem;
    color: var(--text-primary);
  }
  
  .form-group input,
  .form-group select,
  .form-group textarea {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.9rem;
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
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
  }
  
  .btn-primary {
    background: var(--brand-primary);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--brand-primary-hover);
  }
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }
</style>

