<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { customerBillingService, type CustomerBilling, type CustomerBillingServicePlan, type CustomerBillingCycle } from '$lib/services/customerBillingService';
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
    dayOfMonth: 1
  };

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
      } else {
        form.planName = customer.servicePlan?.planName ?? '';
        form.monthlyFee = customer.servicePlan?.monthlyFee ?? 0;
        form.setupFee = 0;
        form.billingCycleType = 'monthly';
        form.dayOfMonth = 1;
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
        dayOfMonth: form.dayOfMonth
      };
      if (billing) {
        await customerBillingService.update(customer.customerId, { servicePlan, billingCycle });
      } else {
        await customerBillingService.createOrUpdate(customer.customerId, { servicePlan, billingCycle });
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
          </div>
          {#if billing?.balance}
            <div class="balance-section">
              <h3>Balance</h3>
              <p>Current: ${(billing.balance.current ?? 0).toFixed(2)} · Overdue: ${(billing.balance.overdue ?? 0).toFixed(2)}</p>
            </div>
          {/if}
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
    max-width: 480px;
    width: 100%;
    max-height: 90vh;
    overflow: auto;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  }
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
