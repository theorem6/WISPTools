<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { customerPortalService } from '$lib/services/customerPortalService';
  import { customerAuthService } from '$lib/services/customerAuthService';
  import { portalBranding } from '$lib/stores/portalBranding';
  import StripeCardForm from '$lib/components/portal/StripeCardForm.svelte';

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
  let payMessage = '';
  let paying = false;
  let currentTenantId = '';
  let showCardForm = false;
  let clientSecretForStripe = '';
  let payAmount = 0;
  let showInvoiceModal = false;
  let selectedInvoice: { invoiceNumber: string; amount: number; status: string; dueDate: string; lineItems?: Array<{ description: string; quantity: number; unitPrice: number; total: number }> } | null = null;
  let invoiceDetailLoading = false;

  $: featureEnabled = ($portalBranding?.features?.enableBilling !== false);
  $: stripePublishableKey = $portalBranding?.billingPortal?.paymentGateways?.stripe?.publicKey ?? '';

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
      currentTenantId = customer.tenantId || '';
      billing = (await customerPortalService.getCustomerBilling(customer.tenantId)) as BillingPortal | null;
    } catch (err: any) {
      error = err.message || 'Failed to load billing information';
    } finally {
      loading = false;
    }
  });

  async function handlePayNow() {
    if (!billing || paying) return;
    const amount = (billing.balance?.current ?? 0) || (billing.balance?.overdue ?? 0);
    if (amount <= 0) {
      payMessage = 'No balance due.';
      return;
    }
    paying = true;
    payMessage = '';
    showCardForm = false;
    clientSecretForStripe = '';
    try {
      const result = await customerPortalService.createPaymentIntent(amount, undefined, currentTenantId);
      if (!result.configured) {
        payMessage = result.message || 'Online payments are not configured. Please pay by check or contact support.';
        return;
      }
      if (result.clientSecret && stripePublishableKey) {
        clientSecretForStripe = result.clientSecret;
        payAmount = amount;
        showCardForm = true;
        payMessage = '';
      } else if (result.clientSecret) {
        payMessage = 'Payments are configured but the payment form is not set up. Contact support.';
      }
    } catch (e: any) {
      payMessage = e.message || 'Failed to start payment';
    } finally {
      paying = false;
    }
  }

  function onPaymentSuccess() {
    showCardForm = false;
    clientSecretForStripe = '';
    payMessage = 'Payment successful. Thank you.';
    if (billing) {
      customerPortalService.getCustomerBilling(currentTenantId).then((b) => {
        if (b) billing = b as BillingPortal;
      });
    }
  }

  function onPaymentError(e: { detail: { message: string } }) {
    payMessage = e.detail?.message || 'Payment failed.';
  }

  async function openInvoiceDetail(invoiceId: string) {
    invoiceDetailLoading = true;
    selectedInvoice = null;
    showInvoiceModal = true;
    try {
      selectedInvoice = await customerPortalService.getInvoice(invoiceId, currentTenantId);
    } catch (err: any) {
      selectedInvoice = { invoiceNumber: '—', amount: 0, status: 'Error', dueDate: '', lineItems: [] };
    } finally {
      invoiceDetailLoading = false;
    }
  }

  function closeInvoiceModal() {
    showInvoiceModal = false;
    selectedInvoice = null;
  }
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
    <p class="subtitle">Your plan, billing cycle, and balance. <a href="/modules/customers/portal/billing/settings" class="link-settings">Billing settings</a></p>

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

        {#if billing.balance && ((billing.balance.current ?? 0) + (billing.balance.overdue ?? 0)) > 0}
          <section class="info-section">
            <h2>Pay now</h2>
            <div class="info-card">
              {#if showCardForm && clientSecretForStripe && stripePublishableKey}
                <StripeCardForm
                  clientSecret={clientSecretForStripe}
                  publishableKey={stripePublishableKey}
                  amountLabel={formatCurrency(payAmount)}
                  on:success={onPaymentSuccess}
                  on:error={onPaymentError}
                />
              {:else}
                <p class="pay-desc">Pay your current balance online (when Stripe is configured).</p>
                <button type="button" class="btn-pay" disabled={paying} on:click={handlePayNow}>
                  {paying ? 'Checking…' : 'Pay now'}
                </button>
              {/if}
              {#if payMessage}
                <p class="pay-message">{payMessage}</p>
              {/if}
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
                    <button type="button" class="btn-view" on:click={() => openInvoiceDetail(inv.invoiceId)}>View</button>
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

    {#if showInvoiceModal}
      <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Invoice detail" on:click={closeInvoiceModal} on:keydown={(e) => e.key === 'Escape' && closeInvoiceModal()}>
        <div class="modal-content" on:click|stopPropagation>
          <div class="modal-header">
            <h2>Invoice detail</h2>
            <button type="button" class="modal-close" on:click={closeInvoiceModal} aria-label="Close">&times;</button>
          </div>
          {#if invoiceDetailLoading}
            <p>Loading…</p>
          {:else if selectedInvoice}
            <div class="invoice-detail">
              <div class="detail-row"><span class="label">Invoice</span><span>{selectedInvoice.invoiceNumber}</span></div>
              <div class="detail-row"><span class="label">Amount</span><span>{formatCurrency(selectedInvoice.amount)}</span></div>
              <div class="detail-row"><span class="label">Status</span><span class="status">{selectedInvoice.status}</span></div>
              <div class="detail-row"><span class="label">Due date</span><span>{formatDate(selectedInvoice.dueDate)}</span></div>
              {#if selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0}
                <h3>Line items</h3>
                <ul class="line-items">
                  {#each selectedInvoice.lineItems as item}
                    <li>{item.description} — {item.quantity} × {formatCurrency(item.unitPrice)} = {formatCurrency(item.total)}</li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}
        </div>
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
  .pay-desc {
    color: var(--brand-text-secondary, #6b7280);
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  .btn-pay {
    background: var(--brand-primary, #3b82f6);
    color: white;
    border: none;
    padding: 0.6rem 1.25rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-pay:hover:not(:disabled) {
    background: var(--brand-accent, #10b981);
  }
  .btn-pay:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .pay-message {
    margin-top: 1rem;
    font-size: 0.875rem;
    color: var(--brand-text-secondary, #6b7280);
  }
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
  .link-settings {
    color: var(--brand-primary, #3b82f6);
    text-decoration: none;
    font-weight: 500;
  }
  .link-settings:hover {
    text-decoration: underline;
  }
  .btn-view {
    background: transparent;
    color: var(--brand-primary, #3b82f6);
    border: 1px solid var(--brand-primary, #3b82f6);
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
    margin-left: auto;
  }
  .btn-view:hover {
    background: var(--brand-primary, #3b82f6);
    color: white;
  }
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .modal-content {
    background: var(--brand-background, #fff);
    border-radius: 12px;
    padding: 1.5rem;
    max-width: 480px;
    width: 90%;
    max-height: 90vh;
    overflow: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  .modal-header h2 {
    font-size: 1.25rem;
    color: var(--brand-text, #111827);
    margin: 0;
  }
  .modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--brand-text-secondary, #6b7280);
    line-height: 1;
  }
  .modal-close:hover {
    color: var(--brand-text, #111827);
  }
  .invoice-detail .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f3f4f6;
  }
  .invoice-detail .label {
    font-weight: 500;
    color: var(--brand-text-secondary, #6b7280);
  }
  .invoice-detail .status {
    text-transform: capitalize;
  }
  .invoice-detail h3 {
    font-size: 1rem;
    margin: 1rem 0 0.5rem;
    color: var(--brand-text, #111827);
  }
  .line-items {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 0.9rem;
    color: var(--brand-text-secondary, #6b7280);
  }
  .line-items li {
    padding: 0.25rem 0;
  }
</style>
