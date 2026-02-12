<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { customerPortalService } from '$lib/services/customerPortalService';
  import { customerAuthService } from '$lib/services/customerAuthService';
  import { portalBranding } from '$lib/stores/portalBranding';

  let loading = true;
  let saving = false;
  let error = '';
  let success = '';
  let paypalEmail = '';
  let invoiceDelivery: 'email' | 'portal' | 'both' = 'email';
  let invoiceFormat: { companyName: string; dueDays: number; currency: string } = {
    companyName: '',
    dueDays: 14,
    currency: 'USD'
  };
  let paypalEnabled = false;
  let featureEnabled = true;

  $: featureEnabled = ($portalBranding?.features?.enableBilling !== false);

  onMount(async () => {
    try {
      const customer = await customerAuthService.getCurrentCustomer();
      if (!customer) {
        goto('/modules/customers/portal/login');
        return;
      }
      if (!featureEnabled) {
        goto('/modules/customers/portal/billing');
        return;
      }
      const settings = await customerPortalService.getBillingSettings(customer.tenantId);
      paypalEmail = settings.paypalEmail || '';
      invoiceDelivery = (settings.invoicePreferences?.delivery as 'email' | 'portal' | 'both') || 'email';
      invoiceFormat = settings.invoiceFormat || invoiceFormat;
      paypalEnabled = !!($portalBranding?.billingPortal?.paymentGateways?.paypal?.enabled);
    } catch (err: any) {
      error = err.message || 'Failed to load settings';
    } finally {
      loading = false;
    }
  });

  async function handleSave() {
    saving = true;
    error = '';
    success = '';
    try {
      const customer = await customerAuthService.getCurrentCustomer();
      if (!customer) return;
      await customerPortalService.updateBillingSettings(
        {
          paypalEmail: paypalEmail.trim() || undefined,
          invoicePreferences: { delivery: invoiceDelivery }
        },
        customer.tenantId
      );
      success = 'Settings saved.';
    } catch (err: any) {
      error = err.message || 'Failed to save';
    } finally {
      saving = false;
    }
  }
</script>

{#if loading}
  <div class="loading">Loading billing settings...</div>
{:else if !featureEnabled}
  <div class="feature-disabled">
    <p>Billing is not available. <a href="/modules/customers/portal/billing">Back to Billing</a></p>
  </div>
{:else}
  <div class="billing-settings-page">
    <h1>Billing settings</h1>
    <p class="subtitle">Payment method and invoice preferences</p>

    {#if error}
      <div class="message error">{error}</div>
    {/if}
    {#if success}
      <div class="message success">{success}</div>
    {/if}

    <form on:submit|preventDefault={handleSave} class="settings-form">
      {#if paypalEnabled}
        <section class="settings-section">
          <h2>PayPal</h2>
          <p class="hint">Your PayPal email for paying invoices (when your provider accepts PayPal).</p>
          <label for="paypal-email">PayPal email</label>
          <input
            id="paypal-email"
            type="email"
            bind:value={paypalEmail}
            placeholder="you@example.com"
            class="input"
          />
        </section>
      {/if}

      <section class="settings-section">
        <h2>Invoice delivery</h2>
        <p class="hint">How you want to receive invoices.</p>
        <label>
          <input type="radio" bind:group={invoiceDelivery} value="email" />
          Email only
        </label>
        <label>
          <input type="radio" bind:group={invoiceDelivery} value="portal" />
          Portal only (view in Billing page)
        </label>
        <label>
          <input type="radio" bind:group={invoiceDelivery} value="both" />
          Both email and portal
        </label>
      </section>

      <section class="settings-section read-only">
        <h2>Invoice format</h2>
        <p class="hint">Set by your provider (read-only).</p>
        <div class="info-rows">
          <div class="info-row">
            <span class="label">Company name</span>
            <span class="value">{invoiceFormat.companyName || '—'}</span>
          </div>
          <div class="info-row">
            <span class="label">Payment due (days)</span>
            <span class="value">{invoiceFormat.dueDays}</span>
          </div>
          <div class="info-row">
            <span class="label">Currency</span>
            <span class="value">{invoiceFormat.currency}</span>
          </div>
        </div>
      </section>

      <div class="actions">
        <button type="submit" class="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        <a href="/modules/customers/portal/billing" class="btn-secondary">Back to Billing</a>
      </div>
    </form>
  </div>
{/if}

<style>
  .billing-settings-page {
    max-width: 560px;
    margin: 0 auto;
  }
  .billing-settings-page h1 {
    font-size: 1.75rem;
    color: var(--brand-text, #111827);
    margin-bottom: 0.25rem;
  }
  .subtitle {
    color: var(--brand-text-secondary, #6b7280);
    margin-bottom: 1.5rem;
  }
  .message {
    padding: 0.75rem 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }
  .message.error {
    background: #fef2f2;
    color: #dc2626;
  }
  .message.success {
    background: #ecfdf5;
    color: #059669;
  }
  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .settings-section {
    background: var(--brand-background, #fff);
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 1.25rem;
  }
  .settings-section h2 {
    font-size: 1.125rem;
    color: var(--brand-text, #111827);
    margin-bottom: 0.5rem;
  }
  .hint {
    font-size: 0.875rem;
    color: var(--brand-text-secondary, #6b7280);
    margin-bottom: 1rem;
  }
  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    cursor: pointer;
  }
  .input {
    width: 100%;
    max-width: 320px;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 1rem;
  }
  .info-rows {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 0.35rem 0;
  }
  .info-row .label {
    color: var(--brand-text-secondary, #6b7280);
    font-weight: 500;
  }
  .info-row .value {
    color: var(--brand-text, #111827);
  }
  .read-only .info-rows {
    margin-top: 0.5rem;
  }
  .actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .btn-primary {
    background: var(--brand-primary, #3b82f6);
    color: white;
    border: none;
    padding: 0.6rem 1.25rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--brand-accent, #10b981);
  }
  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .btn-secondary {
    color: var(--brand-primary, #3b82f6);
    text-decoration: none;
    padding: 0.6rem 1rem;
    font-weight: 500;
  }
  .btn-secondary:hover {
    text-decoration: underline;
  }
  .loading,
  .feature-disabled {
    text-align: center;
    padding: 2rem;
    color: var(--brand-text-secondary, #6b7280);
  }
  .feature-disabled a {
    color: var(--brand-primary, #3b82f6);
  }
</style>
