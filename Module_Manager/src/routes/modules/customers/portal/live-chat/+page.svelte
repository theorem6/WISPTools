<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { customerAuthService } from '$lib/services/customerAuthService';
  import { portalBranding } from '$lib/stores/portalBranding';

  let loading = true;
  let featureEnabled = false;
  let brandName = 'Support';
  let supportEmail = '';
  let supportPhone = '';
  let supportHours = 'Mon-Fri 8am-5pm';

  $: featureEnabled = !!$portalBranding?.features?.enableLiveChat;
  $: brandName = $portalBranding?.company?.displayName || $portalBranding?.company?.name || brandName;
  $: supportEmail = $portalBranding?.company?.supportEmail || 'support@example.com';
  $: supportPhone = $portalBranding?.company?.supportPhone || '';
  $: supportHours = $portalBranding?.company?.supportHours || supportHours;

  onMount(async () => {
    const customer = await customerAuthService.getCurrentCustomer();
    if (!customer) {
      goto('/modules/customers/portal/login');
      return;
    }
    loading = false;
  });
</script>

{#if loading}
  <div class="loading">Preparing live chat...</div>
{:else if !featureEnabled}
  <div class="feature-disabled">
    <h1>Live Chat Unavailable</h1>
    <p>This tenant currently handles conversations via email or phone.</p>
    <p class="contact">
      Email: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
      {#if supportPhone}
        <br />
        Phone: <a href={`tel:${supportPhone}`}>{supportPhone}</a>
      {/if}
    </p>
  </div>
{:else}
  <div class="chat-page">
    <h1>Live Chat with {brandName}</h1>
    <p class="subtitle">Chat is monitored {supportHours}. Start a conversation and we’ll respond as soon as a specialist is available.</p>
    
    <div class="chat-wrapper">
      <div class="chat-placeholder">
        <p>Live chat integration placeholder</p>
        <p class="hint">Embed your preferred chat widget here (Intercom, Zendesk, Drift, etc.).</p>
      </div>
      <div class="fallback-card">
        <h2>Need immediate help?</h2>
        <p>If chat is offline, use one of the options below.</p>
        <a class="btn-link" href={`mailto:${supportEmail}`}>Email {supportEmail}</a>
        {#if supportPhone}
          <a class="btn-link" href={`tel:${supportPhone}`}>Call {supportPhone}</a>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .chat-page {
    max-width: 1000px;
    margin: 0 auto;
  }

  h1 {
    font-size: 2rem;
    color: var(--brand-text, #111827);
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: var(--brand-text-secondary, #6b7280);
    margin-bottom: 2rem;
  }

  .chat-wrapper {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 1.5rem;
  }

  .chat-placeholder {
    background: white;
    border: 2px dashed #cbd5f5;
    border-radius: 16px;
    min-height: 360px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #6b7280;
    text-align: center;
    padding: 1rem;
  }

  .chat-placeholder .hint {
    font-size: 0.9rem;
  }

  .fallback-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .btn-link {
    display: inline-block;
    padding: 0.6rem 1rem;
    border-radius: 999px;
    background: var(--brand-primary, #3b82f6);
    color: white;
    text-align: center;
    text-decoration: none;
    font-weight: 600;
  }

  .btn-link:hover {
    opacity: 0.9;
  }

  .loading, .feature-disabled {
    max-width: 700px;
    margin: 0 auto;
    text-align: center;
    padding: 3rem 2rem;
    color: var(--brand-text-secondary, #6b7280);
  }

  .feature-disabled a {
    color: var(--brand-primary, #3b82f6);
    text-decoration: none;
    font-weight: 600;
  }

  @media (max-width: 900px) {
    .chat-wrapper {
      grid-template-columns: 1fr;
    }
  }
</style>