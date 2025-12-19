<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import AdminBreadcrumb from '$lib/components/admin/AdminBreadcrumb.svelte';
  import { authService } from '$lib/services/authService';
  import { isPlatformAdmin } from '$lib/services/adminService';
  import { 
    getBillingAnalytics, 
    getAllSubscriptions, 
    getSubscriptionPlans,
    getAllInvoices,
    getAllPaymentMethods,
    type Subscription,
    type SubscriptionPlan,
    type Invoice,
    type PaymentMethod
  } from '$lib/services/billingService';

  let isAdmin = false;
  let currentUser: any = null;
  
  // Billing data
  let analytics = {
    totalRevenue: 0,
    monthlyRecurringRevenue: 0,
    activeSubscriptions: 0,
    churnRate: 0,
    averageRevenuePerUser: 0
  };
  
  let subscriptions: Subscription[] = [];
  let plans: SubscriptionPlan[] = [];
  let invoices: Invoice[] = [];
  let paymentMethods: PaymentMethod[] = [];
  let tenants: any[] = []; // Store tenant info for display
  let loading = true;
  let error = '';
  let refreshInterval: NodeJS.Timeout | null = null;

  onMount(async () => {
    if (browser) {
      currentUser = await authService.getCurrentUser();
      isAdmin = isPlatformAdmin(currentUser?.email || null);
      
      if (isAdmin) {
        await loadBillingData();
        // Refresh every 5 minutes
        refreshInterval = setInterval(loadBillingData, 300000);
      }
    }
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  async function loadBillingData() {
    if (!isAdmin) return;
    
    try {
      loading = true;
      error = '';
      
      // Load billing data in parallel
      const [analyticsData, subscriptionsData, plansData, invoicesData, paymentMethodsData] = await Promise.all([
        getBillingAnalytics().catch(() => analytics),
        getAllSubscriptions().catch(() => []),
        getSubscriptionPlans().catch(() => []),
        getAllInvoices().catch(() => []),
        getAllPaymentMethods().catch(() => [])
      ]);
      
      analytics = analyticsData;
      subscriptions = subscriptionsData;
      plans = plansData;
      invoices = invoicesData;
      paymentMethods = paymentMethodsData;
      
      // Load tenant info for display
      try {
        const allTenants = await tenantService.getAllTenants();
        tenants = allTenants;
      } catch (err) {
        console.error('Error loading tenants:', err);
      }
      
    } catch (err: any) {
      console.error('Error loading billing data:', err);
      error = err.message || 'Failed to load billing data';
    } finally {
      loading = false;
    }
  }

  function getTenantName(tenantId: string): string {
    const tenant = tenants.find(t => t.id === tenantId || t._id === tenantId);
    return tenant?.displayName || tenant?.name || tenantId;
  }

  function getFailedPayments(): Invoice[] {
    return invoices.filter(inv => inv.status === 'failed');
  }

  function goBack() {
    goto('/admin/management');
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
      case 'paid':
        return 'badge-success';
      case 'cancelled':
      case 'failed':
        return 'badge-error';
      case 'past_due':
        return 'badge-warning';
      case 'trialing':
      case 'pending':
        return 'badge-info';
      case 'incomplete':
        return 'badge-neutral';
      default:
        return 'badge-neutral';
    }
  }
</script>

<div class="billing-module">
    <!-- Header -->
    <div class="module-header">
      <AdminBreadcrumb items={[{ label: 'Billing Management' }]} />
      <div class="header-content">
        <div class="module-title">
          <h1>💳 Billing Management</h1>
          <p>Manage subscriptions, payments, and billing analytics</p>
        </div>
        <div class="user-info">
          {#if currentUser}
            <span class="user-name">{currentUser.email}</span>
            <span class="user-role">Platform Admin</span>
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

      <!-- Billing Analytics -->
      <div class="analytics-section">
        <h2>Billing Analytics</h2>
        <div class="analytics-grid">
          <div class="analytics-card">
            <div class="analytics-icon">💰</div>
            <div class="analytics-info">
              <h4>Total Revenue</h4>
              <p>{formatCurrency(analytics.totalRevenue)}</p>
            </div>
          </div>
          <div class="analytics-card">
            <div class="analytics-icon">📈</div>
            <div class="analytics-info">
              <h4>Monthly Recurring Revenue</h4>
              <p>{formatCurrency(analytics.monthlyRecurringRevenue)}</p>
            </div>
          </div>
          <div class="analytics-card">
            <div class="analytics-icon">👥</div>
            <div class="analytics-info">
              <h4>Active Subscriptions</h4>
              <p>{analytics.activeSubscriptions}</p>
            </div>
          </div>
          <div class="analytics-card">
            <div class="analytics-icon">📊</div>
            <div class="analytics-info">
              <h4>Average Revenue Per User</h4>
              <p>{formatCurrency(analytics.averageRevenuePerUser)}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Subscription Plans -->
      <div class="plans-section">
        <h2>Subscription Plans</h2>
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
                {#if plan.maxTenants}
                  <span>Up to {plan.maxTenants} tenants</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Failed Payment Alerts -->
      {#if !loading && getFailedPayments().length > 0}
        <div class="alerts-section">
          <h2>⚠️ Failed Payment Alerts</h2>
          <div class="failed-payments-list">
            {#each getFailedPayments() as invoice}
              <div class="alert-card alert-error">
                <div class="alert-icon">⚠️</div>
                <div class="alert-content">
                  <strong>Failed Payment</strong>
                  <p>Tenant: {getTenantName(invoice.tenantId)}</p>
                  <p>Amount: {formatCurrency(invoice.amount)} {invoice.currency}</p>
                  <p>Invoice ID: {invoice.id}</p>
                  <p class="alert-date">Date: {formatDate(invoice.createdAt)}</p>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Payment History Section -->
      <div class="payments-section">
        <h2>💳 Payment History</h2>
        {#if loading}
          <div class="loading">Loading payments...</div>
        {:else if invoices.length === 0}
          <div class="empty-state">
            <p>No payment transactions found</p>
          </div>
        {:else}
          <div class="payments-table">
            <div class="table-header">
              <div class="col-invoice">Invoice ID</div>
              <div class="col-tenant">Tenant</div>
              <div class="col-amount">Amount</div>
              <div class="col-status">Status</div>
              <div class="col-date">Date</div>
            </div>
            {#each invoices as invoice}
              <div class="table-row">
                <div class="col-invoice">
                  <span class="invoice-id">{invoice.id}</span>
                </div>
                <div class="col-tenant">
                  <span class="tenant-name">{getTenantName(invoice.tenantId)}</span>
                </div>
                <div class="col-amount">
                  <span class="amount">{formatCurrency(invoice.amount)} {invoice.currency}</span>
                </div>
                <div class="col-status">
                  <span class="badge {getStatusBadgeClass(invoice.status)}">
                    {invoice.status}
                  </span>
                </div>
                <div class="col-date">
                  <span class="date">{formatDate(invoice.createdAt)}</span>
                  {#if invoice.paidAt}
                    <span class="paid-date">Paid: {formatDate(invoice.paidAt)}</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Payment Methods Section -->
      <div class="payment-methods-section">
        <h2>💳 Payment Methods & Billing Details</h2>
        {#if loading}
          <div class="loading">Loading payment methods...</div>
        {:else if paymentMethods.length === 0}
          <div class="empty-state">
            <p>No payment methods found</p>
          </div>
        {:else}
          <div class="payment-methods-grid">
            {#each paymentMethods as method}
              <div class="payment-method-card">
                <div class="method-header">
                  <div class="method-type">
                    <span class="method-icon">💳</span>
                    <strong>{method.type === 'paypal' ? 'PayPal' : 'Credit Card'}</strong>
                  </div>
                  {#if method.isDefault}
                    <span class="default-badge">Default</span>
                  {/if}
                </div>
                <div class="method-details">
                  <p><strong>Tenant:</strong> {getTenantName(method.tenantId)}</p>
                  <p><strong>Email:</strong> {method.paypalEmail}</p>
                  <p><strong>Added:</strong> {formatDate(method.createdAt)}</p>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Active Subscriptions -->
      <div class="subscriptions-section">
        <h2>Active Subscriptions</h2>
        {#if loading}
          <div class="loading">Loading subscriptions...</div>
        {:else if subscriptions.length === 0}
          <div class="empty-state">
            <p>No subscriptions found</p>
          </div>
        {:else}
          <div class="subscriptions-table">
            <div class="table-header">
              <div class="col-tenant">Tenant</div>
              <div class="col-plan">Plan</div>
              <div class="col-status">Status</div>
              <div class="col-period">Current Period</div>
              <div class="col-actions">Actions</div>
            </div>
            {#each subscriptions as subscription}
              <div class="table-row">
                <div class="col-tenant">
                  <span class="tenant-name">{subscription.tenantId}</span>
                </div>
                <div class="col-plan">
                  <span class="plan-name">{subscription.planId}</span>
                </div>
                <div class="col-status">
                  <span class="badge {getStatusBadgeClass(subscription.status)}">
                    {subscription.status}
                  </span>
                </div>
                <div class="col-period">
                  <span class="period-dates">
                    {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
                  </span>
                </div>
                <div class="col-actions">
                  <button class="action-btn" on:click={() => goto(`/admin/billing/subscription/${subscription.id}`)}>
                    View Details
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      </div>
    </div>
  
  <style>
  .billing-module {
    min-height: 100vh;
    background: var(--bg-primary);
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

  .user-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
  }

  .user-name {
    font-weight: 600;
    color: #1f2937;
  }

  .user-role {
    font-size: 0.75rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
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
    background: var(--danger-light, #fee2e2);
    color: var(--danger-dark, #991b1b);
    border: none;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-btn:hover {
    background: var(--danger-color, #dc2626);
    color: white;
    transform: translateY(-1px);
  }

  .analytics-section,
  .plans-section,
  .subscriptions-section,
  .payments-section,
  .payment-methods-section,
  .alerts-section {
    margin-bottom: 3rem;
  }

  .alerts-section h2,
  .payment-methods-section h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    margin: 0 0 1.5rem 0;
  }

  .failed-payments-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .alert-card {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 0.75rem;
    padding: 1.5rem;
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    border-left: 4px solid;
  }

  .alert-error {
    border-left-color: #dc2626;
    background: #fef2f2;
  }

  .alert-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .alert-content {
    flex: 1;
  }

  .alert-content strong {
    display: block;
    font-size: 1.125rem;
    color: #1f2937;
    margin-bottom: 0.5rem;
  }

  .alert-content p {
    margin: 0.25rem 0;
    color: #6b7280;
    font-size: 0.875rem;
  }

  .alert-date {
    color: #9ca3af;
    font-size: 0.75rem;
    margin-top: 0.5rem !important;
  }

  .payments-table {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 0.75rem;
    overflow: hidden;
  }

  .payments-table .table-header {
    display: grid;
    grid-template-columns: 2fr 2fr 1fr 1fr 2fr;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    font-weight: 600;
    color: #374151;
  }

  .payments-table .table-row {
    display: grid;
    grid-template-columns: 2fr 2fr 1fr 1fr 2fr;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    align-items: center;
  }

  .payments-table .table-row:last-child {
    border-bottom: none;
  }

  .payments-table .table-row:hover {
    background: #f9fafb;
  }

  .invoice-id {
    font-family: monospace;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .amount {
    font-weight: 600;
    color: #1f2937;
  }

  .paid-date {
    display: block;
    font-size: 0.75rem;
    color: #9ca3af;
    margin-top: 0.25rem;
  }

  .payment-methods-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }

  .payment-method-card {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 0.75rem;
    padding: 1.5rem;
    border: 1px solid #e5e7eb;
    transition: all 0.2s ease;
  }

  .payment-method-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: #3b82f6;
  }

  .method-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .method-type {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .method-icon {
    font-size: 1.5rem;
  }

  .default-badge {
    background: #dcfce7;
    color: #166534;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .method-details p {
    margin: 0.5rem 0;
    color: #374151;
    font-size: 0.875rem;
  }

  .method-details strong {
    color: #1f2937;
  }
  
  .payments-section h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    margin: 0 0 1.5rem 0;
  }
  
  .payments-placeholder {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 0.75rem;
    padding: 3rem;
    text-align: center;
  }
  
  .placeholder-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }
  
  .payments-placeholder h3 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 1rem 0;
  }
  
  .payments-placeholder p {
    color: #6b7280;
    margin: 1rem 0;
    line-height: 1.6;
  }
  
  .features-list {
    list-style: none;
    padding: 0;
    margin: 1.5rem auto;
    max-width: 400px;
    text-align: left;
  }
  
  .features-list li {
    padding: 0.5rem 0;
    color: #374151;
    font-size: 0.95rem;
  }
  
  .note {
    font-size: 0.875rem;
    font-style: italic;
    color: #9ca3af;
    margin-top: 1.5rem;
  }

  .analytics-section h2,
  .plans-section h2,
  .subscriptions-section h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    margin: 0 0 1.5rem 0;
  }

  .analytics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .analytics-card {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 0.75rem;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all 0.2s ease;
  }

  .analytics-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .analytics-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .analytics-info h4 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #6b7280;
    margin: 0 0 0.25rem 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .analytics-info p {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0;
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
    background: var(--primary-light, #dbeafe);
    color: var(--primary-dark, #1e40af);
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

  .plan-description {
    color: #6b7280;
    text-align: center;
    margin-bottom: 1.5rem;
    line-height: 1.5;
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
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.875rem;
    color: #6b7280;
    text-align: center;
  }

  .subscriptions-table {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 0.75rem;
    overflow: hidden;
  }

  .table-header {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 2fr 1fr;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    font-weight: 600;
    color: #374151;
  }

  .table-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 2fr 1fr;
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

  .tenant-name,
  .plan-name {
    font-weight: 500;
    color: #1f2937;
  }

  .period-dates {
    font-size: 0.875rem;
    color: #6b7280;
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

  .action-btn {
    background: var(--primary-light, #dbeafe);
    color: var(--primary-dark, #1e40af);
    border: none;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    background: var(--primary-color, #3b82f6);
    color: white;
    transform: translateY(-1px);
  }

  .loading,
  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--text-primary, #111827);
    font-size: 1.125rem;
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

    .analytics-grid {
      grid-template-columns: 1fr;
    }

    .plans-grid {
      grid-template-columns: 1fr;
    }

    .table-header,
    .table-row,
    .payments-table .table-header,
    .payments-table .table-row {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }

    .col-tenant,
    .col-plan,
    .col-status,
    .col-period,
    .col-actions,
    .col-invoice,
    .col-amount,
    .col-date {
      text-align: center;
    }

    .payment-methods-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
