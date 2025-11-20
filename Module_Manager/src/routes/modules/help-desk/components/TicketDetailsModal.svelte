<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { workOrderService, type WorkOrder } from '$lib/services/workOrderService';
  import { getTenantUsers, type TenantUser } from '$lib/services/userManagementService';
  import { authService } from '$lib/services/authService';
  
  export let ticket: WorkOrder;
  const dispatch = createEventDispatcher();
  
  let loading = false;
  let error = '';
  let success = '';
  let activeTab: 'details' | 'work' | 'resolution' = 'details';
  
  // Ticket data
  let ticketData: WorkOrder = ticket;
  let canEdit = false;
  
  // Assignment
  let users: TenantUser[] = [];
  let showAssignModal = false;
  let selectedUserId = '';
  let selectedUserName = '';
  
  // Work logs
  let newWorkLog = {
    action: '',
    notes: ''
  };
  
  // Resolution
  let resolution = {
    resolution: ticket.resolution || '',
    rootCause: ticket.rootCause || '',
    preventiveMeasures: ticket.preventiveMeasures || ''
  };
  
  // Status updates
  let newStatus: WorkOrder['status'] = ticket.status;
  let newPriority: WorkOrder['priority'] = ticket.priority;
  
  onMount(async () => {
    await loadUsers();
    await refreshTicket();
    
    // Check if user can edit
    const currentUser = await authService.getCurrentUser();
    canEdit = !!currentUser; // For now, any authenticated user can edit
  });
  
  async function loadUsers() {
    if (!$currentTenant) return;
    
    try {
      users = await getTenantUsers($currentTenant.id, 'visible');
      // Filter for technicians/engineers
      users = users.filter(u => 
        u.role === 'engineer' || 
        u.role === 'installer' || 
        u.role === 'admin' || 
        u.role === 'owner' ||
        u.status === 'active'
      );
    } catch (err: any) {
      console.error('Error loading users:', err);
    }
  }
  
  async function refreshTicket() {
    if (!ticket._id) return;
    
    try {
      ticketData = await workOrderService.getWorkOrder(ticket._id);
      newStatus = ticketData.status;
      newPriority = ticketData.priority;
    } catch (err: any) {
      console.error('Error refreshing ticket:', err);
    }
  }
  
  async function handleAssign() {
    if (!ticketData._id || !selectedUserId || !selectedUserName) return;
    
    loading = true;
    error = '';
    
    try {
      ticketData = await workOrderService.assignWorkOrder(ticketData._id, selectedUserId, selectedUserName);
      showAssignModal = false;
      success = 'Ticket assigned successfully';
      setTimeout(() => success = '', 3000);
      dispatch('updated', ticketData);
    } catch (err: any) {
      error = err.message || 'Failed to assign ticket';
    } finally {
      loading = false;
    }
  }
  
  async function handleStatusChange() {
    if (!ticketData._id) return;
    
    loading = true;
    error = '';
    
    try {
      const updates: Partial<WorkOrder> = { status: newStatus };
      if (newPriority !== ticketData.priority) {
        updates.priority = newPriority;
      }
      
      ticketData = await workOrderService.updateWorkOrder(ticketData._id, updates);
      
      // If starting work, use the start endpoint
      if (newStatus === 'in-progress' && ticketData.status === 'open') {
        const currentUser = await authService.getCurrentUser();
        if (currentUser?.uid) {
          ticketData = await workOrderService.startWork(ticketData._id, currentUser.uid);
        }
      }
      
      success = 'Ticket status updated';
      setTimeout(() => success = '', 3000);
      dispatch('updated', ticketData);
    } catch (err: any) {
      error = err.message || 'Failed to update status';
    } finally {
      loading = false;
    }
  }
  
  async function handleAddWorkLog() {
    if (!ticketData._id || !newWorkLog.action.trim()) return;
    
    loading = true;
    error = '';
    
    try {
      const currentUser = await authService.getCurrentUser();
      const logEntry = {
        action: newWorkLog.action.trim(),
        notes: newWorkLog.notes.trim() || undefined,
        performedBy: currentUser?.uid || 'unknown',
        performedByName: currentUser?.displayName || currentUser?.email || 'Unknown User'
      };
      
      await workOrderService.addWorkLog(ticketData._id, logEntry);
      
      newWorkLog = { action: '', notes: '' };
      success = 'Work log added';
      setTimeout(() => success = '', 3000);
      await refreshTicket();
      dispatch('updated', ticketData);
    } catch (err: any) {
      error = err.message || 'Failed to add work log';
    } finally {
      loading = false;
    }
  }
  
  async function handleResolve() {
    if (!ticketData._id || !resolution.resolution.trim()) return;
    
    loading = true;
    error = '';
    
    try {
      ticketData = await workOrderService.completeWorkOrder(ticketData._id, {
        resolution: resolution.resolution.trim(),
        rootCause: resolution.rootCause.trim() || undefined,
        preventiveMeasures: resolution.preventiveMeasures.trim() || undefined
      });
      
      success = 'Ticket resolved successfully';
      setTimeout(() => success = '', 3000);
      dispatch('updated', ticketData);
    } catch (err: any) {
      error = err.message || 'Failed to resolve ticket';
    } finally {
      loading = false;
    }
  }
  
  async function handleClose() {
    if (!ticketData._id) return;
    
    if (!confirm('Are you sure you want to close this ticket? It cannot be reopened.')) {
      return;
    }
    
    loading = true;
    error = '';
    
    try {
      ticketData = await workOrderService.closeWorkOrder(ticketData._id);
      success = 'Ticket closed';
      setTimeout(() => success = '', 3000);
      dispatch('updated', ticketData);
    } catch (err: any) {
      error = err.message || 'Failed to close ticket';
    } finally {
      loading = false;
    }
  }
  
  function formatDate(date: string | Date | undefined): string {
    if (!date) return 'Not set';
    return new Date(date).toLocaleString();
  }
  
  function getPriorityBadgeClass(priority: string): string {
    switch (priority) {
      case 'critical': return 'badge-critical';
      case 'high': return 'badge-high';
      case 'medium': return 'badge-medium';
      case 'low': return 'badge-low';
      default: return 'badge-neutral';
    }
  }
  
  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'open': return 'badge-open';
      case 'assigned': return 'badge-assigned';
      case 'in-progress': return 'badge-in-progress';
      case 'waiting-parts': return 'badge-waiting';
      case 'resolved': return 'badge-resolved';
      case 'closed': return 'badge-closed';
      default: return 'badge-neutral';
    }
  }
  
  function getCategoryLabel(category: string | undefined): string {
    switch (category) {
      case 'customer-facing': return 'Customer-Facing';
      case 'infrastructure': return 'Infrastructure';
      default: return 'Unknown';
    }
  }
</script>

<div
  class="modal-backdrop"
  role="presentation"
  on:click={() => dispatch('close')}
>
  <div
    class="modal-content"
    data-size="lg"
    role="dialog"
    aria-modal="true"
    aria-labelledby="ticket-details-heading"
    on:click|stopPropagation
  >
    <header class="modal-header">
      <div>
        <p class="modal-eyebrow">
          {getCategoryLabel(ticketData.ticketCategory)} Ticket
        </p>
        <h2 id="ticket-details-heading">
          {ticketData.ticketNumber || ticketData._id}
        </h2>
      </div>
      <button
        class="modal-close-btn"
        type="button"
        aria-label="Close ticket details"
        on:click={() => dispatch('close')}
      >
        ✕
      </button>
    </header>

    <section class="modal-body">
      {#if error}
        <div class="alert alert-error">
          <span>❌</span>
          <span>{error}</span>
        </div>
      {/if}
      
      {#if success}
        <div class="alert alert-success">
          <span>✅</span>
          <span>{success}</span>
        </div>
      {/if}
      
      <div class="ticket-header">
        <h3 class="ticket-title">{ticketData.title || 'Untitled ticket'}</h3>
        <div class="badges">
          <span class="badge {getPriorityBadgeClass(ticketData.priority)}">
            {ticketData.priority}
          </span>
          <span class="badge {getStatusBadgeClass(ticketData.status)}">
            {ticketData.status}
          </span>
        </div>
      </div>
      
      <div class="tabs">
        <button
          class="tab {activeTab === 'details' ? 'active' : ''}"
          on:click={() => activeTab = 'details'}
        >
          Details
        </button>
        <button
          class="tab {activeTab === 'work' ? 'active' : ''}"
          on:click={() => activeTab = 'work'}
        >
          Work Log ({ticketData.workPerformed?.length || 0})
        </button>
        <button
          class="tab {activeTab === 'resolution' ? 'active' : ''}"
          on:click={() => activeTab = 'resolution'}
          disabled={ticketData.status === 'closed'}
        >
          Resolution
        </button>
      </div>
      
      {#if activeTab === 'details'}
        <div class="details-section">
          <div class="info-grid">
            <div class="info-item">
              <label>Category</label>
              <span>{getCategoryLabel(ticketData.ticketCategory)}</span>
            </div>
            <div class="info-item">
              <label>Type</label>
              <span>{ticketData.type}</span>
            </div>
            <div class="info-item">
              <label>Priority</label>
              <select bind:value={newPriority} disabled={loading}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div class="info-item">
              <label>Status</label>
              <select bind:value={newStatus} on:change={handleStatusChange} disabled={loading || ticketData.status === 'closed'}>
                <option value="open">Open</option>
                <option value="assigned">Assigned</option>
                <option value="in-progress">In Progress</option>
                <option value="waiting-parts">Waiting Parts</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div class="info-item">
              <label>Created</label>
              <span>{formatDate(ticketData.createdAt)}</span>
            </div>
            <div class="info-item">
              <label>Created By</label>
              <span>{ticketData.createdByName || ticketData.createdBy || 'Unknown'}</span>
            </div>
            {#if ticketData.assignedToName}
              <div class="info-item">
                <label>Assigned To</label>
                <span>{ticketData.assignedToName}</span>
              </div>
            {/if}
            {#if ticketData.completedAt}
              <div class="info-item">
                <label>Completed</label>
                <span>{formatDate(ticketData.completedAt)}</span>
              </div>
            {/if}
          </div>
          
          {#if ticketData.description}
            <div class="info-block">
              <label>Description</label>
              <p>{ticketData.description}</p>
            </div>
          {/if}
          
          {#if ticketData.affectedCustomers && ticketData.affectedCustomers.length > 0}
            <div class="info-block">
              <label>Affected Customers</label>
              {#each ticketData.affectedCustomers as customer}
                <div class="customer-item">
                  <strong>{customer.customerName}</strong>
                  {#if customer.phoneNumber}
                    <span>{customer.phoneNumber}</span>
                  {/if}
                  {#if customer.serviceAddress}
                    <span class="address">{customer.serviceAddress}</span>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
          
          {#if ticketData.affectedSites && ticketData.affectedSites.length > 0}
            <div class="info-block">
              <label>Affected Sites</label>
              {#each ticketData.affectedSites as site}
                <div class="site-item">
                  <strong>{site.siteName}</strong>
                  <span>{site.siteType}</span>
                </div>
              {/each}
            </div>
          {/if}
          
          {#if canEdit && ticketData.status !== 'closed' && ticketData.status !== 'resolved'}
            <div class="actions">
              {#if !ticketData.assignedTo}
                <button class="btn btn-primary" on:click={() => showAssignModal = true}>
                  Assign Ticket
                </button>
              {:else}
                <button class="btn btn-secondary" on:click={() => showAssignModal = true}>
                  Reassign Ticket
                </button>
              {/if}
              
              {#if ticketData.status === 'resolved'}
                <button class="btn btn-primary" on:click={handleClose} disabled={loading}>
                  Close Ticket
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
      
      {#if activeTab === 'work'}
        <div class="work-section">
          {#if ticketData.workPerformed && ticketData.workPerformed.length > 0}
            <div class="work-logs">
              {#each ticketData.workPerformed as log}
                <div class="work-log-item">
                  <div class="work-log-header">
                    <strong>{log.action}</strong>
                    <span class="work-log-date">{formatDate(log.timestamp)}</span>
                  </div>
                  <div class="work-log-meta">
                    By: {log.performedByName || log.performedBy}
                  </div>
                  {#if log.notes}
                    <p class="work-log-notes">{log.notes}</p>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <p class="empty-state">No work logs yet</p>
          {/if}
          
          {#if canEdit && ticketData.status !== 'closed'}
            <div class="add-work-log">
              <h4>Add Work Log</h4>
              <div class="form-group">
                <label>Action</label>
                <input
                  type="text"
                  bind:value={newWorkLog.action}
                  placeholder="e.g., Replaced equipment, Updated configuration"
                />
              </div>
              <div class="form-group">
                <label>Notes</label>
                <textarea
                  bind:value={newWorkLog.notes}
                  placeholder="Additional details..."
                  rows="3"
                ></textarea>
              </div>
              <button class="btn btn-primary" on:click={handleAddWorkLog} disabled={loading || !newWorkLog.action.trim()}>
                Add Log Entry
              </button>
            </div>
          {/if}
        </div>
      {/if}
      
      {#if activeTab === 'resolution'}
        <div class="resolution-section">
          {#if ticketData.resolution}
            <div class="info-block">
              <label>Resolution</label>
              <p>{ticketData.resolution}</p>
            </div>
            
            {#if ticketData.rootCause}
              <div class="info-block">
                <label>Root Cause</label>
                <p>{ticketData.rootCause}</p>
              </div>
            {/if}
            
            {#if ticketData.preventiveMeasures}
              <div class="info-block">
                <label>Preventive Measures</label>
                <p>{ticketData.preventiveMeasures}</p>
              </div>
            {/if}
          {:else if canEdit && ticketData.status !== 'closed'}
            <div class="resolution-form">
              <div class="form-group">
                <label>Resolution *</label>
                <textarea
                  bind:value={resolution.resolution}
                  placeholder="Describe how the issue was resolved..."
                  rows="4"
                  required
                ></textarea>
              </div>
              
              <div class="form-group">
                <label>Root Cause (Optional)</label>
                <textarea
                  bind:value={resolution.rootCause}
                  placeholder="What was the root cause of the issue?"
                  rows="3"
                ></textarea>
              </div>
              
              <div class="form-group">
                <label>Preventive Measures (Optional)</label>
                <textarea
                  bind:value={resolution.preventiveMeasures}
                  placeholder="What steps can be taken to prevent this issue in the future?"
                  rows="3"
                ></textarea>
              </div>
              
              <button class="btn btn-primary" on:click={handleResolve} disabled={loading || !resolution.resolution.trim()}>
                Mark as Resolved
              </button>
            </div>
          {:else}
            <p class="empty-state">No resolution recorded yet</p>
          {/if}
        </div>
      {/if}
    </section>
  </div>
</div>

{#if showAssignModal}
  <div class="assign-modal-overlay" on:click={() => showAssignModal = false}>
    <div class="assign-modal" on:click|stopPropagation>
      <h3>Assign Ticket</h3>
      <div class="form-group">
        <label>Select User</label>
        <select bind:value={selectedUserId} on:change={(e) => {
          const user = users.find(u => u.uid === e.target.value);
          selectedUserName = user ? (user.displayName || user.email) : '';
        }}>
          <option value="">-- Select User --</option>
          {#each users as user}
            <option value={user.uid}>{user.displayName || user.email} ({user.role})</option>
          {/each}
        </select>
      </div>
      <div class="assign-modal-actions">
        <button class="btn btn-secondary" on:click={() => showAssignModal = false}>
          Cancel
        </button>
        <button class="btn btn-primary" on:click={handleAssign} disabled={loading || !selectedUserId}>
          Assign
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    background: rgba(0, 0, 0, 0.6) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 99999 !important;
    backdrop-filter: blur(4px);
    visibility: visible !important;
    opacity: 1 !important;
  }

  .modal-content {
    background: var(--card-bg, #ffffff) !important;
    border-radius: 0.75rem;
    padding: 0;
    max-width: 900px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3) !important;
    display: flex !important;
    flex-direction: column;
    position: relative !important;
    visibility: visible !important;
    opacity: 1 !important;
    border: 1px solid var(--border-color, #e5e7eb);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary, #1f2937);
  }

  .modal-close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary, #6b7280);
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
    line-height: 1;
  }

  .modal-close-btn:hover {
    background: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #1f2937);
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .modal-eyebrow {
    margin: 0 0 0.25rem;
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted, #6b7280);
  }

  .ticket-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    gap: 1rem;
  }

  .ticket-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    flex: 1;
  }

  .badges {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .badge {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
  }

  .badge-critical { background: #fee2e2; color: #991b1b; }
  .badge-high { background: #fed7aa; color: #9a3412; }
  .badge-medium { background: #fef3c7; color: #92400e; }
  .badge-low { background: #dbeafe; color: #1e40af; }
  .badge-open { background: #fef3c7; color: #92400e; }
  .badge-assigned { background: #e0e7ff; color: #3730a3; }
  .badge-in-progress { background: #dbeafe; color: #1e40af; }
  .badge-waiting { background: #fed7aa; color: #9a3412; }
  .badge-resolved { background: #d1fae5; color: #065f46; }
  .badge-closed { background: #f3f4f6; color: #374151; }

  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .tab {
    padding: 0.75rem 1.5rem;
    border: none;
    background: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-weight: 500;
    color: var(--text-secondary);
    transition: all 0.2s;
  }

  .tab:hover:not(:disabled) {
    color: var(--text-primary);
  }

  .tab.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }

  .tab:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .info-item label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .info-item span {
    color: var(--text-primary);
  }

  .info-item select {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    background: var(--input-bg);
    color: var(--text-primary);
  }

  .info-block {
    margin-bottom: 1.5rem;
  }

  .info-block label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .info-block p {
    margin: 0;
    color: var(--text-primary);
    line-height: 1.6;
  }

  .customer-item, .site-item {
    padding: 0.75rem;
    background: var(--bg-secondary);
    border-radius: 0.375rem;
    margin-bottom: 0.5rem;
  }

  .customer-item strong, .site-item strong {
    display: block;
    margin-bottom: 0.25rem;
  }

  .address {
    display: block;
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  .actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .work-logs {
    margin-bottom: 2rem;
  }

  .work-log-item {
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .work-log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .work-log-date {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .work-log-meta {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .work-log-notes {
    margin: 0;
    color: var(--text-primary);
    line-height: 1.6;
  }

  .add-work-log {
    padding: 1.5rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
  }

  .add-work-log h4 {
    margin: 0 0 1rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
  }

  .resolution-form {
    padding: 1.5rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--primary);
    color: white;
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .alert {
    padding: 1rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .alert-error {
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
    color: var(--danger);
  }

  .alert-success {
    background: color-mix(in srgb, var(--success) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--success) 30%, transparent);
    color: var(--success);
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
  }

  .assign-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100000;
  }

  .assign-modal {
    background: var(--card-bg);
    padding: 2rem;
    border-radius: 0.75rem;
    max-width: 400px;
    width: 90%;
  }

  .assign-modal h3 {
    margin: 0 0 1.5rem;
  }

  .assign-modal-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
    justify-content: flex-end;
  }
</style>
