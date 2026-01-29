<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { customerPortalService } from '$lib/services/customerPortalService';
  import { customerAuthService } from '$lib/services/customerAuthService';
  import { portalBranding } from '$lib/stores/portalBranding';

  type BillingPortal = {
    servicePlan?: { planName?: string; monthlyFee?: number; setupFee?: number };
    billingCycle?: { type?: string; dayOfMonth?: number; nextBillingDate?: string };
    balance?: { current?: number; overdue?: number };
    autoPay?: { enabled?: boolean };
    invoices?: { invoiceId: string; invoiceNumber: string; amount: number; status: string; dueDate: string }[];
    paymentHistory?: { amount: number; method?: string; paidAt?: string }[];
  };
  let billing: BillingPortal | null = null;
  let loading = true;
  let error = '';
  let featureEnabled = true;

  $: featureEnabled = ($portalBranding?.features?.enableBilling !== false);

  function formatCurrency(n: number | undefined): string {
    if (n == null || Number.isNaN(n)) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  }

  function formatDate(s: string | undefined): string {
    if (!s) return '—';
    try {
      return new Date(s).toLocaleDateString();
    } catch {
      return s;
    }
  }

  onMount(async () => {
    try {
      const customer = await customerAuthService.getCurrentCustomer();
      if (!customer) {
        goto('/modules/customers/portal/login');
        return;
      }
      if (!featureEnabled) {
        goto('/modules/customers/portal/dashboard');
        return;
      }
      billing = (await customerPortalService.getCustomerBilling(customer.tenantId)) as BillingPortal | null;
    } catch (err: any) {
      error = err.message || 'Failed to load billing information';
    } finally {
      loading = false;
    }
  });
</script>

{#if loading}
  <div class="loading">Loading billing information...</div>
{:else if !featureEnabled}
  <div class="feature-disabled">
    <h1>Billing Unavailable</h1>
    <p>Billing is not available for your account. Contact support if you have questions.</p>
  </div>
{:else if error}
  <div class="error">{error}</div>
{:else}
  <div class="billing-page">
    <h1>Billing &amp; Account</h1>
    <p class="subtitle">Your plan, billing cycle, and balance</p>

    {#if billing}
      <div class="billing-sections">
        {#if billing.servicePlan}
          <section class="info-section">
            <h2>Service Plan</h2>
            <div class="info-card">
              <div class="info-row">
                <span class="info-label">Plan</span>
                <span class="info-value">{billing.servicePlan.planName || '—'}</span>
              </div>
              {#if billing.servicePlan.monthlyFee != null}
                <div class="info-row">
                  <span class="info-label">Monthly</span>
                  <span class="info-value">{formatCurrency(billing.servicePlan.monthlyFee)}</span>
                </div>
              {/if}
              {#if billing.servicePlan.setupFee != null && billing.servicePlan.setupFee > 0}
                <div class="info-row">
                  <span class="info-label">Setup (one-time)</span>
                  <span class="info-value">{formatCurrency(billing.servicePlan.setupFee)}</span>
                </div>
              {/if}
            </div>
          </section>
        {/if}

        {#if billing.billingCycle}
          <section class="info-section">
            <h2>Billing Cycle</h2>
            <div class="info-card">
              <div class="info-row">
                <span class="info-label">Cycle</span>
                <span class="info-value">{billing.billingCycle.type || '—'}</span>
              </div>
              {#if billing.billingCycle.dayOfMonth != null}
                <div class="info-row">
                  <span class="info-label">Billing day</span>
                  <span class="info-value">{billing.billingCycle.dayOfMonth}</span>
                </div>
              {/if}
              <div class="info-row">
                <span class="info-label">Next billing date</span>
                <span class="info-value">{formatDate(billing.billingCycle.nextBillingDate)}</span>
              </div>
            </div>
          </section>
        {/if}

        {#if billing.balance && (billing.balance.current != null || billing.balance.overdue != null)}
          <section class="info-section">
            <h2>Balance</h2>
            <div class="info-card">
              {#if billing.balance.current != null}
                <div class="info-row">
                  <span class="info-label">Current balance</span>
                  <span class="info-value">{formatCurrency(billing.balance.current)}</span>
                </div>
              {/if}
              {#if billing.balance.overdue != null && billing.balance.overdue > 0}
                <div class="info-row overdue">
                  <span class="info-label">Overdue</span>
                  <span class="info-value">{formatCurrency(billing.balance.overdue)}</span>
                </div>
              {/if}
            </div>
          </section>
        {/if}

        {#if billing.autoPay?.enabled}
          <section class="info-section">
            <div class="info-card auto-pay-badge">
              <span class="badge">Auto-pay enabled</span>
            </div>
          </section>
        {/if}

        {#if billing.invoices && billing.invoices.length > 0}
          <section class="info-section">
            <h2>Invoices</h2>
            <div class="info-card">
              <ul class="invoice-list">
                {#each billing.invoices as inv}
                  <li class="invoice-row">
                    <span class="inv-num">{inv.invoiceNumber}</span>
                    <span class="inv-amount">{formatCurrency(inv.amount)}</span>
                    <span class="inv-status">{inv.status}</span>
                    <span class="inv-due">Due {formatDate(inv.dueDate)}</span>
                  </li>
                {/each}
              </ul>
            </div>
          </section>
        {/if}

        {#if billing.paymentHistory && billing.paymentHistory.length > 0}
          <section class="info-section">
            <h2>Payment history</h2>
            <div class="info-card">
              <ul class="payment-list">
                {#each billing.paymentHistory.slice().reverse() as pay}
                  <li class="payment-row">
                    <span class="pay-amount">{formatCurrency(pay.amount)}</span>
                    <span class="pay-method">{pay.method || '—'}</span>
                    <span class="pay-date">{formatDate(pay.paidAt)}</span>
                  </li>
                {/each}
              </ul>
            </div>
          </section>
        {/if}
      </div>
    {:else}
      <div class="empty-state">
        <p>No billing record is set up for your account yet.</p>
        <p class="hint">Your provider may add a plan later, or you can contact support for details.</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .billing-page {
    max-width: 700px;
    margin: 0 auto;
  }
  .billing-page h1 {
    font-size: 1.75rem;
    color: var(--brand-text, #111827);
    margin-bottom: 0.25rem;
  }
  .subtitle {
    color: var(--brand-text-secondary, #6b7280);
    margin-bottom: 2rem;
  }
  .billing-sections {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .info-section h2 {
    font-size: 1.125rem;
    color: var(--brand-text, #111827);
    margin-bottom: 0.75rem;
  }
  .info-card {
    background: var(--brand-background, #fff);
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 1.25rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f3f4f6;
  }
  .info-row:last-child {
    border-bottom: none;
  }
  .info-row.overdue .info-value {
    color: #dc2626;
    font-weight: 600;
  }
  .info-label {
    font-weight: 500;
    color: var(--brand-text-secondary, #6b7280);
  }
  .info-value {
    color: var(--brand-text, #111827);
  }
  .auto-pay-badge {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .badge {
    background: #d1fae5;
    color: #065f46;
    padding: 0.35rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .invoice-list, .payment-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .invoice-row, .payment-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f3f4f6;
    font-size: 0.9rem;
  }
  .invoice-row:last-child, .payment-row:last-child {
    border-bottom: none;
  }
  .inv-num, .pay-amount { font-weight: 600; }
  .inv-status { text-transform: capitalize; }
  .empty-state {
    padding: 2rem;
    text-align: center;
    color: var(--brand-text-secondary, #6b7280);
  }
  .empty-state .hint {
    margin-top: 0.5rem;
    font-size: 0.875rem;
  }
  .loading,
  .error,
  .feature-disabled {
    text-align: center;
    padding: 2rem;
    color: var(--brand-text-secondary, #6b7280);
  }
  .error {
    color: #dc2626;
  }
  .feature-disabled h1 {
    color: var(--brand-text, #111827);
    margin-bottom: 0.5rem;
  }
</style>
