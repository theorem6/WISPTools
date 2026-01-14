<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { customerAuthService } from '$lib/services/customerAuthService';
  import { portalBranding } from '$lib/stores/portalBranding';

  let loading = true;
  let featureEnabled = false;
  let brandName = 'Our team';

  const guides = [
    {
      title: 'Optimize Wi-Fi coverage at home',
      summary: 'Tips for positioning your router, reducing interference, and getting the best speeds from your plan.',
      readTime: '4 min read'
    },
    {
      title: 'Troubleshooting intermittent connectivity',
      summary: 'Step-by-step flow to isolate modem, router, or wiring issues before opening a support ticket.',
      readTime: '6 min read'
    },
    {
      title: 'Understanding your monthly statement',
      summary: 'Breakdown of plan charges, taxes, discounts, and how autopay or paperless billing works.',
      readTime: '3 min read'
    },
    {
      title: 'Preparing for a truck roll/visit',
      summary: 'What to expect when a field technician is dispatched and how to make the most of the appointment.',
      readTime: '5 min read'
    }
  ];

  $: featureEnabled = !!$portalBranding?.features?.enableKnowledgeBase;
  $: brandName = $portalBranding?.company?.displayName || $portalBranding?.company?.name || brandName;
  $: supportEmail = $portalBranding?.company?.supportEmail || 'support@example.com';

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
  <div class="loading">Loading knowledge base...</div>
{:else if !featureEnabled}
  <div class="feature-disabled">
    <h1>Knowledge Base Unavailable</h1>
    <p>This tenant has not enabled the Knowledge Base module. For guidance, please contact <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p>
  </div>
{:else}
  <div class="knowledge-page">
    <header>
      <h1>{brandName} Knowledge Base</h1>
      <p class="subtitle">Self-service guides curated by our support engineers.</p>
    </header>
    
    <section class="guides-grid">
      {#each guides as guide}
        <article class="guide-card">
          <h2>{guide.title}</h2>
          <p>{guide.summary}</p>
          <span class="meta">{guide.readTime}</span>
        </article>
      {/each}
    </section>
  </div>
{/if}

<style>
  .knowledge-page {
    max-width: 1100px;
    margin: 0 auto;
  }

  header {
    text-align: center;
    margin-bottom: 2rem;
  }

  h1 {
    font-size: 2.25rem;
    margin-bottom: 0.5rem;
    color: var(--brand-text, #111827);
  }

  .subtitle {
    color: var(--brand-text-secondary, #6b7280);
  }

  .guides-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.5rem;
  }

  .guide-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  }

  .guide-card h2 {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
    color: var(--brand-text, #111827);
  }

  .guide-card p {
    color: var(--brand-text-secondary, #6b7280);
    margin-bottom: 1rem;
    line-height: 1.5;
  }

  .meta {
    font-size: 0.875rem;
    color: var(--brand-primary, #3b82f6);
    font-weight: 600;
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
</style>