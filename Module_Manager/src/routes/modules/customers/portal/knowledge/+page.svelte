<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { customerAuthService } from '$lib/services/customerAuthService';
  import { portalBranding } from '$lib/stores/portalBranding';
  import { getApiUrl } from '$lib/config/api';

  type KBArticle = { _id: string; title: string; content: string; category?: string; tags?: string[] };

  let loading = true;
  let featureEnabled = false;
  let brandName = 'Our team';
  let supportEmail = 'support@example.com';
  let articles: KBArticle[] = [];
  let kbSearch = '';
  let kbCategory = '';

  const fallbackGuides = [
    { title: 'Optimize Wi-Fi coverage at home', summary: 'Tips for positioning your router, reducing interference, and getting the best speeds from your plan.', readTime: '4 min read' },
    { title: 'Troubleshooting intermittent connectivity', summary: 'Step-by-step flow to isolate modem, router, or wiring issues before opening a support ticket.', readTime: '6 min read' },
    { title: 'Understanding your monthly statement', summary: 'Breakdown of plan charges, taxes, discounts, and how autopay or paperless billing works.', readTime: '3 min read' },
    { title: 'Preparing for a truck roll/visit', summary: 'What to expect when a field technician is dispatched and how to make the most of the appointment.', readTime: '5 min read' }
  ];

  $: featureEnabled = !!$portalBranding?.features?.enableKnowledgeBase;
  $: brandName = $portalBranding?.company?.displayName || $portalBranding?.company?.name || brandName;
  $: supportEmail = $portalBranding?.company?.supportEmail || 'support@example.com';
  $: categories = (() => {
    const list = articles.length > 0 ? articles : fallbackGuides.map((g) => ({ _id: '', title: g.title, content: g.summary, category: '' }));
    const cats = new Set<string>();
    list.forEach((a) => {
      const c = (a.category || '').trim();
      if (c) cats.add(c);
    });
    return Array.from(cats).sort();
  })();

  $: displayItems = (() => {
    const list = articles.length > 0 ? articles : fallbackGuides.map((g) => ({ _id: '', title: g.title, content: g.summary, category: '' }));
    let out = list;
    if (kbSearch.trim()) {
      const q = kbSearch.trim().toLowerCase();
      out = out.filter(
        (a) =>
          (a.title || '').toLowerCase().includes(q) ||
          (a.content || '').toLowerCase().includes(q) ||
          (a.category || '').toLowerCase().includes(q)
      );
    }
    if (kbCategory) {
      out = out.filter((a) => (a.category || '').trim() === kbCategory);
    }
    return out;
  })();

  onMount(async () => {
    const customer = await customerAuthService.getCurrentCustomer();
    if (!customer) {
      goto('/modules/customers/portal/login');
      return;
    }
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/portal-content/${customer.tenantId}/knowledge-base/published`);
      if (res.ok) {
        const data = await res.json();
        articles = Array.isArray(data) ? data : [];
      }
    } catch (_) {
      // keep fallback
    }
    loading = false;
  });
</script>

{#if loading}
  <div class="loading">Loading knowledge base...</div>
{:else if !featureEnabled}
  <div class="feature-disabled">
    <p class="back-link"><a href="/modules/customers/portal/dashboard">← Back to Dashboard</a></p>
    <h1>Knowledge Base Unavailable</h1>
    <p>This tenant has not enabled the Knowledge Base module. For guidance, please contact <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p>
  </div>
{:else}
  <div class="knowledge-page">
    <header>
      <h1>{brandName} Knowledge Base</h1>
      <p class="subtitle">Self-service guides curated by our support engineers.</p>
      <div class="kb-filters">
        <input
          type="search"
          class="kb-search"
          placeholder="Search articles…"
          bind:value={kbSearch}
          aria-label="Search knowledge base"
        />
        {#if categories.length > 0}
          <select class="kb-category" bind:value={kbCategory} aria-label="Filter by category">
            <option value="">All categories</option>
            {#each categories as cat}
              <option value={cat}>{cat}</option>
            {/each}
          </select>
        {/if}
      </div>
    </header>
    <section class="guides-grid">
      {#each displayItems as article}
        <article class="guide-card">
          {#if article._id}
            <a href="/modules/customers/portal/knowledge/{article._id}" class="guide-link">
              <h2>{article.title}</h2>
              <p>{article.content?.substring?.(0, 160) || article.content}{article.content?.length > 160 ? '…' : ''}</p>
              {#if article.category}<span class="meta">{article.category}</span>{/if}
            </a>
          {:else}
            <h2>{article.title}</h2>
            <p>{article.content}</p>
          {/if}
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
    margin-bottom: 1rem;
  }

  .kb-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .kb-search {
    flex: 1;
    min-width: 200px;
    max-width: 400px;
    padding: 0.6rem 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 1rem;
  }

  .kb-category {
    padding: 0.6rem 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 1rem;
    background: white;
  }

  .kb-search:focus {
    outline: none;
    border-color: var(--brand-primary, #3b82f6);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
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
  .guide-link {
    text-decoration: none;
    color: inherit;
    display: block;
  }
  .guide-link:hover h2 {
    color: var(--brand-primary, #3b82f6);
  }

  .loading, .feature-disabled {
    max-width: 700px;
    margin: 0 auto;
    text-align: center;
    padding: 3rem 2rem;
    color: var(--brand-text-secondary, #6b7280);
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