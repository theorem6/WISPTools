<script lang="ts">
  import { onMount } from 'svelte';
  import { authService } from '$lib/services/authService';
  import { currentTenant } from '$lib/stores/tenantStore';

  export let documentation: any;
  
  let approving = false;
  let approvingPayment = false;
  let approvalNotes = '';
  let rejectionReason = '';
  let showRejectDialog = false;
  let showPaymentDialog = false;
  const approvedAmountId = 'payment-approved-amount';
  const invoiceNumberId = 'payment-invoice-number';
  const invoiceDateId = 'payment-invoice-date';
  const invoiceUrlId = 'payment-invoice-url';
  const paymentMethodId = 'payment-method';
  const paymentNotesId = 'payment-notes';

  let paymentData = {
    approvedAmount: documentation?.paymentApproval?.requestedAmount || 0,
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    invoiceUrl: '',
    paymentMethod: 'ach',
    paymentNotes: ''
  };

  async function approveInstallation() {
    if (!approvalNotes.trim()) {
      approvalNotes = 'Installation documentation reviewed and approved';
    }

    try {
      approving = true;
      const token = await authService.getAuthTokenForApi();
      const tenantId = $currentTenant?.id;

      const headers: HeadersInit = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(tenantId ? { 'X-Tenant-ID': tenantId } : {})
      };

      const response = await fetch(`/api/installation-documentation/${documentation._id}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          approvalNotes,
          rejected: false
        })
      });

      if (response.ok) {
        const updated = await response.json();
        documentation = updated.documentation;
        alert('Installation approved successfully');
      } else {
        const error = await response.json();
        alert('Error: ' + (error.message || 'Failed to approve'));
      }
    } catch (error: any) {
      console.error('Approval error:', error);
      alert('Error: ' + error.message);
    } finally {
      approving = false;
    }
  }

  async function rejectInstallation() {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      approving = true;
      const token = await authService.getAuthTokenForApi();
      const tenantId = $currentTenant?.id;

      const headers: HeadersInit = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(tenantId ? { 'X-Tenant-ID': tenantId } : {})
      };

      const response = await fetch(`/api/installation-documentation/${documentation._id}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rejected: true,
          rejectionReason
        })
      });

      if (response.ok) {
        const updated = await response.json();
        documentation = updated.documentation;
        showRejectDialog = false;
        alert('Installation rejected');
      } else {
        const error = await response.json();
        alert('Error: ' + (error.message || 'Failed to reject'));
      }
    } catch (error: any) {
      console.error('Rejection error:', error);
      alert('Error: ' + error.message);
    } finally {
      approving = false;
    }
  }

  async function approvePayment() {
    if (!paymentData.invoiceNumber) {
      alert('Invoice number is required');
      return;
    }

    try {
      approvingPayment = true;
      const token = await authService.getAuthTokenForApi();
      const tenantId = $currentTenant?.id;

      const headers: HeadersInit = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(tenantId ? { 'X-Tenant-ID': tenantId } : {})
      };

      const response = await fetch(`/api/installation-documentation/${documentation._id}/payment-approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify(paymentData)
      });

      if (response.ok) {
        const updated = await response.json();
        documentation = updated;
        showPaymentDialog = false;
        alert('Payment approved successfully');
      } else {
        const error = await response.json();
        alert('Error: ' + (error.message || 'Failed to approve payment'));
      }
    } catch (error: any) {
      console.error('Payment approval error:', error);
      alert('Error: ' + error.message);
    } finally {
      approvingPayment = false;
    }
  }
</script>

<div class="approval-panel">
  <h3>Management Approval</h3>
  
  {#if documentation.approvalStatus === 'submitted' || documentation.approvalStatus === 'under-review'}
    <div class="approval-section">
      <h4>📋 Documentation Review</h4>
      
      <div class="review-stats">
        <div class="stat">
          <span class="stat-label">Photos:</span>
          <span class="stat-value">{documentation.photoCount} / {documentation.requiredPhotos?.minCount || 3}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Equipment:</span>
          <span class="stat-value">{documentation.documentation?.equipmentList?.length || 0} items</span>
        </div>
        <div class="stat">
          <span class="stat-label">Submitted:</span>
          <span class="stat-value">{new Date(documentation.submittedAt).toLocaleDateString()}</span>
        </div>
      </div>

      {#if documentation.photos && documentation.photos.length > 0}
        <div class="photos-preview">
          <h5>Photos ({documentation.photos.length})</h5>
          <div class="photos-grid">
            {#each documentation.photos.slice(0, 6) as photo}
              <img src={photo.thumbnailUrl || photo.url} alt={photo.description} class="photo-thumb" />
            {/each}
          </div>
        </div>
      {/if}

      <div class="approval-actions">
        <textarea
          bind:value={approvalNotes}
          placeholder="Approval notes (optional)"
          class="notes-input"
        ></textarea>
        
        <div class="action-buttons">
          <button class="btn-approve" on:click={approveInstallation} disabled={approving}>
            {approving ? 'Approving...' : '✅ Approve Installation'}
          </button>
          <button class="btn-reject" on:click={() => showRejectDialog = true} disabled={approving}>
            ❌ Reject
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if documentation.approvalStatus === 'approved' && documentation.paymentApproval?.required}
    <div class="payment-section">
      <h4>💰 Payment Approval</h4>
      <p class="help-text">
        Installation approved. Review payment details and approve payment to subcontractor.
      </p>
      
      <div class="payment-info">
        <div class="info-row">
          <span class="label">Subcontractor:</span>
          <span class="value">{documentation.subcontractor?.companyName || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="label">Requested Amount:</span>
          <span class="value">${documentation.paymentApproval?.requestedAmount?.toFixed(2) || '0.00'}</span>
        </div>
        <div class="info-row">
          <span class="label">Status:</span>
          <span class="value">{documentation.paymentApproval?.status}</span>
        </div>
      </div>

      {#if documentation.paymentApproval.status === 'documentation-complete'}
        <button class="btn-payment" on:click={() => showPaymentDialog = true}>
          💳 Approve Payment
        </button>
      {/if}
    </div>
  {/if}

  {#if documentation.approvalStatus === 'approved'}
    <div class="approved-section">
      <div class="approved-badge">
        ✅ Approved by {documentation.approval?.approvedByName || 'Management'}
        <br />
        <small>{new Date(documentation.approval?.approvedAt).toLocaleString()}</small>
      </div>
      {#if documentation.approval?.approvalNotes}
        <p class="approval-notes">Notes: {documentation.approval.approvalNotes}</p>
      {/if}
    </div>
  {/if}

  {#if showRejectDialog}
    <div class="dialog-overlay">
      <div class="dialog">
        <h4>Reject Installation</h4>
        <textarea
          bind:value={rejectionReason}
          placeholder="Reason for rejection (required)"
          class="rejection-input"
        ></textarea>
        <div class="dialog-actions">
          <button class="btn-cancel" on:click={() => showRejectDialog = false}>Cancel</button>
          <button class="btn-confirm-reject" on:click={rejectInstallation} disabled={approving}>
            {approving ? 'Rejecting...' : 'Confirm Rejection'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if showPaymentDialog}
    <div class="dialog-overlay">
      <div class="dialog payment-dialog">
        <h4>Approve Payment</h4>
        
        <div class="form-group">
          <label for={approvedAmountId}>Approved Amount ($)</label>
          <input
            id={approvedAmountId}
            type="number"
            bind:value={paymentData.approvedAmount}
            step="0.01"
          />
        </div>
        
        <div class="form-group">
          <label for={invoiceNumberId}>Invoice Number *</label>
          <input
            id={invoiceNumberId}
            type="text"
            bind:value={paymentData.invoiceNumber}
            required
          />
        </div>
        
        <div class="form-group">
          <label for={invoiceDateId}>Invoice Date</label>
          <input
            id={invoiceDateId}
            type="date"
            bind:value={paymentData.invoiceDate}
          />
        </div>
        
        <div class="form-group">
          <label for={invoiceUrlId}>Invoice URL (optional)</label>
          <input
            id={invoiceUrlId}
            type="url"
            bind:value={paymentData.invoiceUrl}
          />
        </div>
        
        <div class="form-group">
          <label for={paymentMethodId}>Payment Method</label>
          <select id={paymentMethodId} bind:value={paymentData.paymentMethod}>
            <option value="ach">ACH</option>
            <option value="check">Check</option>
            <option value="wire">Wire Transfer</option>
            <option value="credit-card">Credit Card</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for={paymentNotesId}>Payment Notes</label>
          <textarea id={paymentNotesId} bind:value={paymentData.paymentNotes}></textarea>
        </div>
        
        <div class="dialog-actions">
          <button class="btn-cancel" on:click={() => showPaymentDialog = false}>Cancel</button>
          <button class="btn-approve" on:click={approvePayment} disabled={approvingPayment}>
            {approvingPayment ? 'Approving...' : '✅ Approve Payment'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .approval-panel {
    background: var(--card-bg);
    border-radius: var(--border-radius-md);
    padding: 1.5rem;
    margin-bottom: 1rem;
  }

  .approval-section, .payment-section, .approved-section {
    margin-bottom: 1.5rem;
  }

  .review-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin: 1rem 0;
  }

  .stat {
    background: var(--secondary-bg);
    padding: 0.75rem;
    border-radius: var(--border-radius-sm);
    text-align: center;
  }

  .stat-label {
    display: block;
    font-size: 0.75rem;
    color: var(--text-color-light);
    margin-bottom: 0.25rem;
  }

  .stat-value {
    display: block;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--primary-color);
  }

  .photos-preview {
    margin: 1rem 0;
  }

  .photos-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .photo-thumb {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: var(--border-radius-sm);
    background: var(--secondary-bg);
  }

  .notes-input {
    width: 100%;
    min-height: 80px;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    background: var(--secondary-bg);
    color: var(--text-color);
    font-family: inherit;
    margin-bottom: 1rem;
  }

  .action-buttons {
    display: flex;
    gap: 1rem;
  }

  .btn-approve {
    flex: 1;
    background: var(--success-color);
    color: white;
    border: none;
    padding: 0.75rem;
    border-radius: var(--border-radius-sm);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-reject {
    flex: 1;
    background: var(--error-color);
    color: white;
    border: none;
    padding: 0.75rem;
    border-radius: var(--border-radius-sm);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-payment {
    width: 100%;
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 0.75rem;
    border-radius: var(--border-radius-sm);
    font-weight: 600;
    cursor: pointer;
    margin-top: 1rem;
  }

  .payment-info {
    background: var(--secondary-bg);
    padding: 1rem;
    border-radius: var(--border-radius-sm);
    margin: 1rem 0;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .approved-badge {
    background: var(--success-color);
    color: white;
    padding: 1rem;
    border-radius: var(--border-radius-sm);
    text-align: center;
    margin-bottom: 0.5rem;
  }

  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    padding: 2rem;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--text-color);
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    background: var(--secondary-bg);
    color: var(--text-color);
    font-family: inherit;
  }

  .dialog-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .btn-cancel {
    flex: 1;
    background: var(--secondary-bg);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    padding: 0.75rem;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
  }

  .btn-confirm-reject {
    flex: 1;
    background: var(--error-color);
    color: white;
    border: none;
    padding: 0.75rem;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
  }

  .help-text {
    color: var(--text-color-light);
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }
</style>
