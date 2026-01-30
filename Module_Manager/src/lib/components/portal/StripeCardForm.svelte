<script lang="ts">
  /**
   * Stripe Card form for portal Pay Now. Mounts Stripe Card Element and confirms PaymentIntent.
   */
  import { onMount, onDestroy, tick } from 'svelte';
  import { loadStripe } from '@stripe/stripe-js';
  import { createEventDispatcher } from 'svelte';

  export let clientSecret: string;
  export let publishableKey: string;
  export let amountLabel: string = '';
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher<{ success: void; error: { message: string } }>();

  let cardMountEl: HTMLDivElement;
  let stripe: Awaited<ReturnType<typeof loadStripe>> = null;
  let cardElement: unknown = null;
  let submitting = false;
  let mountError = '';

  onMount(async () => {
    await tick();
    if (!publishableKey || !clientSecret || !cardMountEl) return;
    try {
      const stripeInstance = await loadStripe(publishableKey);
      if (!stripeInstance) {
        mountError = 'Could not load payment form.';
        return;
      }
      stripe = stripeInstance;
      const elements = stripe.elements({ clientSecret });
      const card = elements.create('card', {
        style: {
          base: { fontSize: '16px', color: '#32325d', '::placeholder': { color: '#aab7c4' } },
          invalid: { color: '#dc2626' }
        }
      });
      card.mount(cardMountEl);
      cardElement = card;
    } catch (e: any) {
      mountError = e?.message || 'Failed to load payment form.';
    }
  });

  onDestroy(() => {
    if (cardElement && cardMountEl?.firstChild && typeof (cardElement as { unmount?: () => void }).unmount === 'function') {
      (cardElement as { unmount: () => void }).unmount();
    }
  });

  async function handleSubmit() {
    if (!stripe || !cardElement || !clientSecret || submitting) return;
    submitting = true;
    try {
      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement as any }
      });
      if (error) {
        dispatch('error', { message: error.message || 'Payment failed.' });
        return;
      }
      dispatch('success');
    } catch (e: any) {
      dispatch('error', { message: e?.message || 'Payment failed.' });
    } finally {
      submitting = false;
    }
  }
</script>

<div class="stripe-card-form">
  {#if mountError}
    <p class="form-error">{mountError}</p>
  {:else}
    <div class="card-mount" bind:this={cardMountEl}></div>
    <p class="card-hint">Enter your card details. Your payment is secure.</p>
    <button type="button" class="btn-submit" disabled={disabled || submitting} on:click={handleSubmit}>
      {submitting ? 'Processing…' : 'Pay ' + amountLabel}
    </button>
  {/if}
</div>

<style>
  .stripe-card-form {
    margin-top: 1rem;
  }
  .card-mount {
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: var(--brand-background, #fff);
    margin-bottom: 0.5rem;
  }
  .card-hint {
    font-size: 0.875rem;
    color: var(--brand-text-secondary, #6b7280);
    margin-bottom: 1rem;
  }
  .btn-submit {
    background: var(--brand-primary, #3b82f6);
    color: white;
    border: none;
    padding: 0.6rem 1.25rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-submit:hover:not(:disabled) {
    background: var(--brand-accent, #10b981);
  }
  .btn-submit:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .form-error {
    color: #dc2626;
    font-size: 0.875rem;
  }
</style>
