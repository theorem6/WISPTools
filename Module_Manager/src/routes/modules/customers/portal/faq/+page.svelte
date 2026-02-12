<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { customerAuthService } from '$lib/services/customerAuthService';
  import { portalBranding } from '$lib/stores/portalBranding';
  import { getApiUrl } from '$lib/config/api';

  type FAQItem = { _id?: string; question: string; answer: string; category?: string };
  let faqItems: FAQItem[] = [];
  let loading = true;
  let featureEnabled = true;
  let brandName = 'Our team';
  let supportEmail = '';
  let supportPhone = '';

  const defaultFaqs = [
    {
      question: 'How can I view my upcoming invoice?',
      answer: 'Invoices are emailed to the primary contact on file and can also be requested from our billing team.'
    },
    {
      question: 'My connection feels slow. What should I check first?',
      answer: 'Reboot your router and wireless equipment, then confirm that Ethernet cables are firmly connected. If the issue persists, open a support ticket so we can run diagnostics.'
    },
    {
      question: 'How do I update the contact information on my account?',
      answer: 'Please submit a support ticket with the new contact details, or call our support line so we can verify the request.'
    },
    {
      question: 'What should I include when opening a ticket?',
      answer: 'Give a short summary (“No internet”, “Slow speeds”, “Billing question”), note when it started, and attach any photos or screenshots that may help. The more detail you share, the faster we can assist.'
    }
  ];
  
  $: featureEnabled = ($portalBranding?.features?.enableFAQ !== false);
  $: brandName = $portalBranding?.company?.displayName || $portalBranding?.company?.name || brandName;
  $: supportEmail = $portalBranding?.company?.supportEmail || 'support@example.com';
  $: supportPhone = $portalBranding?.company?.supportPhone || '';
  let faqSearch = '';
  $: displayFaqs = (() => {
    const list: FAQItem[] = faqItems.length > 0 ? faqItems : defaultFaqs;
    if (!faqSearch.trim()) return list;
    const q = faqSearch.trim().toLowerCase();
    return list.filter(
      (faq) =>
        (faq.question || '').toLowerCase().includes(q) ||
        (faq.answer || '').toLowerCase().includes(q) ||
        ((faq as FAQItem).category || '').toLowerCase().includes(q)
    );
  })();

  onMount(async () => {
    const customer = await customerAuthService.getCurrentCustomer();
    if (!customer) {
      goto('/modules/customers/portal/login');
      return;
    }
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/portal-content/${customer.tenantId}/faq/published`);
      if (res.ok) {
        const data = await res.json();
        faqItems = Array.isArray(data) ? data : [];
      }
    } catch (_) {
      // keep defaultFaqs
    }
    loading = false;
  });
</script>

{#if loading}
  <div class="loading">Loading FAQ...</div>
{:else if !featureEnabled}
  <div class="feature-disabled">
    <p class="back-link"><a href="/modules/customers/portal/dashboard">← Back to Dashboard</a></p>
    <h1>FAQ Unavailable</h1>
    <p>This tenant has disabled the FAQ &amp; Help Center module.</p>
    <p class="contact">
      Reach out to <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
      {#if supportPhone}
        <span> • </span>
        <a href={`tel:${supportPhone}`}>{supportPhone}</a>
      {/if}
      for assistance.
    </p>
  </div>
{:else}
  <div class="faq-page">
    <h1>{brandName} Help Center</h1>
    <p class="subtitle">Quick answers to the most common questions from subscribers.</p>
    <input
      type="search"
      class="faq-search"
      placeholder="Search FAQ…"
      bind:value={faqSearch}
      aria-label="Search FAQ"
    />
    <div class="faq-list">
      {#each displayFaqs as faq}
        <details class="faq-item">
          <summary>{faq.question}</summary>
          <p>{faq.answer}</p>
        </details>
      {/each}
    </div>
    
    <div class="contact-card">
      <h2>Still need help?</h2>
      <p>Open a support ticket from the dashboard or contact our team directly.</p>
      <div class="contact-links">
        <a class="btn-link" href={`mailto:${supportEmail}`}>Email Support</a>
        {#if supportPhone}
          <a class="btn-link" href={`tel:${supportPhone}`}>Call {supportPhone}</a>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .faq-page {
    max-width: 900px;
    margin: 0 auto;
  }

  h1 {
    font-size: 2rem;
    color: var(--brand-text, #111827);
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: var(--brand-text-secondary, #6b7280);
    margin-bottom: 1rem;
  }

  .faq-search {
    width: 100%;
    max-width: 400px;
    padding: 0.6rem 1rem;
    margin-bottom: 1.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 1rem;
  }

  .faq-search:focus {
    outline: none;
    border-color: var(--brand-primary, #3b82f6);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .faq-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .faq-item {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 1rem 1.25rem;
  }

  summary {
    font-weight: 600;
    cursor: pointer;
    color: var(--brand-text, #111827);
  }

  summary::-webkit-details-marker {
    color: var(--brand-primary, #3b82f6);
  }

  .faq-item p {
    margin-top: 0.75rem;
    color: var(--brand-text-secondary, #6b7280);
    line-height: 1.5;
  }

  .contact-card {
    margin-top: 2.5rem;
    padding: 1.75rem;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(16, 185, 129, 0.08));
    border: 1px solid rgba(59, 130, 246, 0.4);
  }

  .contact-card h2 {
    margin-top: 0;
    color: var(--brand-text, #111827);
  }

  .contact-card p {
    color: var(--brand-text-secondary, #6b7280);
  }

  .contact-links {
    margin-top: 1rem;
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .btn-link {
    padding: 0.6rem 1.5rem;
    border-radius: 999px;
    background: white;
    border: 1px solid var(--brand-primary, #3b82f6);
    color: var(--brand-primary, #3b82f6);
    text-decoration: none;
    font-weight: 600;
  }

  .btn-link:hover {
    background: var(--brand-primary, #3b82f6);
    color: white;
  }

  .loading, .feature-disabled {
    max-width: 700px;
    margin: 0 auto;
    text-align: center;
    padding: 3rem 2rem;
    color: var(--brand-text-secondary, #6b7280);
  }

  .feature-disabled {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  }

  .feature-disabled h1 {
    margin-bottom: 0.75rem;
    color: var(--brand-text, #111827);
  }

  .feature-disabled .contact {
    margin-top: 1rem;
  }

  .feature-disabled .back-link {
    margin-bottom: 1rem;
  }
  .feature-disabled .back-link a {
    color: var(--brand-primary, #3b82f6);
    text-decoration: none;
  }
  .feature-disabled .back-link a:hover {
    text-decoration: underline;
  }
  .feature-disabled a {
    color: var(--brand-primary, #3b82f6);
    text-decoration: none;
    font-weight: 600;
  }
</style>