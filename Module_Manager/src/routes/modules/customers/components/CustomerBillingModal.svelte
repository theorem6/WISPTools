<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { customerBillingService, type CustomerBilling, type CustomerBillingServicePlan, type CustomerBillingCycle, type CustomerBillingSLA } from '$lib/services/customerBillingService';
  import type { Customer } from '$lib/services/customerService';

  export let show = false;
  export let customer: Customer | null = null;

  const dispatch = createEventDispatcher();

  let billing: CustomerBilling | null = null;
  let loading = false;
  let saving = false;
  let error = '';

  let form = {
    planName: '',
    monthlyFee: 0,
    setupFee: 0,
    billingCycleType: 'monthly' as 'monthly' | 'annual',
    dayOfMonth: 1,
    nextBillingDate: '' as string,
    slaResponseTimeHours: 24,
    slaUptimePercent: 99.9,
    slaNotes: ''
  };

  let showAddInvoice = false;
  let invoiceForm = { invoiceNumber: '', amount: 0, dueDate: '' };
  let showRecordPayment = false;
  let paymentForm = { amount: 0, method: 'other' as string, invoiceId: '' as string, transactionId: '' };

  $: if (show && customer?.customerId) {
    loadBilling();
  }

  async function loadBilling() {
    if (!customer?.customerId) return;
    loading = true;
    error = '';
    try {
      billing = await customerBillingService.getByCustomer(customer.customerId);
      if (billing) {
        form.planName = billing.servicePlan?.planName ?? '';
        form.monthlyFee = billing.servicePlan?.monthlyFee ?? 0;
        form.setupFee = billing.servicePlan?.setupFee ?? 0;
        form.billingCycleType = (billing.billingCycle?.type as 'monthly' | 'annual') ?? 'monthly';
        form.dayOfMonth = billing.billingCycle?.dayOfMonth ?? 1;
        form.nextBillingDate = billing.billingCycle?.nextBillingDate
          ? new Date(billing.billingCycle.nextBillingDate).toISOString().slice(0, 10)
          : '';
        form.slaResponseTimeHours = billing.sla?.responseTimeHours ?? 24;
        form.slaUptimePercent = billing.sla?.uptimePercent ?? 99.9;
        form.slaNotes = billing.sla?.notes ?? '';
      } else {
        form.planName = customer.servicePlan?.planName ?? '';
        form.monthlyFee = customer.servicePlan?.monthlyFee ?? 0;
        form.setupFee = 0;
        form.billingCycleType = 'monthly';
        form.dayOfMonth = 1;
        form.nextBillingDate = '';
        form.slaResponseTimeHours = 24;
        form.slaUptimePercent = 99.9;
        form.slaNotes = '';
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load billing';
    } finally {
      loading = false;
    }
  }

  async function handleSave() {
    if (!customer?.customerId) return;
    saving = true;
    error = '';
    try {
      const servicePlan: CustomerBillingServicePlan = {
        planName: form.planName || undefined,
        monthlyFee: form.monthlyFee || undefined,
        setupFee: form.setupFee || undefined
      };
      const billingCycle: CustomerBillingCycle = {
        type: form.billingCycleType,
        dayOfMonth: form.dayOfMonth,
        nextBillingDate: form.nextBillingDate ? new Date(form.nextBillingDate).toISOString() : undefined
      };
      const sla: CustomerBillingSLA = {
        responseTimeHours: form.slaResponseTimeHours,
        uptimePercent: form.slaUptimePercent,
        notes: form.slaNotes || undefined
      };
      if (billing) {
        await customerBillingService.update(customer.customerId, { servicePlan, billingCycle, sla });
      } else {
        await customerBillingService.createOrUpdate(customer.customerId, { servicePlan, billingCycle, sla });
      }
      dispatch('saved');
      dispatch('close');
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to save billing';
    } finally {
      saving = false;
    }
  }

  function handleClose() {
    dispatch('close');
  }

  function suggestInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const count = (billing?.invoices?.length ?? 0) + 1;
    return `INV-${year}-${String(count).padStart(3, '0')}`;
  }

  async function handleAddInvoice() {
    if (!customer?.customerId || !invoiceForm.invoiceNumber || invoiceForm.amount <= 0 || !invoiceForm.dueDate) return;
    saving = true;
    error = '';
    try {
      billing = await customerBillingService.addInvoice(customer.customerId, {
        invoiceNumber: invoiceForm.invoiceNumber,
        amount: invoiceForm.amount,
        dueDate: invoiceForm.dueDate
      });
      invoiceForm = { invoiceNumber: suggestInvoiceNumber(), amount: 0, dueDate: '' };
      showAddInvoice = false;
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to add invoice';
    } finally {
      saving = false;
    }
  }

  async function handleRecordPayment() {
    if (!customer?.customerId || paymentForm.amount <= 0) return;
    saving = true;
    error = '';
    try {
      billing = await customerBillingService.recordPayment(customer.customerId, {
        amount: paymentForm.amount,
        method: paymentForm.method,
        invoiceId: paymentForm.invoiceId || undefined,
        transactionId: paymentForm.transactionId || undefined
      });
      paymentForm = { amount: 0, method: 'other', invoiceId: '', transactionId: '' };
      showRecordPayment = false;
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to record payment';
    } finally {
      saving = false;
    }
  }

  function formatCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  }

  function formatDate(s: string | Date | undefined): string {
    if (!s) return '—';
    try {
      return new Date(s).toLocaleDateString();
    } catch {
      return '—';
    }
  }
</script>

{#if show}
  <div class="modal-overlay" role="dialog" aria-modal="true" on:click={handleClose} on:keydown={(e) => e.key === 'Escape' && handleClose()}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Billing – {customer?.fullName || customer?.customerId}</h2>
        <button type="button" class="close-btn" on:click={handleClose} aria-label="Close">×</button>
      </div>
      <div class="modal-body">
        {#if loading}
          <p class="loading-msg">Loading billing…</p>
        {:else if error}
          <p class="error-msg">{error}</p>
        {:else}
          <div class="form-section">
            <h3>Service plan</h3>
            <div class="form-row">
              <label for="billing-plan">Plan name</label>
              <input id="billing-plan" type="text" bind:value={form.planName} placeholder="e.g. Residential 50" />
            </div>
            <div class="form-row">
              <label for="billing-monthly">Monthly fee ($)</label>
              <input id="billing-monthly" type="number" step="0.01" min="0" bind:value={form.monthlyFee} />
            </div>
            <div class="form-row">
              <label for="billing-setup">Setup fee ($)</label>
              <input id="billing-setup" type="number" step="0.01" min="0" bind:value={form.setupFee} />
            </div>
          </div>
          <div class="form-section">
            <h3>Billing cycle</h3>
            <div class="form-row">
              <label for="billing-type">Cycle</label>
              <select id="billing-type" bind:value={form.billingCycleType}>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div class="form-row">
              <label for="billing-day">Day of month (1–31)</label>
              <input id="billing-day" type="number" min="1" max="31" bind:value={form.dayOfMonth} />
            </div>
            <div class="form-row">
              <label for="next-billing">Next billing date</label>
              <input id="next-billing" type="date" bind:value={form.nextBillingDate} />
            </div>
          </div>
          <div class="form-section">
            <h3>SLA</h3>
            <div class="form-row">
              <label for="sla-response">Response time (hours)</label>
              <input id="sla-response" type="number" min="1" max="168" bind:value={form.slaResponseTimeHours} placeholder="e.g. 24" />
            </div>
            <div class="form-row">
              <label for="sla-uptime">Uptime guarantee (%)</label>
              <input id="sla-uptime" type="number" step="0.1" min="0" max="100" bind:value={form.slaUptimePercent} placeholder="e.g. 99.9" />
            </div>
            <div class="form-row">
              <label for="sla-notes">SLA notes</label>
              <input id="sla-notes" type="text" bind:value={form.slaNotes} placeholder="Optional notes" />
            </div>
          </div>
          {#if billing?.balance}
            <div class="balance-section">
              <h3>Balance</h3>
              <p>Current: {formatCurrency(billing.balance.current ?? 0)} · Overdue: {formatCurrency(billing.balance.overdue ?? 0)}</p>
            </div>
          {/if}

          <div class="form-section">
            <h3>Invoices</h3>
            {#if billing?.invoices?.length}
              <ul class="invoice-list">
                {#each billing.invoices as inv}
                  <li class="invoice-item">
                    <span class="inv-num">{inv.invoiceNumber}</span>
                    <span class="inv-amount">{formatCurrency(inv.amount)}</span>
                    <span class="inv-status">{inv.status}</span>
                    <span class="inv-due">Due {formatDate(inv.dueDate)}</span>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="muted">No invoices yet.</p>
            {/if}
            {#if showAddInvoice}
              <div class="sub-form">
                <div class="form-row">
                  <label>Invoice number</label>
                  <input type="text" bind:value={invoiceForm.invoiceNumber} placeholder="e.g. INV-2025-001" />
                </div>
                <div class="form-row">
                  <label>Amount ($)</label>
                  <input type="number" step="0.01" min="0" bind:value={invoiceForm.amount} />
                </div>
                <div class="form-row">
                  <label>Due date</label>
                  <input type="date" bind:value={invoiceForm.dueDate} />
                </div>
                <div class="form-actions-inline">
                  <button type="button" class="btn-primary" on:click={handleAddInvoice} disabled={saving || !invoiceForm.invoiceNumber || invoiceForm.amount <= 0 || !invoiceForm.dueDate}>Add invoice</button>
                  <button type="button" class="btn-secondary" on:click={() => (showAddInvoice = false)}>Cancel</button>
                </div>
              </div>
            {:else}
              <button type="button" class="btn-secondary btn-sm" on:click={() => { showAddInvoice = true; invoiceForm.invoiceNumber = suggestInvoiceNumber(); }}>+ Add invoice</button>
            {/if}
          </div>

          <div class="form-section">
            <h3>Payment history</h3>
            {#if billing?.paymentHistory?.length}
              <ul class="payment-list">
                {#each billing.paymentHistory.slice().reverse() as pay}
                  <li class="payment-item">
                    <span class="pay-amount">{formatCurrency(pay.amount)}</span>
                    <span class="pay-method">{pay.method || '—'}</span>
                    <span class="pay-date">{formatDate(pay.paidAt)}</span>
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="muted">No payments recorded.</p>
            {/if}
            {#if showRecordPayment}
              <div class="sub-form">
                <div class="form-row">
                  <label>Amount ($)</label>
                  <input type="number" step="0.01" min="0.01" bind:value={paymentForm.amount} />
                </div>
                <div class="form-row">
                  <label>Method</label>
                  <select bind:value={paymentForm.method}>
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="credit_card">Credit card</option>
                    <option value="ach">ACH</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div class="form-row">
                  <label>Apply to invoice (optional)</label>
                  <select bind:value={paymentForm.invoiceId}>
                    <option value="">—</option>
                    {#if billing?.invoices}
                      {#each billing.invoices.filter((i) => i.status === 'pending' || i.status === 'overdue') as inv}
                        <option value={inv.invoiceId}>{inv.invoiceNumber} – {formatCurrency(inv.amount)}</option>
                      {/each}
                    {/if}
                  </select>
                </div>
                <div class="form-row">
                  <label>Transaction ID (optional)</label>
                  <input type="text" bind:value={paymentForm.transactionId} placeholder="Reference" />
                </div>
                <div class="form-actions-inline">
                  <button type="button" class="btn-primary" on:click={handleRecordPayment} disabled={saving || paymentForm.amount <= 0}>Record payment</button>
                  <button type="button" class="btn-secondary" on:click={() => (showRecordPayment = false)}>Cancel</button>
                </div>
              </div>
            {:else}
              <button type="button" class="btn-secondary btn-sm" on:click={() => (showRecordPayment = true)}>+ Record payment</button>
            {/if}
          </div>
        {/if}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" on:click={handleClose}>Cancel</button>
        {#if !loading && !error}
          <button type="button" class="btn-primary" on:click={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .modal {
    background: var(--bg-primary, #fff);
    border-radius: 12px;
    max-width: 520px;
    width: 100%;
    max-height: 90vh;
    overflow: auto;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  }
  .invoice-list, .payment-list {
    list-style: none;
    margin: 0 0 0.75rem 0;
    padding: 0;
  }
  .invoice-item, .payment-item {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    padding: 0.35rem 0;
    border-bottom: 1px solid var(--border-color, #eee);
    font-size: 0.9rem;
  }
  .invoice-item:last-child, .payment-item:last-child {
    border-bottom: none;
  }
  .inv-num, .pay-amount { font-weight: 600; }
  .inv-status { text-transform: capitalize; }
  .muted { color: var(--text-secondary, #6b7280); font-size: 0.9rem; margin: 0 0 0.5rem 0; }
  .sub-form { background: var(--bg-secondary, #f9fafb); border-radius: 8px; padding: 0.75rem; margin-top: 0.5rem; }
  .form-actions-inline { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
  .btn-sm { font-size: 0.875rem; padding: 0.35rem 0.75rem; }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }
  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0 0.25rem;
    line-height: 1;
    color: var(--text-secondary, #6b7280);
  }
  .close-btn:hover {
    color: var(--text-primary, #111);
  }
  .modal-body {
    padding: 1.25rem;
  }
  .loading-msg, .error-msg {
    margin: 0;
  }
  .error-msg {
    color: var(--error-color, #dc2626);
  }
  .form-section {
    margin-bottom: 1.25rem;
  }
  .form-section h3 {
    margin: 0 0 0.75rem 0;
    font-size: 0.95rem;
    color: var(--text-secondary, #6b7280);
  }
  .form-row {
    margin-bottom: 0.75rem;
  }
  .form-row label {
    display: block;
    font-size: 0.875rem;
    margin-bottom: 0.25rem;
    color: var(--text-primary, #111);
  }
  .form-row input,
  .form-row select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 6px;
    font-size: 1rem;
  }
  .balance-section {
    padding-top: 1rem;
    border-top: 1px solid var(--border-color, #e5e7eb);
  }
  .balance-section h3 {
    margin: 0 0 0.5rem 0;
    font-size: 0.95rem;
    color: var(--text-secondary, #6b7280);
  }
  .balance-section p {
    margin: 0;
    font-size: 0.95rem;
  }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--border-color, #e5e7eb);
  }
  .btn-primary {
    background: var(--brand-primary, #3b82f6);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn-secondary {
    background: var(--bg-secondary, #f3f4f6);
    color: var(--text-primary, #111);
    border: 1px solid var(--border-color, #e5e7eb);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
  }
</style>
