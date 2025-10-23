<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { authService } from '$lib/services/authService';
  import { isPlatformAdmin } from '$lib/services/adminService';
  import { 
    getBillingAnalytics, 
    getAllSubscriptions, 
    getSubscriptionPlans,
    type Subscription,
    type SubscriptionPlan,
    type Invoice
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
      const [analyticsData, subscriptionsData, plansData] = await Promise.all([
        getBillingAnalytics().catch(() => analytics),
        getAllSubscriptions().catch(() => []),
        getSubscriptionPlans().catch(() => [])
      ]);
      
      analytics = analyticsData;
      subscriptions = subscriptionsData;
      plans = plansData;
      
    } catch (err: any) {
      console.error('Error loading billing data:', err);
      error = err.message || 'Failed to load billing data';
    } finally {
      loading = false;
    }
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
</script>

<TenantGuard requireTenant={false} adminOnly={true}>
  <div class="billing-module">
    <!-- Header -->
    <div class="module-header">
      <div class="header-content">
        <button class="back-btn" on:click={goBack}>
          <span class="back-icon">←</span>
          Back to Admin Management
        </button>
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

  .analytics-section,
  .plans-section,
  .subscriptions-section {
    margin-bottom: 3rem;
  }

  .analytics-section h2,
  .plans-section h2,
  .subscriptions-section h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: white;
    margin: 0 0 1.5rem 0;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .loading,
  .empty-state {
    text-align: center;
    padding: 3rem;
    color: white;
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
    .table-row {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }

    .col-tenant,
    .col-plan,
    .col-status,
    .col-period,
    .col-actions {
      text-align: center;
    }
  }
</style>
