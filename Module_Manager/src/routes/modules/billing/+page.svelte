<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { 
    getSubscriptionPlans,
    getTenantSubscription,
    getTenantInvoices,
    getTenantPaymentMethods,
    updatePaymentMethod,
    createPayPalSubscription,
    cancelSubscription,
    type SubscriptionPlan,
    type Subscription,
    type Invoice,
    type PaymentMethod
  } from '$lib/services/billingService';

  let plans: SubscriptionPlan[] = [];
  let currentSubscription: Subscription | null = null;
  let invoices: Invoice[] = [];
  let paymentMethods: PaymentMethod[] = [];
  let loading = true;
  let error = '';
  let showUpgradeModal = false;
  let selectedPlan: SubscriptionPlan | null = null;
  let showEditPaymentModal = false;
  let selectedPaymentMethod: PaymentMethod | null = null;
  let editingPaymentEmail = '';

  onMount(async () => {
    if (browser && $currentTenant) {
      await loadBillingData();
    }
  });

  async function loadBillingData() {
    if (!$currentTenant) return;
    
    try {
      loading = true;
      error = '';
      
      // Load billing data in parallel
      const [plansData, subscriptionData, invoicesData, paymentMethodsData] = await Promise.all([
        getSubscriptionPlans().catch(() => []),
        getTenantSubscription($currentTenant.id).catch(() => null),
        getTenantInvoices($currentTenant.id).catch(() => []),
        getTenantPaymentMethods($currentTenant.id).catch(() => [])
      ]);
      
      plans = plansData;
      currentSubscription = subscriptionData;
      invoices = invoicesData;
      paymentMethods = paymentMethodsData;
      
    } catch (err: any) {
      console.error('Error loading billing data:', err);
      error = err.message || 'Failed to load billing data';
    } finally {
      loading = false;
    }
  }

  function goBack() {
    goto('/dashboard');
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'active':
        return 'badge-success';
      case 'cancelled':
        return 'badge-error';
      case 'past_due':
        return 'badge-warning';
      case 'trialing':
        return 'badge-info';
      case 'incomplete':
        return 'badge-neutral';
      default:
        return 'badge-neutral';
    }
  }

  async function handleUpgrade(plan: SubscriptionPlan) {
    if (!$currentTenant) return;
    
    try {
      selectedPlan = plan;
      showUpgradeModal = true;
      
      const successUrl = `${window.location.origin}/billing/success`;
      const cancelUrl = `${window.location.origin}/billing/cancel`;
      
      const { approvalUrl } = await createPayPalSubscription(
        $currentTenant.id,
        plan.id,
        successUrl,
        cancelUrl
      );
      
      // Redirect to PayPal
      window.location.href = approvalUrl;
      
    } catch (err: any) {
      console.error('Error creating subscription:', err);
      error = err.message || 'Failed to create subscription';
      showUpgradeModal = false;
    }
  }

  async function handleCancelSubscription() {
    if (!$currentTenant || !currentSubscription) return;
    
    if (!confirm('Are you sure you want to cancel your subscription? This action cannot be undone.')) {
      return;
    }
    
    try {
      await cancelSubscription($currentTenant.id, currentSubscription.id);
      await loadBillingData(); // Reload data
    } catch (err: any) {
      console.error('Error cancelling subscription:', err);
      error = err.message || 'Failed to cancel subscription';
    }
  }

  function getCurrentPlan(): SubscriptionPlan | null {
    const subscription = currentSubscription;
    if (!subscription) {
      return null;
    }
    return plans.find((plan) => plan.id === subscription.planId) ?? null;
  }

  function openEditPaymentMethod(method: PaymentMethod) {
    selectedPaymentMethod = method;
    editingPaymentEmail = method.paypalEmail;
    showEditPaymentModal = true;
  }

  function closeEditPaymentModal() {
    showEditPaymentModal = false;
    selectedPaymentMethod = null;
    editingPaymentEmail = '';
  }

  async function handleSavePaymentMethod() {
    if (!$currentTenant || !selectedPaymentMethod) return;
    
    if (!editingPaymentEmail.trim()) {
      error = 'Please enter a valid PayPal email address';
      return;
    }
    
    try {
      await updatePaymentMethod(
        $currentTenant.id,
        selectedPaymentMethod.id,
        editingPaymentEmail.trim()
      );
      await loadBillingData(); // Reload data
      closeEditPaymentModal();
    } catch (err: any) {
      console.error('Error updating payment method:', err);
      error = err.message || 'Failed to update payment method';
    }
  }
</script>

<TenantGuard>
  <div class="billing-module">
    <!-- Header -->
    <div class="module-header">
      <div class="header-content">
        <button class="back-btn" on:click={goBack}>
          <span class="back-icon">←</span>
          Back to Dashboard
        </button>
        <div class="module-title">
          <h1>💳 Billing & Subscriptions</h1>
          <p>Manage your subscription and billing information</p>
        </div>
        <div class="tenant-info">
          {#if $currentTenant}
            <span class="tenant-name">{$currentTenant.name}</span>
            <span class="tenant-subdomain">{$currentTenant.subdomain}</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="module-content">
      {#if error}
        <div class="error-banner">
          <p>⚠️ {error}</p>
          <button class="retry-btn" on:click={loadBillingData}>Retry</button>
        </div>
      {/if}

      {#if loading}
        <div class="loading">Loading billing information...</div>
      {:else}
        <!-- Current Subscription -->
        <div class="current-subscription">
          <h2>Current Subscription</h2>
          {#if currentSubscription}
            {@const currentPlan = getCurrentPlan()}
            <div class="subscription-card">
              <div class="subscription-header">
                <div class="plan-info">
                  <h3>{currentPlan?.name || 'Unknown Plan'}</h3>
                  <p class="plan-description">{currentPlan?.description || ''}</p>
                </div>
                <div class="subscription-status">
                  <span class="badge {getStatusBadgeClass(currentSubscription.status)}">
                    {currentSubscription.status}
                  </span>
                </div>
              </div>
              
              <div class="subscription-details">
                <div class="detail-item">
                  <span class="label">Current Period:</span>
                  <span class="value">
                    {formatDate(currentSubscription.currentPeriodStart)} - {formatDate(currentSubscription.currentPeriodEnd)}
                  </span>
                </div>
                <div class="detail-item">
                  <span class="label">Plan Price:</span>
                  <span class="value">
                    {currentPlan ? formatCurrency(currentPlan.price) : 'N/A'} / {currentPlan?.interval || 'month'}
                  </span>
                </div>
                <div class="detail-item">
                  <span class="label">Auto-renewal:</span>
                  <span class="value">
                    {currentSubscription.cancelAtPeriodEnd ? 'Cancelled' : 'Active'}
                  </span>
                </div>
              </div>
              
              <div class="subscription-actions">
                {#if currentSubscription.status === 'active' && !currentSubscription.cancelAtPeriodEnd}
                  <button class="cancel-btn" on:click={handleCancelSubscription}>
                    Cancel Subscription
                  </button>
                {/if}
                <button class="upgrade-btn" on:click={() => showUpgradeModal = true}>
                  Change Plan
                </button>
              </div>
            </div>
          {:else}
            <div class="no-subscription">
              <p>No active subscription found. Choose a plan to get started.</p>
            </div>
          {/if}
        </div>

        <!-- Available Plans -->
        <div class="plans-section">
          <h2>Available Plans</h2>
          <div class="plans-grid">
            {#each plans as plan}
              <div class="plan-card {plan.isPopular ? 'popular' : ''}">
                {#if plan.isPopular}
                  <div class="popular-badge">Most Popular</div>
                {/if}
                <div class="plan-header">
                  <h3>{plan.name}</h3>
                  <div class="plan-price">
                    <span class="price">{formatCurrency(plan.price)}</span>
                    <span class="interval">/{plan.interval}</span>
                  </div>
                </div>
                <p class="plan-description">{plan.description}</p>
                <ul class="plan-features">
                  {#each plan.features as feature}
                    <li>✓ {feature}</li>
                  {/each}
                </ul>
                <div class="plan-limits">
                  <span>Up to {plan.maxUsers} users</span>
                </div>
                <button 
                  class="select-plan-btn" 
                  on:click={() => handleUpgrade(plan)}
                  disabled={currentSubscription?.planId === plan.id}
                >
                  {currentSubscription?.planId === plan.id ? 'Current Plan' : 'Select Plan'}
                </button>
              </div>
            {/each}
          </div>
        </div>

        <!-- Payment Methods -->
        <div class="payment-methods-section">
          <h2>Payment Methods</h2>
          {#if paymentMethods.length === 0}
            <div class="no-payment-methods">
              <p>No payment methods found. Add a payment method to manage your subscription.</p>
            </div>
          {:else}
            <div class="payment-methods-list">
              {#each paymentMethods as method}
                <div class="payment-method-card">
                  <div class="method-info">
                    <div class="method-type">
                      <span class="method-icon">💳</span>
                      <span class="method-name">PayPal</span>
                    </div>
                    <div class="method-details">
                      <span class="method-email">{method.paypalEmail}</span>
                      {#if method.isDefault}
                        <span class="default-badge">Default</span>
                      {/if}
                    </div>
                  </div>
                  <div class="method-actions">
                    <button class="edit-btn" on:click={() => openEditPaymentMethod(method)}>Edit</button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Recent Invoices -->
        <div class="invoices-section">
          <h2>Recent Invoices</h2>
          {#if invoices.length === 0}
            <div class="no-invoices">
              <p>No invoices found.</p>
            </div>
          {:else}
            <div class="invoices-table">
              <div class="table-header">
                <div class="col-date">Date</div>
                <div class="col-amount">Amount</div>
                <div class="col-status">Status</div>
                <div class="col-actions">Actions</div>
              </div>
              {#each invoices as invoice}
                <div class="table-row">
                  <div class="col-date">{formatDate(invoice.createdAt)}</div>
                  <div class="col-amount">{formatCurrency(invoice.amount)}</div>
                  <div class="col-status">
                    <span class="badge {getStatusBadgeClass(invoice.status)}">
                      {invoice.status}
                    </span>
                  </div>
                  <div class="col-actions">
                    {#if invoice.invoiceUrl}
                      <a href={invoice.invoiceUrl} target="_blank" class="download-btn">
                        Download
                      </a>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Edit Payment Method Modal -->
    {#if showEditPaymentModal && selectedPaymentMethod}
      <div class="modal-overlay" on:click={closeEditPaymentModal}>
        <div class="modal-content" on:click|stopPropagation>
          <div class="modal-header">
            <h3>Edit Payment Method</h3>
            <button class="modal-close" on:click={closeEditPaymentModal}>✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>PayPal Email</label>
              <input
                type="email"
                bind:value={editingPaymentEmail}
                placeholder="paypal@example.com"
                required
              />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" on:click={closeEditPaymentModal}>Cancel</button>
            <button class="btn-primary" on:click={handleSavePaymentMethod}>Save</button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</TenantGuard>

<style>
  .billing-module {
    min-height: 100vh;
    background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  }

  .module-header {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    padding: 1.5rem 2rem;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 1200px;
    margin: 0 auto;
  }

  .back-btn {
    background: #6b7280;
    color: white;
    border: none;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .back-btn:hover {
    background: #4b5563;
    transform: translateY(-1px);
  }

  .back-icon {
    font-size: 1rem;
  }

  .module-title h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
  }

  .module-title p {
    color: #6b7280;
    margin: 0;
    font-size: 1rem;
  }

  .tenant-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
  }

  .tenant-name {
    font-weight: 600;
    color: #1f2937;
  }

  .tenant-subdomain {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .module-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .error-banner {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.75rem;
    padding: 1rem;
    margin-bottom: 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .error-banner p {
    margin: 0;
    color: #dc2626;
    font-weight: 500;
  }

  .retry-btn {
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-btn:hover {
    background: #b91c1c;
    transform: translateY(-1px);
  }

  .current-subscription,
  .plans-section,
  .payment-methods-section,
  .invoices-section {
    margin-bottom: 3rem;
  }

  .current-subscription h2,
  .plans-section h2,
  .payment-methods-section h2,
  .invoices-section h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: white;
    margin: 0 0 1.5rem 0;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .subscription-card {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 1rem;
    padding: 2rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .subscription-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }

  .plan-info h3 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
  }

  .plan-description {
    color: #6b7280;
    margin: 0;
  }

  .subscription-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .label {
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 500;
  }

  .value {
    font-size: 1rem;
    color: #1f2937;
    font-weight: 600;
  }

  .subscription-actions {
    display: flex;
    gap: 1rem;
  }

  .cancel-btn {
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 0.5rem;
    padding: 0.75rem 1.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-btn:hover {
    background: #dc2626;
    transform: translateY(-1px);
  }

  .upgrade-btn {
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    padding: 0.75rem 1.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .upgrade-btn:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .no-subscription,
  .no-payment-methods,
  .no-invoices {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 0.75rem;
    padding: 2rem;
    text-align: center;
    color: #6b7280;
  }

  .plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .plan-card {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 1rem;
    padding: 2rem;
    position: relative;
    transition: all 0.3s ease;
    border: 2px solid transparent;
  }

  .plan-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }

  .plan-card.popular {
    border-color: #3b82f6;
    transform: scale(1.05);
  }

  .popular-badge {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    background: #3b82f6;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .plan-header {
    text-align: center;
    margin-bottom: 1rem;
  }

  .plan-header h3 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
  }

  .plan-price {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.25rem;
  }

  .price {
    font-size: 2.5rem;
    font-weight: 700;
    color: #1f2937;
  }

  .interval {
    font-size: 1rem;
    color: #6b7280;
  }

  .plan-features {
    list-style: none;
    padding: 0;
    margin: 0 0 1.5rem 0;
  }

  .plan-features li {
    padding: 0.5rem 0;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
  }

  .plan-features li:last-child {
    border-bottom: none;
  }

  .plan-limits {
    text-align: center;
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 1.5rem;
  }

  .select-plan-btn {
    width: 100%;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .select-plan-btn:hover:not(:disabled) {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .select-plan-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .payment-methods-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .payment-method-card {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 0.75rem;
    padding: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .method-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .method-type {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .method-icon {
    font-size: 1.25rem;
  }

  .method-name {
    font-weight: 600;
    color: #1f2937;
  }

  .method-details {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .method-email {
    color: #6b7280;
  }

  .default-badge {
    background: #dcfce7;
    color: #166534;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .edit-btn {
    background: #6b7280;
    color: white;
    border: none;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .edit-btn:hover {
    background: #4b5563;
  }

  .invoices-table {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 0.75rem;
    overflow: hidden;
  }

  .table-header {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    font-weight: 600;
    color: #374151;
  }

  .table-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    align-items: center;
  }

  .table-row:last-child {
    border-bottom: none;
  }

  .table-row:hover {
    background: #f9fafb;
  }

  .badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .badge-success {
    background: #dcfce7;
    color: #166534;
  }

  .badge-error {
    background: #fef2f2;
    color: #dc2626;
  }

  .badge-warning {
    background: #fef3c7;
    color: #d97706;
  }

  .badge-info {
    background: #dbeafe;
    color: #2563eb;
  }

  .badge-neutral {
    background: #f3f4f6;
    color: #6b7280;
  }

  .download-btn {
    background: #3b82f6;
    color: white;
    text-decoration: none;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .download-btn:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: white;
    font-size: 1.125rem;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: white;
    border-radius: 0.75rem;
    padding: 0;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #6b7280;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: #f3f4f6;
    color: #1f2937;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-weight: 500;
    color: #374151;
    font-size: 0.875rem;
  }

  .form-group input {
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.95rem;
  }

  .form-group input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
  }

  .btn-primary, .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover {
    background: #e5e7eb;
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }

    .module-content {
      padding: 1rem;
    }

    .subscription-header {
      flex-direction: column;
      gap: 1rem;
    }

    .subscription-details {
      grid-template-columns: 1fr;
    }

    .subscription-actions {
      flex-direction: column;
    }

    .plans-grid {
      grid-template-columns: 1fr;
    }

    .payment-method-card {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }

    .table-header,
    .table-row {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }

    .col-date,
    .col-amount,
    .col-status,
    .col-actions {
      text-align: center;
    }
  }
</style>
