<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { userId } from '$lib/stores/authStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { workOrderService, type WorkOrder } from '$lib/services/workOrderService';
  
  let workOrder: WorkOrder | null = null;
  let isLoading = true;
  let error = '';
  let success = '';
  let isUpdating = false;
  
  let workOrderId: string = '';
  $: workOrderId = $page.params.id ?? '';
  $: tenantId = $currentTenant?.id || '';
  
  onMount(async () => {
    await loadWorkOrder();
  });
  
  async function loadWorkOrder() {
    isLoading = true;
    error = '';
    
    try {
      if (!workOrderId) {
        throw new Error('Missing work order ID');
      }
      workOrder = await workOrderService.getWorkOrder(workOrderId);
    } catch (err: any) {
      error = err.message || 'Failed to load work order';
    } finally {
      isLoading = false;
    }
  }
  
  async function handleUpdateStatus(newStatus: WorkOrder['status']) {
    if (!workOrder) return;
    
    isUpdating = true;
    try {
      await workOrderService.updateWorkOrder(workOrder._id!, { status: newStatus });
      success = `Status updated to: ${newStatus}`;
      setTimeout(() => success = '', 3000);
      await loadWorkOrder();
    } catch (err: any) {
      error = err.message || 'Failed to update status';
    } finally {
      isUpdating = false;
    }
  }
  
  async function handleStartWork() {
    if (!workOrder) return;
    
    isUpdating = true;
    try {
      if (!$userId) {
        throw new Error('No authenticated user');
      }
      await workOrderService.startWork(workOrder._id!, $userId);
      success = 'Work started';
      setTimeout(() => success = '', 3000);
      await loadWorkOrder();
    } catch (err: any) {
      error = err.message || 'Failed to start work';
    } finally {
      isUpdating = false;
    }
  }
  
  async function handleComplete() {
    if (!workOrder) return;
    
    const resolution = prompt('Enter resolution notes:');
    if (!resolution) return;
    
    isUpdating = true;
    try {
      await workOrderService.completeWorkOrder(workOrder._id!, { resolution });
      success = 'Work order completed';
      setTimeout(() => success = '', 3000);
      await loadWorkOrder();
    } catch (err: any) {
      error = err.message || 'Failed to complete work order';
    } finally {
      isUpdating = false;
    }
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
      closed: '#374151'
    };
    return colors[status] || '#6b7280';
  }
  
  function formatDateTime(date: Date | string | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  }

  function gotoEditWorkOrder() {
    if (!workOrder?._id) return;
    goto(`/modules/work-orders/${workOrder._id}/edit`);
  }
</script>

<TenantGuard>
<div class="work-order-details">
  <div class="page-header">
    <button class="back-button" on:click={() => goto('/modules/work-orders')}>
      ← Back to Work Orders
    </button>
    
    {#if workOrder}
      <div class="header-content">
        <div class="header-left">
          <h1>{workOrder.ticketNumber || 'Work Order'}</h1>
          <p class="subtitle">{workOrder.title}</p>
        </div>
        
        <div class="header-badges">
          <div 
            class="priority-badge" 
            style="background-color: {getPriorityColor(workOrder.priority)}"
          >
            {workOrder.priority}
          </div>
          
          <div 
            class="status-badge" 
            style="background-color: {getStatusColor(workOrder.status)}"
          >
            {workOrder.status}
          </div>
        </div>
      </div>
    {/if}
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
  
  {#if isLoading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading work order...</p>
    </div>
  {:else if workOrder}
    <div class="content-grid">
      <!-- Main Content -->
      <div class="main-column">
        <!-- Description -->
        <div class="card">
          <h3>📋 Description</h3>
          <p class="description">{workOrder.description || 'No description provided'}</p>
          
          {#if workOrder.symptoms}
            <h4>Symptoms:</h4>
            <p class="symptoms">{workOrder.symptoms}</p>
          {/if}
        </div>
        
        <!-- Location -->
        {#if workOrder.location}
          <div class="card">
            <h3>📍 Location</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Type:</span>
                <span class="info-value">{workOrder.location.type}</span>
              </div>
              {#if workOrder.location.siteName}
                <div class="info-item">
                  <span class="info-label">Site:</span>
                  <span class="info-value">{workOrder.location.siteName}</span>
                </div>
              {/if}
              {#if workOrder.location.address}
                <div class="info-item">
                  <span class="info-label">Address:</span>
                  <span class="info-value">{workOrder.location.address}</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}
        
        <!-- Customer Info -->
        {#if workOrder.customerReported && workOrder.customerContact}
          <div class="card">
            <h3>👤 Customer Information</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Name:</span>
                <span class="info-value">{workOrder.customerContact.name}</span>
              </div>
              {#if workOrder.customerContact.phone}
                <div class="info-item">
                  <span class="info-label">Phone:</span>
                  <span class="info-value">{workOrder.customerContact.phone}</span>
                </div>
              {/if}
              {#if workOrder.customerContact.email}
                <div class="info-item">
                  <span class="info-label">Email:</span>
                  <span class="info-value">{workOrder.customerContact.email}</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}
        
        <!-- Resolution -->
        {#if workOrder.resolution}
          <div class="card">
            <h3>✅ Resolution</h3>
            <p class="resolution">{workOrder.resolution}</p>
            
            {#if workOrder.rootCause}
              <h4>Root Cause:</h4>
              <p>{workOrder.rootCause}</p>
            {/if}
            
            {#if workOrder.preventiveMeasures}
              <h4>Preventive Measures:</h4>
              <p>{workOrder.preventiveMeasures}</p>
            {/if}
          </div>
        {/if}
        
        <!-- Work Log -->
        {#if workOrder.workPerformed && workOrder.workPerformed.length > 0}
          <div class="card">
            <h3>📝 Work Log</h3>
            <div class="work-log">
              {#each workOrder.workPerformed as entry}
                <div class="log-entry">
                  <div class="log-header">
                    <span class="log-time">{formatDateTime(entry.timestamp)}</span>
                    <span class="log-user">{entry.performedByName}</span>
                  </div>
                  <p class="log-action">{entry.action}</p>
                  {#if entry.notes}
                    <p class="log-notes">{entry.notes}</p>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Sidebar -->
      <div class="sidebar-column">
        <!-- Actions -->
        <div class="card actions-card">
          <h3>⚡ Quick Actions</h3>
          
          {#if workOrder.status === 'open' || workOrder.status === 'assigned'}
            <button 
              class="action-btn start-btn"
              on:click={handleStartWork}
              disabled={isUpdating}
            >
              ▶️ Start Work
            </button>
          {/if}
          
          {#if workOrder.status === 'in-progress'}
            <button 
              class="action-btn complete-btn"
              on:click={handleComplete}
              disabled={isUpdating}
            >
              ✅ Mark Complete
            </button>
          {/if}
          
          {#if workOrder.status === 'resolved'}
            <button 
              class="action-btn"
              on:click={() => handleUpdateStatus('closed')}
              disabled={isUpdating}
            >
              🔒 Close Ticket
            </button>
          {/if}
          
          <button 
            class="action-btn secondary-btn"
            on:click={gotoEditWorkOrder}
          >
            ✏️ Edit Details
          </button>
        </div>
        
        <!-- Details -->
        <div class="card">
          <h3>ℹ️ Details</h3>
          
          <div class="detail-list">
            <div class="detail-item">
              <span class="detail-label">Type:</span>
              <span class="detail-value">{workOrder.type}</span>
            </div>
            
            <div class="detail-item">
              <span class="detail-label">Created:</span>
              <span class="detail-value">{formatDateTime(workOrder.createdAt)}</span>
            </div>
            
            {#if workOrder.createdByName}
              <div class="detail-item">
                <span class="detail-label">Created By:</span>
                <span class="detail-value">{workOrder.createdByName}</span>
              </div>
            {/if}
            
            {#if workOrder.assignedToName}
              <div class="detail-item">
                <span class="detail-label">Assigned To:</span>
                <span class="detail-value">{workOrder.assignedToName}</span>
              </div>
            {/if}
            
            {#if workOrder.scheduledDate}
              <div class="detail-item">
                <span class="detail-label">Scheduled:</span>
                <span class="detail-value">{formatDateTime(workOrder.scheduledDate)}</span>
              </div>
            {/if}
            
            {#if workOrder.estimatedDuration}
              <div class="detail-item">
                <span class="detail-label">Est. Duration:</span>
                <span class="detail-value">{workOrder.estimatedDuration} min</span>
              </div>
            {/if}
          </div>
        </div>
        
        <!-- SLA -->
        {#if workOrder.sla}
          <div class="card" class:sla-breach={workOrder.sla.breached}>
            <h3>⏱️ SLA</h3>
            
            <div class="detail-list">
              {#if workOrder.sla.responseDeadline}
                <div class="detail-item">
                  <span class="detail-label">Response By:</span>
                  <span class="detail-value">{formatDateTime(workOrder.sla.responseDeadline)}</span>
                </div>
              {/if}
              
              {#if workOrder.sla.resolutionDeadline}
                <div class="detail-item">
                  <span class="detail-label">Resolve By:</span>
                  <span class="detail-value">{formatDateTime(workOrder.sla.resolutionDeadline)}</span>
                </div>
              {/if}
              
              {#if workOrder.sla.breached}
                <div class="sla-warning">
                  ⚠️ SLA Breached
                </div>
              {/if}
            </div>
          </div>
        {/if}
        
        <!-- Timeline -->
        <div class="card">
          <h3>📅 Timeline</h3>
          
          <div class="timeline">
            <div class="timeline-item">
              <span class="timeline-icon">📝</span>
              <div class="timeline-content">
                <span class="timeline-label">Created</span>
                <span class="timeline-time">{formatDateTime(workOrder.createdAt)}</span>
              </div>
            </div>
            
            {#if workOrder.assignedAt}
              <div class="timeline-item">
                <span class="timeline-icon">👤</span>
                <div class="timeline-content">
                  <span class="timeline-label">Assigned</span>
                  <span class="timeline-time">{formatDateTime(workOrder.assignedAt)}</span>
                </div>
              </div>
            {/if}
            
            {#if workOrder.startedAt}
              <div class="timeline-item">
                <span class="timeline-icon">▶️</span>
                <div class="timeline-content">
                  <span class="timeline-label">Started</span>
                  <span class="timeline-time">{formatDateTime(workOrder.startedAt)}</span>
                </div>
              </div>
            {/if}
            
            {#if workOrder.completedAt}
              <div class="timeline-item">
                <span class="timeline-icon">✅</span>
                <div class="timeline-content">
                  <span class="timeline-label">Completed</span>
                  <span class="timeline-time">{formatDateTime(workOrder.completedAt)}</span>
                </div>
              </div>
            {/if}
            
            {#if workOrder.closedAt}
              <div class="timeline-item">
                <span class="timeline-icon">🔒</span>
                <div class="timeline-content">
                  <span class="timeline-label">Closed</span>
                  <span class="timeline-time">{formatDateTime(workOrder.closedAt)}</span>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
</TenantGuard>

<style>
  .work-order-details {
    min-height: 100vh;
    background: var(--bg-primary);
    padding: 2rem;
  }
  
  .page-header {
    margin-bottom: 1.5rem;
  }
  
  .back-button {
    background: none;
    border: 1px solid var(--border-color);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-secondary);
    margin-bottom: 1rem;
    transition: all 0.2s;
  }
  
  .back-button:hover {
    background: var(--bg-hover);
    color: var(--brand-primary);
  }
  
  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  
  h1 {
    font-size: 2rem;
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }
  
  .subtitle {
    font-size: 1.25rem;
    color: var(--text-secondary);
    margin: 0;
  }
  
  .header-badges {
    display: flex;
    gap: 0.75rem;
  }
  
  .priority-badge,
  .status-badge {
    padding: 0.5rem 1rem;
    border-radius: 12px;
    color: white;
    font-size: 0.875rem;
    font-weight: 700;
    text-transform: uppercase;
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
  
  .content-grid {
    display: grid;
    grid-template-columns: 1fr 350px;
    gap: 1.5rem;
  }
  
  .card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }
  
  .card.sla-breach {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.05);
  }
  
  .card h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }
  
  .card h4 {
    margin: 1rem 0 0.5rem 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  
  .description,
  .symptoms,
  .resolution {
    color: var(--text-primary);
    line-height: 1.6;
  }
  
  .info-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
  }
  
  .info-label {
    font-weight: 600;
    color: var(--text-secondary);
  }
  
  .info-value {
    color: var(--text-primary);
    text-transform: capitalize;
  }
  
  .actions-card {
    position: sticky;
    top: 2rem;
  }
  
  .action-btn {
    width: 100%;
    padding: 0.875rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    margin-bottom: 0.75rem;
    transition: all 0.2s;
  }
  
  .start-btn {
    background: #10b981;
    color: white;
  }
  
  .start-btn:hover:not(:disabled) {
    background: #059669;
    transform: translateY(-2px);
  }
  
  .complete-btn {
    background: var(--brand-primary);
    color: white;
  }
  
  .complete-btn:hover:not(:disabled) {
    background: var(--brand-primary-hover);
    transform: translateY(-2px);
  }
  
  .secondary-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .secondary-btn:hover {
    background: var(--bg-tertiary);
  }
  
  .action-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .detail-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .detail-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
  }
  
  .detail-value {
    font-size: 0.9rem;
    color: var(--text-primary);
  }
  
  .sla-warning {
    background: #ef4444;
    color: white;
    padding: 0.75rem;
    border-radius: 6px;
    text-align: center;
    font-weight: 600;
    margin-top: 0.75rem;
  }
  
  .timeline {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .timeline-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }
  
  .timeline-icon {
    font-size: 1.25rem;
  }
  
  .timeline-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .timeline-label {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.875rem;
  }
  
  .timeline-time {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  
  .work-log {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .log-entry {
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 8px;
    border-left: 3px solid var(--brand-primary);
  }
  
  .log-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  
  .log-time {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  
  .log-user {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--brand-primary);
  }
  
  .log-action {
    font-weight: 600;
    margin: 0 0 0.25rem 0;
    color: var(--text-primary);
  }
  
  .log-notes {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0;
  }
  
  @media (max-width: 1024px) {
    .content-grid {
      grid-template-columns: 1fr;
    }
    
    .actions-card {
      position: static;
    }
  }
</style>

