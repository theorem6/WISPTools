<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { planService, type PlanProject } from '$lib/services/planService';
  
  export let show = false;
  export let plan: PlanProject | null = null;
  
  const dispatch = createEventDispatcher();
  
  let isProcessing = false;
  let error = '';
  let success = '';
  
  // Approval/Rejection form
  let approvalNotes = '';
  let rejectionReason = 'budget'; // Default reason
  let rejectionNotes = '';
  
  // Rejection reasons
  const rejectionReasons = [
    { value: 'budget', label: '💰 Budget Constraints' },
    { value: 'technical', label: '🔧 Technical Issues' },
    { value: 'timing', label: '⏰ Timing/Timeline Concerns' },
    { value: 'regulatory', label: '📋 Regulatory/Compliance Issues' },
    { value: 'scope', label: '📐 Scope Changes Needed' },
    { value: 'other', label: '❓ Other' }
  ];
  
  function handleClose() {
    approvalNotes = '';
    rejectionReason = 'budget';
    rejectionNotes = '';
    error = '';
    success = '';
    dispatch('close');
  }
  
  async function handleApprove() {
    if (!plan) return;
    
    isProcessing = true;
    error = '';
    
    try {
      await planService.approvePlan(plan.id, approvalNotes);
      success = `Plan "${plan.name}" has been approved for deployment.`;
      setTimeout(() => {
        dispatch('approved', { planId: plan?.id });
        handleClose();
      }, 1500);
    } catch (err: any) {
      error = err.message || 'Failed to approve plan';
      console.error('Error approving plan:', err);
    } finally {
      isProcessing = false;
    }
  }
  
  async function handleReject() {
    if (!plan) return;
    
    if (!rejectionReason) {
      error = 'Please select a rejection reason';
      return;
    }
    
    isProcessing = true;
    error = '';
    
    try {
      await planService.rejectPlan(plan.id, rejectionReason, rejectionNotes);
      success = `Plan "${plan.name}" has been rejected.`;
      setTimeout(() => {
        dispatch('rejected', { planId: plan?.id, reason: rejectionReason });
        handleClose();
      }, 1500);
    } catch (err: any) {
      error = err.message || 'Failed to reject plan';
      console.error('Error rejecting plan:', err);
    } finally {
      isProcessing = false;
    }
  }
  
  function getRejectionReasonLabel(value: string): string {
    return rejectionReasons.find(r => r.value === value)?.label || value;
  }
</script>

{#if show && plan}
  <div class="modal-overlay" on:click={handleClose}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>📋 Plan Approval: {plan.name}</h2>
        <button class="close-btn" on:click={handleClose}>✕</button>
      </div>
      
      <div class="modal-body">
        <!-- Plan Details -->
        <div class="plan-info">
          <div class="info-row">
            <span class="info-label">Status:</span>
            <span class="status-badge {plan.status}">{plan.status}</span>
          </div>
          {#if plan.description}
            <div class="info-row">
              <span class="info-label">Description:</span>
              <span class="info-value">{plan.description}</span>
            </div>
          {/if}
          <div class="info-row">
            <span class="info-label">Scope:</span>
            <span class="info-value">
              {plan.scope.towers.length} towers, {plan.scope.sectors.length} sectors, 
              {plan.scope.cpeDevices.length} CPE, {plan.scope.equipment.length} equipment
            </span>
          </div>
          {#if plan.purchasePlan?.totalEstimatedCost}
            <div class="info-row">
              <span class="info-label">Estimated Cost:</span>
              <span class="info-value cost">${plan.purchasePlan.totalEstimatedCost.toLocaleString()}</span>
            </div>
          {/if}
          {#if plan.approval?.approvedBy}
            <div class="info-row">
              <span class="info-label">Previously Approved By:</span>
              <span class="info-value">{plan.approval.approvedBy} on {plan.approval.approvedAt ? new Date(plan.approval.approvedAt).toLocaleDateString() : 'Unknown'}</span>
            </div>
          {/if}
          {#if plan.approval?.rejectedBy}
            <div class="info-row">
              <span class="info-label">Previously Rejected By:</span>
              <span class="info-value">{plan.approval.rejectedBy} on {plan.approval.rejectedAt ? new Date(plan.approval.rejectedAt).toLocaleDateString() : 'Unknown'}</span>
            </div>
            {#if plan.approval.rejectionReason}
              <div class="info-row">
                <span class="info-label">Reason:</span>
                <span class="info-value">{getRejectionReasonLabel(plan.approval.rejectionReason)}</span>
              </div>
            {/if}
          {/if}
        </div>
        
        <!-- Approval Section -->
        <div class="approval-section">
          <h3>✅ Approve Plan</h3>
          <div class="form-group">
            <label for="approvalNotes">Approval Notes (Optional)</label>
            <textarea
              id="approvalNotes"
              bind:value={approvalNotes}
              placeholder="Add any notes about the approval..."
              rows="3"
            ></textarea>
          </div>
          <button 
            class="btn-approve" 
            on:click={handleApprove} 
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : '✅ Approve Plan'}
          </button>
        </div>
        
        <div class="divider">OR</div>
        
        <!-- Rejection Section -->
        <div class="rejection-section">
          <h3>❌ Reject Plan</h3>
          <div class="form-group">
            <label for="rejectionReason">Rejection Reason *</label>
            <select id="rejectionReason" bind:value={rejectionReason} required>
              {#each rejectionReasons as reason}
                <option value={reason.value}>{reason.label}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label for="rejectionNotes">Rejection Notes (Optional)</label>
            <textarea
              id="rejectionNotes"
              bind:value={rejectionNotes}
              placeholder="Provide details about why the plan is being rejected..."
              rows="4"
            ></textarea>
          </div>
          <button 
            class="btn-reject" 
            on:click={handleReject} 
            disabled={isProcessing || !rejectionReason}
          >
            {isProcessing ? 'Processing...' : '❌ Reject Plan'}
          </button>
        </div>
        
        <!-- Error/Success Messages -->
        {#if error}
          <div class="message error">{error}</div>
        {/if}
        {#if success}
          <div class="message success">{success}</div>
        {/if}
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={handleClose}>Cancel</button>
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
    max-width: 700px;
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
  
  .modal-body {
    padding: var(--spacing-lg);
    overflow-y: auto;
    flex: 1;
  }
  
  .plan-info {
    background: var(--bg-secondary);
    border-radius: var(--border-radius-md);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }
  
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-sm);
  }
  
  .info-row:last-child {
    margin-bottom: 0;
  }
  
  .info-label {
    font-weight: 600;
    color: var(--text-secondary);
  }
  
  .info-value {
    color: var(--text-primary);
  }
  
  .info-value.cost {
    font-weight: 600;
    color: var(--brand-primary);
    font-size: 1.1rem;
  }
  
  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: var(--border-radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .status-badge.ready {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
  }
  
  .status-badge.approved {
    background: rgba(59, 130, 246, 0.1);
    color: #2563eb;
  }
  
  .status-badge.rejected {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }
  
  .approval-section,
  .rejection-section {
    margin-bottom: var(--spacing-lg);
  }
  
  .approval-section h3,
  .rejection-section h3 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-primary);
    font-weight: 600;
  }
  
  .form-group {
    margin-bottom: var(--spacing-md);
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
    transition: border-color 0.2s;
    font-family: inherit;
  }
  
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--brand-primary);
  }
  
  .form-group textarea {
    resize: vertical;
    min-height: 80px;
  }
  
  .btn-approve,
  .btn-reject {
    width: 100%;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--border-radius-md);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 1rem;
  }
  
  .btn-approve {
    background: var(--success);
    color: white;
  }
  
  .btn-approve:hover:not(:disabled) {
    background: var(--success-hover);
    transform: translateY(-1px);
  }
  
  .btn-reject {
    background: var(--danger);
    color: white;
  }
  
  .btn-reject:hover:not(:disabled) {
    background: var(--danger-hover);
    transform: translateY(-1px);
  }
  
  .btn-approve:disabled,
  .btn-reject:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .divider {
    text-align: center;
    margin: var(--spacing-lg) 0;
    color: var(--text-secondary);
    font-weight: 600;
    position: relative;
  }
  
  .divider::before,
  .divider::after {
    content: '';
    position: absolute;
    top: 50%;
    width: 40%;
    height: 1px;
    background: var(--border-color);
  }
  
  .divider::before {
    left: 0;
  }
  
  .divider::after {
    right: 0;
  }
  
  .message {
    padding: 0.75rem;
    border-radius: var(--border-radius-sm);
    margin-top: var(--spacing-md);
  }
  
  .message.error {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
    border-left: 3px solid #dc2626;
  }
  
  .message.success {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
    border-left: 3px solid #16a34a;
  }
  
  .modal-footer {
    padding: var(--spacing-lg);
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
  }
  
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }
</style>

